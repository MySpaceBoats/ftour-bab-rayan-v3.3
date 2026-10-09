import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const META = JSON.parse(readFileSync("worker/d1/meta.generated.json", "utf8"));
const { SUPABASE_URL: U, SUPABASE_SERVICE_ROLE_KEY: K } = process.env;
// Usage: node --env-file=.env.local scripts/compare-supabase-d1.mjs <prod|staging> <table,table,...>  (prints row/column differences, never values)
const DB = { staging: "ftour-bab-rayan-staging-db", prod: "ftour-bab-rayan-prod-db" }[process.argv[2]];
const tables = process.argv[3].split(",");
let failed = 0;
const norm = (v, kind) => {
  if (v === null || v === undefined) return null;
  if (kind === "bool") return Boolean(Number(v));
  if (kind === "json") return JSON.stringify(typeof v === "string" ? JSON.parse(v) : v);
  if (kind === "num" || kind === "int") return Number(v);
  if (typeof v === "string" && /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d/.test(v)) return new Date(v.replace(" ", "T").replace(/(\+00(:00)?|Z)?$/, "Z")).getTime();
  return String(v);
};
for (const t of tables) {
  const m = META[t];
  const sb = await (await fetch(`${U}/rest/v1/${t}?select=*&order=${m.pk.join(",")}&limit=1000`, { headers: { apikey: K, Authorization: `Bearer ${K}` } })).json();
  if (!sb.length) continue;
  const out = JSON.parse(execFileSync("npx", ["wrangler", "d1", "execute", DB, "--remote", "--json", "--command", `SELECT * FROM "t_${t}"`], { encoding: "utf8", maxBuffer: 1 << 28 }))[0].results;
  const byKey = new Map(out.map(r => [m.pk.map(c => r[c]).join("|"), r]));
  const diffCols = {};
  let rowsDiff = 0;
  for (const r of sb) {
    const d = byKey.get(m.pk.map(c => r[c]).join("|"));
    let bad = false;
    for (const c of Object.keys(m.cols)) {
      if (JSON.stringify(norm(r[c], m.cols[c])) !== JSON.stringify(norm(d?.[c], m.cols[c]))) { diffCols[c] = (diffCols[c] ?? 0) + 1; bad = true; }
    }
    if (bad) rowsDiff++;
  }
  if (rowsDiff) failed++;
  console.log(`${rowsDiff ? "DIFF" : "OK  "} ${t.padEnd(22)} rows=${sb.length} differing=${rowsDiff} ${rowsDiff ? JSON.stringify(diffCols) : ""}`);
}
process.exit(failed ? 1 : 0);
