// Builds the site once, then clones dist/public per palette with olive-scale hex remapped.
// Usage: node scripts/build-palette-variants.mjs [--deploy]
import { execSync } from "node:child_process";
import { cpSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

// ponytail: hex values eyeballed from content/media palette board, not official Pantone sRGB. Swap if exact values needed.
const VARIANTS = {
    d1: { name: "Sunset Mauve 7644C", base: "#A85A6B", dark: "#8A4656", soft: "#BB7585", darkest: "#6E3744", softer: "#C48C99" },
    d2: { name: "Dusty Raspberry 7647C", base: "#B03050", dark: "#8F2540", soft: "#C24A68", darkest: "#701C32", softer: "#CC6C85" },
    d3: { name: "Warm Sand 4665C", base: "#A38458", dark: "#85693F", soft: "#B59A72", darkest: "#6A5232", softer: "#C2AB88" },
    d4: { name: "Deep Petrol 5483C", base: "#0F5560", dark: "#0B424B", soft: "#2A6E79", darkest: "#08323A", softer: "#4A8790" },
    d5: { name: "Rich Cobalt 7686C", base: "#1558B0", dark: "#10468C", soft: "#3270C0", darkest: "#0C366D", softer: "#5588CC" },
};
// olive scale in source -> variant slot
const MAP = { "5E5B34": "base", "4A4829": "dark", "6F6C3F": "soft", "3D3B22": "darkest", "8A8555": "softer" };

const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const deploy = process.argv.includes("--deploy");

execSync("pnpm build:cloudflare", { stdio: "inherit" });
for (const [id, v] of Object.entries(VARIANTS)) {
    const out = `dist/variants/${id}`;
    rmSync(out, { recursive: true, force: true });
    cpSync("dist/public", out, { recursive: true });
    for (const f of walk(out).filter(p => /\.(css|js|html)$/.test(p))) {
        let s = readFileSync(f, "utf8");
        for (const [hex, slot] of Object.entries(MAP)) s = s.replace(new RegExp(`#${hex}`, "gi"), v[slot]);
        writeFileSync(f, s);
    }
    console.log(`built ${id}: ${v.name}`);
    if (deploy) {
        const proj = `ftour-bab-rayan-${id}`;
        try { execSync(`wrangler pages project create ${proj} --production-branch=main`, { stdio: "inherit" }); } catch {}
        execSync(`wrangler pages deploy ${out} --project-name=${proj} --branch=main --commit-dirty=true`, { stdio: "inherit" });
    }
}
