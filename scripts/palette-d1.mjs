// Palette d1 "Sunset Mauve 7644C" — legacy olive -> mauve mapping, rewriter and accessibility gate.
// Usage:
//   node scripts/palette-d1.mjs                 gate (exit 1 on any FAIL)
//   node scripts/palette-d1.mjs --apply <file>  rewrite legacy olive hex/rgba in the given repo files
// Rule: luminance-matched hue swap. Each shipped colour has the d1 hue of its slot and the same WCAG
// relative luminance as the olive it replaces (never lighter), so every existing contrast pairing is kept.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SELF), "..");

// d1 reference hexes (VARIANTS.d1 in build-palette-variants.mjs)
const D1 = { base: "#A85A6B", dark: "#8A4656", soft: "#BB7585", darkest: "#6E3744", softer: "#C48C99" };

// [legacy olive, shipped mauve, slot]
export const PALETTE = [
    ["#5E5B34", "#864654", "base"],
    ["#4A4829", "#6B3643", "dark"],
    ["#6F6C3F", "#A35063", "soft"],
    ["#3D3B22", "#592C37", "darkest"],
    ["#8A8555", "#B56F80", "softer"],
    ["#5D5A3C", "#844653", "base"],
    ["#6B6B4E", "#A14F62", "soft"],
    ["#4A4730", "#6B3643", "dark"],
    ["#4A4830", "#6B3743", "dark"],
    ["#3D3B1E", "#592C37", "darkest"],
    ["#3A3820", "#542A34", "darkest"],
    ["#2D2B15", "#412028", "darkest"],
    ["#1A1910", "#261318", "darkest"],
];
export const SLOTS = Object.fromEntries(PALETTE.slice(0, 5).map(([, shipped, slot]) => [slot, shipped]));
const RGBA = { legacy: /rgba\(\s*74\s*,\s*72\s*,\s*41\s*,/gi, shipped: "rgba(107, 54, 67," };

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const lin = c => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = hex => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hue = hex => {
    const [r, g, b] = rgb(hex).map(c => c / 255);
    const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
    if (!d) return 0;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
};
const hueDist = (a, b) => { const d = Math.abs(hue(a) - hue(b)); return Math.min(d, 360 - d); };

function apply(args) {
    const files = args.map(a => resolve(ROOT, a));
    for (const [i, f] of files.entries()) {
        const rel = relative(ROOT, f);
        if (rel.startsWith("..") || isAbsolute(rel) || !existsSync(f) || f === SELF) {
            console.error(`refused: ${args[i]} (outside repo, missing, or the script itself)`);
            process.exitCode = 1;
            return;
        }
    }
    const map = new Map(PALETTE.map(([l, s]) => [l.toUpperCase(), s]));
    const re = new RegExp(`(${[...map.keys()].join("|")})(?![0-9a-fA-F])`, "gi");
    for (const f of files) {
        let n = 0;
        const out = readFileSync(f, "utf8")
            .replace(re, m => (n++, map.get(m.toUpperCase())))
            .replace(RGBA.legacy, () => (n++, RGBA.shipped));
        if (n) writeFileSync(f, out);
        console.log(`apply ${relative(ROOT, f)}: ${n} replacements`);
    }
}

function decls(css, selector) {
    const m = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
    return Object.fromEntries([...(m?.[1] ?? "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(x => [x[1], x[2].trim()]));
}

function gate() {
    const css = readFileSync(resolve(ROOT, "client/src/index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const root = decls(css, ":root");
    const themes = {
        ":root": root,
        light: { ...root, ...decls(css, '\\.light,\\s*\\[data-theme="light"\\]') },
        "admin-v2": { ...root, ...decls(css, '\\[data-theme="admin-v2"\\]') },
    };
    const res = [];
    const out = (ok, msg) => res.push(ok) && console.log(`${ok ? "PASS" : "FAIL"} ${msg}`);

    for (const [legacy, shipped, slot] of PALETTE) {
        const c = contrast(legacy, shipped), h = hueDist(shipped, D1[slot]);
        out(lum(shipped) <= lum(legacy) && c <= 1.01 && h <= 3,
            `parity ${legacy}->${shipped} (${slot}) lum ${lum(legacy).toFixed(4)}->${lum(shipped).toFixed(4)} contrast ${c.toFixed(3)} hue-d1 ${h.toFixed(1)}deg`);
    }

    const slotChecks = [[":root", "--bg-olive", 0], [":root", "--bg-olive-dark", 1], [":root", "--bg-olive-soft", 2],
        [":root", "--chart-5", 4], ["admin-v2", "--olive", 0], ["admin-v2", "--olive-deep", 3]];
    for (const [t, tok, row] of slotChecks) {
        const got = themes[t][tok], want = PALETTE[row][1];
        out(got?.toUpperCase() === want, `slot ${t} ${tok} = ${got} (want ${want})`);
    }

    const resolveVar = (theme, v, depth = 0) => {
        const m = v?.match(/^var\((--[\w-]+)\)$/);
        return m && depth < 10 ? resolveVar(theme, theme[m[1]], depth + 1) : v;
    };
    const base = ["foreground/background", "card-foreground/card", "popover-foreground/popover", "primary-foreground/primary",
        "secondary-foreground/secondary", "muted-foreground/muted", "muted-foreground/background", "muted-foreground/card",
        "accent-foreground/accent", "sidebar-foreground/sidebar", "sidebar-primary-foreground/sidebar-primary",
        "sidebar-accent-foreground/sidebar-accent"];
    // pre-existing sub-AA olive pairs: minimum is their olive baseline
    const floor = {
        ":root muted-foreground/muted": 3.95, ":root accent-foreground/accent": 4.46, ":root sidebar-accent-foreground/sidebar-accent": 4.46,
        "light sidebar-accent-foreground/sidebar-accent": 4.46, "light muted-foreground/muted": 3.95, "light muted-foreground/background": 4.46,
    };
    for (const [t, theme] of Object.entries(themes)) {
        for (const pair of [...base, "ring/background"]) {
            const [f, b] = pair.split("/").map(n => resolveVar(theme, theme[`--${n}`]));
            const min = pair === "ring/background" ? 3.0 : floor[`${t} ${pair}`] ?? 4.5;
            const ok = /^#[0-9a-f]{6}$/i.test(f ?? "") && /^#[0-9a-f]{6}$/i.test(b ?? "");
            const c = ok ? contrast(f, b) : 0;
            out(ok && c >= min, `pair ${t} ${pair} ${ok ? c.toFixed(2) : `unresolved (${f} / ${b})`} (min ${min})`);
        }
    }
    const failed = res.filter(r => !r).length;
    console.log(`palette-d1: ${res.length} checks, ${failed} failed`);
    if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [flag, ...rest] = process.argv.slice(2);
    if (flag === "--apply") apply(rest);
    else gate();
}
