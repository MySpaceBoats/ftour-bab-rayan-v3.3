#!/usr/bin/env node
/**
 * Génère les photos de démonstration de la marketplace (scripts/hub-demo/media/*.jpg).
 *
 * Les visuels sont rendus par Chrome headless puis convertis en JPEG : pas de dépendance d'image,
 * pas de photo sous licence. Chaque visuel porte la mention « Photo de démonstration » pour qu'il ne
 * soit jamais confondu avec une vraie annonce.
 *
 * Usage : node scripts/hub-demo/media/generate-media.mjs
 *   CHROME_BIN=/chemin/vers/chrome pour forcer le binaire (défaut : Chrome macOS).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TMP = join(HERE, ".tmp");
const CHROME = process.env.CHROME_BIN
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SIPS = "/usr/bin/sips";

/** Doit rester synchronisé avec LISTING_MEDIA (build.ts) et STAY_MEDIA (stay.ts). */
const ITEMS = [
  { file: "velo-1.jpg", emoji: "🚲", title: "Vélo enfant 6-8 ans", from: "#dbeafe", to: "#93c5fd" },
  { file: "velo-2.jpg", emoji: "🛞", title: "Vélo enfant — roues et cadre", from: "#e0e7ff", to: "#a5b4fc" },
  { file: "cafe-1.jpg", emoji: "☕", title: "Machine à café à capsules", from: "#fef3c7", to: "#fcd34d" },
  { file: "livres-1.jpg", emoji: "📚", title: "12 livres de cuisine marocaine", from: "#d1fae5", to: "#6ee7b7" },
  { file: "poussette-1.jpg", emoji: "🍼", title: "Poussette Chicco pliable", from: "#cffafe", to: "#67e8f9" },
  { file: "robe-1.jpg", emoji: "👗", title: "Robe de soirée taille 38", from: "#fce7f3", to: "#f9a8d4" },
  { file: "robe-2.jpg", emoji: "🧵", title: "Robe de soirée — détail du tissu", from: "#fae8ff", to: "#e9d5ff" },
  { file: "casque-1.jpg", emoji: "🎧", title: "Casque audio Bluetooth neuf", from: "#e0e7ff", to: "#a5b4fc" },
  { file: "table-1.jpg", emoji: "🪑", title: "Table basse en bois à donner", from: "#fef3c7", to: "#d6b98c" },
  { file: "manuels-1.jpg", emoji: "📘", title: "Manuels de lycée maths et physique", from: "#dbeafe", to: "#93c5fd" },
  { file: "tapis-1.jpg", emoji: "🧶", title: "Tapis berbère 2 x 3 m", from: "#fee2e2", to: "#fca5a5" },
  { file: "iphone-1.jpg", emoji: "📱", title: "iPhone 15 Pro", from: "#e2e8f0", to: "#cbd5e1" },
  { file: "scooter-1.jpg", emoji: "🛵", title: "Scooter 50 cc, 12 000 km", from: "#fee2e2", to: "#fca5a5" },
  { file: "djellaba-1.jpg", emoji: "🧥", title: "Djellaba homme taille L", from: "#fef3c7", to: "#fde68a" },
  { file: "couture-1.jpg", emoji: "🧵", title: "Machine à coudre de table", from: "#fae8ff", to: "#e9d5ff" },
  { file: "tablette-1.jpg", emoji: "📲", title: "Tablette Android 10 pouces", from: "#e2e8f0", to: "#cbd5e1" },
  { file: "stay-chambre-maarif.jpg", emoji: "🛏️", title: "Chambre calme près du Maârif", from: "#dbeafe", to: "#bfdbfe" },
  { file: "stay-canape-gauthier.jpg", emoji: "🛋️", title: "Canapé-lit de dépannage", from: "#d1fae5", to: "#a7f3d0" },
  { file: "stay-studio-agdal.jpg", emoji: "🏢", title: "Studio indépendant à Agdal", from: "#e0e7ff", to: "#c7d2fe" },
  { file: "stay-maison-gueliz.jpg", emoji: "🏡", title: "Maison avec patio, Guéliz", from: "#ffedd5", to: "#fdba74" },
  { file: "stay-tente-palmeraie.jpg", emoji: "⛺", title: "Tente berbère dans le jardin", from: "#fef3c7", to: "#fcd34d" },
  { file: "stay-appart-fes.jpg", emoji: "🏙️", title: "Appartement lumineux, Fès", from: "#fce7f3", to: "#fbcfe8" },
  { file: "stay-chambre-mohammedia.jpg", emoji: "🌊", title: "Chambre simple, Mohammedia", from: "#cffafe", to: "#a5f3fc" },
  { file: "stay-appart-oasis.jpg", emoji: "🏠", title: "Appartement 2 pièces, Oasis", from: "#ecfccb", to: "#bef264" },
];

for (const [bin, hint] of [[CHROME, "CHROME_BIN=/chemin/vers/chrome"], [SIPS, "sips est fourni par macOS (conversion JPEG)"]]) {
  if (!existsSync(bin)) {
    console.error(`${bin} introuvable.\n${hint}`);
    process.exit(1);
  }
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// Une page par visuel : Chrome ne sait capturer que la fenêtre, pas un élément précis.
// Les autres visuels sont de vraies photos libres de droits (voir CREDITS.md) : ne jamais les écraser.
const PLACEHOLDERS = new Set(["livres-1.jpg", "poussette-1.jpg", "robe-1.jpg", "robe-2.jpg", "djellaba-1.jpg", "stay-appart-oasis.jpg"]);
const TODO = ITEMS.filter(i => PLACEHOLDERS.has(i.file));
for (const item of TODO) {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    html,body{margin:0;width:800px;height:600px;overflow:hidden}
    .tile{width:800px;height:600px;display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:28px;background:linear-gradient(140deg,${item.from},${item.to});
      font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .emoji{font-size:190px;line-height:1;filter:drop-shadow(0 10px 18px rgba(0,0,0,.18))}
    h1{margin:0;max-width:660px;text-align:center;font-size:34px;font-weight:700;color:#1f2937;letter-spacing:-.4px}
    .tag{position:absolute;bottom:22px;font-size:14px;font-weight:600;letter-spacing:.4px;
      color:rgba(31,41,55,.55);text-transform:uppercase}
  </style></head><body>
    <div class="tile"><div class="emoji">${item.emoji}</div><h1>${item.title}</h1>
    <div class="tag">Photo de démonstration</div></div>
  </body></html>`;
  const page = join(TMP, `${item.file.replace(/\.jpg$/, "")}.html`);
  const shot = join(TMP, item.file.replace(/\.jpg$/, ".png"));
  writeFileSync(page, html);
  execFileSync(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--disable-crash-reporter", `--crash-dumps-dir=${TMP}`,
    "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${join(TMP, "profile")}`,
    "--window-size=800,600", "--virtual-time-budget=2500",
    `--screenshot=${shot}`, `file://${page}`,
  ], { stdio: ["ignore", "ignore", "ignore"] });
  // JPEG : un PNG de 800x600 pèse ~200 Ko, le même en JPEG ~30 Ko (dépôt et R2 plus légers)
  execFileSync(SIPS, ["-s", "format", "jpeg", "-s", "formatOptions", "82", shot, "--out", join(HERE, item.file)], { stdio: ["ignore", "ignore", "ignore"] });
  console.log(`✓ ${item.file}`);
}

rmSync(TMP, { recursive: true, force: true });
console.log(`\n${TODO.length} visuels écrits dans ${HERE}`);
