import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import { inventoryRpc } from "./inventory-d1";

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
    batch: async stmts => {
      sqlite.exec("BEGIN");
      try { const out = []; for (const s of stmts) out.push(await s.all()); sqlite.exec("COMMIT"); return out; }
      catch (e) { sqlite.exec("ROLLBACK"); throw e; }
    },
  };
}

let d: D1Like, raw: InstanceType<typeof DatabaseSync>;
const qty = (p: number, l: number) => (raw.prepare("SELECT quantity_on_hand q FROM t_inventory_stock_balances WHERE product_id=? AND location_id=?").get(p, l) as any)?.q;
beforeEach(() => {
  raw = new DatabaseSync(":memory:");
  raw.exec(readFileSync(new URL("./d1/schema.generated.sql", import.meta.url), "utf8"));
  raw.exec(readFileSync(new URL("./d1/logic.sql", import.meta.url), "utf8"));
  d = fakeD1(raw);
});

describe("inventory-d1", () => {
  it("add_stock creates the balance and the movement", async () => {
    const r = await inventoryRpc(d, "inventory_add_stock", { p_product_id: 1, p_location_id: 1, p_quantity: 10, p_movement_type: "PURCHASE", p_reason: "x" });
    expect(r.error).toBeNull();
    expect(typeof r.data).toBe("number");
    expect(qty(1, 1)).toBe(10);
  });

  it("transfer moves stock atomically and returns [out, in] ids", async () => {
    await inventoryRpc(d, "inventory_add_stock", { p_product_id: 1, p_location_id: 1, p_quantity: 10, p_movement_type: "PURCHASE" });
    const r = await inventoryRpc(d, "inventory_transfer_stock", { p_product_id: 1, p_quantity: 4, p_from_location: 1, p_to_location: 2 });
    expect(r.data).toHaveLength(2);
    expect([qty(1, 1), qty(1, 2)]).toEqual([6, 4]);
  });

  it("insufficient stock rolls back the whole operation (no movement, no credit)", async () => {
    await inventoryRpc(d, "inventory_add_stock", { p_product_id: 1, p_location_id: 1, p_quantity: 3, p_movement_type: "PURCHASE" });
    const r = await inventoryRpc(d, "inventory_transfer_stock", { p_product_id: 1, p_quantity: 5, p_from_location: 1, p_to_location: 2 });
    expect(r.error?.message).toMatch(/Stock insuffisant/);
    expect(qty(1, 1)).toBe(3);
    expect(qty(1, 2)).toBeUndefined();
    expect((raw.prepare("SELECT COUNT(*) n FROM t_inventory_movements").get() as any).n).toBe(1);
  });

  it("validation errors keep their Postgres codes", async () => {
    expect((await inventoryRpc(d, "inventory_add_stock", { p_product_id: 1, p_location_id: 1, p_quantity: 0, p_movement_type: "X" })).error?.code).toBe("P0002");
    expect((await inventoryRpc(d, "inventory_adjust_stock", { p_product_id: 1, p_location_id: 1, p_qty_delta: 0, p_reason: "r" })).error?.code).toBe("P0002");
    expect((await inventoryRpc(d, "inventory_adjust_stock", { p_product_id: 1, p_location_id: 1, p_qty_delta: 2, p_reason: " " })).error?.code).toBe("P0003");
  });

  it("adjust +/-, sale and return", async () => {
    await inventoryRpc(d, "inventory_adjust_stock", { p_product_id: 1, p_location_id: 1, p_qty_delta: 8, p_reason: "count" });
    await inventoryRpc(d, "inventory_adjust_stock", { p_product_id: 1, p_location_id: 1, p_qty_delta: -3, p_reason: "loss" });
    expect(qty(1, 1)).toBe(5);
    await inventoryRpc(d, "inventory_record_sale", { p_product_id: 1, p_quantity: 2, p_location_id: 1 });
    expect(qty(1, 1)).toBe(3);
    const r = await inventoryRpc(d, "inventory_record_return", { p_product_id: 1, p_quantity: 1, p_from_pos_location: 1, p_to_buffer_location: 2 });
    expect(r.data).toHaveLength(2);
    expect([qty(1, 1), qty(1, 2)]).toEqual([2, 1]);
    const types = (raw.prepare("SELECT movement_type t FROM t_inventory_movements ORDER BY id").all() as any[]).map(x => x.t);
    expect(types).toEqual(["ADJUSTMENT_PLUS", "ADJUSTMENT_MINUS", "SALE", "RETURN_OUT", "RETURN_IN"]);
  });

  it("volunteer counter trigger follows insert / move / delete", async () => {
    raw.exec("INSERT INTO t_ramadan_days (id, day_number, date, capacity) VALUES (1,1,'2026-02-19',10),(2,2,'2026-02-20',10)");
    const mk = (day: number) => raw.prepare("INSERT INTO t_volunteers (first_name,last_name,email,phone,day_id,qr_token) VALUES ('a','b','e@x.y','1',?,?)").run(day, crypto.randomUUID());
    const id = Number(mk(1).lastInsertRowid);
    const count = (day: number) => (raw.prepare("SELECT registered_count c FROM t_ramadan_days WHERE id=?").get(day) as any).c;
    expect([count(1), count(2)]).toEqual([1, 0]);
    raw.prepare("UPDATE t_volunteers SET day_id=2 WHERE id=?").run(id);
    expect([count(1), count(2)]).toEqual([0, 1]);
    raw.prepare("DELETE FROM t_volunteers WHERE id=?").run(id);
    expect([count(1), count(2)]).toEqual([0, 0]);
  });
});
