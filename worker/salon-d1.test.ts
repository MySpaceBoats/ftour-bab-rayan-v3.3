import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { D1Like } from "./gallery-d1";
import * as h from "./hub-d1";
import * as s from "./salon-d1";
import { fakeD1, openDb, type Sqlite } from "./test-d1";

const T0 = Date.parse("2026-10-10T12:00:00.000Z");
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
let sqlite: Sqlite;
let d: D1Like;

async function member(email: string, first = "Amina") {
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?,'confirmed')").run(first, "Benali", email);
  const { session } = await h.openSession(d, await h.createLoginToken(d, email, T0), T0);
  return (await h.getSession(d, session, T0 + 1))!;
}
const input = (over: Record<string, unknown> = {}) => ({ title: "Cuisine du Ramadan", topic: "Recettes et astuces pour l'iftar.", ...over });
const rejects = async (p: Promise<unknown>, code: h.HubErrorCode) => {
  const e = await p.then(() => null, (x: unknown) => x);
  expect(e).toBeInstanceOf(h.HubError);
  expect((e as h.HubError).code).toBe(code);
};

beforeEach(() => {
  sqlite = openDb();
  const ddl = readFileSync(new URL("./d1/salon.sql", import.meta.url).pathname, "utf8");
  sqlite.exec(ddl);
  sqlite.exec(ddl); // idempotent
  d = fakeD1(sqlite);
});

describe("salon create", () => {
  it("rejects bad payloads", async () => {
    const m = await member("a@x.ma");
    for (const bad of [{ title: "" }, { title: "   " }, { title: "x".repeat(81) }, { title: 5 }, { topic: "" }, { topic: "x".repeat(501) }, { topic: undefined }]) {
      await rejects(s.createSalon(d, m, input(bad), T0), "invalid");
    }
    await rejects(s.createSalon(d, m, null, T0), "invalid");
    expect((sqlite.prepare("SELECT COUNT(*) AS n FROM sl_salons").get() as { n: number }).n).toBe(0);
  });

  it("creates a salon with a random room and trims text", async () => {
    const m = await member("a@x.ma");
    const { id } = await s.createSalon(d, m, input({ title: "  Cuisine  " }), T0);
    const row = sqlite.prepare("SELECT * FROM sl_salons WHERE id = ?").get(id) as any;
    expect(row).toMatchObject({ title: "Cuisine", status: "active", member_id: m.id, last_post_at: null });
    expect(row.room).toMatch(/^[a-f0-9]{32}$/);
    const { id: id2 } = await s.createSalon(d, m, input(), T0);
    expect((sqlite.prepare("SELECT room FROM sl_salons WHERE id = ?").get(id2) as any).room).not.toBe(row.room);
  });

  it("limits to 5 salons per rolling day", async () => {
    const m = await member("a@x.ma");
    for (let i = 0; i < 5; i++) await s.createSalon(d, m, input(), T0 + i);
    await rejects(s.createSalon(d, m, input(), T0 + 10), "rate_limited");
    await s.createSalon(d, m, input(), T0 + DAY + 1000);
  });
});

describe("salon list / detail", () => {
  it("lists active salons without room, newest activity first, paginated", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma");
    const one = (await s.createSalon(d, a, input({ title: "Un" }), T0)).id;
    const two = (await s.createSalon(d, a, input({ title: "Deux" }), T0 + MIN)).id;
    const three = (await s.createSalon(d, b, input({ title: "Trois" }), T0 + 2 * MIN)).id;
    sqlite.prepare("UPDATE sl_salons SET last_post_at = ? WHERE id = ?").run(h.iso(T0 + 5 * MIN), one);

    const p1 = await s.listSalons(d, b.id, { limit: 2 });
    expect(p1.salons.map(x => x.id)).toEqual([one, three]);
    expect(p1.nextCursor).not.toBeNull();
    const p2 = await s.listSalons(d, b.id, { limit: 2, cursor: p1.nextCursor });
    expect(p2.salons.map(x => x.id)).toEqual([two]);
    expect(p2.nextCursor).toBeNull();
    expect(JSON.stringify(p1)).not.toContain("room");
    expect(p1.salons[1]).toMatchObject({ title: "Trois", mine: true, post_count: 0, creator: { id: b.id, display_name: "Amina B." } });
    expect(p1.salons[0].mine).toBe(false);
    await rejects(s.listSalons(d, b.id, { cursor: "garbage" }), "invalid");
  });

  it("hides archived, hidden and suspended-creator salons from the list", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma");
    const keep = (await s.createSalon(d, a, input(), T0)).id;
    const arch = (await s.createSalon(d, a, input(), T0)).id;
    const hid = (await s.createSalon(d, a, input(), T0)).id;
    const susp = (await s.createSalon(d, b, input(), T0)).id;
    sqlite.prepare("UPDATE sl_salons SET status='archived' WHERE id = ?").run(arch);
    sqlite.prepare("UPDATE sl_salons SET status='hidden' WHERE id = ?").run(hid);
    sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id = ?").run(b.id);
    expect((await s.listSalons(d, a.id)).salons.map(x => x.id)).toEqual([keep]);
    await rejects(s.getSalon(d, a.id, susp), "not_found");
  });

  it("detail exposes room; archived readable; hidden/unknown not found", async () => {
    const a = await member("a@x.ma");
    const id = (await s.createSalon(d, a, input(), T0)).id;
    const det = await s.getSalon(d, a.id, id);
    expect(det.room).toMatch(/^[a-f0-9]{32}$/);
    expect(det).toMatchObject({ id, mine: true, status: "active" });
    sqlite.prepare("UPDATE sl_salons SET status='archived' WHERE id = ?").run(id);
    expect((await s.getSalon(d, a.id, id)).status).toBe("archived");
    sqlite.prepare("UPDATE sl_salons SET status='hidden' WHERE id = ?").run(id);
    await rejects(s.getSalon(d, a.id, id), "not_found");
    await rejects(s.getSalon(d, a.id, 9999), "not_found");
  });
});

describe("salon archive / admin", () => {
  it("only the creator archives; archiving twice is harmless; it leaves the list", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma");
    const id = (await s.createSalon(d, a, input(), T0)).id;
    await rejects(s.archiveSalon(d, b, id), "forbidden");
    await s.archiveSalon(d, a, id);
    await s.archiveSalon(d, a, id);
    expect((await s.getSalon(d, a.id, id)).status).toBe("archived");
    expect((await s.listSalons(d, a.id)).salons).toEqual([]);
    await rejects(s.archiveSalon(d, a, 9999), "not_found");
  });

  it("admin lists, hides and deletes (messages included)", async () => {
    const a = await member("a@x.ma");
    const id = (await s.createSalon(d, a, input(), T0)).id;
    sqlite.prepare("INSERT INTO sl_posts (salon_id, member_id, body) VALUES (?,?,?)").run(id, a.id, "salut");
    const list = await s.adminListSalons(d);
    expect(list[0]).toMatchObject({ id, title: "Cuisine du Ramadan", status: "active", creator: "Amina B.", post_count: 1 });
    expect(JSON.stringify(list)).not.toContain("room");
    await s.hideSalon(d, id);
    expect((await s.adminListSalons(d))[0].status).toBe("hidden");
    await s.deleteSalon(d, id);
    expect(await s.adminListSalons(d)).toEqual([]);
    expect((sqlite.prepare("SELECT COUNT(*) AS n FROM sl_posts").get() as { n: number }).n).toBe(0);
    await rejects(s.hideSalon(d, id), "not_found");
    await rejects(s.deleteSalon(d, id), "not_found");
  });
});
