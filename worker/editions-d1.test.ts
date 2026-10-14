import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { fakeD1, openDb } from "./test-d1";
import { activateEdition, activeEdition, archiveEdition, editionFilter, listEditions, setupCalendar, unarchiveEdition } from "./editions-d1";

const MIGRATION = readFileSync(new URL("./d1/editions.sql", import.meta.url), "utf8");

function setup(migrate = true) {
  const sqlite = openDb();
  // prod shape before the migration (see schema.generated.sql)
  sqlite.exec(`CREATE TABLE t_ramadan_days (id INTEGER PRIMARY KEY AUTOINCREMENT, day_number INTEGER NOT NULL, date TEXT NOT NULL, hijri_date TEXT, capacity INTEGER NOT NULL DEFAULT 120, registered_count INTEGER NOT NULL DEFAULT 0, is_open INTEGER NOT NULL DEFAULT 1, iftar_time TEXT, location TEXT, notes TEXT, created_at TEXT, updated_at TEXT);
    CREATE UNIQUE INDEX uq_t_ramadan_days_1 ON t_ramadan_days(day_number);
    CREATE UNIQUE INDEX uq_t_ramadan_days_2 ON t_ramadan_days(date);
    ALTER TABLE t_volunteers ADD COLUMN day_id INTEGER;`);
  sqlite.prepare("INSERT INTO t_ramadan_days (day_number, date, is_open) VALUES (1,'2026-02-18',1),(2,'2026-02-19',1)").run();
  if (migrate) sqlite.exec(MIGRATION);
  return { sqlite, d: fakeD1(sqlite) };
}
const days = (sqlite: ReturnType<typeof openDb>, edition: number) => sqlite.prepare("SELECT * FROM t_ramadan_days WHERE edition = ? ORDER BY day_number").all(edition) as any[];
const CAL = { startDate: "2027-02-08", endDate: "2027-03-10", capacity: 150, iftarTime: "18:05", location: "Bab Rayan" };

describe("editions migration", () => {
  it("gives existing days edition 12 and lets editions share a day_number", () => {
    const { sqlite } = setup();
    expect(days(sqlite, 12)).toHaveLength(2);
    sqlite.prepare("INSERT INTO t_ramadan_days (day_number, date, edition) VALUES (1,'2027-02-08',13)").run();
    expect(days(sqlite, 13)).toHaveLength(1);
  });
  it("still refuses two days on the same date or the same day_number inside one edition", () => {
    const { sqlite } = setup();
    expect(() => sqlite.prepare("INSERT INTO t_ramadan_days (day_number, date, edition) VALUES (9,'2026-02-18',13)").run()).toThrow();
    expect(() => sqlite.prepare("INSERT INTO t_ramadan_days (day_number, date, edition) VALUES (1,'2026-03-01',12)").run()).toThrow();
  });
});

describe("activeEdition", () => {
  it("returns the active edition", async () => {
    const { d } = setup();
    expect(await activeEdition(d)).toBe(12);
  });
  it("returns null before the migration (callers then do not filter)", async () => {
    const { d } = setup(false);
    expect(await activeEdition(d)).toBeNull();
  });
});

describe("editionFilter", () => {
  it("filters on the active edition, shows nothing when none is active, and does not filter before the migration", async () => {
    const { d } = setup();
    expect(await editionFilter(d)).toBe(12);
    await archiveEdition(d, 12);
    expect(await editionFilter(d)).toBe(-1);
    expect(await editionFilter(setup(false).d)).toBeNull();
  });
});

describe("archive / unarchive", () => {
  it("archives the edition and closes its days without deleting anything", async () => {
    const { sqlite, d } = setup();
    await archiveEdition(d, 12);
    const s = sqlite.prepare("SELECT status, archived_at FROM edition_settings WHERE edition = 12").get() as any;
    expect(s.status).toBe("archived");
    expect(s.archived_at).toBeTruthy();
    expect(days(sqlite, 12).map(x => x.is_open)).toEqual([0, 0]);
    expect(await activeEdition(d)).toBeNull();
  });
  it("refuses to archive twice or an unknown edition", async () => {
    const { d } = setup();
    await archiveEdition(d, 12);
    await expect(archiveEdition(d, 12)).rejects.toThrow(/déjà archivée/);
    await expect(archiveEdition(d, 99)).rejects.toThrow(/introuvable/);
  });
  it("unarchive puts it back as a draft (days stay closed, nothing becomes active)", async () => {
    const { sqlite, d } = setup();
    await archiveEdition(d, 12);
    await unarchiveEdition(d, 12);
    expect((sqlite.prepare("SELECT status FROM edition_settings WHERE edition = 12").get() as any).status).toBe("draft");
    expect(await activeEdition(d)).toBeNull();
    await expect(unarchiveEdition(d, 13)).rejects.toThrow(/pas archivée/);
  });
});

describe("setupCalendar", () => {
  it("creates one closed day per date, inclusive, numbered from 1", async () => {
    const { sqlite, d } = setup();
    expect(await setupCalendar(d, 13, CAL)).toBe(31);
    const rows = days(sqlite, 13);
    expect(rows).toHaveLength(31);
    expect(rows[0]).toMatchObject({ day_number: 1, date: "2027-02-08", capacity: 150, iftar_time: "18:05", location: "Bab Rayan", is_open: 0, registered_count: 0 });
    expect(rows[30]).toMatchObject({ day_number: 31, date: "2027-03-10" });
  });
  it("refuses when the edition already has days, or is not a draft", async () => {
    const { d } = setup();
    await setupCalendar(d, 13, CAL);
    await expect(setupCalendar(d, 13, CAL)).rejects.toThrow(/déjà des jours/);
    await expect(setupCalendar(d, 12, CAL)).rejects.toThrow(/brouillon/);
  });
  it("refuses an invalid or oversized range and dates already used by another edition", async () => {
    const { d } = setup();
    await expect(setupCalendar(d, 13, { ...CAL, endDate: "2027-02-01" })).rejects.toThrow(/dates/i);
    await expect(setupCalendar(d, 13, { ...CAL, endDate: "2027-06-01" })).rejects.toThrow(/dates/i);
    await expect(setupCalendar(d, 13, { ...CAL, startDate: "2026-02-18", endDate: "2026-02-20" })).rejects.toThrow(/déjà utilisées/);
  });
  it("creates nothing when the range is rejected", async () => {
    const { sqlite, d } = setup();
    await setupCalendar(d, 13, { ...CAL, startDate: "2026-02-18", endDate: "2026-02-20" }).catch(() => {});
    expect(days(sqlite, 13)).toHaveLength(0);
  });
});

describe("activateEdition", () => {
  it("needs the current edition archived first, and days to exist", async () => {
    const { d } = setup();
    await expect(activateEdition(d, 13)).rejects.toThrow(/Archivez d'abord/);
    await archiveEdition(d, 12);
    await expect(activateEdition(d, 13)).rejects.toThrow(/aucun jour/);
  });
  it("makes the edition the only active one", async () => {
    const { d } = setup();
    await setupCalendar(d, 13, CAL);
    await archiveEdition(d, 12);
    await activateEdition(d, 13);
    expect(await activeEdition(d)).toBe(13);
    const list = await listEditions(d);
    expect(list.map(e => [e.edition, e.status, e.days])).toEqual([[12, "archived", 2], [13, "active", 31]]);
  });
});
