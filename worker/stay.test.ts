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
const STAY = { startDate: "2026-11-01", endDate: "2026-11-05", guests: 1, message: "Bonjour, je viens aider pour l'iftar." };
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
const json = async <T>(method: string, path: string, o: Parameters<typeof call>[2] = {}): Promise<T> => (await call(method, path, o).then(r => r.json())) as T;
const tokenFromMail = () => /token=([a-f0-9]{64})/.exec(mails[mails.length - 1].html)![1];

async function signIn(email = "a@x.ma", first = "Amina") {
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,'Benali',?,'confirmed')").run(first, email);
  await call("POST", "/hub/login", { body: { email } });
  const v = await call("POST", "/hub/verify", { body: { token: tokenFromMail() } });
  return (await v.json()) as { session: string; member: { id: number; display_name: string } };
}

const listing = (over: Record<string, unknown> = {}) => ({
  title: "Chambre d'amis", description: "Chambre calme près du centre-ville", kind: "chambre",
  city: "Casablanca", area: "Maârif", capacity: 2, rooms: 1, priceType: "gratuit", price: 0,
  amenities: ["wifi", "cuisine"], availableFrom: "2026-10-15", availableTo: "2026-12-31", ...over,
});

const SCHEMA_DIR = new URL("./d1/", import.meta.url).pathname;

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE t_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, status TEXT);");
  sqlite.exec(readFileSync(`${SCHEMA_DIR}hub.sql`, "utf8"));
  sqlite.exec(readFileSync(`${SCHEMA_DIR}stay.sql`, "utf8"));
  env = { DB: fakeD1(sqlite), JWT_SECRET: "test-secret", MEDIA_BASE_URL: "https://m.test", GALLERY_MEDIA: undefined, PUBLIC_APP_URL: "https://site.test" };
  mails = [];
  clock = T0;
  extra = {};
});

describe("stay http", () => {
  it("ignores non-hub paths; unknown stay path is 404; auth required; bad JSON is 400", async () => {
    expect(await handleHubRequest(new Request("https://w.test/api/trpc"), env, CORS, deps())).toBeNull();
    expect((await call("GET", "/hub/stay/nope")).status).toBe(404);
    expect((await call("GET", "/hub/stay")).status).toBe(404);
    expect((await call("GET", "/hub/stay/listings")).status).toBe(401);
    const { session } = await signIn();
    expect((await call("POST", "/hub/stay/listings", { token: session, body: "{nope" })).status).toBe(400);
  });

  it("publishes a stay, books it end-to-end, reviews it and pauses it", async () => {
    const host = await signIn("host@x.ma", "Hôte");
    const guest = await signIn("guest@x.ma", "Invité");

    // one photo through the shared hub uploader, attached to the listing
    const up = await json<{ path: string; uploadUrl: string }>("POST", "/hub/media", { token: host.session, body: { contentType: "image/jpeg" } });
    expect(up.uploadUrl).toContain(`https://m.test/media-upload/private/hub/${up.path}?exp=`);
    const created = await json<{ id: number }>("POST", "/hub/stay/listings", { token: host.session, body: listing({ media: [up.path], phone: "+212 612345678", whatsapp: true }) });
    expect(created.id).toBeGreaterThan(0);

    // the guest sees it in the search with a signed cover
    const search = await json<{ listings: any[]; nextCursor: number | null }>("GET", "/hub/stay/listings", { token: guest.session });
    expect(search.nextCursor).toBeNull();
    expect(search.listings).toHaveLength(1);
    expect(search.listings[0]).toMatchObject({ id: created.id, title: "Chambre d'amis", kind: "chambre", capacity: 2, host: { display_name: "Hôte B." }, rating: null, review_count: 0 });
    expect(search.listings[0].cover).toContain(`https://m.test/media-signed/private/hub/${up.path}?exp=`);
    expect(JSON.stringify(search)).not.toContain("+212612345678");

    const detail = await json<{ listing: any }>("GET", `/hub/stay/listings/${created.id}`, { token: guest.session });
    expect(detail.listing.contact).toEqual({ phone: "+212612345678", whatsapp: true });
    expect(detail.listing.media[0]).toContain(`https://m.test/media-signed/private/hub/${up.path}?exp=`);
    expect(detail.listing.media_keys).toBeUndefined(); // keys are for the owner only

    // the guest books free dates; the host accepts
    const request = await json<{ id: number }>("POST", `/hub/stay/listings/${created.id}/requests`, { token: guest.session, body: STAY });
    const received = await json<{ requests: any[] }>("GET", "/hub/stay/requests?role=host", { token: host.session });
    expect(received.requests).toHaveLength(1);
    expect(received.requests[0]).toMatchObject({ id: request.id, status: "pending", listing_title: "Chambre d'amis", other: { display_name: "Invité B." }, unread: 0 });
    expect((await json<{ requests: any[] }>("GET", "/hub/stay/requests?role=guest", { token: host.session })).requests).toEqual([]);
    expect((await call("POST", `/hub/stay/requests/${request.id}/status`, { token: guest.session, body: { action: "accept" } })).status).toBe(403);
    expect((await call("POST", `/hub/stay/requests/${request.id}/status`, { token: host.session, body: { action: "accept", reply: "Bienvenue !" } })).status).toBe(200);
    const accepted = await json<{ request: any }>("GET", `/hub/stay/requests/${request.id}`, { token: guest.session });
    expect(accepted.request).toMatchObject({ status: "accepted", host_reply: "Bienvenue !", role: "guest", can_review: true, guests: 1 });

    // the request thread carries the discussion; the host badge counts it
    expect((await call("POST", `/hub/stay/requests/${request.id}/messages`, { token: guest.session, body: { body: "Je peux arriver à 18 h ?" } })).status).toBe(200);
    const thread = await json<{ messages: any[]; other: any; request: any }>("GET", `/hub/stay/requests/${request.id}/messages`, { token: host.session });
    expect(thread.messages.map(m => m.body)).toEqual(["Je peux arriver à 18 h ?"]);
    expect(thread.request).toMatchObject({ id: request.id, status: "accepted", listing: { id: created.id, title: "Chambre d'amis" } });
    expect(await json<{ count: number }>("GET", "/hub/stay/unread", { token: host.session })).toMatchObject({ count: 1 });
    await call("POST", `/hub/stay/requests/${request.id}/read`, { token: host.session });
    expect(await json<{ count: number }>("GET", "/hub/stay/unread", { token: host.session })).toMatchObject({ count: 0 });
    expect((await call("POST", "/hub/stay/requests/9999/messages", { token: host.session, body: { body: "coucou" } })).status).toBe(404);

    // the guest reviews the stay; the listing rating follows
    expect((await call("POST", `/hub/stay/requests/${request.id}/review`, { token: host.session, body: { rating: 5 } })).status).toBe(403);
    expect((await call("POST", `/hub/stay/requests/${request.id}/review`, { token: guest.session, body: { rating: 5, body: "Parfait" } })).status).toBe(200);
    expect((await call("POST", `/hub/stay/requests/${request.id}/review`, { token: guest.session, body: { rating: 5 } })).status).toBe(400);
    const rated = await json<{ listing: any }>("GET", `/hub/stay/listings/${created.id}`, { token: guest.session });
    expect(rated.listing).toMatchObject({ rating: 5, review_count: 1 });
    expect(rated.listing.reviews[0]).toMatchObject({ rating: 5, body: "Parfait", author: { display_name: "Invité B." } });

    // pausing hides it from others but not from its owner
    await call("POST", `/hub/stay/listings/${created.id}/status`, { token: host.session, body: { status: "paused" } });
    expect((await json<{ listings: any[] }>("GET", "/hub/stay/listings", { token: guest.session })).listings).toEqual([]);
    expect((await json<{ listings: any[] }>("GET", "/hub/stay/listings?mine=1", { token: host.session })).listings).toHaveLength(1);
    await call("POST", `/hub/stay/listings/${created.id}/status`, { token: host.session, body: { status: "active" } });
    expect((await json<{ listings: any[] }>("GET", "/hub/stay/listings", { token: guest.session })).listings).toHaveLength(1);

    // keep the owner-only media keys for the edit form
    const mine = await json<{ listing: any }>("GET", `/hub/stay/listings/${created.id}`, { token: host.session });
    expect(mine.listing.media_keys).toEqual([up.path]);
  });

  it("validates payloads and maps every domain error to its status", async () => {
    const host = await signIn("host@x.ma", "Hôte");
    const guest = await signIn("guest@x.ma", "Invité");
    const created = await json<{ id: number }>("POST", "/hub/stay/listings", { token: host.session, body: listing() });

    const bad = async (method: string, path: string, o: Parameters<typeof call>[2], status: number, error: string) => {
      const r = await call(method, path, o);
      expect(r.status).toBe(status);
      expect(((await r.json()) as { error?: string }).error).toBe(error);
    };
    await bad("POST", "/hub/stay/listings", { token: host.session, body: listing({ kind: "chateau" }) }, 400, "invalid");
    await bad("POST", "/hub/stay/listings", { token: host.session, body: listing({ priceType: "prix", price: 0 }) }, 400, "invalid");
    await bad("POST", "/hub/stay/listings", { token: host.session, body: listing({ media: "nope" }) }, 400, "invalid");
    await bad("POST", "/hub/stay/listings", { token: host.session, body: listing({ amenities: ["jacuzzi"] }) }, 400, "invalid");
    await bad("GET", "/hub/stay/listings?kind=chateau", { token: guest.session }, 400, "invalid");
    await bad("GET", "/hub/stay/listings?from=2026-11-10&to=2026-11-01", { token: guest.session }, 400, "invalid");
    await bad("GET", "/hub/stay/listings/9999", { token: guest.session }, 404, "not_found");
    await bad("GET", "/hub/stay/listings/nope", { token: guest.session }, 404, "not_found");
    await bad("PUT", `/hub/stay/listings/${created.id}`, { token: guest.session, body: listing() }, 403, "forbidden");
    await bad("DELETE", `/hub/stay/listings/${created.id}`, { token: guest.session }, 403, "forbidden");
    await bad("POST", `/hub/stay/listings/${created.id}/requests`, { token: guest.session, body: { ...STAY, startDate: "2020-01-01" } }, 400, "invalid");
    await bad("POST", `/hub/stay/listings/${created.id}/requests`, { token: host.session, body: STAY }, 400, "invalid"); // own listing
    await bad("POST", `/hub/stay/requests/9999/status`, { token: guest.session, body: { action: "cancel" } }, 404, "not_found");
    await bad("POST", "/hub/stay/report", { token: guest.session, body: { type: "user", id: created.id, reason: "spam" } }, 400, "invalid");
    await bad("POST", "/hub/stay/report", { token: guest.session, body: { type: "listing", id: 9999, reason: "spam" } }, 404, "not_found");
    await bad("GET", "/hub/stay/requests?role=x", { token: guest.session }, 400, "invalid");

    // the guest can cancel an accepted request, but no longer once it is closed
    const r = await json<{ id: number }>("POST", `/hub/stay/listings/${created.id}/requests`, { token: guest.session, body: STAY });
    await call("POST", `/hub/stay/requests/${r.id}/status`, { token: host.session, body: { action: "accept" } });
    await call("POST", `/hub/stay/requests/${r.id}/status`, { token: guest.session, body: { action: "cancel" } });
    await bad("POST", `/hub/stay/requests/${r.id}/status`, { token: guest.session, body: { action: "cancel" } }, 400, "invalid");
    await bad("POST", `/hub/stay/requests/${r.id}/messages`, { token: guest.session, body: { body: "encore ?" } }, 403, "forbidden");
  });

  it("hides listings and messages through the admin surface only", async () => {
    const host = await signIn("host@x.ma", "Hôte");
    const guest = await signIn("guest@x.ma", "Invité");
    const created = await json<{ id: number }>("POST", "/hub/stay/listings", { token: host.session, body: listing() });
    const r = await json<{ id: number }>("POST", `/hub/stay/listings/${created.id}/requests`, { token: guest.session, body: STAY });
    await call("POST", `/hub/stay/requests/${r.id}/messages`, { token: guest.session, body: { body: "message limite" } });
    const mid = (await json<{ messages: any[] }>("GET", `/hub/stay/requests/${r.id}/messages`, { token: host.session })).messages[0].id;
    await call("POST", "/hub/stay/report", { token: guest.session, body: { type: "listing", id: created.id, reason: "Annonce trompeuse" } });
    await call("POST", "/hub/stay/report", { token: host.session, body: { type: "message", id: mid, reason: "Message agressif" } });

    for (const admin of [undefined, "member", "demo"]) {
      expect((await call("GET", "/hub/stay/admin/reports", { token: guest.session, admin })).status).toBe(403);
    }
    const reports = await json<{ reports: any[] }>("GET", "/hub/stay/admin/reports", { token: guest.session, admin: "admin_ops" });
    expect(reports.reports).toHaveLength(2);
    expect(reports.reports.find(x => x.target_type === "listing")).toMatchObject({ target_id: created.id, reporter: "Invité B.", body: "Chambre d'amis", target_status: "active" });

    const listings = await json<{ listings: any[] }>("GET", "/hub/stay/admin/listings", { token: guest.session, admin: "admin" });
    expect(listings.listings[0]).toMatchObject({ id: created.id, host: "Hôte B.", status: "active" });
    expect((await call("POST", "/hub/stay/admin/hide", { token: guest.session, admin: "admin", body: { type: "message", id: mid } })).status).toBe(200);
    expect((await json<{ messages: any[] }>("GET", `/hub/stay/requests/${r.id}/messages`, { token: host.session })).messages).toEqual([]);
    expect((await call("POST", "/hub/stay/admin/hide", { token: guest.session, admin: "admin", body: { type: "listing", id: created.id } })).status).toBe(200);
    expect((await json<{ listings: any[] }>("GET", "/hub/stay/listings", { token: guest.session })).listings).toEqual([]);
    expect((await json<{ listings: any[] }>("GET", "/hub/stay/admin/listings", { token: guest.session, admin: "admin" })).listings[0].status).toBe("hidden");
    expect((await call("POST", `/hub/stay/admin/reports/${reports.reports[0].id}/dismiss`, { token: guest.session, admin: "admin" })).status).toBe(200);
    expect((await json<{ reports: any[] }>("GET", "/hub/stay/admin/reports", { token: guest.session, admin: "admin" })).reports).toHaveLength(1);
  });
});
