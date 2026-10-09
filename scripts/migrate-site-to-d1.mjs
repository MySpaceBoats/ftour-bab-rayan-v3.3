// Copies ftour_team_members, contact_messages, partner_leads from Supabase into D1 (same ids). Idempotent.
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/migrate-site-to-d1.mjs <staging|prod> [--dry-run]
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DBS = { staging: "ftour-bab-rayan-staging-db", prod: "ftour-bab-rayan-prod-db" };
const db = DBS[process.argv[2]];
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
if (!db || !SUPABASE_URL || !KEY) { console.error("usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… <staging|prod> [--dry-run]"); process.exit(1); }
const dry = process.argv.includes("--dry-run");

const TABLES = {
    ftour_team_members: ["id", "first_name", "last_name", "role", "citation", "photo_url", "display_order", "edition", "is_active", "created_at", "updated_at"],
    contact_messages: ["id", "name", "email", "phone", "subject", "message", "is_read", "created_at"],
    partner_leads: ["id", "created_at", "company_name", "contact_name", "email", "phone", "city", "partnership_type", "budget_range", "message", "source", "locale"],
};
const q = v => v == null ? "NULL" : typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "1" : "0") : `'${String(v).replace(/'/g, "''")}'`;

const stmts = [];
for (const [table, cols] of Object.entries(TABLES)) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
    const rows = await res.json();
    console.log(`${table}: ${rows.length}`);
    for (const r of rows) stmts.push(`INSERT OR REPLACE INTO ${table} (${cols.join(",")}) VALUES (${cols.map(c => q(r[c])).join(",")});`);
}
console.log(`${stmts.length} rows -> ${db}${dry ? " (dry run)" : ""}`);
if (dry || !stmts.length) process.exit(0);

const dir = mkdtempSync(join(tmpdir(), "site-d1-"));
try {
    const file = join(dir, "site.sql");
    writeFileSync(file, stmts.join("\n"));
    execFileSync("npx", ["wrangler", "d1", "execute", db, "--remote", "--file", file], { stdio: "inherit" });
} finally { rmSync(dir, { recursive: true, force: true }); }
