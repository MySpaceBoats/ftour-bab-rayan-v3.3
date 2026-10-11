import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import * as S from "./social-d1";
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
const T0 = Date.parse("2026-10-10T12:00:00.000Z");
let sqlite: InstanceType<typeof DatabaseSync>;
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
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?, 'confirmed')").run(first, "Benali", email);
  await call("POST", "/hub/login", { body: { email } });
  const token = /token=([a-f0-9]{64})/.exec(mails[mails.length - 1])![1];
  const v = (await (await call("POST", "/hub/verify", { body: { token } })).json()) as { session: string; member: { id: number } };
  return { session: v.session, id: v.member.id };
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE t_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, status TEXT);");
  for (const f of ["hub.sql", "social.sql"]) sqlite.exec(readFileSync(new URL(`./d1/${f}`, import.meta.url), "utf8"));
  env = { DB: fakeD1(sqlite), JWT_SECRET: "test-secret", MEDIA_BASE_URL: "https://m.test", GALLERY_MEDIA: undefined, PUBLIC_APP_URL: "https://site.test" };
  mails = [];
  clock = T0;
});


const ids = async () => { const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim"); const c = await signIn("c@x.ma", "Chaima"); return { a, b, c }; };

describe("social data: friendships", () => {
  it("request -> accept creates one accepted row and mutual follows", async () => {
    const { a, b } = await ids();
    expect(await S.requestFriend(env.DB, a.id, b.id, clock)).toEqual({ friendship: "sent" });
    expect((await S.relation(env.DB, b.id, a.id)).friendship).toBe("received");
    await S.acceptFriend(env.DB, b.id, a.id, clock);
    expect((await S.relation(env.DB, a.id, b.id))).toMatchObject({ friendship: "friends", following: true });
    expect((await S.relation(env.DB, b.id, a.id))).toMatchObject({ friendship: "friends", following: true, friends_count: 1, followers_count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_friendships").get()).toEqual({ n: 1 });
  });
  it("crossed request accepts instead of duplicating", async () => {
    const { a, b } = await ids();
    await S.requestFriend(env.DB, a.id, b.id, clock);
    expect(await S.requestFriend(env.DB, b.id, a.id, clock)).toEqual({ friendship: "friends" });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_friendships").get()).toEqual({ n: 1 });
  });
  it("duplicates and strangers", async () => {
    const { a, b, c } = await ids();
    await S.requestFriend(env.DB, a.id, b.id, clock);
    await expect(S.requestFriend(env.DB, a.id, b.id, clock)).rejects.toMatchObject({ code: "conflict" });
    await expect(S.requestFriend(env.DB, a.id, a.id, clock)).rejects.toMatchObject({ code: "not_found" });
    await expect(S.acceptFriend(env.DB, c.id, a.id, clock)).rejects.toMatchObject({ code: "not_found" });
    await expect(S.acceptFriend(env.DB, a.id, b.id, clock)).rejects.toMatchObject({ code: "not_found" }); // sender cannot accept
    await expect(S.declineFriend(env.DB, c.id, a.id)).rejects.toMatchObject({ code: "not_found" });
  });
  it("decline, cancel and unfriend delete the row", async () => {
    const { a, b, c } = await ids();
    await S.requestFriend(env.DB, a.id, b.id, clock);
    await S.declineFriend(env.DB, b.id, a.id);
    await S.requestFriend(env.DB, a.id, c.id, clock);
    await S.removeFriend(env.DB, a.id, c.id); // cancel
    await S.requestFriend(env.DB, a.id, b.id, clock);
    await S.acceptFriend(env.DB, b.id, a.id, clock);
    await S.removeFriend(env.DB, b.id, a.id); // unfriend by the addressee
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_friendships").get()).toEqual({ n: 0 });
    expect((await S.relation(env.DB, a.id, b.id))).toMatchObject({ friendship: "none", following: true }); // follows stay
    await expect(S.removeFriend(env.DB, a.id, b.id)).rejects.toMatchObject({ code: "not_found" });
  });
  it("suspended or unconfirmed members are 404", async () => {
    const { a, b } = await ids();
    sqlite.prepare("UPDATE hub_members SET status = 'suspended' WHERE id = ?").run(b.id);
    await expect(S.requestFriend(env.DB, a.id, b.id, clock)).rejects.toMatchObject({ code: "not_found" });
    await expect(S.relation(env.DB, a.id, b.id)).rejects.toMatchObject({ code: "not_found" });
    sqlite.prepare("UPDATE hub_members SET status = 'active' WHERE id = ?").run(b.id);
    sqlite.prepare("UPDATE t_volunteers SET status = 'cancelled' WHERE email = 'b@x.ma'").run();
    await expect(S.follow(env.DB, a.id, b.id, clock)).rejects.toMatchObject({ code: "not_found" });
  });
  it("rate limit: 20 requests per hour, 50 pending", async () => {
    const { a } = await ids();
    const others: number[] = [];
    for (let i = 0; i < 21; i++) { const r = sqlite.prepare("INSERT INTO hub_members (email, display_name) VALUES (?,?) RETURNING id").get(`o${i}@x.ma`, `O${i}`) as { id: number }; sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('O','X',?, 'confirmed')").run(`o${i}@x.ma`); others.push(r.id); }
    for (let i = 0; i < 20; i++) await S.requestFriend(env.DB, a.id, others[i], clock);
    await expect(S.requestFriend(env.DB, a.id, others[20], clock)).rejects.toMatchObject({ code: "rate_limited" });
    await S.requestFriend(env.DB, a.id, others[20], clock + 3_600_001); // window passed
  });
});

describe("social data: follow and favorite", () => {
  it("follow, favorite, unfollow removes the star; idempotent follow", async () => {
    const { a, b } = await ids();
    await expect(S.setFavorite(env.DB, a.id, b.id, true)).rejects.toMatchObject({ code: "conflict" });
    await S.follow(env.DB, a.id, b.id, clock); await S.follow(env.DB, a.id, b.id, clock);
    await S.setFavorite(env.DB, a.id, b.id, true);
    expect((await S.listFollowing(env.DB, a.id, null)).people).toEqual([expect.objectContaining({ id: b.id, favorite: true })]);
    await S.unfollow(env.DB, a.id, b.id);
    expect((await S.listFollowing(env.DB, a.id, null)).people).toEqual([]);
    expect((await S.relation(env.DB, a.id, b.id)).favorite).toBe(false);
  });
  it("cannot unfollow a friend", async () => {
    const { a, b } = await ids();
    await S.requestFriend(env.DB, a.id, b.id, clock); await S.acceptFriend(env.DB, b.id, a.id, clock);
    await expect(S.unfollow(env.DB, a.id, b.id)).rejects.toMatchObject({ code: "conflict" });
  });
  it("lists carry no email; requests split received/sent; pendingCount", async () => {
    const { a, b, c } = await ids();
    await S.requestFriend(env.DB, a.id, b.id, clock); await S.requestFriend(env.DB, c.id, a.id, clock);
    const r = await S.listRequests(env.DB, a.id);
    expect(r.received.map(p => p.id)).toEqual([c.id]); expect(r.sent.map(p => p.id)).toEqual([b.id]);
    expect(await S.pendingCount(env.DB, a.id)).toBe(1);
    expect(JSON.stringify(r)).not.toContain("@");
    expect((await S.listFriends(env.DB, a.id, null)).people).toEqual([]);
  });
});

describe("social data: fix round 1", () => {
  const seed = (n: number, prefix: string) => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const r = sqlite.prepare("INSERT INTO hub_members (email, display_name) VALUES (?,?) RETURNING id").get(`${prefix}${i}@x.ma`, `${prefix}${i}`) as { id: number };
      sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('O','X',?, 'confirmed')").run(`${prefix}${i}@x.ma`);
      out.push(r.id);
    }
    return out;
  };
  it("concurrent crossed requests: one row, no raw error", async () => {
    const { a, b } = await ids();
    const res = await Promise.allSettled([S.requestFriend(env.DB, a.id, b.id, clock), S.requestFriend(env.DB, b.id, a.id, clock)]);
    for (const r of res) if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "conflict" });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_friendships").get()).toEqual({ n: 1 });
  });
  it("unique pair index rejects a reverse row; lost race resolves to friends", async () => {
    const { a, b } = await ids();
    sqlite.prepare("INSERT INTO hub_friendships (requester_id, addressee_id, created_at) VALUES (?,?,?)").run(a.id, b.id, "x");
    expect(() => sqlite.prepare("INSERT INTO hub_friendships (requester_id, addressee_id, created_at) VALUES (?,?,?)").run(b.id, a.id, "x")).toThrow();
    // simulate losing the race: friendshipRow sees nothing on first read, then the row appears before INSERT
    sqlite.prepare("DELETE FROM hub_friendships").run();
    let first = true;
    const racy: typeof env.DB = { ...env.DB, prepare: sql => {
      const st = env.DB.prepare(sql);
      if (first && sql.startsWith("SELECT requester_id, status FROM hub_friendships")) {
        first = false;
        return { ...st, bind: (...v: unknown[]) => ({ ...st.bind(...v), first: async () => { sqlite.prepare("INSERT INTO hub_friendships (requester_id, addressee_id, created_at) VALUES (?,?,?)").run(a.id, b.id, "x"); return null; } }) } as any;
      }
      return st;
    } };
    expect(await S.requestFriend(racy, b.id, a.id, clock)).toEqual({ friendship: "friends" });
    expect(sqlite.prepare("SELECT status FROM hub_friendships").get()).toEqual({ status: "accepted" });
  });
  it("accept is atomic: follows only when accepted", async () => {
    const { a, b } = await ids();
    await S.requestFriend(env.DB, a.id, b.id, clock);
    await S.acceptFriend(env.DB, b.id, a.id, clock);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_follows").get()).toEqual({ n: 2 });
    await expect(S.acceptFriend(env.DB, b.id, a.id, clock)).rejects.toMatchObject({ code: "not_found" });
  });
  it("50 pending cap", async () => {
    const { a } = await ids();
    const o = seed(51, "p");
    for (const id of o.slice(0, 50)) sqlite.prepare("INSERT INTO hub_friendships (requester_id, addressee_id, created_at) VALUES (?,?,?)").run(a.id, id, "2020-01-01T00:00:00.000Z");
    await expect(S.requestFriend(env.DB, a.id, o[50], clock)).rejects.toMatchObject({ code: "rate_limited" });
  });
  it("200 following cap; follow idempotent at the cap", async () => {
    const { a } = await ids();
    const o = seed(201, "f");
    for (const id of o.slice(0, 200)) sqlite.prepare("INSERT INTO hub_follows (follower_id, followee_id, created_at) VALUES (?,?,?)").run(a.id, id, "x");
    await expect(S.follow(env.DB, a.id, o[200], clock)).rejects.toMatchObject({ code: "rate_limited" });
    await S.follow(env.DB, a.id, o[0], clock);
  });
  it("invisible members are absent from every list", async () => {
    const { a, b, c } = await ids();
    await S.requestFriend(env.DB, a.id, b.id, clock); await S.acceptFriend(env.DB, b.id, a.id, clock);
    await S.requestFriend(env.DB, a.id, c.id, clock); await S.requestFriend(env.DB, c.id, a.id, clock);
    const d = seed(1, "s")[0];
    await S.requestFriend(env.DB, d, a.id, clock);
    sqlite.prepare("UPDATE hub_members SET status = 'suspended' WHERE id IN (?, ?)").run(b.id, d);
    sqlite.prepare("UPDATE t_volunteers SET status = 'cancelled' WHERE email = 'c@x.ma'").run();
    expect((await S.listFriends(env.DB, a.id, null)).people).toEqual([]);
    expect((await S.listFollowing(env.DB, a.id, null)).people).toEqual([]);
    const r = await S.listRequests(env.DB, a.id);
    expect(r.received).toEqual([]); expect(r.sent).toEqual([]);
  });
  it("nextCursor pagination", async () => {
    const { a } = await ids();
    const o = seed(51, "g");
    for (const id of o) sqlite.prepare("INSERT INTO hub_follows (follower_id, followee_id, created_at) VALUES (?,?,?)").run(a.id, id, "x");
    const p1 = await S.listFollowing(env.DB, a.id, null);
    expect(p1.people).toHaveLength(50); expect(p1.nextCursor).toBe(p1.people[49].id);
    const p2 = await S.listFollowing(env.DB, a.id, p1.nextCursor);
    expect(p2.people.map(p => p.id)).toEqual([o[50]]); expect(p2.nextCursor).toBeNull();
  });
  it("favorite off and self-follow", async () => {
    const { a, b } = await ids();
    await S.follow(env.DB, a.id, b.id, clock);
    await S.setFavorite(env.DB, a.id, b.id, true);
    await S.setFavorite(env.DB, a.id, b.id, false);
    expect((await S.relation(env.DB, a.id, b.id)).favorite).toBe(false);
    await expect(S.follow(env.DB, a.id, a.id, clock)).rejects.toMatchObject({ code: "not_found" });
  });
});

const post = (path: string, token: string, body: unknown) => call("POST", `/hub/social/${path}`, { token, body });

describe("social http", () => {
  it("needs a session; unknown route is JSON 404; bad ids are 400", async () => {
    expect((await call("GET", "/hub/social/friends")).status).toBe(401);
    const { a } = await ids();
    const r = await call("GET", "/hub/social/nope", { token: a.session });
    expect(r.status).toBe(404); expect(await r.json()).toMatchObject({ error: "not_found" });
    expect((await post("friend/request", a.session, { id: "x" })).status).toBe(400);
    expect((await call("GET", "/hub/social/relation/abc", { token: a.session })).status).toBe(404);
  });
  it("friend flow over HTTP, conflict is 409, no email leaks", async () => {
    const { a, b } = await ids();
    expect((await post("friend/request", a.session, { id: b.id })).status).toBe(200);
    expect((await post("friend/request", a.session, { id: b.id })).status).toBe(409);
    const unread = (await (await call("GET", "/hub/notifications/unread", { token: b.session })).json()) as any;
    expect(unread.friend_requests).toBe(1);
    expect((await post("friend/accept", b.session, { id: a.id })).status).toBe(200);
    const rel = (await (await call("GET", `/hub/social/relation/${b.id}`, { token: a.session })).json()) as any;
    expect(rel).toMatchObject({ friendship: "friends", following: true });
    const list = await (await call("GET", "/hub/social/friends", { token: a.session })).text();
    expect(list).toContain("Brahim"); expect(list).not.toContain("@");
    expect((await call("DELETE", `/hub/social/follow/${b.id}`, { token: a.session })).status).toBe(409);
    expect((await call("DELETE", `/hub/social/friend/${b.id}`, { token: a.session })).status).toBe(200);
  });
  it("favorite requires a follow (409), then works", async () => {
    const { a, b } = await ids();
    expect((await post("favorite", a.session, { id: b.id, on: true })).status).toBe(409);
    await post("follow", a.session, { id: b.id });
    expect((await post("favorite", a.session, { id: b.id, on: true })).status).toBe(200);
    expect((await post("favorite", a.session, { id: b.id, on: "yes" })).status).toBe(400);
  });
});

describe("feed scope", () => {
  const publish = (s: string, body: string) => call("POST", "/hub/posts", { token: s, body: { body } });
  const bodies = async (token: string, scope: string) => ((await (await call("GET", `/hub/feed?scope=${scope}`, { token })).json()) as any).posts.map((p: any) => p.body);
  it("filters friends / following / favorites, keeps pinned, rejects unknown scope", async () => {
    const { a, b, c } = await ids();
    await publish(b.session, "post de B"); await publish(c.session, "post de C");
    expect((await bodies(a.session, "all")).sort()).toEqual(["post de B", "post de C"]);
    expect(await bodies(a.session, "following")).toEqual([]);
    await post("follow", a.session, { id: c.id });
    expect(await bodies(a.session, "following")).toEqual(["post de C"]);
    expect(await bodies(a.session, "favorites")).toEqual([]);
    await post("favorite", a.session, { id: c.id, on: true });
    expect(await bodies(a.session, "favorites")).toEqual(["post de C"]);
    expect(await bodies(a.session, "friends")).toEqual([]);
    await post("friend/request", b.session, { id: a.id }); await post("friend/accept", a.session, { id: b.id });
    expect(await bodies(a.session, "friends")).toEqual(["post de B"]);
    for (const bad of ["", "nope", "__proto__", "constructor"]) expect((await call("GET", `/hub/feed?scope=${bad}`, { token: a.session })).status).toBe(400);
    expect((await call("GET", "/hub/feed", { token: a.session })).status).toBe(200);
  });
});
