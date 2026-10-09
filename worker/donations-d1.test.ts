import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import * as n from "./donations-d1";

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
const don = (ref: string, over: Partial<n.NewDonation> = {}): n.NewDonation => ({
  reference: ref, donorName: "A", donorEmail: "a@b.c", amount: "100", paymentMethod: "transfer",
  status: "pending", isAnonymous: false, acceptsUpdates: true, ...over,
});

beforeEach(() => {
  const db = new DatabaseSync(":memory:");
  const sql = readFileSync(new URL("./d1/donations.sql", import.meta.url), "utf8");
  db.exec(sql);
  db.exec(sql); // idempotent
  d = fakeD1(db);
});

describe("donations-d1", () => {
  it("create/lookup by reference; booleans mapped; processed_by needs no users row", async () => {
    const { id } = await n.createDonation(d, don("DON-1"));
    expect(await n.byReference(d, "DON-1")).toMatchObject({ id, status: "pending", is_anonymous: false, accepts_updates: true });
    await n.setStatus(d, id, "received", 999);
    expect(await n.byId(d, id)).toMatchObject({ status: "received", processed_by: 999 });
  });

  it("rejects duplicate reference and unknown status", async () => {
    await n.createDonation(d, don("DON-D"));
    await expect(n.createDonation(d, don("DON-D"))).rejects.toThrow(/UNIQUE/);
    const { id } = await n.createDonation(d, don("DON-E"));
    await expect(n.setStatus(d, id, "bogus")).rejects.toThrow(/CHECK/);
  });

  it("stats and received total handle TEXT amounts", async () => {
    const a = await n.createDonation(d, don("DON-A", { amount: "1000" }));
    await n.createDonation(d, don("DON-B", { amount: "12500.50", status: "promised" }));
    await n.setStatus(d, a.id, "received");
    expect(await n.receivedTotal(d)).toBe(1000);
    expect(await n.stats(d)).toEqual({ count: 2, total: 13500.5, received: 1000, pending: 12500.5 });
  });

  it("setStatus keeps processed_by when none given; listAll newest first", async () => {
    const { id } = await n.createDonation(d, don("DON-C"));
    await n.setStatus(d, id, "pending", 7);
    await n.setStatus(d, id, "cancelled");
    expect(await n.byId(d, id)).toMatchObject({ status: "cancelled", processed_by: 7 });
    expect((await n.listAll(d)).map((r: any) => r.id)).toEqual([id]);
  });
});
