import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import * as s from "./site-d1";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

function fakeD1(sqlite: InstanceType<typeof DatabaseSync>): D1Like {
  const stmt = (sql: string, params: unknown[] = []): D1Stmt => ({
    bind: (...v) => stmt(sql, v),
    all: async () => ({ results: sqlite.prepare(sql).all(...(params as any[])) as any[] }),
    first: async () => ((sqlite.prepare(sql).get(...(params as any[])) as any) ?? null),
    run: async () => sqlite.prepare(sql).run(...(params as any[])),
  });
  return { prepare: sql => stmt(sql), batch: async x => Promise.all(x.map(y => y.run())) };
}

let d: D1Like;
beforeEach(() => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("./d1/site.sql", import.meta.url), "utf8"));
  d = fakeD1(db);
});
const member = (over: Partial<s.NewTeamMember> = {}): s.NewTeamMember => ({
  firstName: "A", lastName: "B", role: null, citation: null, photoUrl: null, displayOrder: 0, edition: 12, ...over,
});

describe("site-d1", () => {
  it("team: public list is active-only, ordered, booleans mapped", async () => {
    const a = await s.createTeam(d, member({ displayOrder: 2 }));
    const b = await s.createTeam(d, member({ firstName: "Z", displayOrder: 1 }));
    await s.createTeam(d, member({ edition: 11 }));
    expect(a?.is_active).toBe(true);
    await s.updateTeam(d, a!.id, { is_active: false });
    expect((await s.listTeam(d, { edition: 12, onlyActive: true })).map((m: any) => m.id)).toEqual([b!.id]);
    expect(await s.listTeam(d, {})).toHaveLength(3);
  });

  it("team: update skips undefined, reorder, delete", async () => {
    const a = await s.createTeam(d, member({ role: "chef" }));
    const b = await s.createTeam(d, member());
    const u = await s.updateTeam(d, a!.id, { first_name: "X", role: undefined });
    expect(u).toMatchObject({ first_name: "X", role: "chef" });
    await s.reorderTeam(d, [b!.id, a!.id]);
    expect((await s.listTeam(d, {})).map((m: any) => m.id)).toEqual([b!.id, a!.id]);
    await s.deleteTeam(d, a!.id);
    expect(await s.listTeam(d, {})).toHaveLength(1);
  });

  it("contact: insert, list newest first, mark read", async () => {
    const { id } = await s.insertContact(d, { name: "n", email: "e@x.y", message: "hello world" });
    await s.insertContact(d, { name: "m", email: "e@x.y", message: "second one!", subject: "s" });
    await s.markContactRead(d, id);
    const list = await s.listContacts(d);
    expect(list.map((m: any) => m.name)).toEqual(["m", "n"]);
    expect(list.find((m: any) => m.id === id)?.is_read).toBe(true);
  });

  it("partner lead: defaults source to website", async () => {
    const id = await s.insertPartnerLead(d, { companyName: "C", contactName: "N", email: "a@b.c" });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
