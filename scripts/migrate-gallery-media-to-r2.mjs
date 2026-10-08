// Copies gallery images referenced in D1 from their legacy (Supabase public) URL into R2, same keys.
// Usage: node scripts/migrate-gallery-media-to-r2.mjs <staging|prod> [--dry-run]
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TARGETS = {
    staging: { db: "ftour-bab-rayan-staging-db", bucket: "ftour-bab-rayan-staging-media" },
    prod: { db: "ftour-bab-rayan-prod-db", bucket: "ftour-bab-rayan-prod-media" },
};
const target = TARGETS[process.argv[2]];
if (!target) { console.error("usage: <staging|prod> [--dry-run]"); process.exit(1); }
const dry = process.argv.includes("--dry-run");

const wr = args => execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const out = wr(["d1", "execute", target.db, "--remote", "--json", "--command",
    "SELECT storage_path, image_original_url, thumb_storage_path, image_thumb_url, medium_storage_path, image_medium_url, mime_type FROM gallery_photos"]);
const rows = JSON.parse(out)[0].results;

// key -> { url, type }; legacy URLs only (rows already pointing at /media/ have nothing to copy)
const todo = new Map();
for (const r of rows) {
    for (const [k, u] of [[r.storage_path, r.image_original_url], [r.thumb_storage_path, r.image_thumb_url], [r.medium_storage_path, r.image_medium_url]]) {
        if (k && u && /^https?:\/\//.test(u) && !u.includes("/media/")) todo.set(k, { url: u, type: r.mime_type });
    }
}
console.log(`${todo.size} objects to copy -> r2://${target.bucket}${dry ? " (dry run)" : ""}`);

const dir = mkdtempSync(join(tmpdir(), "gallery-r2-"));
let ok = 0, failed = [];
try {
    for (const [key, { url, type }] of todo) {
        if (dry) { console.log("would copy", key); continue; }
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const file = join(dir, "obj");
            writeFileSync(file, Buffer.from(await res.arrayBuffer()));
            wr(["r2", "object", "put", `${target.bucket}/${key}`, "--remote", "--file", file, "--content-type", type || res.headers.get("content-type") || "image/jpeg"]);
            ok++;
        } catch (e) { failed.push(`${key}: ${e.message}`); }
    }
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log(`copied ${ok}, failed ${failed.length}`);
failed.forEach(f => console.log("FAILED", f));
process.exit(failed.length ? 1 : 0);
