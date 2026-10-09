// Copies Supabase Storage objects into the R2 bucket with the key scheme of worker/media-r2.ts.
// Usage: node --env-file=.env.local scripts/migrate-storage-to-r2.mjs <staging|prod> [--dry-run] [--include-gallery]
//   gallery/* objects are skipped by default: the gallery module already copied what it references.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const R2 = { staging: "ftour-bab-rayan-staging-media", prod: "ftour-bab-rayan-prod-media" }[process.argv[2]];
const { SUPABASE_URL: U, SUPABASE_SERVICE_ROLE_KEY: K } = process.env;
if (!R2 || !U || !K) { console.error("usage: node --env-file=.env.local scripts/migrate-storage-to-r2.mjs <staging|prod> [--dry-run] [--include-gallery]"); process.exit(1); }
const dry = process.argv.includes("--dry-run"), withGallery = process.argv.includes("--include-gallery");

// keep in sync with PUBLIC_BUCKETS in worker/media-r2.ts
const PUBLIC = new Set(["images", "manager-candidates", "product-images", "Formulaire", "RIB", "Images siteweb"]);
const keyOf = (bucket, path) => bucket === "images" ? path : PUBLIC.has(bucket) ? `${bucket}/${path}` : `private/${bucket}/${path}`;

const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
async function list(bucket, prefix = "") {
    const out = [];
    for (let offset = 0; ; offset += 1000) {
        const res = await fetch(`${U}/storage/v1/object/list/${encodeURIComponent(bucket)}`, { method: "POST", headers: H, body: JSON.stringify({ prefix, limit: 1000, offset }) });
        const page = await res.json();
        if (!Array.isArray(page)) throw new Error(`${bucket}: ${JSON.stringify(page)}`);
        for (const o of page) {
            if (o.id === null) out.push(...await list(bucket, `${prefix}${o.name}/`));
            else out.push({ path: `${prefix}${o.name}`, type: o.metadata?.mimetype, size: o.metadata?.size ?? 0 });
        }
        if (page.length < 1000) return out;
    }
}

const buckets = await (await fetch(`${U}/storage/v1/bucket`, { headers: H })).json();
const todo = [];
for (const b of buckets) for (const o of await list(b.name)) {
    if (b.name === "images" && o.path.startsWith("gallery/") && !withGallery) continue;
    todo.push({ bucket: b.name, ...o, key: keyOf(b.name, o.path) });
}
const mb = todo.reduce((s, o) => s + o.size, 0) / 1048576;
console.log(`${todo.length} objects (${mb.toFixed(1)} MB) -> r2://${R2}${dry ? " (dry run)" : ""}`);

const dir = mkdtempSync(join(tmpdir(), "storage-r2-"));
let ok = 0; const failed = [];
try {
    for (const o of todo) {
        if (dry) { console.log("would copy", o.bucket, "->", o.key); continue; }
        try {
            const res = await fetch(`${U}/storage/v1/object/${encodeURIComponent(o.bucket)}/${o.path.split("/").map(encodeURIComponent).join("/")}`, { headers: { apikey: K, Authorization: `Bearer ${K}` } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const file = join(dir, "obj");
            writeFileSync(file, Buffer.from(await res.arrayBuffer()));
            execFileSync("npx", ["wrangler", "r2", "object", "put", `${R2}/${o.key}`, "--remote", "--file", file, "--content-type", o.type || res.headers.get("content-type") || "application/octet-stream"], { stdio: "pipe" });
            ok++;
            if (ok % 20 === 0) console.log(`  ${ok}/${todo.length}`);
        } catch (e) { failed.push(`${o.bucket}/${o.path}: ${e.message}`); }
    }
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log(`copied ${ok}, failed ${failed.length}`);
failed.forEach(f => console.log("FAILED", f));
process.exit(failed.length ? 1 : 0);
