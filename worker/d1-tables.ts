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
];

export function d1TableSet(env: { D1_TABLES?: string }): Set<string> {
  const o = env.D1_TABLES?.trim();
  if (o) return new Set(o === "none" ? [] : o.split(",").map(s => s.trim()).filter(Boolean));
  return new Set(D1_TABLES);
}
