/**
 * Which Supabase tables are served from Cloudflare D1 (generated twins t_<table>).
 * Grow this list wave by wave AFTER the data has been copied (scripts/copy-supabase-to-d1.mjs).
 * Tables joined with embedded selects must move together.
 * Rollback lever without a code change: set the Worker var/secret D1_TABLES (comma list, or "none").
 */
// wave 1: commerce (goodies, terroir, pastries, products, shop, payments)
export const D1_TABLES: string[] = [
  "goodies", "goodie_variants", "orders", "order_items",
  "terroir_products", "terroir_product_variants", "terroir_orders", "terroir_order_items", "terroir_pickup_slots",
  "pastries", "pastry_orders", "products",
  "shop_products", "shop_product_variants", "shop_orders", "shop_order_items",
  "payments", "payment_logs", "payment_methods_config",
  // wave B
  "inventory_products", "inventory_locations", "inventory_events", "inventory_stock_balances", "inventory_movements", "feedback_responses", "testimonials", "partners",
  // wave C
  "restaurants", "restaurant_reservations", "reservations", "reservation_payment_tokens", "reservation_payment_proofs", "reservation_checkins", "reservation_events", "volunteers", "volunteer_group_requests", "checkins", "ramadan_config", "ramadan_daily_stats", "ramadan_days",
];

export function d1TableSet(env: { D1_TABLES?: string }): Set<string> {
  const o = env.D1_TABLES?.trim();
  if (o) return new Set(o === "none" ? [] : o.split(",").map(s => s.trim()).filter(Boolean));
  return new Set(D1_TABLES);
}

/**
 * Supabase Storage buckets served from R2 instead (see media-r2.ts). Enable AFTER scripts/migrate-storage-to-r2.mjs.
 * Rollback lever: Worker var R2_BUCKETS (comma list, or "none").
 */
export const R2_BUCKETS: string[] = [];

export function r2BucketSet(env: { R2_BUCKETS?: string }): Set<string> {
  const o = env.R2_BUCKETS?.trim();
  if (o) return new Set(o === "none" ? [] : o.split(",").map(s => s.trim()).filter(Boolean));
  return new Set(R2_BUCKETS);
}
