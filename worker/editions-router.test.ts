/** Edition scoping through the real router and the D1 adapter (no network: every table used here is served from D1). */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { fakeD1 } from "./test-d1";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

function setup() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("./d1/schema.generated.sql", import.meta.url), "utf8"));
  sqlite.exec(`CREATE TABLE edition_settings (edition INTEGER PRIMARY KEY, status TEXT NOT NULL, archived_at TEXT, created_at TEXT);
    INSERT INTO edition_settings (edition, status) VALUES (12,'active'),(13,'draft');
    INSERT INTO t_ramadan_days (id, day_number, date, edition, is_open) VALUES (1,1,'2026-02-18',12,1),(2,2,'2026-02-19',12,1),(3,1,'2027-02-08',13,0);`);
  const vol = (id: number, day: number) =>
    sqlite.prepare("INSERT INTO t_volunteers (id, first_name, last_name, email, phone, day_id, qr_token) VALUES (?,?,?,?,?,?,?)").run(id, `V${id}`, "X", `v${id}@x.ma`, "0600000000", day, `qr${id}`);
  vol(1, 1); vol(2, 2); vol(3, 3);
  const env: any = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k", DB: fakeD1(sqlite) };
  const caller = (role?: string) =>
    appRouter.createCaller({ req: new Request("https://w.test"), env, user: role ? ({ id: 1, openId: "o", name: "A", email: "a@x.ma", role, isDemo: false } as any) : null } as any);
  return { sqlite, caller };
}
const ids = (rows: { id: number }[]) => rows.map(r => r.id).sort();

describe("edition scoping", () => {
  it("public days.list only shows the active edition", async () => {
    const { caller } = setup();
    expect(ids(await caller().days.list())).toEqual([1, 2]);
  });
  it("an admin can read another edition's days, a visitor cannot", async () => {
    const { caller } = setup();
    expect(ids(await caller("super_admin").days.list({ edition: 13 }))).toEqual([3]);
    expect(ids(await caller().days.list({ edition: 13 }))).toEqual([1, 2]);
  });
  it("volunteers.listByDay defaults to the active edition and accepts an edition", async () => {
    const { caller } = setup();
    const admin = caller("super_admin");
    expect(ids((await admin.volunteers.listByDay({})).volunteers as any)).toEqual([1, 2]);
    expect(ids((await admin.volunteers.listByDay({ edition: 13 })).volunteers as any)).toEqual([3]);
    expect(ids((await admin.volunteers.listByDay({ dayId: 3 })).volunteers as any)).toEqual([3]);
  });
  it("after the switch (12 archived, 13 active) the defaults follow", async () => {
    const { sqlite, caller } = setup();
    sqlite.exec("UPDATE edition_settings SET status='archived' WHERE edition=12; UPDATE edition_settings SET status='active' WHERE edition=13;");
    expect(ids(await caller().days.list())).toEqual([3]);
    expect(ids((await caller("super_admin").volunteers.listByDay({})).volunteers as any)).toEqual([3]);
    expect(ids((await caller("super_admin").volunteers.listByDay({ edition: 12 })).volunteers as any)).toEqual([1, 2]);
  });
});
