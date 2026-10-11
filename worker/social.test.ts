import { beforeEach, describe, expect, it } from "vitest";
import * as S from "./social-d1";import { createRequire } from "node:module";
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
