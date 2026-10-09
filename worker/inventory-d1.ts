/**
 * Inventory stock operations on D1 (ports of the Postgres functions inventory_add_stock, inventory_transfer_stock,
 * inventory_record_sale, inventory_record_return, inventory_adjust_stock). Each runs as ONE D1 batch (= transaction);
 * the t_inv_balance_nonneg trigger (d1/logic.sql) aborts the batch when stock would go negative.
 * No tRPC / Supabase imports: testable with a fake D1.
 */
import type { D1Like, D1Stmt } from "./gallery-d1";

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

class InvError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

const balance = (d: D1Like, productId: number, locationId: number, delta: number): D1Stmt[] => [
  d.prepare("INSERT OR IGNORE INTO t_inventory_stock_balances (product_id, location_id, quantity_on_hand) VALUES (?,?,0)").bind(productId, locationId),
  d.prepare(`UPDATE t_inventory_stock_balances SET quantity_on_hand = quantity_on_hand + ?, updated_at = ${NOW} WHERE product_id = ? AND location_id = ?`).bind(delta, productId, locationId),
];

const movement = (d: D1Like, cols: Record<string, unknown>): D1Stmt => {
  const keys = Object.keys(cols);
  return d
    .prepare(`INSERT INTO t_inventory_movements (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")}) RETURNING id`)
    .bind(...keys.map(k => cols[k] ?? null));
};

const needPositive = (q: number) => {
  if (!(q > 0)) throw new InvError("La quantité doit être positive", "P0002");
};

/** Runs the batch and returns the ids produced by the RETURNING statements, in order. */
async function run(d: D1Like, stmts: D1Stmt[]): Promise<number[]> {
  const res = (await d.batch(stmts)) as { results?: { id?: number }[] }[];
  return res.flatMap(r => (r.results ?? []).map(x => x.id).filter((x): x is number => typeof x === "number"));
}

type Args = Record<string, any>;

const OPS: Record<string, (d: D1Like, a: Args) => Promise<number | number[]>> = {
  async inventory_add_stock(d, a) {
    needPositive(a.p_quantity);
    const [id] = await run(d, [
      ...balance(d, a.p_product_id, a.p_location_id, a.p_quantity),
      movement(d, { product_id: a.p_product_id, quantity: a.p_quantity, movement_type: a.p_movement_type, to_location_id: a.p_location_id,
        reason: a.p_reason, note: a.p_note, performed_by: a.p_performed_by, reference_type: a.p_reference_type, reference_id: a.p_reference_id }),
    ]);
    return id;
  },
  async inventory_transfer_stock(d, a) {
    needPositive(a.p_quantity);
    const base = { product_id: a.p_product_id, quantity: a.p_quantity, from_location_id: a.p_from_location, to_location_id: a.p_to_location,
      event_id: a.p_event_id, reason: a.p_reason, note: a.p_note, performed_by: a.p_performed_by };
    return run(d, [
      ...balance(d, a.p_product_id, a.p_from_location, -a.p_quantity),
      ...balance(d, a.p_product_id, a.p_to_location, a.p_quantity),
      movement(d, { ...base, movement_type: "TRANSFER_OUT" }),
      movement(d, { ...base, movement_type: "TRANSFER_IN" }),
    ]);
  },
  async inventory_record_sale(d, a) {
    needPositive(a.p_quantity);
    const [id] = await run(d, [
      ...balance(d, a.p_product_id, a.p_location_id, -a.p_quantity),
      movement(d, { product_id: a.p_product_id, quantity: a.p_quantity, movement_type: "SALE", from_location_id: a.p_location_id,
        event_id: a.p_event_id, pos_location_id: a.p_location_id, sale_order_id: a.p_sale_order_id, sale_line_id: a.p_sale_line_id,
        reference_type: a.p_reference_type, reference_id: a.p_reference_id, note: a.p_note, performed_by: a.p_performed_by }),
    ]);
    return id;
  },
  async inventory_record_return(d, a) {
    needPositive(a.p_quantity);
    const base = { product_id: a.p_product_id, quantity: a.p_quantity, from_location_id: a.p_from_pos_location, to_location_id: a.p_to_buffer_location,
      event_id: a.p_event_id, pos_location_id: a.p_from_pos_location, reason: a.p_reason, note: a.p_note, performed_by: a.p_performed_by };
    return run(d, [
      ...balance(d, a.p_product_id, a.p_from_pos_location, -a.p_quantity),
      ...balance(d, a.p_product_id, a.p_to_buffer_location, a.p_quantity),
      movement(d, { ...base, movement_type: "RETURN_OUT" }),
      movement(d, { ...base, movement_type: "RETURN_IN" }),
    ]);
  },
  async inventory_adjust_stock(d, a) {
    if (a.p_qty_delta === 0) throw new InvError("Le delta ne peut pas être zéro", "P0002");
    if (a.p_reason == null || String(a.p_reason).trim() === "") throw new InvError("Le motif est obligatoire pour un ajustement", "P0003");
    const plus = a.p_qty_delta > 0;
    const [id] = await run(d, [
      ...balance(d, a.p_product_id, a.p_location_id, a.p_qty_delta),
      movement(d, { product_id: a.p_product_id, quantity: Math.abs(a.p_qty_delta), movement_type: plus ? "ADJUSTMENT_PLUS" : "ADJUSTMENT_MINUS",
        [plus ? "to_location_id" : "from_location_id"]: a.p_location_id, reason: a.p_reason, note: a.p_note, performed_by: a.p_performed_by }),
    ]);
    return id;
  },
};

export const INVENTORY_RPC = new Set(Object.keys(OPS));

/** supabase.rpc-compatible: resolves to { data, error } and never throws. */
export async function inventoryRpc(d: D1Like, name: string, args: Args) {
  try {
    return { data: await OPS[name](d, args ?? {}), error: null };
  } catch (e) {
    const err = e as Error & { code?: string };
    return { data: null, error: { message: err.message, code: err.code ?? "P0001", details: null, hint: null } };
  }
}
