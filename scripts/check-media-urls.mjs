// Verifies every Supabase Storage object is reachable through the Worker's /media route (public) or hidden (private).
// Usage: node --env-file=.env.local scripts/check-media-urls.mjs [origin]
const { SUPABASE_URL: U, SUPABASE_SERVICE_ROLE_KEY: K } = process.env;
const ORIGIN = (process.argv[2] || process.env.MEDIA_BASE_URL || "https://ftour-bab-rayan-v2.reda-sebbani-43b.workers.dev").replace(/\/$/, "");
const PUBLIC = new Set(["images", "manager-candidates", "product-images", "Formulaire", "RIB", "Images siteweb"]); // keep in sync with worker/media-r2.ts
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
async function list(bucket, prefix = "") {
    const out = [];
    for (let offset = 0; ; offset += 1000) {
        const page = await (await fetch(`${U}/storage/v1/object/list/${encodeURIComponent(bucket)}`, { method: "POST", headers: H, body: JSON.stringify({ prefix, limit: 1000, offset }) })).json();
        for (const o of page) o.id === null ? out.push(...await list(bucket, `${prefix}${o.name}/`)) : out.push(`${prefix}${o.name}`);
        if (page.length < 1000) return out;
    }
}
// gallery files that no gallery_photos row references are orphans (deleted/failed uploads): not migrated, not checked
const rows = await (await fetch(`${U}/rest/v1/gallery_photos?select=storage_path,thumb_storage_path,medium_storage_path&limit=10000`, { headers: H })).json();
const referenced = new Set(rows.flatMap(r => [r.storage_path, r.thumb_storage_path, r.medium_storage_path]).filter(Boolean));
let bad = 0, n = 0, orphans = 0;
for (const b of await (await fetch(`${U}/storage/v1/bucket`, { headers: H })).json()) {
    for (const path of await list(b.name)) {
        if (b.name === "images" && path.startsWith("gallery/") && !referenced.has(path)) { orphans++; continue; }
        const pub = PUBLIC.has(b.name);
        const key = b.name === "images" ? path : pub ? `${b.name}/${path}` : `private/${b.name}/${path}`;
        const res = await fetch(`${ORIGIN}/media/${key.split("/").map(encodeURIComponent).join("/")}`, { method: "HEAD" });
        const html = (res.headers.get("content-type") || "").includes("text/html"); // SPA fallback is not an object
        const ok = pub ? res.status === 200 && !html : res.status === 404 || html;
        n++;
        if (!ok) { bad++; console.log(`BAD ${res.status} ${pub ? "public " : "private"} ${b.name}/${path}`); }
    }
}
console.log(`${orphans} unreferenced gallery files skipped`);
console.log(bad ? `${bad}/${n} objects not as expected` : `all ${n} objects OK (public reachable, private hidden)`);
process.exit(bad ? 1 : 0);
