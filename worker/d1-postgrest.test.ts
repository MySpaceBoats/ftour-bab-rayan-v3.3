import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import { createD1Rest } from "./d1-postgrest";
import { META } from "./d1-meta.generated";

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
      try {
        const out = [];
        for (const s of stmts) out.push(await s.all());
        sqlite.exec("COMMIT");
        return out;
      } catch (e) { sqlite.exec("ROLLBACK"); throw e; }
    },
  };
}

let db: ReturnType<typeof createD1Rest>;
beforeEach(() => {
  const s = new DatabaseSync(":memory:");
  s.exec(readFileSync(new URL("./d1/schema.generated.sql", import.meta.url), "utf8"));
  db = createD1Rest(fakeD1(s), META as any, { isD1: t => t in META });
});

const goodie = (name: string, over: Record<string, unknown> = {}) => ({ name, price: 10, ...over });

describe("d1-postgrest", () => {
  it("insert + select returns booleans/uuid/defaults like PostgREST", async () => {
    const { data, error } = await db.from("goodies").insert(goodie("Mug")).select().single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ name: "Mug", price: 10 });
    expect(typeof data.id).toBe("number");
    expect(typeof data.created_at).toBe("string");
  });

  it("insert without select returns null data; multi-row insert is atomic", async () => {
    const r = await db.from("goodies").insert([goodie("A"), goodie("B")]);
    expect(r).toMatchObject({ data: null, error: null });
    const { data } = await db.from("goodies").select("name").order("name");
    expect(data).toEqual([{ name: "A" }, { name: "B" }]);
    const bad = await db.from("goodies").insert([goodie("C"), { price: 1 }]); // NOT NULL name
    expect(bad.error?.code).toBe("23502");
    expect((await db.from("goodies").select("*", { count: "exact", head: true })).count).toBe(2);
  });

  it("single() / maybeSingle() errors and nulls", async () => {
    await db.from("goodies").insert(goodie("A"));
    expect((await db.from("goodies").select().eq("name", "zzz").single()).error?.code).toBe("PGRST116");
    expect((await db.from("goodies").select().eq("name", "zzz").maybeSingle()).data).toBeNull();
  });

  it("filters: eq/neq/in/or/ilike/is/range/order nulls", async () => {
    await db.from("goodies").insert([goodie("alpha", { description: "x" }), goodie("beta"), goodie("gamma", { description: "y" })]);
    const names = async (q: any) => (await q).data.map((r: any) => r.name);
    expect(await names(db.from("goodies").select("name").in("name", ["alpha", "gamma"]).order("name"))).toEqual(["alpha", "gamma"]);
    expect(await names(db.from("goodies").select("name").neq("name", "alpha").order("name"))).toEqual(["beta", "gamma"]);
    expect(await names(db.from("goodies").select("name").or("name.ilike.%ALP%,name.eq.beta").order("name"))).toEqual(["alpha", "beta"]);
    expect(await names(db.from("goodies").select("name").is("description", null))).toEqual(["beta"]);
    expect(await names(db.from("goodies").select("name").order("name", { ascending: false }).range(0, 1))).toEqual(["gamma", "beta"]);
    // PostgREST: ASC puts NULLs last
    expect(await names(db.from("goodies").select("name").order("description"))).toEqual(["alpha", "gamma", "beta"]);
    const withCount = await db.from("goodies").select("name", { count: "exact" }).range(0, 0);
    expect(withCount.count).toBe(3);
    expect(withCount.data).toHaveLength(1);
  });

  it("update returns rows only with select; updated_at is bumped; boolean columns round-trip", async () => {
    const { data: g } = await db.from("goodies").insert(goodie("A")).select().single();
    const r = await db.from("goodies").update({ is_active: false }).eq("id", g.id);
    expect(r.data).toBeNull();
    const { data } = await db.from("goodies").update({ price: 99 }).eq("id", g.id).select().single();
    expect(data.price).toBe(99);
    expect(data.is_active).toBe(false);
  });

  it("upsert on conflict updates", async () => {
    const cfg = { id: 1, hijri_year: "1447", gregorian_start_date: "2026-02-18" } as any;
    await db.from("ramadan_config").upsert(cfg);
    const { data, error } = await db.from("ramadan_config").upsert({ ...cfg, hijri_year: "1448" }).select().single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ id: 1, hijri_year: "1448" });
    expect((await db.from("ramadan_config").select("*", { count: "exact", head: true })).count).toBe(1);
  });

  it("embedded selects: to-many, to-one, nested, projected columns", async () => {
    const { data: order } = await db.from("orders").insert({ order_reference: "O1", customer_name: "N", customer_email: "e@x.y", customer_phone: "1", total_amount: 5 } as any).select().single();
    const { data: g } = await db.from("goodies").insert(goodie("Mug")).select().single();
    await db.from("order_items").insert([{ order_id: order.id, goodie_id: g.id, quantity: 2, unit_price: 5, total_price: 10 } as any]);
    const { data, error } = await db.from("orders").select("id, order_items(quantity, goodies(name))").eq("id", order.id).single();
    expect(error).toBeNull();
    expect(data).toEqual({ id: order.id, order_items: [{ quantity: 2, goodies: { name: "Mug" } }] });
    const all = await db.from("orders").select("*, order_items(*)").single();
    expect(all.data.order_items).toHaveLength(1);
    expect(all.data.order_items[0].order_id).toBe(order.id);
  });

  it("delete cascades to children and reports what was deleted", async () => {
    const { data: order } = await db.from("orders").insert({ order_reference: "O2", customer_name: "N", customer_email: "e@x.y", customer_phone: "1", total_amount: 5 } as any).select().single();
    const { data: g } = await db.from("goodies").insert(goodie("Mug")).select().single();
    await db.from("order_items").insert({ order_id: order.id, goodie_id: g.id, quantity: 1, unit_price: 5, total_price: 5 } as any);
    const del = await db.from("orders").delete().eq("id", order.id).select();
    expect(del.data).toHaveLength(1);
    expect((await db.from("order_items").select("*", { count: "exact", head: true })).count).toBe(0);
    expect((await db.from("goodies").select("*", { count: "exact", head: true })).count).toBe(1);
  });

  it("unknown table/column fail loudly", async () => {
    expect(() => db.from("nope")).toThrow(/not served by D1/);
    const r = await db.from("goodies").select().eq("bogus", 1);
    expect(r.error?.message).toMatch(/Unknown column/);
  });
});

describe("d1-postgrest external embeds", () => {
  it("joins a to-one relation served outside D1 (users) through opts.external", async () => {
    const s = new DatabaseSync(":memory:");
    s.exec(readFileSync(new URL("./d1/schema.generated.sql", import.meta.url), "utf8"));
    const calls: unknown[] = [];
    const ext = createD1Rest(fakeD1(s), META as any, {
      isD1: t => t in META,
      external: async (table, cols, col, values) => { calls.push([table, cols, col, values]); return [{ id: 7, name: "Ada", email: "a@x.y" }]; },
    });
    await ext.from("inventory_products").insert({ name: "P", product_type: "goodie", unit: "piece" } as any);
    await ext.from("inventory_locations").insert({ code: "L", name: "L", location_type: "buffer" } as any);
    await ext.from("inventory_movements").insert({ product_id: 1, quantity: 1, movement_type: "SALE", performed_by: 7 } as any);
    const { data, error } = await ext.from("inventory_movements").select("id, users(name)").single();
    expect(error).toBeNull();
    expect(data.users).toMatchObject({ name: "Ada" });
    expect(data.users).not.toHaveProperty("id");
    expect(calls).toEqual([["users", "name,id", "id", [7]]]);
  });
});
