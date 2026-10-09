/** REST handler for the volunteer hub. Mounted from worker/index.ts like handleMediaRequest. */
import type { D1Like } from "./gallery-d1";
import { createR2Storage, type MediaEnv } from "./media-r2";
import { sendEmail } from "./email";
import { createWorkerContext } from "./context";
import type { Env } from "./index";
import * as H from "./hub-d1";

export interface HubEnv extends MediaEnv { DB?: D1Like; RESEND_API_KEY?: string; EMAIL_PROVIDER_KEY?: string; PUBLIC_APP_URL?: string }
export interface HubDeps {
  now?: () => number;
  sendMail?: (to: string, subject: string, html: string) => Promise<unknown>;
  adminUser?: (request: Request) => Promise<{ role: string; isDemo?: boolean } | null>;
}

// mirrors client ROUTE_ROLES for '/admin/benevoles' (ADMIN_BASE + admin_ops)
const ADMIN_ROLES = new Set(["super_admin", "admin", "admin_ops"]);
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const STATUS: Record<H.HubErrorCode, number> = { unauthorized: 401, forbidden: 403, not_found: 404, invalid: 400, rate_limited: 429 };
const SIGN_TTL_S = 3600;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    throw new H.HubError("invalid", "JSON invalide");
  }
}
const num = (v: unknown) => (typeof v === "string" || typeof v === "number") && /^\d+$/.test(String(v)) ? Number(v) : NaN;

export async function handleHubRequest(request: Request, env: HubEnv, cors: Record<string, string>, deps: HubDeps = {}): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/hub/")) return null;
  const path = url.pathname.slice("/hub/".length).replace(/\/$/, "");
  const now = deps.now ?? Date.now;
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const match = (method: string, re: RegExp) => (request.method === method ? re.exec(path) : null);

  try {
    if (!env.DB) throw new Error("D1 binding DB is not configured");
    const d = env.DB;
    const storage = createR2Storage(env, now).from("hub");
    const sign = async (p: string | null) => (p ? ((await storage.createSignedUrl(p, SIGN_TTL_S)).data?.signedUrl ?? null) : null);
    const present = async (p: H.PostView) => ({
      ...p,
      media: await Promise.all(p.media.map(sign)),
      author: { ...p.author, avatar: await sign(p.author.avatar_key) },
    });
    const sendMail = deps.sendMail ?? ((to: string, subject: string, html: string) =>
      sendEmail({ to, subject, html, apiKey: env.RESEND_API_KEY || env.EMAIL_PROVIDER_KEY || "" }));

    const member = async () => {
      const a = request.headers.get("authorization") ?? "";
      const m = a.startsWith("Bearer ") ? await H.getSession(d, a.slice(7), now()) : null;
      if (!m) throw new H.HubError("unauthorized", "Connexion requise");
      return m;
    };
    const admin = async () => {
      const u = await (deps.adminUser ?? (async (req: Request) => (await createWorkerContext(req, env as unknown as Env)).user))(request);
      if (!u || !ADMIN_ROLES.has(u.role)) throw new H.HubError("forbidden", "Réservé aux administrateurs");
      if (u.isDemo && request.method !== "GET") throw new H.HubError("forbidden", "Mode démo en lecture seule");
    };

    let m: RegExpExecArray | null;

    // ---- session -----------------------------------------------------------
    if (match("POST", /^login$/)) {
      const email = String((await readJson(request)).email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 320) throw new H.HubError("invalid", "Email invalide");
      // same answer whether or not the email is eligible (no enumeration)
      if ((await H.isEligible(d, email)) && (await H.canRequestLogin(d, email, now()))) {
        const token = await H.createLoginToken(d, email, now());
        const base = (env.PUBLIC_APP_URL || "https://www.ftourbabrayan.ma").replace(/\/$/, "");
        const link = `${base}/fr/benevole/espace?token=${token}`;
        await sendMail(email, "Votre lien de connexion — Espace bénévole", `<p>Bonjour,</p><p>Voici votre lien de connexion à l'espace bénévole Ftour Bab Rayan (valable 15 minutes, usage unique) :</p><p><a href="${link}">Ouvrir l'espace bénévole</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`);
      }
      return json({ ok: true });
    }
    if (match("POST", /^verify$/)) {
      const token = String((await readJson(request)).token ?? "");
      return json(await H.openSession(d, token, now()));
    }
    if (match("POST", /^logout$/)) {
      const a = request.headers.get("authorization") ?? "";
      if (a.startsWith("Bearer ")) await H.revokeSession(d, a.slice(7), now());
      return json({ ok: true });
    }
    if (match("GET", /^me$/)) {
      const me = await member();
      return json({ member: { ...H.memberView(me), avatar: await sign(me.avatar_key) } });
    }
    if (match("PUT", /^me$/)) {
      const me = await member();
      const b = await readJson(request);
      const view = await H.updateProfile(d, me, {
        ...(typeof b.display_name === "string" ? { display_name: b.display_name } : {}),
        ...(typeof b.bio === "string" ? { bio: b.bio } : {}),
        ...("avatar_key" in b ? { avatar_key: typeof b.avatar_key === "string" ? b.avatar_key : null } : {}),
      });
      return json({ member: { ...view, avatar: await sign(view.avatar_key) } });
    }

    // ---- feed / posts ------------------------------------------------------
    if (match("GET", /^feed$/)) {
      const me = await member();
      const c = url.searchParams.get("cursor");
      const f = await H.feed(d, me.id, c && /^\d+$/.test(c) ? Number(c) : null);
      return json({ pinned: await Promise.all(f.pinned.map(present)), posts: await Promise.all(f.posts.map(present)), nextCursor: f.nextCursor });
    }
    if (match("POST", /^posts$/)) {
      const me = await member();
      const b = await readJson(request);
      const media = Array.isArray(b.media) ? b.media.filter((x): x is string => typeof x === "string") : [];
      return json(await H.createPost(d, me, { body: String(b.body ?? ""), mediaPaths: media }, now()));
    }
    if ((m = match("DELETE", /^posts\/(\d+)$/))) {
      await H.removeContent(d, await member(), "post", Number(m[1]));
      return json({ ok: true });
    }
    if ((m = match("POST", /^posts\/(\d+)\/like$/))) {
      const me = await member();
      return json(await H.toggleLike(d, me.id, Number(m[1])));
    }
    if ((m = match("GET", /^posts\/(\d+)\/comments$/))) {
      await member();
      const comments = await H.listComments(d, Number(m[1]));
      return json({ comments: await Promise.all(comments.map(async c => ({ ...c, author: { ...c.author, avatar: await sign(c.author.avatar_key) } }))) });
    }
    if ((m = match("POST", /^posts\/(\d+)\/comments$/))) {
      const me = await member();
      return json(await H.addComment(d, me, Number(m[1]), String((await readJson(request)).body ?? ""), now()));
    }
    if ((m = match("DELETE", /^comments\/(\d+)$/))) {
      await H.removeContent(d, await member(), "comment", Number(m[1]));
      return json({ ok: true });
    }

    // ---- media / report ----------------------------------------------------
    if (match("POST", /^media$/)) {
      const me = await member();
      const ext = EXT[String((await readJson(request)).contentType ?? "")];
      if (!ext) throw new H.HubError("invalid", "Format d'image non supporté (jpeg, png, webp, gif)");
      await H.recordUpload(d, me.id, now());
      const p = `${me.id}/${crypto.randomUUID()}.${ext}`;
      const r = await storage.createSignedUploadUrl(p);
      if (!r.data) throw new Error(r.error?.message ?? "signed upload failed");
      return json({ path: p, uploadUrl: r.data.signedUrl });
    }
    if (match("POST", /^report$/)) {
      const me = await member();
      const b = await readJson(request);
      await H.reportContent(d, me, b.type as "post" | "comment", num(b.id), String(b.reason ?? ""));
      return json({ ok: true });
    }

    // ---- admin (Supabase bearer + role) ------------------------------------
    if (match("GET", /^admin\/reports$/)) { await admin(); return json({ reports: await H.listReports(d) }); }
    if ((m = match("POST", /^admin\/reports\/(\d+)\/dismiss$/))) { await admin(); await H.dismissReport(d, Number(m[1])); return json({ ok: true }); }
    if (match("POST", /^admin\/posts$/)) {
      await admin();
      const b = await readJson(request);
      return json(await H.postAnnouncement(d, { body: String(b.body ?? ""), pinned: b.pinned === true }, now()));
    }
    if (match("POST", /^admin\/hide$/)) {
      await admin();
      const b = await readJson(request);
      await H.hideContent(d, b.type as "post" | "comment", num(b.id));
      return json({ ok: true });
    }
    if (match("GET", /^admin\/members$/)) { await admin(); return json({ members: await H.listMembers(d) }); }
    if ((m = match("PUT", /^admin\/members\/(\d+)$/))) {
      await admin();
      const b = await readJson(request);
      await H.adminUpdateMember(d, Number(m[1]), { status: b.status as any, role: b.role as any });
      return json({ ok: true });
    }

    return json({ error: "not_found", message: "Route inconnue" }, 404);
  } catch (e) {
    if (e instanceof H.HubError) return json({ error: e.code, message: e.message }, STATUS[e.code]);
    console.error("[hub]", e);
    return json({ error: "internal" }, 500);
  }
}
