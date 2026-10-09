/**
 * Which Supabase tables are served from Cloudflare D1 (generated twins t_<table>).
 * Grow this list wave by wave AFTER the data has been copied (scripts/copy-supabase-to-d1.mjs).
 * Tables joined with embedded selects must move together.
 * Rollback lever without a code change: set the Worker var/secret D1_TABLES (comma list, or "none").
 */
export const D1_TABLES: string[] = [];

export function d1TableSet(env: { D1_TABLES?: string }): Set<string> {
  const o = env.D1_TABLES?.trim();
  if (o) return new Set(o === "none" ? [] : o.split(",").map(s => s.trim()).filter(Boolean));
  return new Set(D1_TABLES);
}
