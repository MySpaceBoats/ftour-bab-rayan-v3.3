// Copies blog_posts + blog_post_likes from Supabase into D1 (same ids). Idempotent (INSERT OR REPLACE).
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/migrate-blog-to-d1.mjs <staging|prod> [--dry-run]
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DBS = { staging: "ftour-bab-rayan-staging-db", prod: "ftour-bab-rayan-prod-db" };
const db = DBS[process.argv[2]];
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
if (!db || !SUPABASE_URL || !KEY) { console.error("usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… <staging|prod> [--dry-run]"); process.exit(1); }
const dry = process.argv.includes("--dry-run");

const fetchAll = async table => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=id`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
    return res.json();
};
const q = v => v == null ? "NULL" : typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "1" : "0") : `'${String(v).replace(/'/g, "''")}'`;

const posts = await fetchAll("blog_posts");
const likes = await fetchAll("blog_post_likes");
const sql = [
    ...posts.map(p => `INSERT OR REPLACE INTO blog_posts (id,title,slug,content,excerpt,hook,author_id,author_name,type,categories,cover_image,likes,views,status,rejection_note,consented,created_at,updated_at) VALUES (${[
        p.id, p.title, p.slug, p.content, p.excerpt, p.hook, p.author_id, p.author_name, p.type, JSON.stringify(p.categories ?? []),
        p.cover_image, p.likes ?? 0, p.views ?? 0, p.status, p.rejection_note, p.consented, p.created_at, p.updated_at].map(q).join(",")});`),
    ...likes.map(l => `INSERT OR REPLACE INTO blog_post_likes (id,post_id,user_id,created_at) VALUES (${[l.id, l.post_id, l.user_id, l.created_at].map(q).join(",")});`),
].join("\n");
console.log(`${posts.length} posts, ${likes.length} likes -> ${db}${dry ? " (dry run)" : ""}`);
if (dry || !sql) process.exit(0);

const dir = mkdtempSync(join(tmpdir(), "blog-d1-"));
try {
    const file = join(dir, "blog.sql");
    writeFileSync(file, sql);
    execFileSync("npx", ["wrangler", "d1", "execute", db, "--remote", "--file", file], { stdio: "inherit" });
} finally { rmSync(dir, { recursive: true, force: true }); }
