import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import { handleHubRequest, type HubDeps, type HubEnv } from "./hub";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

function fakeD1(sqlite: InstanceType<typeof DatabaseSync>): D1Like {
  const stmt = (sql: string, params: unknown[] = []): D1Stmt => ({
    bind: (...v) => stmt(sql, v),
    all: async () => ({ results: sqlite.prepare(sql).all(...(params as any[])) as any[] }),
    first: async () => ((sqlite.prepare(sql).get(...(params as any[])) as any) ?? null),
    run: async () => sqlite.prepare(sql).run(...(params as any[])),
  });
  return {
    prepare: sql => stmt(sql),
    batch: async s => {
      sqlite.exec("BEGIN");
      try { for (const x of s) await x.run(); sqlite.exec("COMMIT"); } catch (e) { sqlite.exec("ROLLBACK"); throw e; }
      return [];
    },
  };
}

const CORS = { "Access-Control-Allow-Origin": "https://www.ftourbabrayan.ma" };
const T0 = Date.parse("2026-10-09T12:00:00.000Z");
let sqlite: InstanceType<typeof DatabaseSync>;
let env: HubEnv;
let mails: { to: string; subject: string; html: string }[];
let clock: number;

let extra: Partial<HubDeps> = {};
const deps = (): HubDeps => ({
  ...extra,
  now: () => clock,
  sendMail: async (to, subject, html) => { mails.push({ to, subject, html }); },
  adminUser: async req => {
    const site = req.headers.get("x-site");
    if (site) return site === "demo" ? { role: "super_admin", email: "demo@ftourbabrayan.local", isDemo: true } : { role: "user", email: site };
    const r = req.headers.get("x-admin");
    return r ? { role: r === "demo" ? "super_admin" : r, isDemo: r === "demo" } : null;
  },
});

async function call(method: string, path: string, o: { token?: string; admin?: string; site?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (o.site) headers["x-site"] = o.site;
  if (o.token) headers.authorization = `Bearer ${o.token}`;
  if (o.admin) headers["x-admin"] = o.admin;
  if (o.body !== undefined) headers["content-type"] = "application/json";
  const res = await handleHubRequest(new Request(`https://w.test${path}`, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) }), env, CORS, deps());
  return res!;
}
const tokenFromMail = () => /token=([a-f0-9]{64})/.exec(mails[mails.length - 1].html)![1];

async function signIn(email = "a@x.ma") {
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('Amina','Benali',?, 'confirmed')").run(email);
  await call("POST", "/hub/login", { body: { email } });
  const v = await call("POST", "/hub/verify", { body: { token: tokenFromMail() } });
  return (await v.json()) as { session: string; member: { id: number } };
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE t_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, status TEXT);");
  sqlite.exec(readFileSync(new URL("./d1/hub.sql", import.meta.url), "utf8"));
  env = { DB: fakeD1(sqlite), JWT_SECRET: "test-secret", MEDIA_BASE_URL: "https://m.test", GALLERY_MEDIA: undefined, PUBLIC_APP_URL: "https://site.test" };
  mails = [];
  clock = T0;
  extra = {};
});

describe("hub http", () => {
  it("ignores non-hub paths; unknown hub path is 404; CORS is applied; bad JSON is 400", async () => {
    expect(await handleHubRequest(new Request("https://w.test/api/trpc"), env, CORS, deps())).toBeNull();
    const r = await call("GET", "/hub/nope");
    expect(r.status).toBe(404);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(CORS["Access-Control-Allow-Origin"]);
    const bad = await handleHubRequest(new Request("https://w.test/hub/login", { method: "POST", body: "{nope" }), env, CORS, deps());
    expect(bad!.status).toBe(400);
  });

  it("login: same answer for unknown/ineligible, no mail; eligible gets one mail with a 15-min link; 3/h cap", async () => {
    sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('N','B','new@x.ma','registered')").run();
    for (const email of ["nobody@x.ma", "new@x.ma"]) {
      const r = await call("POST", "/hub/login", { body: { email } });
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ ok: true });
    }
    expect(mails).toHaveLength(0);
    expect((await call("POST", "/hub/login", { body: { email: "not-an-email" } })).status).toBe(400);
    sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('A','B','a@x.ma','confirmed')").run();
    for (let i = 0; i < 5; i++) expect((await call("POST", "/hub/login", { body: { email: "a@x.ma" } })).status).toBe(200);
    expect(mails).toHaveLength(3);
    expect(mails[0].to).toBe("a@x.ma");
    expect(mails[0].html).toContain("https://site.test/fr/benevole/espace?token=");
  });

  it("verify opens a session usable on /hub/me; token is single-use; logout revokes", async () => {
    const { session, member } = await signIn();
    const me = await call("GET", "/hub/me", { token: session });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ member: { id: member.id, display_name: "Amina B." } });
    expect((await call("POST", "/hub/verify", { body: { token: tokenFromMail() } })).status).toBe(401);
    expect((await call("GET", "/hub/me")).status).toBe(401);
    expect((await call("POST", "/hub/logout", { token: session })).status).toBe(200);
    expect((await call("GET", "/hub/me", { token: session })).status).toBe(401);
  });

  it("a suspended member gets 401 on the next request", async () => {
    const { session, member } = await signIn();
    sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id=?").run(member.id);
    expect((await call("GET", "/hub/feed", { token: session })).status).toBe(401);
  });

  it("post, feed with signed photo URL, like, comment, delete", async () => {
    const { session, member } = await signIn();
    const up = await call("POST", "/hub/media", { token: session, body: { contentType: "image/jpeg" } });
    const { path, uploadUrl } = (await up.json()) as { path: string; uploadUrl: string };
    expect(path).toMatch(new RegExp(`^${member.id}/[0-9a-f-]{36}\\.jpg$`));
    expect(uploadUrl).toContain(`https://m.test/media-upload/private/hub/${path}?exp=`);
    expect((await call("POST", "/hub/media", { token: session, body: { contentType: "text/html" } })).status).toBe(400);

    const created = await call("POST", "/hub/posts", { token: session, body: { body: "Salam <script>alert(1)</script>", media: [path] } });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: number };
    const feed = (await (await call("GET", "/hub/feed", { token: session })).json()) as any;
    expect(feed.posts[0].body).toBe("Salam <script>alert(1)</script>");
    expect(feed.posts[0].media[0]).toContain(`https://m.test/media-signed/private/hub/${path}?exp=`);

    expect(await (await call("POST", `/hub/posts/${id}/like`, { token: session })).json()).toEqual({ liked: true, count: 1 });
    const c = await call("POST", `/hub/posts/${id}/comments`, { token: session, body: { body: "bravo" } });
    expect(c.status).toBe(200);
    const comments = (await (await call("GET", `/hub/posts/${id}/comments`, { token: session })).json()) as any;
    expect(comments.comments[0]).toMatchObject({ body: "bravo" });
    expect((await call("DELETE", `/hub/comments/${comments.comments[0].id}`, { token: session })).status).toBe(200);
    expect((await call("DELETE", `/hub/posts/${id}`, { token: session })).status).toBe(200);
    expect(((await (await call("GET", "/hub/feed", { token: session })).json()) as any).posts).toEqual([]);
  });

  it("refuses another member's photo path and path traversal", async () => {
    const { session } = await signIn();
    expect((await call("POST", "/hub/posts", { token: session, body: { body: "x", media: ["999/a.jpg"] } })).status).toBe(400);
    expect((await call("POST", "/hub/posts", { token: session, body: { body: "x", media: ["1/../a.jpg"] } })).status).toBe(400);
  });

  it("profile update through PUT /hub/me", async () => {
    const { session } = await signIn();
    const r = await call("PUT", "/hub/me", { token: session, body: { display_name: "Nadia", bio: "Hi" } });
    expect(await r.json()).toMatchObject({ member: { display_name: "Nadia", bio: "Hi" } });
  });

  it("report flow and admin gate", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma");
    const { id } = (await (await call("POST", "/hub/posts", { token: a.session, body: { body: "bad" } })).json()) as { id: number };
    expect((await call("POST", "/hub/report", { token: b.session, body: { type: "post", id, reason: "spam" } })).status).toBe(200);

    expect((await call("GET", "/hub/admin/reports")).status).toBe(403);
    expect((await call("GET", "/hub/admin/reports", { admin: "user" })).status).toBe(403);
    const reports = (await (await call("GET", "/hub/admin/reports", { admin: "admin_ops" })).json()) as any;
    expect(reports.reports[0]).toMatchObject({ target_id: id, reason: "spam" });

    expect((await call("POST", "/hub/admin/hide", { admin: "admin", body: { type: "post", id } })).status).toBe(200);
    expect(((await (await call("GET", "/hub/feed", { token: b.session })).json()) as any).posts).toEqual([]);
    expect((await call("POST", `/hub/admin/reports/${reports.reports[0].id}/dismiss`, { admin: "admin" })).status).toBe(200);
  });

  it("admin announcements and member control; demo access is refused", async () => {
    const a = await signIn();
    expect((await call("POST", "/hub/admin/posts", { admin: "demo", body: { body: "x", pinned: true } })).status).toBe(403);
    expect((await call("GET", "/hub/admin/members", { admin: "demo" })).status).toBe(403);
    expect((await call("GET", "/hub/admin/reports", { admin: "demo" })).status).toBe(403);
    expect((await call("POST", "/hub/admin/posts", { admin: "admin", body: { body: "Réunion", pinned: true } })).status).toBe(200);
    const feed = (await (await call("GET", "/hub/feed", { token: a.session })).json()) as any;
    expect(feed.pinned[0]).toMatchObject({ body: "Réunion", kind: "announcement" });
    const members = (await (await call("GET", "/hub/admin/members", { admin: "admin" })).json()) as any;
    expect(members.members[0].email).toBe("a@x.ma");
    expect((await call("PUT", `/hub/admin/members/${a.member.id}`, { admin: "admin", body: { status: "suspended" } })).status).toBe(200);
    expect((await call("GET", "/hub/me", { token: a.session })).status).toBe(401);
    expect((await call("PUT", `/hub/admin/members/${a.member.id}`, { admin: "admin", body: { status: "nope" } })).status).toBe(400);
  });
});

describe("hub http hardening", () => {
  const login = (email = "a@x.ma") => call("POST", "/hub/login", { body: { email } });
  const seed = () => sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('A','B','a@x.ma','confirmed')").run();

  it("login: sendMail throwing still gives 200 {ok:true}", async () => {
    seed();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    extra = { sendMail: async () => { throw new Error("resend down"); } };
    const r = await login();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    spy.mockRestore();
  });

  it("login: with waitUntil the handler returns before the job; mail sent once awaited", async () => {
    seed();
    let job: Promise<unknown> | undefined;
    extra = { waitUntil: p => { job = p; } };
    const r = await login();
    expect(await r.json()).toEqual({ ok: true });
    expect(job).toBeInstanceOf(Promise);
    await job;
    expect(mails).toHaveLength(1);
  });

  it("missing JWT_SECRET: feed still 200 with null media, error logged once", async () => {
    const { session, member } = await signIn();
    const up = (await (await call("POST", "/hub/media", { token: session, body: { contentType: "image/png" } })).json()) as { path: string };
    await call("POST", "/hub/posts", { token: session, body: { body: "p", media: [up.path] } });
    env = { ...env, JWT_SECRET: undefined } as HubEnv;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await call("GET", "/hub/feed", { token: session });
    expect(r.status).toBe(200);
    expect(((await r.json()) as any).posts[0].media).toEqual([null]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect(member.id).toBeGreaterThan(0);
  });

  it("non-string text fields are 400", async () => {
    const { session } = await signIn();
    expect((await call("POST", "/hub/posts", { token: session, body: { body: {} } })).status).toBe(400);
    expect((await call("POST", "/hub/posts", { token: session, body: { body: 5 } })).status).toBe(400);
  });

  it("unsafe or non-numeric ids are 400", async () => {
    const { session } = await signIn();
    for (const id of [99999999999999999999, "abc"])
      expect((await call("POST", "/hub/report", { token: session, body: { type: "post", id, reason: "x" } })).status).toBe(400);
    expect((await call("GET", "/hub/posts/99999999999999999999/comments", { token: session })).status).toBe(400);
  });
});

describe("volunteer photos via site session", () => {
  const seedVol = (email: string, status = "confirmed") =>
    sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('Amina','Benali',?,?)").run(email, status);
  const jpeg = { contentType: "image/jpeg" };

  it("confirmed volunteer (mixed-case email) gets media upload; hub member created for lowercase email", async () => {
    seedVol("Mixed@X.ma");
    const r = await call("POST", "/hub/volunteer/media", { site: "Mixed@X.ma", body: jpeg });
    expect(r.status).toBe(200);
    const { path } = (await r.json()) as { path: string };
    const row = sqlite.prepare("SELECT id FROM hub_members WHERE email = 'mixed@x.ma'").get() as { id: number };
    expect(row).toBeTruthy();
    expect(path).toMatch(new RegExp(`^${row.id}/`));
  });

  it("site session and magic link resolve to the same member", async () => {
    const { member } = await signIn("a@x.ma");
    const { path } = (await (await call("POST", "/hub/volunteer/media", { site: "A@x.ma", body: jpeg })).json()) as { path: string };
    expect(path.startsWith(`${member.id}/`)).toBe(true);
  });

  it("rejects missing, ineligible, demo and suspended site users without writing uploads", async () => {
    seedVol("reg@x.ma", "registered");
    expect((await call("POST", "/hub/volunteer/media", { body: jpeg })).status).toBe(401);
    expect((await call("POST", "/hub/volunteer/media", { site: "reg@x.ma", body: jpeg })).status).toBe(403);
    expect((await call("POST", "/hub/volunteer/media", { site: "unknown@x.ma", body: jpeg })).status).toBe(403);
    expect((await call("POST", "/hub/volunteer/media", { site: "demo", body: jpeg })).status).toBe(401);
    const { member } = await signIn("s@x.ma");
    sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id=?").run(member.id);
    expect((await call("POST", "/hub/volunteer/media", { site: "s@x.ma", body: jpeg })).status).toBe(403);
    expect((sqlite.prepare("SELECT COUNT(*) AS n FROM hub_uploads").get() as { n: number }).n).toBe(0);
  });

  it("shares a post visible in the feed and listed in own photos", async () => {
    seedVol("a@x.ma");
    const other = await signIn("b@x.ma");
    const { path } = (await (await call("POST", "/hub/volunteer/media", { site: "a@x.ma", body: jpeg })).json()) as { path: string };
    const p = await call("POST", "/hub/volunteer/posts", { site: "a@x.ma", body: { body: "Soirée", media: [path] } });
    expect(p.status).toBe(200);
    const feed = (await (await call("GET", "/hub/feed", { token: other.session })).json()) as any;
    expect(feed.posts[0]).toMatchObject({ body: "Soirée" });
    expect(feed.posts[0].media).toHaveLength(1);
    const mine = (await (await call("GET", "/hub/volunteer/photos", { site: "a@x.ma" })).json()) as any;
    expect(mine.photos).toHaveLength(1);
    expect(mine.photos[0]).toMatchObject({ path, post_id: (await p.json() as any).id });
    expect(mine.photos[0].url).toContain("https://m.test/media-signed/private/hub/");
  });

  it("deleting the post empties the photo list", async () => {
    const a = await signIn("a@x.ma");
    const { path } = (await (await call("POST", "/hub/volunteer/media", { site: "a@x.ma", body: jpeg })).json()) as { path: string };
    const { id } = (await (await call("POST", "/hub/volunteer/posts", { site: "a@x.ma", body: { body: "x", media: [path] } })).json()) as { id: number };
    expect((await call("DELETE", `/hub/posts/${id}`, { token: a.session })).status).toBe(200);
    expect(((await (await call("GET", "/hub/volunteer/photos", { site: "a@x.ma" })).json()) as any).photos).toEqual([]);
  });

  it("refuses someone else's path via volunteer/posts", async () => {
    seedVol("a@x.ma");
    expect((await call("POST", "/hub/volunteer/posts", { site: "a@x.ma", body: { body: "x", media: ["999/a.jpg"] } })).status).toBe(400);
  });

  it("site session cannot reach other hub routes", async () => {
    seedVol("a@x.ma");
    expect((await call("GET", "/hub/feed", { site: "a@x.ma" })).status).toBe(401);
  });
});
