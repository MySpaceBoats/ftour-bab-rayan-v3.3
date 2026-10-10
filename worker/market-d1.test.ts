import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import * as h from "./hub-d1";
import * as mk from "./market-d1";

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

const T0 = Date.parse("2026-10-10T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
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

const base = (over: Partial<mk.ListingInput> = {}): mk.ListingInput => ({
  title: "Vélo enfant", description: "Très bon état", price: 150, category: "enfants", condition: "bon", city: "Casablanca", ...over,
});

/** Insert a listing directly (bypasses the daily rate limit) for list/search/pagination tests. */
function raw(memberId: number, over: Record<string, unknown> = {}) {
  const o = { title: "Objet", description: "desc", price: 10, category: "autre", item_condition: "bon", city: "", status: "active", ...over };
  return Number(sqlite.prepare(
    "INSERT INTO mk_listings (member_id,title,description,price,category,item_condition,city,status) VALUES (?,?,?,?,?,?,?,?)",
  ).run(memberId, o.title, o.description, o.price, o.category, o.item_condition, o.city, o.status).lastInsertRowid);
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE t_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, status TEXT);");
  for (const f of ["hub.sql", "marketplace.sql"]) {
    const sql = readFileSync(new URL(`./d1/${f}`, import.meta.url), "utf8");
    sqlite.exec(sql);
    sqlite.exec(sql); // idempotent
  }
  d = fakeD1(sqlite);
});

describe("normalizePhone", () => {
  it("accepts empty, strips separators, validates digits", () => {
    expect(mk.normalizePhone(undefined)).toBeNull();
    expect(mk.normalizePhone("")).toBeNull();
    expect(mk.normalizePhone("  ")).toBeNull();
    expect(mk.normalizePhone("+212 6.12-34 56 78")).toBe("+212612345678");
    expect(mk.normalizePhone("06 12 34 56 78")).toBe("0612345678");
    for (const bad of ["abc", "123", "+1234567890123456", "12 34 56 7a 89", 5, {}]) {
      expect(() => mk.normalizePhone(bad as any)).toThrow(/Téléphone invalide/);
    }
  });
});

describe("listings write", () => {
  it("creates with photos; validates every field", async () => {
    const a = await member("a@x.ma");
    const { id } = await mk.createListing(d, a, base({ mediaPaths: [`${a.id}/a.jpg`, `${a.id}/b.jpg`], phone: "+212 612345678", whatsapp: true }), T0);
    const got = await mk.getListing(d, a.id, id);
    expect(got).toMatchObject({ title: "Vélo enfant", price: 150, category: "enfants", condition: "bon", status: "active", mine: true, contact: { phone: "+212612345678", whatsapp: true } });
    expect(got.media).toEqual([`${a.id}/a.jpg`, `${a.id}/b.jpg`]);
    const bad = async (over: Partial<mk.ListingInput>) => expect(mk.createListing(d, a, base(over), T0)).rejects.toMatchObject({ code: "invalid" });
    await bad({ title: "  " });
    await bad({ title: "x".repeat(81) });
    await bad({ description: "" });
    await bad({ price: -1 });
    await bad({ price: 1.5 });
    await bad({ price: NaN });
    await bad({ price: 10_000_000 });
    await bad({ category: "voitures" });
    await bad({ condition: "casse" });
    await bad({ city: "v".repeat(61) });
    await bad({ phone: "12" });
    await bad({ phone: "0612345678", whatsapp: true }); // WhatsApp needs +country code
    await bad({ mediaPaths: [1, 2, 3, 4, 5].map(i => `${a.id}/${i}.jpg`) });
    await bad({ mediaPaths: ["999/x.jpg"] });
    await bad({ mediaPaths: [`${a.id}/../x.jpg`] });
    await expect(mk.createListing(d, a, base({ price: 0 }), T0 + 5)).resolves.toBeTruthy(); // free is allowed
  });

  it("rate-limits 5 listings per 24 hours", async () => {
    const a = await member("a@x.ma");
    for (let i = 0; i < 5; i++) await mk.createListing(d, a, base({ title: `t${i}` }), T0 + i);
    await expect(mk.createListing(d, a, base(), T0 + 10)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(mk.createListing(d, a, base(), T0 + DAY + 100)).resolves.toBeTruthy();
  });

  it("stores markup as text and a phone-less listing exposes no contact", async () => {
    const a = await member("a@x.ma");
    const { id } = await mk.createListing(d, a, base({ title: "<script>alert(1)</script>" }), T0);
    const got = await mk.getListing(d, a.id, id);
    expect(got.title).toBe("<script>alert(1)</script>");
    expect(got.contact).toBeNull();
    expect((got as any).contact_phone).toBeUndefined();
  });

  it("update: owner only, replaces photos, not on hidden", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await mk.createListing(d, a, base({ mediaPaths: [`${a.id}/a.jpg`] }), T0);
    await expect(mk.updateListing(d, b, id, base(), T0 + 1)).rejects.toMatchObject({ code: "forbidden" });
    await mk.updateListing(d, a, id, base({ title: "Nouveau", price: 99, mediaPaths: [`${a.id}/c.jpg`, `${a.id}/d.jpg`] }), T0 + 2);
    expect(await mk.getListing(d, a.id, id)).toMatchObject({ title: "Nouveau", price: 99, media: [`${a.id}/c.jpg`, `${a.id}/d.jpg`] });
    await mk.hideListing(d, id);
    await expect(mk.updateListing(d, a, id, base(), T0 + 3)).rejects.toMatchObject({ code: "not_found" });
    await expect(mk.updateListing(d, a, 9999, base(), T0 + 3)).rejects.toMatchObject({ code: "not_found" });
  });

  it("status sold/active: owner only; invalid values rejected", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await mk.createListing(d, a, base(), T0);
    await expect(mk.setListingStatus(d, b, id, "sold", T0)).rejects.toMatchObject({ code: "forbidden" });
    await expect(mk.setListingStatus(d, a, id, "hidden" as any, T0)).rejects.toMatchObject({ code: "invalid" });
    await mk.setListingStatus(d, a, id, "sold", T0 + 1);
    expect((await mk.getListing(d, a.id, id)).status).toBe("sold");
    await mk.setListingStatus(d, a, id, "active", T0 + 2);
    expect((await mk.getListing(d, a.id, id)).status).toBe("active");
  });

  it("hide: owner, moderator or admin; others forbidden; hidden is 404 and leaves the list", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const mod = await member("m@x.ma", "Mona", "moderator");
    const l1 = (await mk.createListing(d, a, base({ title: "l1" }), T0)).id;
    const l2 = (await mk.createListing(d, a, base({ title: "l2" }), T0 + 1)).id;
    const l3 = (await mk.createListing(d, a, base({ title: "l3" }), T0 + 2)).id;
    await expect(mk.hideListing(d, l1, b)).rejects.toMatchObject({ code: "forbidden" });
    await mk.hideListing(d, l1, a);
    await mk.hideListing(d, l2, mod);
    await mk.hideListing(d, l3); // admin
    for (const x of [l1, l2, l3]) await expect(mk.getListing(d, b.id, x)).rejects.toMatchObject({ code: "not_found" });
    expect((await mk.listListings(d, b.id)).listings).toEqual([]);
    await expect(mk.hideListing(d, 9999)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("listings read", () => {
  it("list: newest first, cover photo, cursor pagination, no description or phone", async () => {
    const a = await member("a@x.ma");
    const ids: number[] = [];
    for (let i = 0; i < 25; i++) ids.push(raw(a.id, { title: `o${i}` }));
    sqlite.prepare("INSERT INTO mk_listing_media (listing_id, r2_key, position) VALUES (?,?,0)").run(ids[24], `${a.id}/cover.jpg`);
    sqlite.prepare("UPDATE mk_listings SET contact_phone='+212600000000' WHERE id=?").run(ids[24]);
    const p1 = await mk.listListings(d, a.id);
    expect(p1.listings).toHaveLength(20);
    expect(p1.listings[0]).toMatchObject({ id: ids[24], cover: `${a.id}/cover.jpg`, seller: { display_name: "Amina B." } });
    expect(JSON.stringify(p1)).not.toContain("+212600000000");
    expect(JSON.stringify(p1)).not.toContain("description");
    const p2 = await mk.listListings(d, a.id, { cursor: p1.nextCursor });
    expect(p2.listings).toHaveLength(5);
    expect(p2.nextCursor).toBeNull();
  });

  it("filters: category, mine, sold stays visible, hidden excluded; bad category rejected", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    raw(a.id, { title: "livre 1", category: "livres" });
    raw(b.id, { title: "table", category: "maison" });
    raw(b.id, { title: "vendu", category: "maison", status: "sold" });
    raw(b.id, { title: "masque", category: "maison", status: "hidden" });
    expect((await mk.listListings(d, a.id, { category: "maison" })).listings.map(l => l.title).sort()).toEqual(["table", "vendu"]);
    expect((await mk.listListings(d, a.id, { mine: true })).listings.map(l => l.title)).toEqual(["livre 1"]);
    await expect(mk.listListings(d, a.id, { category: "voitures" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("search: title or description, wildcards are literal, long patterns rejected", async () => {
    const a = await member("a@x.ma");
    raw(a.id, { title: "Table basse", description: "bois" });
    raw(a.id, { title: "Lampe", description: "pour la table" });
    raw(a.id, { title: "Remise 50%", description: "x" });
    raw(a.id, { title: "a_b", description: "x" });
    const t = async (q: string) => (await mk.listListings(d, a.id, { q })).listings.map(l => l.title).sort();
    expect(await t("table")).toEqual(["Lampe", "Table basse"]);
    expect(await t("50%")).toEqual(["Remise 50%"]);
    expect(await t("%")).toEqual(["Remise 50%"]);
    expect(await t("_")).toEqual(["a_b"]);
  });

  it("search too long -> invalid", async () => {
    const a = await member("a@x.ma");
    await expect(mk.listListings(d, a.id, { q: "é".repeat(30) })).rejects.toMatchObject({ code: "invalid" });
    await expect(mk.listListings(d, a.id, { q: "x".repeat(49) })).rejects.toMatchObject({ code: "invalid" });
    await expect(mk.listListings(d, a.id, { q: "x".repeat(48) })).resolves.toBeTruthy();
  });

  it("sellers that are suspended or no longer confirmed vanish (list and detail)", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const la = raw(a.id, { title: "de A" });
    const lb = raw(b.id, { title: "de B" });
    sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id=?").run(a.id);
    sqlite.prepare("UPDATE t_volunteers SET status='cancelled' WHERE email='b@x.ma'").run();
    const viewer = await member("c@x.ma", "Chakib");
    expect((await mk.listListings(d, viewer.id)).listings).toEqual([]);
    await expect(mk.getListing(d, viewer.id, la)).rejects.toMatchObject({ code: "not_found" });
    await expect(mk.getListing(d, viewer.id, lb)).rejects.toMatchObject({ code: "not_found" });
  });

  it("detail: mine flag, contact whatsapp flag, raw media keys only for the owner", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await mk.createListing(d, a, base({ phone: "0612345678", mediaPaths: [`${a.id}/a.jpg`] }), T0);
    const asOwner = await mk.getListing(d, a.id, id);
    const asOther = await mk.getListing(d, b.id, id);
    expect(asOwner).toMatchObject({ mine: true, contact: { phone: "0612345678", whatsapp: false } });
    expect(asOther).toMatchObject({ mine: false, contact: { phone: "0612345678", whatsapp: false } });
    expect(asOwner.media_keys).toEqual([`${a.id}/a.jpg`]);
    expect(asOther.media_keys).toBeUndefined();
    await expect(mk.getListing(d, a.id, 9999)).rejects.toMatchObject({ code: "not_found" });
  });
});
