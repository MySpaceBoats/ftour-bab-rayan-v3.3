/** REST handler for the volunteer hub. Mounted from worker/index.ts like handleMediaRequest. */
import { insertPhoto, type D1Like } from "./gallery-d1";
import { createR2Storage, objectKey, type MediaEnv } from "./media-r2";
import { escapeHtml, sendEmail } from "./email";
import { createWorkerContext } from "./context";
import type { Env } from "./index";
import * as H from "./hub-d1";
import * as A from "./hub-auth-d1";
import * as N from "./hub-notify";
import { appBaseUrl, emailField, id, readJson, str } from "./hub-http";
import { handleMarketRoute } from "./market";
import { handleStayRoute } from "./stay";
import { handlePro } from "./pro";

export interface HubEnv extends MediaEnv { DB?: D1Like; RESEND_API_KEY?: string; EMAIL_PROVIDER_KEY?: string; PUBLIC_APP_URL?: string }
export interface HubDeps {
  now?: () => number;
  sendMail?: (to: string, subject: string, html: string) => Promise<unknown>;
  sendBatch?: (msgs: { to: string; subject: string; html: string }[]) => Promise<unknown>;
  waitUntil?: (p: Promise<unknown>) => void;
  adminUser?: (request: Request) => Promise<{ role: string; email?: string; isDemo?: boolean } | null>;
}

// mirrors client ROUTE_ROLES for '/admin/benevoles' (ADMIN_BASE + admin_ops)
const ADMIN_ROLES = new Set(["super_admin", "admin", "admin_ops"]);
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const STATUS: Record<H.HubErrorCode, number> = { unauthorized: 401, forbidden: 403, not_found: 404, invalid: 400, rate_limited: 429 };
const SIGN_TTL_S = 3600;

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
    let signWarned = false;
    const sign = async (p: string | null) => {
      if (!p) return null;
      const r = await storage.createSignedUrl(p, SIGN_TTL_S);
      if (!r.data) {
        if (!signWarned) { signWarned = true; console.error("[hub] cannot sign media URL", r.error?.message); }
        return null;
      }
      return r.data.signedUrl ?? null;
    };
    const present = async (p: H.PostView) => ({
      ...p,
      media: await Promise.all(p.media.map(sign)),
      author: { ...p.author, avatar: await sign(p.author.avatar_key) },
    });
    const sendMail = deps.sendMail ?? ((to: string, subject: string, html: string) =>
      sendEmail({ to, subject, html, apiKey: env.RESEND_API_KEY || env.EMAIL_PROVIDER_KEY || "" }));

    const base = appBaseUrl(env);
    const mailer: N.Mailer = { ...N.mailerFromEnv(env), ...(deps.sendBatch ? { sendBatch: deps.sendBatch } : {}) };
    // Best-effort side effect (mail): runs after the response when waitUntil exists, else awaited. Never throws.
    const background = (label: string, job: () => Promise<unknown>): Promise<unknown> | void => {
      const p = job().catch(e => console.error(`[hub] ${label} failed`, e));
      if (deps.waitUntil) deps.waitUntil(p);
      else return p;
    };

    const member = async () => {
      const a = request.headers.get("authorization") ?? "";
      const m = a.startsWith("Bearer ") ? await H.getSession(d, a.slice(7), now()) : null;
      if (!m) throw new H.HubError("unauthorized", "Connexion requise");
      return m;
    };
    // Supabase site session (admin pages, volunteer "Mes photos" tab) — distinct from the hub magic-link token
    const siteUser = () => (deps.adminUser ?? (async (req: Request) => (await createWorkerContext(req, env as unknown as Env)).user))(request);
    // Bridges the site session to the same hub_members row as the magic link, by normalized email.
    const volunteer = async () => {
      const u = await siteUser();
      const email = (u?.email ?? "").trim().toLowerCase();
      if (!u || u.isDemo || !email) throw new H.HubError("unauthorized", "Connexion requise");
      if (!(await H.isEligible(d, email))) throw new H.HubError("forbidden", "Accès réservé aux bénévoles confirmés");
      const me = await H.upsertMember(d, email);
      if (me.status !== "active") throw new H.HubError("forbidden", "Compte suspendu");
      return me;
    };
    const rescueTarget = async (email: string): Promise<string | null> => {
      const owner = await A.recoveryOwner(d, email);
      return owner && (await H.isEligible(d, owner)) ? owner : null;
    };
    const who = path.startsWith("volunteer/") ? volunteer : member;
    const admin = async () => {
      const u = await siteUser();
      if (!u || u.isDemo || !ADMIN_ROLES.has(u.role)) throw new H.HubError("forbidden", "Réservé aux administrateurs");
    };

    let m: RegExpExecArray | null;

    // ---- session -----------------------------------------------------------
    if (match("POST", /^login$/)) {
      const email = emailField((await readJson(request)).email);
      // same answer whether or not the email is eligible (no enumeration). The link goes to the address typed:
      // the registration email, or a verified recovery address (rescue login for the member who owns it).
      const target = (await H.isEligible(d, email)) ? email : await rescueTarget(email);
      if (target && (await H.canRequestLogin(d, target, now()))) {
        await background("login mail", async () => {
          const token = await H.createLoginToken(d, target, now());
          const link = `${base}/fr/benevole/espace?token=${token}`;
          await sendMail(email, "Votre lien de connexion — Espace bénévole", `<p>Bonjour,</p><p>Voici votre lien de connexion à l'espace bénévole Ftour Bab Rayan (valable 15 minutes, usage unique) :</p><p><a href="${link}">Ouvrir l'espace bénévole</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`);
        });
      }
      return json({ ok: true });
    }
    if (match("POST", /^login\/password$/)) {
      const b = await readJson(request);
      const email = emailField(b.email);
      const password = str(b.password);
      if (!password || password.length > A.PASSWORD_MAX) throw new H.HubError("unauthorized", "Email ou mot de passe incorrect");
      return json(await A.loginWithPassword(d, email, password, now(), request.headers.get("cf-connecting-ip")));
    }
    if (match("GET", /^me\/security$/)) {
      const me = await member();
      return json(await A.security(d, me.id, now()));
    }
    if (match("PUT", /^me\/password$/)) {
      const me = await member();
      const b = await readJson(request);
      await A.setPassword(d, me, { current: str(b.current), password: str(b.password), keepSessionToken: (request.headers.get("authorization") ?? "").slice(7) }, now());
      await background("password notice", () => sendMail(me.email, "Votre mot de passe a été modifié — Espace bénévole", `<p>Bonjour,</p><p>Le mot de passe de votre espace bénévole Ftour Bab Rayan vient d'être modifié.</p><p>Si ce n'était pas vous, utilisez « Mot de passe oublié » sur la page de connexion ou contactez l'équipe.</p>`));
      return json({ ok: true });
    }
    if (match("PUT", /^me\/recovery$/)) {
      const me = await member();
      const email = emailField((await readJson(request)).email);
      const token = await A.requestRecovery(d, me, email, now());
      await background("recovery mail", () => sendMail(email, "Confirmez votre adresse de récupération — Espace bénévole", `<p>Bonjour,</p><p>Confirmez cette adresse comme adresse de récupération de votre espace bénévole Ftour Bab Rayan (lien valable 24 heures, usage unique) :</p><p><a href="${base}/fr/benevole/espace?recovery=${token}">Confirmer cette adresse</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`));
      return json({ ok: true, pending: email });
    }
    if (match("DELETE", /^me\/recovery$/)) {
      const me = await member();
      await A.removeRecovery(d, me.id, now());
      return json({ ok: true });
    }
    if (match("POST", /^recovery\/verify$/)) {
      const r = await A.confirmRecovery(d, str((await readJson(request)).token), now());
      await background("recovery notice", () => sendMail(r.primary_email, "Adresse de récupération ajoutée — Espace bénévole", `<p>Bonjour,</p><p>Adresse de récupération ajoutée : <strong>${escapeHtml(r.recovery_email)}</strong>.</p><p>Si ce n'était pas vous, contactez l'équipe.</p>`));
      return json({ ok: true, recovery_email: r.recovery_email });
    }
    if (match("POST", /^password\/forgot$/)) {
      const email = emailField((await readJson(request)).email);
      const r = await A.requestReset(d, email, now());
      if (r) {
        await background("reset mail", () => sendMail(r.sendTo, "Réinitialisation de votre mot de passe — Espace bénévole", `<p>Bonjour,</p><p>Pour choisir un nouveau mot de passe pour votre espace bénévole Ftour Bab Rayan (lien valable 30 minutes, usage unique) :</p><p><a href="${base}/fr/benevole/espace?reset=${r.token}">Réinitialiser mon mot de passe</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`));
      }
      return json({ ok: true });
    }
    if (match("POST", /^password\/reset$/)) {
      const b = await readJson(request);
      const r = await A.resetPassword(d, str(b.token), str(b.password), now());
      await background("reset notice", () => sendMail(r.email, "Votre mot de passe a été réinitialisé — Espace bénévole", `<p>Bonjour,</p><p>Le mot de passe de votre espace bénévole Ftour Bab Rayan vient d'être réinitialisé et vos autres sessions ont été déconnectées.</p><p>Si ce n'était pas vous, contactez l'équipe.</p>`));
      return json({ session: r.session, member: r.member });
    }
    if (match("POST", /^verify$/)) {
      const token = str((await readJson(request)).token);
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

    // ---- notifications -----------------------------------------------------
    if (match("GET", /^notifications$/)) {
      const me = await member();
      const c = url.searchParams.get("cursor");
      return json(await N.listNotifications(d, me.id, c && /^\d+$/.test(c) ? Number(c) : null));
    }
    if (match("GET", /^notifications\/unread$/)) {
      const me = await member();
      return json({ unread: await N.unreadCount(d, me.id) });
    }
    if (match("POST", /^notifications\/read$/)) {
      const me = await member();
      const b = await readJson(request);
      if (b.ids !== undefined && !Array.isArray(b.ids)) throw new H.HubError("invalid", "Identifiants invalides");
      await N.markRead(d, me.id, Array.isArray(b.ids) ? b.ids.map(id) : null, now());
      return json({ unread: await N.unreadCount(d, me.id) });
    }
    if (match("GET", /^notifications\/prefs$/)) {
      const me = await member();
      return json({ prefs: await N.getPrefs(d, me.id) });
    }
    if (match("PUT", /^notifications\/prefs$/)) {
      const me = await member();
      return json({ prefs: await N.setPrefs(d, me.id, await readJson(request)) });
    }

    if ((m = match("GET", /^members\/(\d+)$/))) {
      await member();
      const view = await H.publicMember(d, id(m[1]));
      const photos = await H.memberPhotos(d, view.id);
      return json({
        member: { ...view, avatar: await sign(view.avatar_key) },
        photos: await Promise.all(photos.map(async p => ({ ...p, url: await sign(p.path) }))),
      });
    }

    // ---- feed / posts ------------------------------------------------------
    if (match("GET", /^feed$/)) {
      const me = await member();
      const c = url.searchParams.get("cursor");
      const f = await H.feed(d, me.id, c && /^\d+$/.test(c) ? Number(c) : null);
      return json({ pinned: await Promise.all(f.pinned.map(present)), posts: await Promise.all(f.posts.map(present)), nextCursor: f.nextCursor });
    }
    if (match("POST", /^(?:volunteer\/)?posts$/)) {
      const me = await who();
      const b = await readJson(request);
      const media = Array.isArray(b.media) ? b.media.filter((x): x is string => typeof x === "string") : [];
      return json(await H.createPost(d, me, { body: str(b.body), mediaPaths: media }, now()));
    }
    if ((m = match("DELETE", /^posts\/(\d+)$/))) {
      await H.removeContent(d, await member(), "post", id(m[1]));
      return json({ ok: true });
    }
    if ((m = match("POST", /^posts\/(\d+)\/like$/))) {
      const me = await member();
      const postId = id(m[1]);
      const r = await H.toggleLike(d, me.id, postId);
      if (r.liked) await background("notify like", () => N.onLike(d, mailer, me, postId, now()));
      return json(r);
    }
    if ((m = match("GET", /^posts\/(\d+)\/comments$/))) {
      await member();
      const comments = await H.listComments(d, id(m[1]));
      return json({ comments: await Promise.all(comments.map(async c => ({ ...c, author: { ...c.author, avatar: await sign(c.author.avatar_key) } }))) });
    }
    if ((m = match("POST", /^posts\/(\d+)\/comments$/))) {
      const me = await member();
      const postId = id(m[1]);
      const text = str((await readJson(request)).body);
      const r = await H.addComment(d, me, postId, text, now());
      await background("notify comment", () => N.onComment(d, mailer, me, postId, r.id, text.trim(), now()));
      return json(r);
    }
    if ((m = match("DELETE", /^comments\/(\d+)$/))) {
      await H.removeContent(d, await member(), "comment", id(m[1]));
      return json({ ok: true });
    }

    // ---- media / report ----------------------------------------------------
    if (match("POST", /^(?:volunteer\/)?media$/)) {
      const me = await who();
      const ext = EXT[str((await readJson(request)).contentType)];
      if (!ext) throw new H.HubError("invalid", "Format d'image non supporté (jpeg, png, webp, gif)");
      await H.recordUpload(d, me.id, now());
      const p = `${me.id}/${crypto.randomUUID()}.${ext}`;
      const r = await storage.createSignedUploadUrl(p);
      if (!r.data) throw new Error(r.error?.message ?? "signed upload failed");
      return json({ path: p, uploadUrl: r.data.signedUrl });
    }
    if (match("GET", /^volunteer\/photos$/)) {
      const me = await volunteer();
      const photos = await H.memberPhotos(d, me.id);
      return json({ photos: await Promise.all(photos.map(async p => ({ ...p, url: await sign(p.path) }))) });
    }
    if (match("POST", /^volunteer\/photos\/propose$/)) {
      const me = await volunteer();
      const path = str((await readJson(request)).path);
      // Copies the private hub object to the public gallery key and inserts a DRAFT row: no validation token, so only admin moderation can publish it.
      const publish = async (caption: string) => {
        if (!env.GALLERY_MEDIA) throw new Error("R2 binding GALLERY_MEDIA is not configured");
        const obj = await env.GALLERY_MEDIA.get(objectKey("hub", path));
        const type = obj?.httpMetadata?.contentType ?? "";
        if (!obj || !EXT[type]) throw new H.HubError("not_found", "Photo introuvable");
        const bytes = new Uint8Array(await new Response(obj.body).arrayBuffer());
        const key = `gallery/original/${crypto.randomUUID()}.${EXT[type]}`;
        await env.GALLERY_MEDIA.put(key, bytes, { httpMetadata: { contentType: type } });
        try {
          const photo = await insertPhoto(d, {
            description: caption, eventDate: null, tags: [], sortOrder: 0, isFeatured: false, status: "draft",
            storagePath: key, sizeBytes: bytes.byteLength, mimeType: type, uploadedBy: me.email,
            validationEmail: null, validationToken: null, validated: false,
          }, url.origin);
          return photo!.id as string;
        } catch (e) {
          await env.GALLERY_MEDIA.delete(key).catch(() => {});
          throw e;
        }
      };
      return json(await H.proposeToGallery(d, me, path, now(), publish));
    }
    if (match("POST", /^report$/)) {
      const me = await member();
      const b = await readJson(request);
      await H.reportContent(d, me, b.type as "post" | "comment", id(b.id), str(b.reason));
      return json({ ok: true });
    }

    // ---- admin (Supabase bearer + role) ------------------------------------
    if (match("GET", /^admin\/reports$/)) { await admin(); return json({ reports: await H.listReports(d) }); }
    if ((m = match("POST", /^admin\/reports\/(\d+)\/dismiss$/))) { await admin(); await H.dismissReport(d, id(m[1])); return json({ ok: true }); }
    if (match("POST", /^admin\/posts$/)) {
      await admin();
      const b = await readJson(request);
      const text = str(b.body);
      const r = await H.postAnnouncement(d, { body: text, pinned: b.pinned === true }, now());
      await background("notify announcement", () => N.onAnnouncement(d, mailer, r.id, text.trim(), now()));
      return json(r);
    }
    if (match("POST", /^admin\/hide$/)) {
      await admin();
      const b = await readJson(request);
      await H.hideContent(d, b.type as "post" | "comment", id(b.id));
      return json({ ok: true });
    }
    if (match("GET", /^admin\/members$/)) { await admin(); return json({ members: await H.listMembers(d) }); }
    if ((m = match("PUT", /^admin\/members\/(\d+)$/))) {
      await admin();
      const b = await readJson(request);
      await H.adminUpdateMember(d, id(m[1]), { status: b.status as any, role: b.role as any });
      return json({ ok: true });
    }

    // ---- marketplace -------------------------------------------------------
    if (path.startsWith("market/")) {
      const r = await handleMarketRoute({ d, request, url, path: path.slice("market/".length), now, json, member, admin, sign });
      if (r) return r;
    }

    // ---- hébergement (façon Airbnb) ----------------------------------------
    if (path.startsWith("stay/")) {
      const r = await handleStayRoute({ d, request, url, path: path.slice("stay/".length), now, json, member, admin, sign });
      if (r) return r;
    }

    // ---- professional network ----------------------------------------------
    if (path.startsWith("pro/")) {
      const r = await handlePro({ d, request, url, path: path.slice("pro/".length), now, json, member, admin, sign });
      if (r) return r;
    }

    return json({ error: "not_found", message: "Route inconnue" }, 404);
  } catch (e) {
    if (e instanceof H.HubError) return json({ error: e.code, message: e.message }, STATUS[e.code]);
    console.error("[hub]", e);
    return json({ error: "internal" }, 500);
  }
}
