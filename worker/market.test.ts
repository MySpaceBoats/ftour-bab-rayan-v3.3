import { beforeEach, describe, expect, it } from "vitest";
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

const listing = (over: Record<string, unknown> = {}) => ({ title: "Vélo", description: "Bon état", price: 150, category: "enfants", condition: "bon", city: "Rabat", ...over });

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE t_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, status TEXT);");
  for (const f of ["hub.sql", "marketplace.sql"]) sqlite.exec(readFileSync(new URL(`./d1/${f}`, import.meta.url), "utf8"));
  env = { DB: fakeD1(sqlite), JWT_SECRET: "test-secret", MEDIA_BASE_URL: "https://m.test", GALLERY_MEDIA: undefined, PUBLIC_APP_URL: "https://site.test" };
  mails = [];
  clock = T0;
});

describe("market http: listings", () => {
  it("needs a session; unknown market route is a JSON 404", async () => {
    expect((await call("GET", "/hub/market/listings")).status).toBe(401);
    expect((await call("POST", "/hub/market/listings", { body: listing() })).status).toBe(401);
    const a = await signIn("a@x.ma");
    const r = await call("GET", "/hub/market/nope", { token: a.session });
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ error: "not_found" });
  });

  it("create -> list (cover signed, no phone) -> detail (phone, signed media)", async () => {
    const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim");
    const created = await call("POST", "/hub/market/listings", { token: a.session, body: listing({ phone: "+212 600000000", whatsapp: true, media: [`${a.id}/p.jpg`] }) });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: number };
    const list = (await (await call("GET", "/hub/market/listings", { token: b.session })).json()) as any;
    expect(list.listings[0]).toMatchObject({ id, title: "Vélo", price: 150, seller: { display_name: "Amina B." } });
    expect(list.listings[0].cover).toContain(`https://m.test/media-signed/private/hub/${a.id}/p.jpg?exp=`);
    expect(JSON.stringify(list)).not.toContain("+212600000000");
    const det = (await (await call("GET", `/hub/market/listings/${id}`, { token: b.session })).json()) as any;
    expect(det.listing).toMatchObject({ contact: { phone: "+212600000000", whatsapp: true }, mine: false });
    expect(det.listing.media[0]).toContain("/media-signed/private/hub/");
    expect(det.listing.media_keys).toBeUndefined();
    expect(JSON.stringify(det)).not.toContain("a@x.ma");
  });

  it("owner sees media_keys; update and status via PUT / POST; others forbidden", async () => {
    const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim");
    const { id } = (await (await call("POST", "/hub/market/listings", { token: a.session, body: listing({ media: [`${a.id}/p.jpg`] }) })).json()) as { id: number };
    const own = (await (await call("GET", `/hub/market/listings/${id}`, { token: a.session })).json()) as any;
    expect(own.listing.media_keys).toEqual([`${a.id}/p.jpg`]);
    expect((await call("PUT", `/hub/market/listings/${id}`, { token: b.session, body: listing() })).status).toBe(403);
    expect((await call("PUT", `/hub/market/listings/${id}`, { token: a.session, body: listing({ title: "Nouveau" }) })).status).toBe(200);
    expect((await call("POST", `/hub/market/listings/${id}/status`, { token: b.session, body: { status: "sold" } })).status).toBe(403);
    expect((await call("POST", `/hub/market/listings/${id}/status`, { token: a.session, body: { status: "hidden" } })).status).toBe(400);
    expect((await call("POST", `/hub/market/listings/${id}/status`, { token: a.session, body: { status: "sold" } })).status).toBe(200);
    const det = (await (await call("GET", `/hub/market/listings/${id}`, { token: b.session })).json()) as any;
    expect(det.listing).toMatchObject({ title: "Nouveau", status: "sold" });
  });

  it("hostile input is a 400, never a 500", async () => {
    const a = await signIn("a@x.ma");
    for (const over of [{ price: "12" }, { price: -1 }, { price: 1.5 }, { title: {} }, { title: 5 }, { category: "x" }, { phone: 5 }, { media: ["999/a.jpg"] }, { media: ["1/../a.jpg"] }]) {
      const r = await call("POST", "/hub/market/listings", { token: a.session, body: listing(over) });
      expect(r.status, JSON.stringify(over)).toBe(400);
    }
    for (const p of ["/hub/market/listings/abc", "/hub/market/listings/0", "/hub/market/listings/99999999999999999999", "/hub/market/listings?cursor=abc&category=nope"]) {
      expect([400, 404]).toContain((await call("GET", p, { token: a.session })).status);
    }
    expect((await call("GET", "/hub/market/listings?category=nope", { token: a.session })).status).toBe(400);
    expect((await call("GET", `/hub/market/listings?q=${"é".repeat(30)}`, { token: a.session })).status).toBe(400);
  });

  it("delete hides (owner), 404 afterwards; 429 on the sixth listing of the day", async () => {
    const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim");
    const { id } = (await (await call("POST", "/hub/market/listings", { token: a.session, body: listing() })).json()) as { id: number };
    expect((await call("DELETE", `/hub/market/listings/${id}`, { token: b.session })).status).toBe(403);
    expect((await call("DELETE", `/hub/market/listings/${id}`, { token: a.session })).status).toBe(200);
    expect((await call("GET", `/hub/market/listings/${id}`, { token: b.session })).status).toBe(404);
    for (let i = 0; i < 4; i++) expect((await call("POST", "/hub/market/listings", { token: a.session, body: listing() })).status).toBe(200);
    expect((await call("POST", "/hub/market/listings", { token: a.session, body: listing() })).status).toBe(429);
  });
});

describe("market http: comments, reports, admin", () => {
  it("comments + report flow", async () => {
    const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim");
    const { id } = (await (await call("POST", "/hub/market/listings", { token: a.session, body: listing() })).json()) as { id: number };
    expect((await call("POST", `/hub/market/listings/${id}/comments`, { token: b.session, body: { body: {} } })).status).toBe(400);
    const c = (await (await call("POST", `/hub/market/listings/${id}/comments`, { token: b.session, body: { body: "Dispo ?" } })).json()) as { id: number };
    const got = (await (await call("GET", `/hub/market/listings/${id}/comments`, { token: a.session })).json()) as any;
    expect(got.comments[0]).toMatchObject({ body: "Dispo ?", author: { display_name: "Brahim B." } });
    expect(JSON.stringify(got)).not.toContain("@x.ma");
    expect((await call("DELETE", `/hub/market/comments/${c.id}`, { token: a.session })).status).toBe(403);
    expect((await call("POST", "/hub/market/report", { token: b.session, body: { type: "listing", id, reason: "arnaque" } })).status).toBe(200);
    expect((await call("POST", "/hub/market/report", { token: b.session, body: { type: "constructor", id, reason: "x" } })).status).toBe(400);
    expect((await call("DELETE", `/hub/market/comments/${c.id}`, { token: b.session })).status).toBe(200);
  });

  it("admin routes: no admin / user role / demo -> 403; real admin works", async () => {
    const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim");
    const { id } = (await (await call("POST", "/hub/market/listings", { token: a.session, body: listing() })).json()) as { id: number };
    await call("POST", "/hub/market/report", { token: b.session, body: { type: "listing", id, reason: "arnaque" } });
    for (const adm of [undefined, "user", "demo"]) {
      expect((await call("GET", "/hub/market/admin/listings", { admin: adm })).status, String(adm)).toBe(403);
      expect((await call("GET", "/hub/market/admin/reports", { admin: adm })).status, String(adm)).toBe(403);
      expect((await call("POST", "/hub/market/admin/hide", { admin: adm, body: { type: "listing", id } })).status, String(adm)).toBe(403);
    }
    const listings = (await (await call("GET", "/hub/market/admin/listings", { admin: "admin_ops" })).json()) as any;
    expect(listings.listings[0]).toMatchObject({ id, status: "active", seller: "Amina B." });
    const reports = (await (await call("GET", "/hub/market/admin/reports", { admin: "admin" })).json()) as any;
    expect(reports.reports[0]).toMatchObject({ target_id: id, reason: "arnaque" });
    expect((await call("POST", "/hub/market/admin/hide", { admin: "admin", body: { type: "listing", id } })).status).toBe(200);
    expect((await call("GET", `/hub/market/listings/${id}`, { token: b.session })).status).toBe(404);
    expect((await call("POST", `/hub/market/admin/reports/${reports.reports[0].id}/dismiss`, { admin: "admin" })).status).toBe(200);
  });
});

describe("market http: messaging", () => {
  async function pair() {
    const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim"); const c = await signIn("c@x.ma", "Chakib");
    const { id } = (await (await call("POST", "/hub/market/listings", { token: a.session, body: listing() })).json()) as { id: number };
    return { a, b, c, id };
  }

  it("open thread, exchange, unread, read, inbox", async () => {
    const { a, b, id } = await pair();
    const t = (await (await call("POST", `/hub/market/listings/${id}/thread`, { token: b.session })).json()) as { id: number; created: boolean };
    expect(t.created).toBe(true);
    expect((await call("POST", `/hub/market/threads/${t.id}/messages`, { token: b.session, body: { body: {} } })).status).toBe(400);
    expect((await call("POST", `/hub/market/threads/${t.id}/messages`, { token: b.session, body: { body: "Bonjour" } })).status).toBe(200);
    expect(await (await call("GET", "/hub/market/unread", { token: a.session })).json()).toEqual({ count: 1 });
    const inbox = (await (await call("GET", "/hub/market/threads", { token: a.session })).json()) as any;
    expect(inbox.threads[0]).toMatchObject({ id: t.id, last_body: "Bonjour", unread: 1, other: { display_name: "Brahim B." } });
    expect(JSON.stringify(inbox)).not.toContain("@x.ma");
    const msgs = (await (await call("GET", `/hub/market/threads/${t.id}/messages`, { token: a.session })).json()) as any;
    expect(msgs.messages[0]).toMatchObject({ body: "Bonjour", sender_id: b.id });
    expect(msgs.other.display_name).toBe("Brahim B.");
    expect((await call("POST", `/hub/market/threads/${t.id}/read`, { token: a.session })).status).toBe(200);
    expect(await (await call("GET", "/hub/market/unread", { token: a.session })).json()).toEqual({ count: 0 });
  });

  it("inbox snippet is truncated to 120 chars, thread messages keep the full body", async () => {
    const { a, b, id } = await pair();
    const t = (await (await call("POST", `/hub/market/listings/${id}/thread`, { token: b.session })).json()) as { id: number };
    const long = "x".repeat(300);
    expect((await call("POST", `/hub/market/threads/${t.id}/messages`, { token: b.session, body: { body: long } })).status).toBe(200);
    const inbox = (await (await call("GET", "/hub/market/threads", { token: a.session })).json()) as any;
    expect(inbox.threads[0].last_body.length).toBeLessThanOrEqual(120);
    const msgs = (await (await call("GET", `/hub/market/threads/${t.id}/messages`, { token: a.session })).json()) as any;
    expect(msgs.messages[0].body).toBe(long);
  });

  it("outsiders get 404, yourself is 400, anonymous 401, admins cannot read", async () => {
    const { a, b, c, id } = await pair();
    expect((await call("POST", `/hub/market/listings/${id}/thread`, { token: a.session })).status).toBe(400);
    const t = (await (await call("POST", `/hub/market/listings/${id}/thread`, { token: b.session })).json()) as { id: number };
    await call("POST", `/hub/market/threads/${t.id}/messages`, { token: b.session, body: { body: "secret" } });
    for (const [m, p, body] of [["GET", `/hub/market/threads/${t.id}/messages`, undefined], ["POST", `/hub/market/threads/${t.id}/messages`, { body: "x" }], ["POST", `/hub/market/threads/${t.id}/read`, undefined]] as const) {
      expect((await call(m, p, { token: c.session, body })).status, `${m} ${p}`).toBe(404);
      expect((await call(m, p, { body })).status, `${m} ${p} anon`).toBe(401);
      expect((await call(m, p, { admin: "admin", body })).status, `${m} ${p} admin`).toBe(401); // admin bearer is not a member session
    }
    expect((await call("GET", "/hub/market/threads/abc/messages", { token: a.session })).status).toBe(404); // not a numeric id: route does not match
    expect((await call("GET", "/hub/market/threads/99999999999999999999/messages", { token: a.session })).status).toBe(400);
  });
});
