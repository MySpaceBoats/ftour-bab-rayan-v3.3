import { beforeEach, describe, expect, it } from "vitest";
import { fakeD1, openDb, type Sqlite } from "./test-d1";
import { handleHubRequest, type HubDeps, type HubEnv } from "./hub";

const CORS = { "Access-Control-Allow-Origin": "https://www.ftourbabrayan.ma" };
const T0 = Date.parse("2026-10-10T12:00:00.000Z");
let sqlite: Sqlite;
let env: HubEnv;
let mails: string[];
let clock: number;

const deps = (): HubDeps => ({
  now: () => clock,
  sendMail: async (_to, _s, html) => { mails.push(html); },
  adminUser: async req => {
    const r = req.headers.get("x-admin");
    return r ? { role: r === "demo" ? "super_admin" : r, isDemo: r === "demo" } : null;
  },
});

async function call(method: string, path: string, o: { token?: string; admin?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (o.token) headers.authorization = `Bearer ${o.token}`;
  if (o.admin) headers["x-admin"] = o.admin;
  if (o.body !== undefined) headers["content-type"] = "application/json";
  const res = await handleHubRequest(new Request(`https://w.test${path}`, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) }), env, CORS, deps());
  return res!;
}

async function signIn(email: string, first = "Amina") {
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?,'confirmed')").run(first, "Benali", email);
  await call("POST", "/hub/login", { body: { email } });
  const token = /token=([a-f0-9]{64})/.exec(mails[mails.length - 1])![1];
  const v = (await (await call("POST", "/hub/verify", { body: { token } })).json()) as { session: string; member: { id: number } };
  return { session: v.session, id: v.member.id };
}

beforeEach(() => {
  sqlite = openDb();
  env = { DB: fakeD1(sqlite), JWT_SECRET: "test-secret", MEDIA_BASE_URL: "https://m.test", GALLERY_MEDIA: undefined, PUBLIC_APP_URL: "https://site.test" };
  mails = [];
  clock = T0;
});

describe("pro http: auth", () => {
  it("requires a member session", async () => {
    for (const [m, p] of [["GET", "/hub/pro/feed"], ["POST", "/hub/pro/posts"], ["GET", "/hub/pro/profile/1"], ["PUT", "/hub/pro/profile"], ["POST", "/hub/pro/report"]])
      expect((await call(m, p)).status).toBe(401);
  });
  it("admin routes: 403 without role or in demo mode, 200 for an admin", async () => {
    expect((await call("GET", "/hub/pro/admin/reports")).status).toBe(403);
    expect((await call("GET", "/hub/pro/admin/reports", { admin: "demo" })).status).toBe(403);
    expect((await call("GET", "/hub/pro/admin/reports", { admin: "admin" })).status).toBe(200);
  });
  it("unknown pro route is 404", async () => {
    const a = await signIn("a@x.ma");
    expect((await call("GET", "/hub/pro/nope", { token: a.session })).status).toBe(404);
  });
});

describe("pro http: profile and feed", () => {
  it("saves and reads a profile", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    const put = await call("PUT", "/hub/pro/profile", { token: a.session, body: { headline: "Dev", skills: ["React"], open_to_work: true } });
    expect(put.status).toBe(200);
    const got = (await (await call("GET", `/hub/pro/profile/${a.id}`, { token: b.session })).json()) as any;
    expect(got.profile).toMatchObject({ headline: "Dev", skills: ["React"], open_to_work: true, mine: false, member: { id: a.id } });
    expect(JSON.stringify(got)).not.toContain("@");
    expect((await call("GET", "/hub/pro/profile/999", { token: b.session })).status).toBe(404);
    expect((await call("GET", "/hub/pro/profile/abc", { token: b.session })).status).toBe(404); // not matched by the route
  });

  it("posts, likes, comments and reads the feed", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    const created = await call("POST", "/hub/pro/posts", { token: a.session, body: { body: "Salut", link: "https://example.com" } });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: number };
    expect((await (await call("POST", `/hub/pro/posts/${id}/like`, { token: b.session })).json())).toEqual({ liked: true, count: 1 });
    expect((await call("POST", `/hub/pro/posts/${id}/comments`, { token: b.session, body: { body: "bravo" } })).status).toBe(200);
    const feed = (await (await call("GET", "/hub/pro/feed", { token: b.session })).json()) as any;
    expect(feed.posts[0]).toMatchObject({ id, body: "Salut", link: "https://example.com/", like_count: 1, comment_count: 1, liked: true, author: { id: a.id } });
    expect(JSON.stringify(feed)).not.toContain("@");
    const comments = (await (await call("GET", `/hub/pro/posts/${id}/comments`, { token: b.session })).json()) as any;
    expect(comments.comments).toHaveLength(1);
  });

  it("rejects dangerous links, bad JSON and foreign deletes", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    expect((await call("POST", "/hub/pro/posts", { token: a.session, body: { body: "x", link: "javascript:alert(1)" } })).status).toBe(400);
    const res = await handleHubRequest(new Request("https://w.test/hub/pro/posts", { method: "POST", headers: { authorization: `Bearer ${a.session}` }, body: "{oops" }), env, CORS, deps());
    expect(res!.status).toBe(400);
    const { id } = (await (await call("POST", "/hub/pro/posts", { token: a.session, body: { body: "mien" } })).json()) as { id: number };
    expect((await call("DELETE", `/hub/pro/posts/${id}`, { token: b.session })).status).toBe(403);
    expect((await call("DELETE", `/hub/pro/posts/${id}`, { token: a.session })).status).toBe(200);
  });

  it("report then admin hide removes the post from the feed", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    const { id } = (await (await call("POST", "/hub/pro/posts", { token: a.session, body: { body: "spam" } })).json()) as { id: number };
    expect((await call("POST", "/hub/pro/report", { token: b.session, body: { type: "post", id, reason: "spam" } })).status).toBe(200);
    expect((await call("POST", "/hub/pro/report", { token: b.session, body: { type: "member", id, reason: "x" } })).status).toBe(400);
    const reports = (await (await call("GET", "/hub/pro/admin/reports", { admin: "admin" })).json()) as any;
    expect(reports.reports).toHaveLength(1);
    expect((await call("POST", "/hub/pro/admin/hide", { admin: "admin", body: { type: "post", id } })).status).toBe(200);
    expect(((await (await call("GET", "/hub/pro/feed", { token: b.session })).json()) as any).posts).toEqual([]);
    expect((await call("POST", `/hub/pro/admin/reports/${reports.reports[0].id}/dismiss`, { admin: "admin" })).status).toBe(200);
  });
});

const jobBody = (over: Record<string, unknown> = {}) => ({ title: "Dev React", company: "Acme", city: "Rabat", type: "cdi", description: "On recrute", contact: "rh@acme.ma", ...over });

describe("pro http: jobs", () => {
  it("requires a member session", async () => {
    for (const [m, p] of [["GET", "/hub/pro/jobs"], ["POST", "/hub/pro/jobs"], ["GET", "/hub/pro/jobs/1"], ["PUT", "/hub/pro/jobs/1"], ["DELETE", "/hub/pro/jobs/1"]])
      expect((await call(m, p)).status).toBe(401);
  });

  it("creates, lists, reads, edits, closes and removes a job", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    const created = await call("POST", "/hub/pro/jobs", { token: a.session, body: jobBody() });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: number };

    const list = (await (await call("GET", "/hub/pro/jobs?type=cdi&city=rabat&q=react", { token: b.session })).json()) as any;
    expect(list.jobs).toHaveLength(1);
    expect(list.jobs[0]).toMatchObject({ id, title: "Dev React", poster: { id: a.id } });
    expect(list.jobs[0].description).toBeUndefined();

    const detail = (await (await call("GET", `/hub/pro/jobs/${id}`, { token: b.session })).json()) as any;
    expect(detail.job).toMatchObject({ id, description: "On recrute", contact: "rh@acme.ma", mine: false, poster: { id: a.id } });
    expect(JSON.stringify(detail.job)).not.toMatch(/a@x\.ma|b@x\.ma/);

    expect((await call("PUT", `/hub/pro/jobs/${id}`, { token: b.session, body: jobBody() })).status).toBe(403);
    expect((await call("PUT", `/hub/pro/jobs/${id}`, { token: a.session, body: jobBody({ title: "Lead React" }) })).status).toBe(200);
    expect((await call("POST", `/hub/pro/jobs/${id}/status`, { token: a.session, body: { status: "closed" } })).status).toBe(200);
    expect(((await (await call("GET", "/hub/pro/jobs", { token: b.session })).json()) as any).jobs).toEqual([]);
    expect(((await (await call("GET", "/hub/pro/jobs?mine=1", { token: a.session })).json()) as any).jobs).toHaveLength(1);
    expect((await call("POST", `/hub/pro/jobs/${id}/status`, { token: a.session, body: { status: "hidden" } })).status).toBe(400);

    expect((await call("DELETE", `/hub/pro/jobs/${id}`, { token: b.session })).status).toBe(403);
    expect((await call("DELETE", `/hub/pro/jobs/${id}`, { token: a.session })).status).toBe(200);
    expect((await call("GET", `/hub/pro/jobs/${id}`, { token: b.session })).status).toBe(404);
  });

  it("returns 400 on invalid input and 429 past the daily limit", async () => {
    const a = await signIn("a@x.ma");
    expect((await call("POST", "/hub/pro/jobs", { token: a.session, body: jobBody({ type: "interim" }) })).status).toBe(400);
    expect((await call("GET", "/hub/pro/jobs?type=interim", { token: a.session })).status).toBe(400);
    for (let i = 0; i < 3; i++) expect((await call("POST", "/hub/pro/jobs", { token: a.session, body: jobBody() })).status).toBe(200);
    expect((await call("POST", "/hub/pro/jobs", { token: a.session, body: jobBody() })).status).toBe(429);
  });

  it("report + admin: list jobs, hide", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    const { id } = (await (await call("POST", "/hub/pro/jobs", { token: a.session, body: jobBody() })).json()) as { id: number };
    expect((await call("POST", "/hub/pro/report", { token: b.session, body: { type: "job", id, reason: "arnaque" } })).status).toBe(200);
    expect((await call("GET", "/hub/pro/admin/jobs")).status).toBe(403);
    expect(((await (await call("GET", "/hub/pro/admin/jobs", { admin: "admin" })).json()) as any).jobs[0]).toMatchObject({ id, status: "open" });
    expect((await call("POST", "/hub/pro/admin/hide", { admin: "admin", body: { type: "job", id } })).status).toBe(200);
    expect((await call("GET", `/hub/pro/jobs/${id}`, { token: b.session })).status).toBe(404);
  });
});
