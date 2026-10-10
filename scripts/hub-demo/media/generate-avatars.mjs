#!/usr/bin/env node
/**
 * Génère les 10 avatars illustrés (dessins plats, pas de photos de personnes) : avatar-<clé>.png, 256x256.
 * Déterministe : même entrée, même sortie. Nécessite `sharp` (npm i --no-save sharp) pour rastériser le SVG.
 * Usage : node scripts/hub-demo/media/generate-avatars.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const { default: sharp } = await import("sharp");

// bg: fond, skin: peau, top: vêtement, hair: cheveux/voile, style: variante de coiffure
const P = {
  yasmine: { bg: "#bfe7e0", skin: "#e8b48a", top: "#2f6f73", hair: "#1f8a8a", style: "hijab" },
  karim: { bg: "#f8d9b0", skin: "#d9a074", top: "#3b4a6b", hair: "#2a1f1a", style: "short" },
  salma: { bg: "#f3c6d0", skin: "#f0c09a", top: "#7a2e44", hair: "#8e3b56", style: "hijab" },
  omar: { bg: "#cfd8f3", skin: "#c68b62", top: "#4a5a3a", hair: "#1e1a17", style: "beard" },
  nadia: { bg: "#e6d3f2", skin: "#f1c9a5", top: "#b5527a", hair: "#4a2c1d", style: "long" },
  mehdi: { bg: "#d4ecc9", skin: "#d49a70", top: "#2d3f5e", hair: "#a33a2a", style: "cap" },
  imane: { bg: "#fbe7a8", skin: "#e9b88f", top: "#6b4f1d", hair: "#d19a1e", style: "hijab" },
  reda: { bg: "#c8dbe9", skin: "#b9805a", top: "#8a3d2a", hair: "#15110f", style: "curly" },
  hajar: { bg: "#ffd9c2", skin: "#f0c4a0", top: "#3f6b4d", hair: "#2b1b14", style: "bun" },
  anas: { bg: "#d9d9ee", skin: "#d8a47c", top: "#e4572e", hair: "#241a14", style: "short" },
};

const back = {
  long: c => `<path d="M64 110C60 70 90 40 128 40s68 30 64 70l6 80H58z" fill="${c.hair}"/>`,
  hijab: c => `<path d="M128 40c-36 0-56 28-52 76 2 30-6 52-16 70h136c-10-18-18-40-16-70 4-48-16-76-52-76z" fill="${c.hair}"/>`,
};
const front = {
  hijab: c => `<path d="M86 118c0-40 18-56 42-56s42 16 42 56c-10-20-22-32-42-32s-32 12-42 32z" fill="${c.hair}"/><path d="M86 126c2 24 16 36 42 36s40-12 42-36c8 46-10 78-40 78s-48-32-40-78z" fill="${c.hair}"/>`,
  short: c => `<path d="M88 100c-4-40 12-56 40-56s44 16 40 56c-8-22-20-30-40-30s-32 8-40 30z" fill="${c.hair}"/>`,
  beard: c => `<path d="M88 98c-4-38 12-52 40-52s44 14 40 52c-8-18-20-24-40-24s-32 6-40 24z" fill="${c.hair}"/><path d="M92 130c4 36 18 48 36 48s32-12 36-48c-10 16-20 20-36 20s-26-4-36-20z" fill="${c.hair}"/>`,
  long: c => `<path d="M88 104c-2-36 14-52 40-52s42 16 40 52c-10-24-24-30-40-30s-30 6-40 30z" fill="${c.hair}"/>`,
  cap: c => `<path d="M84 98c0-36 18-52 44-52s44 16 44 52z" fill="${c.top}"/><path d="M80 98h110c6 0 6 10 0 10H80z" fill="${c.top}"/><path d="M96 96c0-24 14-36 32-36" fill="none" stroke="#ffffff55" stroke-width="4"/>`,
  curly: c => `<g fill="${c.hair}"><circle cx="94" cy="84" r="16"/><circle cx="112" cy="68" r="17"/><circle cx="136" cy="66" r="17"/><circle cx="158" cy="80" r="17"/><circle cx="164" cy="100" r="11"/><circle cx="92" cy="102" r="11"/></g>`,
  bun: c => `<circle cx="128" cy="38" r="20" fill="${c.hair}"/><path d="M88 104c-4-38 14-54 40-54s44 16 40 54c-8-22-22-28-40-28s-32 6-40 28z" fill="${c.hair}"/>`,
};

const svg = k => {
  const c = P[k];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<rect width="256" height="256" fill="${c.bg}"/>
${back[c.style]?.(c) ?? ""}
<path d="M40 256c0-48 36-70 88-70s88 22 88 70z" fill="${c.top}"/>
<rect x="112" y="150" width="32" height="40" rx="12" fill="${c.skin}"/>
<ellipse cx="128" cy="112" rx="40" ry="46" fill="${c.skin}"/>
<ellipse cx="88" cy="116" rx="6" ry="10" fill="${c.skin}"/><ellipse cx="168" cy="116" rx="6" ry="10" fill="${c.skin}"/>
${front[c.style](c)}
<circle cx="112" cy="112" r="4" fill="#2a1f1a"/><circle cx="144" cy="112" r="4" fill="#2a1f1a"/>
<path d="M114 134c8 8 20 8 28 0" fill="none" stroke="#7a3b2a" stroke-width="3.5" stroke-linecap="round"/>
</svg>`;
};

for (const k of Object.keys(P)) {
  await sharp(Buffer.from(svg(k))).png({ compressionLevel: 9 }).toFile(join(HERE, `avatar-${k}.png`));
  console.log(`✓ avatar-${k}.png`);
}
