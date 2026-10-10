import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import * as h from "./hub-d1";
import * as s from "./stay-d1";

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

const T0 = Date.parse("2026-10-10T12:00:00.000Z"); // 13:00 in Casablanca -> 2026-10-10
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const N = { from: "2026-11-01", to: "2026-11-05" };
let sqlite: InstanceType<typeof DatabaseSync>;
let d: D1Like;

const vol = (email: string, status = "confirmed", first = "Amina") =>
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?,?)").run(first, "Benali", email, status);

async function member(email: string, first = "Amina", role?: "moderator") {
  vol(email, "confirmed", first);
  const { session } = await h.openSession(d, await h.createLoginToken(d, email, T0), T0);
  if (role) sqlite.prepare("UPDATE hub_members SET role=? WHERE email=?").run(role, email);
  return (await h.getSession(d, session, T0 + 1))!;
}

const base = (over: Partial<s.StayListingInput> = {}): s.StayListingInput => ({
  title: "Chambre d'amis", description: "Chambre calme près du centre-ville", kind: "chambre",
  city: "Casablanca", area: "Maârif", capacity: 2, rooms: 1, priceType: "gratuit", price: 0, amenities: ["wifi"], ...over,
});

const req = (over: Partial<s.StayRequestInput> = {}): s.StayRequestInput => ({ startDate: N.from, endDate: N.to, guests: 1, message: "Bonjour, je viens pour l'iftar.", ...over });

/** Insert a listing directly (bypasses the daily rate limit) for list/search/date tests. */
function raw(memberId: number, over: Record<string, string | number | null> = {}) {
  const o: Record<string, string | number | null> = { title: "Logement", description: "desc", kind: "chambre", city: "Casablanca", area: "", capacity: 2, rooms: 1, price_type: "gratuit", price: 0, amenities: "[]", status: "active", available_from: null, available_to: null, ...over };
  return Number(sqlite.prepare(
    "INSERT INTO st_listings (member_id,title,description,kind,city,area,capacity,rooms,price_type,price,amenities,status,available_from,available_to) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).run(memberId, o.title, o.description, o.kind, o.city, o.area, o.capacity, o.rooms, o.price_type, o.price, o.amenities, o.status, o.available_from, o.available_to).lastInsertRowid);
}

/** Insert a request directly, bypassing the create-time checks (overlap, windows, rate limit). */
function rawRequest(listingId: number, guestId: number, hostId: number, over: Record<string, string | number | null> = {}) {
  const o: Record<string, string | number | null> = { start_date: N.from, end_date: N.to, guests: 1, message: "m", status: "pending", ...over };
  return Number(sqlite.prepare(
    "INSERT INTO st_requests (listing_id,guest_id,host_id,start_date,end_date,guests,message,status) VALUES (?,?,?,?,?,?,?,?)",
  ).run(listingId, guestId, hostId, o.start_date, o.end_date, o.guests, o.message, o.status).lastInsertRowid);
}

const SCHEMA_DIR = new URL("./d1/", import.meta.url).pathname;

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE t_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, status TEXT);");
  for (const f of ["hub.sql", "stay.sql"]) {
    const sql = readFileSync(`${SCHEMA_DIR}${f}`, "utf8");
    sqlite.exec(sql);
    sqlite.exec(sql); // idempotent
  }
  d = fakeD1(sqlite);
});

describe("date helpers", () => {
  it("validates real calendar dates, not just the shape", () => {
    expect(s.isIsoDate("2026-10-10")).toBe(true);
    expect(s.isIsoDate("2026-02-31")).toBe(false);
    expect(s.isIsoDate("2026-13-01")).toBe(false);
    expect(s.isIsoDate("10/10/2026")).toBe(false);
    expect(s.isIsoDate(null)).toBe(false);
  });

  it("computes the Casablanca date and half-open overlaps", () => {
    expect(s.todayCasablanca(Date.parse("2026-10-10T22:30:00.000Z"))).toBe("2026-10-10"); // 23:30 local
    expect(s.overlaps("2026-11-01", "2026-11-05", "2026-11-04", "2026-11-08")).toBe(true);
    expect(s.overlaps("2026-11-01", "2026-11-05", "2026-11-05", "2026-11-08")).toBe(false); // checkout day is reusable
    expect(s.nightsBetween("2026-11-01", "2026-11-05")).toBe(4);
  });
});

describe("listings write", () => {
  it("creates with photos and reads every field back", async () => {
    const a = await member("a@x.ma");
    const { id } = await s.createListing(d, a, base({ mediaPaths: [`${a.id}/a.jpg`, `${a.id}/b.jpg`], phone: "+212 612345678", whatsapp: true, amenities: ["wifi", "cuisine", "wifi"] }), T0);
    const got = await s.getStayListing(d, a.id, id);
    expect(got).toMatchObject({ title: "Chambre d'amis", kind: "chambre", city: "Casablanca", area: "Maârif", capacity: 2, rooms: 1, price_type: "gratuit", price: 0, status: "active", mine: true, contact: { phone: "+212612345678", whatsapp: true } });
    expect(got.media).toEqual([`${a.id}/a.jpg`, `${a.id}/b.jpg`]);
    expect(got.media_keys).toEqual([`${a.id}/a.jpg`, `${a.id}/b.jpg`]);
    expect(got.amenities).toEqual(["wifi", "cuisine"]); // deduplicated
  });

  it("validates every field, and a free stay never carries a price", async () => {
    const a = await member("a@x.ma");
    const bad = async (over: Partial<s.StayListingInput>) => expect(s.createListing(d, a, base(over), T0)).rejects.toMatchObject({ code: "invalid" });
    await bad({ title: "  " });
    await bad({ title: "x".repeat(81) });
    await bad({ description: "" });
    await bad({ kind: "chateau" });
    await bad({ capacity: 0 });
    await bad({ capacity: 13 });
    await bad({ capacity: 1.5 });
    await bad({ rooms: 11 });
    await bad({ priceType: "don" });
    await bad({ priceType: "prix", price: 0 });
    await bad({ priceType: "prix", price: 1.5 });
    await bad({ priceType: "participation", price: 1_000_000 });
    await bad({ city: "v".repeat(61) });
    await bad({ area: "q".repeat(61) });
    await bad({ phone: "12" });
    await bad({ phone: "0612345678", whatsapp: true }); // WhatsApp needs +country code
    await bad({ amenities: ["jacuzzi"] });
    await bad({ amenities: [...s.ST_AMENITIES, "wifi"] } as any);
    await bad({ mediaPaths: [0, 1, 2, 3, 4, 5, 6].map(i => `${a.id}/${i}.jpg`) });
    await bad({ mediaPaths: ["999/x.jpg"] });
    await bad({ mediaPaths: [`${a.id}/../x.jpg`] });
    await bad({ availableFrom: "01/11/2026" });
    await bad({ availableFrom: "2026-11-10", availableTo: "2026-11-01" });
    const free = (await s.createListing(d, a, base({ price: 500 }), T0)).id; // gratuit forces price 0
    expect((await s.getStayListing(d, a.id, free)).price).toBe(0);
    expect((await s.createListing(d, a, base({ priceType: "prix", price: 120 }), T0)).id).toBeTruthy(); // paid = 1..max
  });

  it("rate-limits 5 listings per 24 hours", async () => {
    const a = await member("a@x.ma");
    for (let i = 0; i < 5; i++) await s.createListing(d, a, base({ title: `t${i}` }), T0 + i);
    await expect(s.createListing(d, a, base(), T0 + 10)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(s.createListing(d, a, base(), T0 + DAY + 100)).resolves.toBeTruthy();
  });

  it("update: owner only, replaces photos, refuses hidden listings", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await s.createListing(d, a, base({ mediaPaths: [`${a.id}/a.jpg`] }), T0);
    await expect(s.updateListing(d, b, id, base(), T0 + 1)).rejects.toMatchObject({ code: "forbidden" });
    await s.updateListing(d, a, id, base({ title: "Studio refait", kind: "studio", mediaPaths: [`${a.id}/c.jpg`] }), T0 + 2);
    expect(await s.getStayListing(d, a.id, id)).toMatchObject({ title: "Studio refait", kind: "studio", media: [`${a.id}/c.jpg`] });
    await s.hideStayListing(d, id);
    await expect(s.updateListing(d, a, id, base(), T0 + 3)).rejects.toMatchObject({ code: "not_found" });
    await expect(s.updateListing(d, a, 9999, base(), T0 + 3)).rejects.toMatchObject({ code: "not_found" });
  });

  it("pause/active: owner only, invalid values rejected, paused stays out of the public list", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await s.createListing(d, a, base(), T0);
    await expect(s.setListingStatus(d, b, id, "paused", T0)).rejects.toMatchObject({ code: "forbidden" });
    await expect(s.setListingStatus(d, a, id, "hidden" as any, T0)).rejects.toMatchObject({ code: "invalid" });
    await s.setListingStatus(d, a, id, "paused", T0 + 1);
    expect((await s.getStayListing(d, a.id, id)).status).toBe("paused");
    expect((await s.listStayListings(d, b.id)).listings).toHaveLength(0);
    expect((await s.listStayListings(d, a.id, { mine: true })).listings).toHaveLength(1);
    await s.setListingStatus(d, a, id, "active", T0 + 2);
    expect((await s.listStayListings(d, b.id)).listings).toHaveLength(1);
  });

  it("hide: owner, moderator or admin; others forbidden; hidden is 404 and leaves the list", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const mod = await member("mod@x.ma", "Mona", "moderator");
    const l1 = (await s.createListing(d, a, base({ title: "l1" }), T0)).id;
    const l2 = (await s.createListing(d, a, base({ title: "l2" }), T0 + 1)).id;
    const l3 = (await s.createListing(d, a, base({ title: "l3" }), T0 + 2)).id;
    await expect(s.hideStayListing(d, l1, b)).rejects.toMatchObject({ code: "forbidden" });
    await s.hideStayListing(d, l1, a);
    await s.hideStayListing(d, l2, mod);
    await s.hideStayListing(d, l3); // admin
    for (const x of [l1, l2, l3]) await expect(s.getStayListing(d, b.id, x)).rejects.toMatchObject({ code: "not_found" });
    expect((await s.listStayListings(d, b.id)).listings).toEqual([]);
    await expect(s.hideStayListing(d, 9999)).rejects.toMatchObject({ code: "not_found" });
  });

  it("a suspended host's listing disappears, contact and description stay out of the cards", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await s.createListing(d, a, base({ phone: "+212600000000" }), T0);
    expect(JSON.stringify(await s.listStayListings(d, b.id))).not.toContain("+212600000000");
    expect(JSON.stringify(await s.listStayListings(d, b.id))).not.toContain("description");
    sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id=?").run(a.id);
    await expect(s.getStayListing(d, b.id, id)).rejects.toMatchObject({ code: "not_found" });
    expect((await s.listStayListings(d, b.id)).listings).toEqual([]);
  });

  it("exposes media_keys to the owner only, and no contact without a phone", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await s.createListing(d, a, base({ mediaPaths: [`${a.id}/a.jpg`] }), T0);
    expect((await s.getStayListing(d, a.id, id)).media_keys).toEqual([`${a.id}/a.jpg`]);
    const seen = await s.getStayListing(d, b.id, id);
    expect(seen.media_keys).toBeUndefined();
    expect(seen.contact).toBeNull();
  });
});

describe("listings read", () => {
  it("lists newest first with cover and cursor pagination", async () => {
    const a = await member("a@x.ma");
    const ids: number[] = [];
    for (let i = 0; i < 25; i++) ids.push(raw(a.id, { title: `l${i}` }));
    sqlite.prepare("INSERT INTO st_listing_media (listing_id, r2_key, position) VALUES (?,?,0)").run(ids[24], `${a.id}/cover.jpg`);
    const p1 = await s.listStayListings(d, a.id);
    expect(p1.listings).toHaveLength(20);
    expect(p1.listings[0]).toMatchObject({ id: ids[24], cover: `${a.id}/cover.jpg`, host: { display_name: "Amina B." } });
    const p2 = await s.listStayListings(d, a.id, { cursor: p1.nextCursor });
    expect(p2.listings).toHaveLength(5);
    expect(p2.nextCursor).toBeNull();
  });

  it("filters by kind, city, text, price type, guests and mine", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    raw(a.id, { title: "Chambre Maârif", kind: "chambre", city: "Casablanca", area: "Maârif", capacity: 2 });
    raw(a.id, { title: "Grande maison", kind: "maison", city: "Rabat", capacity: 8, price_type: "prix", price: 200 });
    raw(b.id, { title: "Studio Agdal", kind: "studio", city: "Rabat", capacity: 2, price_type: "participation", price: 50 });
    const ids = async (o: s.StaySearch) => (await s.listStayListings(d, a.id, o)).listings.map(l => l.title);
    expect(await ids({ kind: "chambre" })).toEqual(["Chambre Maârif"]);
    expect(await ids({ city: "rabat" })).toEqual(["Studio Agdal", "Grande maison"]);
    expect(await ids({ q: "agdal" })).toEqual(["Studio Agdal"]);
    expect(await ids({ q: "Maârif" })).toEqual(["Chambre Maârif"]);
    expect(await ids({ priceType: "prix" })).toEqual(["Grande maison"]);
    expect(await ids({ guests: 4 })).toEqual(["Grande maison"]);
    expect(await ids({ mine: true })).toEqual(["Grande maison", "Chambre Maârif"]);
    await expect(s.listStayListings(d, a.id, { kind: "chateau" })).rejects.toMatchObject({ code: "invalid" });
    await expect(s.listStayListings(d, a.id, { from: N.to, to: N.from })).rejects.toMatchObject({ code: "invalid" });
  });

  it("keeps only free windows: availability bound and pending/accepted requests block dates", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const open = raw(a.id, { title: "Toujours libre" });
    const late = raw(a.id, { title: "Plus tard", available_from: "2026-12-01" });
    const early = raw(a.id, { title: "Bientôt fini", available_to: "2026-10-20" });
    const booked = raw(a.id, { title: "Déjà pris" });
    const cancelled = raw(a.id, { title: "Annulé" });
    rawRequest(booked, b.id, a.id, { status: "pending" });
    rawRequest(cancelled, b.id, a.id, { status: "cancelled" });
    const found = async (o: s.StaySearch) => (await s.listStayListings(d, b.id, o)).listings.map(l => l.title);
    const all = await found({ from: N.from, to: N.to });
    expect(all).toContain("Toujours libre");
    expect(all).toContain("Annulé");
    expect(all).not.toContain("Déjà pris");
    expect(all).not.toContain("Plus tard");
    expect(all).not.toContain("Bientôt fini");
    expect(await found({ from: "2026-12-05", to: "2026-12-08" })).toContain("Plus tard");
    expect(await found({ from: "2026-10-21" })).not.toContain("Bientôt fini");
    // a non-overlapping window still sees the booked listing
    expect(await found({ from: "2027-01-01", to: "2027-01-03" })).toContain("Déjà pris");
  });
});

describe("requests", () => {
  it("creates a request and blocks self-booking, past dates, bad windows and overlaps", async () => {
    const host = await member("host@x.ma", "Hôte");
    const guest = await member("guest@x.ma", "Invité");
    const { id } = await s.createListing(d, host, base({ capacity: 2, availableFrom: "2026-10-15", availableTo: "2026-12-31" }), T0);
    await expect(s.createRequest(d, host, id, req(), T0)).rejects.toMatchObject({ code: "invalid" }); // own listing
    await expect(s.createRequest(d, guest, id, req({ startDate: "2026-10-01" }), T0)).rejects.toMatchObject({ code: "invalid" }); // past
    await expect(s.createRequest(d, guest, id, req({ startDate: N.to, endDate: N.from }), T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(s.createRequest(d, guest, id, req({ startDate: N.from, endDate: "2027-03-01" }), T0)).rejects.toMatchObject({ code: "invalid" }); // > 60 nights
    await expect(s.createRequest(d, guest, id, req({ guests: 3 }), T0)).rejects.toMatchObject({ code: "invalid" }); // capacity
    await expect(s.createRequest(d, guest, id, req({ startDate: "2026-10-11" }), T0)).rejects.toMatchObject({ code: "invalid" }); // before available_from
    await expect(s.createRequest(d, guest, id, req({ endDate: "2027-01-02" }), T0)).rejects.toMatchObject({ code: "invalid" }); // after available_to
    await expect(s.createRequest(d, guest, id, req({ message: "  " }), T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(s.createRequest(d, guest, 9999, req(), T0)).rejects.toMatchObject({ code: "not_found" });
    const { id: requestId } = await s.createRequest(d, guest, id, req({ guests: 2 }), T0);
    expect(requestId).toBeGreaterThan(0);
    // pending already blocks the dates for everyone, including another guest
    await expect(s.createRequest(d, guest, id, req({ startDate: "2026-11-04", endDate: "2026-11-08" }), T0 + 1)).rejects.toMatchObject({ code: "invalid" });
    await expect(s.createRequest(d, guest, id, req({ startDate: "2026-11-06", endDate: "2026-11-09" }), T0 + 2)).resolves.toBeTruthy();
  });

  it("rate-limits 10 requests per 24 hours", async () => {
    const host = await member("host@x.ma", "Hôte"); const guest = await member("guest@x.ma", "Invité");
    const { id } = await s.createListing(d, host, base(), T0);
    for (let i = 0; i < 10; i++) await s.createRequest(d, guest, id, req({ startDate: `2027-${String(i + 1).padStart(2, "0")}-01`, endDate: `2027-${String(i + 1).padStart(2, "0")}-03` }), T0 + i);
    await expect(s.createRequest(d, guest, id, req({ startDate: "2027-11-01", endDate: "2027-11-03" }), T0 + 20)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("decides: host accepts/declines, guest cancels, outsiders get a 404, double decisions rejected", async () => {
    const host = await member("host@x.ma", "Hôte"); const guest = await member("guest@x.ma", "Invité"); const other = await member("other@x.ma", "Autre");
    const { id } = await s.createListing(d, host, base(), T0);
    const a = (await s.createRequest(d, guest, id, req(), T0)).id;
    await expect(s.decideRequest(d, other, a, "accept", null, T0)).rejects.toMatchObject({ code: "not_found" });
    await expect(s.decideRequest(d, guest, a, "accept", null, T0)).rejects.toMatchObject({ code: "forbidden" });
    await expect(s.decideRequest(d, host, a, "maybe", null, T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(s.decideRequest(d, host, a, "decline", "  ", T0)).resolves.toBeUndefined();
    expect(await s.getRequestDetail(d, guest, a)).toMatchObject({ status: "declined", host_reply: null });
    await expect(s.decideRequest(d, host, a, "accept", null, T0 + 1)).rejects.toMatchObject({ code: "invalid" });

    const b = (await s.createRequest(d, guest, id, req({ startDate: "2026-12-01", endDate: "2026-12-04" }), T0 + 2)).id;
    await s.decideRequest(d, host, b, "accept", "Bienvenue !", T0 + 3);
    const accepted = await s.getRequestDetail(d, guest, b);
    expect(accepted).toMatchObject({ status: "accepted", host_reply: "Bienvenue !", role: "guest", can_review: true, decided_at: expect.any(String) });
    expect((await s.getRequestDetail(d, host, b)).role).toBe("host");
    expect((await s.getRequestDetail(d, host, b)).can_review).toBe(false);
    await s.decideRequest(d, guest, b, "cancel", null, T0 + 4);
    expect((await s.getRequestDetail(d, guest, b)).status).toBe("cancelled");
    await expect(s.decideRequest(d, guest, b, "cancel", null, T0 + 5)).rejects.toMatchObject({ code: "invalid" });

    const c = (await s.createRequest(d, guest, id, req({ startDate: "2027-01-01", endDate: "2027-01-04" }), T0 + 6)).id;
    await s.decideRequest(d, host, c, "cancel", null, T0 + 7);
    expect((await s.getRequestDetail(d, host, c)).status).toBe("cancelled");
    await expect(s.getRequestDetail(d, other, c)).rejects.toMatchObject({ code: "not_found" });
    await expect(s.decideRequest(d, host, 9999, "accept", null, T0)).rejects.toMatchObject({ code: "not_found" });
  });

  it("lists my requests per role with the other party, cover and unread count", async () => {
    const host = await member("host@x.ma", "Hôte"); const guest = await member("guest@x.ma", "Invité");
    const { id } = await s.createListing(d, host, base(), T0);
    sqlite.prepare("INSERT INTO st_listing_media (listing_id, r2_key, position) VALUES (?,?,0)").run(id, `${host.id}/c.jpg`);
    const r1 = rawRequest(id, guest.id, host.id);
    sqlite.prepare("INSERT INTO st_request_messages (request_id, sender_id, body) VALUES (?,?,?)").run(r1, guest.id, "Une question");
    const asGuest = await s.listMyRequests(d, guest.id, "guest");
    expect(asGuest).toHaveLength(1);
    expect(asGuest[0]).toMatchObject({ id: r1, listing_title: "Chambre d'amis", cover: `${host.id}/c.jpg`, other: { display_name: "Hôte B." }, unread: 0 });
    expect(await s.listMyRequests(d, host.id, "guest")).toEqual([]);
    expect(await s.listMyRequests(d, host.id, "host")).toHaveLength(1);
    expect((await s.listMyRequests(d, host.id, "host"))[0].unread).toBe(1);
    expect(await s.listMyRequests(d, host.id, "all")).toHaveLength(1);
    expect(await s.unreadTotal(d, host.id)).toBe(2); // one unread message + one pending request
    expect(await s.unreadTotal(d, guest.id)).toBe(0);
    await expect(s.listMyRequests(d, guest.id, "x" as any)).rejects.toMatchObject({ code: "invalid" });
    await s.hideStayListing(d, id);
    expect(await s.listMyRequests(d, host.id, "all")).toEqual([]);
  });
});

describe("request messages", () => {
  it("keeps the thread between participants only and freezes it once closed", async () => {
    const host = await member("host@x.ma", "Hôte"); const guest = await member("guest@x.ma", "Invité"); const other = await member("other@x.ma", "Autre");
    const { id } = await s.createListing(d, host, base(), T0);
    const r = (await s.createRequest(d, guest, id, req(), T0)).id;
    await expect(s.sendRequestMessage(d, other, r, "coucou", T0)).rejects.toMatchObject({ code: "not_found" });
    await expect(s.sendRequestMessage(d, guest, r, "  ", T0)).rejects.toMatchObject({ code: "invalid" });
    await s.sendRequestMessage(d, guest, r, "Bonjour", T0 + 1);
    await s.sendRequestMessage(d, host, r, "Bien sûr, à bientôt", T0 + 2);
    const thread = await s.listRequestMessages(d, host, r);
    expect(thread.messages.map(m => m.body)).toEqual(["Bonjour", "Bien sûr, à bientôt"]);
    expect(thread.other).toMatchObject({ display_name: "Invité B." });
    expect(thread.request).toMatchObject({ id: r, status: "pending", listing: { id, title: "Chambre d'amis" } });
    expect(await s.unreadTotal(d, host.id)).toBe(2); // one unread message + one pending request
    await s.markRequestRead(d, host, r, T0 + 3);
    expect((await s.listRequestMessages(d, host, r)).messages.find(m => m.body === "Bonjour")!.read_at).not.toBeNull();
    expect(await s.unreadTotal(d, host.id)).toBe(1); // only the pending request remains
    await s.decideRequest(d, host, r, "decline", null, T0 + 4);
    await expect(s.sendRequestMessage(d, guest, r, "encore ?", T0 + 5)).rejects.toMatchObject({ code: "forbidden" });
    // an admin-hidden message leaves the thread
    const other2 = (await s.createRequest(d, other, id, req({ startDate: "2027-02-01", endDate: "2027-02-04" }), T0 + 6)).id;
    await s.sendRequestMessage(d, other, other2, "message abusif", T0 + 7);
    const mid = (await s.listRequestMessages(d, host, other2)).messages[0].id;
    await s.hideStayContent(d, "message", mid);
    expect((await s.listRequestMessages(d, host, other2)).messages).toEqual([]);
    // a hidden listing freezes its conversations
    await s.hideStayListing(d, id);
    await expect(s.sendRequestMessage(d, other, other2, "toujours là ?", T0 + 8)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rate-limits 60 messages per hour", async () => {
    const host = await member("host@x.ma", "Hôte"); const guest = await member("guest@x.ma", "Invité");
    const { id } = await s.createListing(d, host, base(), T0);
    const r = (await s.createRequest(d, guest, id, req(), T0)).id;
    for (let i = 0; i < 60; i++) await s.sendRequestMessage(d, guest, r, `m${i}`, T0 + i);
    await expect(s.sendRequestMessage(d, guest, r, "trop", T0 + 100)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(s.sendRequestMessage(d, guest, r, "ok", T0 + HOUR + 1)).resolves.toBeTruthy();
  });
});

describe("reviews", () => {
  it("lets the guest review an accepted stay once, and feeds the listing rating", async () => {
    const host = await member("host@x.ma", "Hôte"); const guest = await member("guest@x.ma", "Invité"); const other = await member("other@x.ma", "Autre");
    const { id } = await s.createListing(d, host, base(), T0);
    const r = (await s.createRequest(d, guest, id, req(), T0)).id;
    await expect(s.reviewRequest(d, guest, r, 5, "ok", T0)).rejects.toMatchObject({ code: "invalid" }); // still pending
    await s.decideRequest(d, host, r, "accept", null, T0 + 1);
    await expect(s.reviewRequest(d, host, r, 5, "ok", T0 + 2)).rejects.toMatchObject({ code: "forbidden" });
    await expect(s.reviewRequest(d, other, r, 5, "ok", T0 + 2)).rejects.toMatchObject({ code: "forbidden" });
    await expect(s.reviewRequest(d, guest, r, 0, "ok", T0 + 2)).rejects.toMatchObject({ code: "invalid" });
    await expect(s.reviewRequest(d, guest, r, 6, "ok", T0 + 2)).rejects.toMatchObject({ code: "invalid" });
    await expect(s.reviewRequest(d, guest, r, 2.5, "ok", T0 + 2)).rejects.toMatchObject({ code: "invalid" });
    await expect(s.reviewRequest(d, guest, r, 4, "x".repeat(501), T0 + 2)).rejects.toMatchObject({ code: "invalid" });
    await s.reviewRequest(d, guest, r, 4, "Séjour très agréable", T0 + 3);
    await expect(s.reviewRequest(d, guest, r, 5, "encore", T0 + 4)).rejects.toMatchObject({ code: "invalid" });
    const detail = await s.getStayListing(d, other.id, id);
    expect(detail.rating).toBe(4);
    expect(detail.review_count).toBe(1);
    expect(detail.reviews[0]).toMatchObject({ rating: 4, body: "Séjour très agréable", author: { display_name: "Invité B." } });
    const r2 = (await s.createRequest(d, other, id, req({ startDate: "2027-03-01", endDate: "2027-03-04" }), T0 + 5)).id;
    await s.decideRequest(d, host, r2, "accept", null, T0 + 6);
    await s.reviewRequest(d, other, r2, 5, "", T0 + 7);
    const rated = await s.getStayListing(d, other.id, id);
    expect(rated.rating).toBe(4.5);
    expect(rated.review_count).toBe(2);
    await expect(s.getRequestDetail(d, guest, r)).resolves.toMatchObject({ can_review: false, review: { rating: 4 } });
  });
});

describe("reports and admin", () => {
  it("reports a listing or a message once, lists and dismisses them", async () => {
    const host = await member("host@x.ma", "Hôte"); const guest = await member("guest@x.ma", "Invité");
    const { id } = await s.createListing(d, host, base(), T0);
    const r = (await s.createRequest(d, guest, id, req(), T0)).id;
    await s.sendRequestMessage(d, host, r, "message limite", T0 + 1);
    const mid = (await s.listRequestMessages(d, host, r)).messages[0].id;
    await expect(s.reportStay(d, guest, "user" as any, id, "motif")).rejects.toMatchObject({ code: "invalid" });
    await expect(s.reportStay(d, guest, "listing", 9999, "motif")).rejects.toMatchObject({ code: "not_found" });
    await expect(s.reportStay(d, guest, "listing", id, "  ")).rejects.toMatchObject({ code: "invalid" });
    await s.reportStay(d, guest, "listing", id, "Annonce trompeuse");
    await s.reportStay(d, guest, "listing", id, "Annonce trompeuse"); // idempotent
    await s.reportStay(d, host, "message", mid, "Message agressif");
    const reports = await s.listStayReports(d);
    expect(reports).toHaveLength(2);
    expect(reports.map(x => x.target_type).sort()).toEqual(["listing", "message"]);
    expect(reports.find(x => x.target_type === "listing")).toMatchObject({ target_id: id, reporter: "Invité B.", body: "Chambre d'amis", target_status: "active" });
    await s.dismissStayReport(d, reports[0].id);
    expect(await s.listStayReports(d)).toHaveLength(1);
  });

  it("hides a reported listing through the admin surface and lists listings for admins", async () => {
    const host = await member("host@x.ma", "Hôte");
    const { id } = await s.createListing(d, host, base(), T0);
    const adminView = await s.adminListStayListings(d);
    expect(adminView[0]).toMatchObject({ id, title: "Chambre d'amis", host: "Hôte B.", status: "active" });
    await expect(s.hideStayContent(d, "listing", 9999)).rejects.toMatchObject({ code: "not_found" });
    await expect(s.hideStayContent(d, "x" as any, id)).rejects.toMatchObject({ code: "invalid" });
    await s.hideStayContent(d, "listing", id);
    expect((await s.adminListStayListings(d))[0].status).toBe("hidden");
  });
});
