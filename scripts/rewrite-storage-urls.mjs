// Rewrites Supabase Storage public URLs stored in D1 text columns to the R2-backed /media URLs.
//   https://<ref>.supabase.co/storage/v1/object/public/images/<p>   ->  <origin>/media/<p>
//   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<p> ->  <origin>/media/<bucket>/<p>
// Usage: node --env-file=.env.local scripts/rewrite-storage-urls.mjs <staging|prod> [--apply]   (default: report only)
import { execFileSync } from "node:child_process";

const DB = { staging: "ftour-bab-rayan-staging-db", prod: "ftour-bab-rayan-prod-db" }[process.argv[2]];
const { SUPABASE_URL: U } = process.env;
const ORIGIN = (process.env.PUBLIC_APP_URL || "https://www.ftourbabrayan.ma").replace(/\/$/, "");
if (!DB || !U) { console.error("usage: node --env-file=.env.local scripts/rewrite-storage-urls.mjs <staging|prod> [--apply]"); process.exit(1); }
const apply = process.argv.includes("--apply");

const d1 = sql => JSON.parse(execFileSync("npx", ["wrangler", "d1", "execute", DB, "--remote", "--json", "--command", sql], { encoding: "utf8", maxBuffer: 1 << 28 }))[0].results;
const base = `${U}/storage/v1/object/public/`;
// only live tables: generated twins (t_*) and the hand-written modules; the legacy 86-table snapshot is ignored
const LIVE = `(m.name LIKE 't\\_%' ESCAPE '\\' OR m.name IN ('gallery_albums','gallery_photos','blog_posts','blog_post_likes','ftour_team_members','contact_messages','partner_leads','election_settings','manager_candidates','manager_votes','donations_v2'))`;
const cols = d1(`SELECT m.name AS tbl, p.name AS col FROM sqlite_master m JOIN pragma_table_info(m.name) p
  WHERE m.type = 'table' AND ${LIVE} AND p.type IN ('TEXT','VARCHAR','')`);
const byTable = {};
for (const { tbl, col } of cols) (byTable[tbl] ??= []).push(col);
const hits = [];
for (const [tbl, cs] of Object.entries(byTable)) { // one query per table: D1 caps compound SELECTs
    const row = d1(`SELECT ${cs.map((c, i) => `COALESCE(SUM(instr("${c}", '${base}') > 0), 0) AS c${i}`).join(", ")} FROM "${tbl}"`)[0];
    cs.forEach((col, i) => { if (row[`c${i}`] > 0) hits.push({ tbl, col, n: row[`c${i}`] }); });
}
let total = 0;
for (const { tbl, col, n } of hits) {
    total += n;
    console.log(`${String(n).padStart(5)} rows  ${tbl}.${col}`);
    if (apply) {
        // other buckets first (keep the bucket in the path), then the "images" bucket (no prefix)
        const imgs = `${base}images/`;
        d1(`UPDATE "${tbl}" SET "${col}" = REPLACE(REPLACE("${col}", '${imgs}', '${ORIGIN}/media/'), '${base}', '${ORIGIN}/media/') WHERE instr("${col}", '${base}') > 0`);
    }
}
console.log(apply ? `rewrote ${total} values` : `${total} values would be rewritten (add --apply)`);
