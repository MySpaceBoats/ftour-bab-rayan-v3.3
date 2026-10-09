// Copies Supabase tables into their generated D1 twins (t_<table>), with parity check.
// Usage: node --env-file=.env.local scripts/copy-supabase-to-d1.mjs <staging|prod> <table,table,...|all> [--mirror] [--check] [--dry-run]
//   --mirror  empty the D1 table first so it equals Supabase exactly (use for the final sync of a cutover)
//   --check   only compare row counts + primary keys, write nothing
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DBS = { staging: "ftour-bab-rayan-staging-db", prod: "ftour-bab-rayan-prod-db" };
const db = DBS[process.argv[2]];
const META = JSON.parse(readFileSync(new URL("../worker/d1/meta.generated.json", import.meta.url), "utf8"));
const wanted = process.argv[3] === "all" ? Object.keys(META) : (process.argv[3] ?? "").split(",").filter(Boolean);
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
const flag = f => process.argv.includes(f);
if (!db || !wanted.length || !SUPABASE_URL || !KEY) { console.error("usage: node --env-file=.env.local scripts/copy-supabase-to-d1.mjs <staging|prod> <tables|all> [--mirror] [--check] [--dry-run]"); process.exit(1); }
for (const t of wanted) if (!META[t]) { console.error(`unknown table: ${t}`); process.exit(1); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const wr = args => execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const d1 = sql => JSON.parse(wr(["d1", "execute", db, "--remote", "--json", "--command", sql]))[0].results;

async function fetchAll(table) {
    const pk = META[table].pk;
    const rows = [];
    for (let from = 0; ; from += 1000) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=${pk.join(",")}`, { headers: { ...H, Range: `${from}-${from + 999}`, "Range-Unit": "items" } });
        if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
        const page = await res.json();
        rows.push(...page);
        if (page.length < 1000) return rows;
    }
}
const q = (v, kind) => {
    if (v === null || v === undefined) return "NULL";
    if (kind === "bool") return v ? "1" : "0";
    if (kind === "json") return `'${(typeof v === "string" ? v : JSON.stringify(v)).replace(/'/g, "''")}'`;
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "1" : "0";
    return `'${String(v).replace(/'/g, "''")}'`;
};
const key = (row, pk) => pk.map(c => row[c]).join("|");

let bad = 0;
const dir = mkdtempSync(join(tmpdir(), "copy-d1-"));
try {
    for (const table of wanted) {
        const m = META[table];
        const rows = await fetchAll(table);
        if (flag("--check")) {
            const d1rows = d1(`SELECT ${m.pk.map(c => `"${c}"`).join(", ")} FROM "t_${table}"`);
            const a = new Set(rows.map(r => key(r, m.pk))), b = new Set(d1rows.map(r => key(r, m.pk)));
            const missing = [...a].filter(k => !b.has(k)).length, extra = [...b].filter(k => !a.has(k)).length;
            const ok = missing === 0 && extra === 0;
            if (!ok) bad++;
            console.log(`${ok ? "OK  " : "DIFF"} ${table.padEnd(30)} supabase=${rows.length} d1=${d1rows.length} missing=${missing} extra=${extra}`);
            continue;
        }
        const cols = Object.keys(m.cols);
        const stmts = [];
        if (flag("--mirror")) stmts.push(`DELETE FROM "t_${table}";`);
        for (const r of rows) stmts.push(`INSERT OR REPLACE INTO "t_${table}" (${cols.map(c => `"${c}"`).join(",")}) VALUES (${cols.map(c => q(r[c], m.cols[c])).join(",")});`);
        console.log(`${table.padEnd(30)} ${rows.length} rows${flag("--dry-run") ? " (dry run)" : ""}`);
        if (flag("--dry-run") || !rows.length && !flag("--mirror")) continue;
        for (let i = 0; i < stmts.length; i += 400) {
            const file = join(dir, `${table}-${i}.sql`);
            writeFileSync(file, stmts.slice(i, i + 400).join("\n"));
            wr(["d1", "execute", db, "--remote", "--file", file]);
        }
    }
} finally { rmSync(dir, { recursive: true, force: true }); }
if (flag("--check")) { console.log(bad ? `${bad} table(s) differ` : "parity OK"); process.exit(bad ? 1 : 0); }
