# Marketplace de l'espace bénévole Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un onglet Marketplace dans l'espace bénévole : annonces d'objets à vendre (photos privées, prix, catégories), commentaires publics, contact téléphone/WhatsApp au choix du vendeur, et messagerie privée acheteur-vendeur, avec modération admin.

**Architecture:** Nouvelles tables D1 `mk_*` (un fichier `worker/d1/marketplace.sql`), couche données `worker/market-d1.ts` (comme `hub-d1.ts`), routes `/hub/market/*` dans `worker/market.ts` que `worker/hub.ts` appelle pour tout chemin `market/…` (même session Bearer, même garde admin, même signature de photos). Client dans `client/src/features/hub/market/`. Livraison en deux jalons : annonces (Tasks 1–4), messagerie (Tasks 5–7).

**Tech Stack:** TypeScript, Cloudflare Worker + D1 + R2, vitest + `node:sqlite`, React 19, wouter, sonner, shadcn/ui, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-10-marketplace-design.md`

## Global Constraints

- Tests hermétiques : D1 = `node:sqlite` en mémoire, aucun réseau. Pas de `.skip`/`.only`. Pas de nouvelle dépendance. TS strict.
- Le Worker gèle `Date` au chargement du module : le temps est toujours passé en paramètre (`nowMs`) ou lu via `now()`.
- CORS du Worker : `GET, POST, PUT, DELETE, OPTIONS` seulement. **Pas de PATCH.**
- Le Worker déploie `dist/worker.js` : toujours `pnpm build:cloudflare` (ou `pnpm build:worker`) avant `wrangler deploy`.
- Limites : titre ≤ 80, description ≤ 2000, ville ≤ 60, ≤ 4 photos, prix entier 0–9 999 999 MAD, commentaire ≤ 500, message ≤ 1000, raison de signalement ≤ 300 ; 5 annonces/24 h, 30 commentaires/h, 30 messages/h, 20 nouvelles discussions/h par membre.
- Catégories : `maison, mode, high-tech, enfants, livres, vehicules, autre`. États : `neuf, bon, correct`. Statuts d'annonce : `active, sold, hidden`.
- Téléphone : normalisé (espaces, points, tirets, parenthèses retirés) puis `^\+?\d{8,15}$` ; WhatsApp exige le format international `+…`. Il n'est renvoyé qu'aux membres connectés et seulement s'il est renseigné.
- Les admins **ne lisent pas** les messages privés. Aucun JSON ne contient d'email ni (hors `contact`) de téléphone.
- Admin : garde `admin()` existante (Supabase bearer, rôle ∈ {super_admin, admin, admin_ops}, **demo refusé**).
- Recherche LIKE : motif (`%q%` échappé) ≤ 50 octets, sinon 400 (limite D1).
- Ne jamais `git commit -a` ; `git add` de chemins précis (le dépôt a des fichiers non liés non commités : `CLAUDE.md`, `.planning/STATE.md`, `.claude-flow/`). Aucun secret committé.
- Aucun déploiement/écriture de prod par un agent : Task 8 est lancée par l'utilisateur. Projet Pages de prod : `ftour-bab-rayan-v3-3` (jamais `ftour-bab-rayan`).

## Review Focus

- Téléphone d'un vendeur : jamais dans la liste, jamais sans session, uniquement dans le détail quand renseigné.
- Annonce `hidden` : 404 par id pour tous ; commentaires/discussions sur annonce masquée refusés.
- Vendeur suspendu ou bénévole annulé : ses annonces disparaissent de la liste et du détail.
- Un tiers qui devine l'id d'une discussion : 404 (pas 403), ni lecture ni écriture ni « lu ».
- Acheteur = vendeur : refus. Nouvelle discussion sur annonce vendue : refus ; discussion existante : continue.
- Prix `-1`, `1.5`, `"12"`, `NaN`, `1e9` ; catégorie/état hors liste ; titre vide ou HTML (`<script>`) : rejeté/échappé, jamais exécuté.
- Recherche `q` avec `%`, `_`, `\` et > 50 octets (accents) ; curseur non numérique.
- Chemin de photo d'un autre membre ou avec `..` dans une annonce.
- Spam : 6ᵉ annonce du jour, 31ᵉ message de l'heure → 429.
- Admin en mode démo ou sans jeton sur `market/admin/*` : 403.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `worker/d1/marketplace.sql` (créer) | Schéma `mk_*` idempotent |
| `worker/hub-d1.ts` (modifier) | exporter `cleanBody`, `HOUR_MS` |
| `worker/market-d1.ts` (créer) | Données : annonces, commentaires, signalements, admin, puis messagerie |
| `worker/market-d1.test.ts` (créer) | Tests données |
| `worker/hub-http.ts` (créer) | helpers HTTP partagés (`readJson`, `num`, `id`, `str`) extraits de `hub.ts` |
| `worker/market.ts` (créer) | Routes `market/*` |
| `worker/market.test.ts` (créer) | Tests des routes via `handleHubRequest` |
| `worker/hub.ts` (modifier) | importe `hub-http`, délègue `market/*` |
| `client/src/features/hub/api.ts` (modifier) | exporter `call` |
| `client/src/features/hub/useHubMember.ts` (créer) | hook membre courant |
| `client/src/features/hub/market/*` (créer) | api, pages, composants |
| `client/src/features/hub/components/HubShell.tsx`, `client/src/App.tsx`, `client/src/features/hub/admin/AdminHub.tsx` (modifier) | navigation, routes, admin |

---

### Task 1: Schéma et annonces (création, édition, statut, liste, détail)

**Files:**
- Create: `worker/d1/marketplace.sql`
- Create: `worker/market-d1.ts`
- Create: `worker/market-d1.test.ts`
- Modify: `worker/hub-d1.ts` (exporter `cleanBody` et `HOUR_MS`)

**Interfaces:**
- Consumes (de `hub-d1.ts`) : `HubError`, `iso`, `isOwnPath`, `MemberRow`, `createLoginToken`, `openSession`, `getSession` (tests), et — après `export` ajouté ici — `cleanBody(raw: unknown, max: number, label: string): string` et `HOUR_MS`.
- Produces :
  - `MK_CATEGORIES`, `MK_CONDITIONS`, `MK_LIMITS`
  - `normalizePhone(raw: unknown): string | null`
  - `interface ListingInput { title: string; description: string; price: number; category: string; condition: string; city?: string; phone?: unknown; whatsapp?: boolean; mediaPaths?: string[] }`
  - `createListing(d, member, input, nowMs): Promise<{ id: number }>`
  - `updateListing(d, member, id, input, nowMs): Promise<void>`
  - `setListingStatus(d, member, id, status: "active" | "sold", nowMs): Promise<void>`
  - `hideListing(d, id, actor?: MemberRow): Promise<void>` (sans `actor` = admin)
  - `listListings(d, viewerId, opts?: { cursor?: number | null; category?: string; q?: string; mine?: boolean; limit?: number }): Promise<{ listings: ListingCard[]; nextCursor: number | null }>`
  - `getListing(d, viewerId, id): Promise<ListingDetail>`
  - types `Seller`, `ListingCard`, `ListingDetail`

- [ ] **Step 1: Exporter les helpers de `hub-d1.ts`**

Dans `worker/hub-d1.ts`, remplacer `const HOUR_MS = 60 * 60 * 1000;` par `export const HOUR_MS = 60 * 60 * 1000;` et `function cleanBody(` par `export function cleanBody(`.

- [ ] **Step 2: Écrire le schéma `worker/d1/marketplace.sql`**

```sql
-- Marketplace de l'espace bénévole. Idempotent. Prérequis : worker/d1/hub.sql.
-- Appliquer : wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/marketplace.sql
CREATE TABLE IF NOT EXISTS mk_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 2000),
  price INTEGER NOT NULL CHECK (price BETWEEN 0 AND 9999999),
  category TEXT NOT NULL CHECK (category IN ('maison','mode','high-tech','enfants','livres','vehicules','autre')),
  item_condition TEXT NOT NULL CHECK (item_condition IN ('neuf','bon','correct')),
  city TEXT NOT NULL DEFAULT '' CHECK (length(city) <= 60),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','hidden')),
  contact_phone TEXT,
  contact_whatsapp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_mk_listings_status ON mk_listings(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_mk_listings_cat ON mk_listings(category, status, id DESC);
CREATE INDEX IF NOT EXISTS idx_mk_listings_member ON mk_listings(member_id, created_at);

-- r2_key = chemin dans le bucket logique "hub" (<memberId>/<uuid>.<ext>)
CREATE TABLE IF NOT EXISTS mk_listing_media (
  listing_id INTEGER NOT NULL REFERENCES mk_listings(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
  PRIMARY KEY (listing_id, position)
);

CREATE TABLE IF NOT EXISTS mk_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES mk_listings(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_mk_comments_listing ON mk_comments(listing_id, id);
CREATE INDEX IF NOT EXISTS idx_mk_comments_member ON mk_comments(member_id, created_at);

CREATE TABLE IF NOT EXISTS mk_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES mk_listings(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL,
  UNIQUE (listing_id, buyer_id),
  CHECK (buyer_id <> seller_id)
);
CREATE INDEX IF NOT EXISTS idx_mk_threads_buyer ON mk_threads(buyer_id, last_message_at);
CREATE INDEX IF NOT EXISTS idx_mk_threads_seller ON mk_threads(seller_id, last_message_at);

CREATE TABLE IF NOT EXISTS mk_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES mk_threads(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_mk_messages_thread ON mk_messages(thread_id, id);
CREATE INDEX IF NOT EXISTS idx_mk_messages_sender ON mk_messages(sender_id, created_at);

CREATE TABLE IF NOT EXISTS mk_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('listing','comment')),
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 300),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (target_type, target_id, member_id)
);
```

- [ ] **Step 3: Écrire les tests qui échouent `worker/market-d1.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import * as h from "./hub-d1";
import * as mk from "./market-d1";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

function fakeD1(sqlite: InstanceType<typeof DatabaseSync>): D1Like {
  const stmt = (sql: string, params: unknown[] = []): D1Stmt => ({
    bind: (...v) => stmt(sql, v),
    all: async () => ({ results: sqlite.prepare(sql).all(...(params as any[])) as any[] }),
    first: async () => ((sqlite.prepare(sql).get(...(params as any[])) as any) ?? null),
    run: async () => sqlite.prepare(sql).run(...(params as any[])),
  });
  return {
    prepare: sql => stmt(sql),
    batch: async s => {
      sqlite.exec("BEGIN");
      try { for (const x of s) await x.run(); sqlite.exec("COMMIT"); } catch (e) { sqlite.exec("ROLLBACK"); throw e; }
      return [];
    },
  };
}

const T0 = Date.parse("2026-10-10T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let sqlite: InstanceType<typeof DatabaseSync>;
let d: D1Like;

const vol = (email: string, status = "confirmed", first = "Amina") =>
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?,?)").run(first, "Benali", email, status);

async function member(email: string, first = "Amina", role?: "moderator") {
  vol(email, "confirmed", first);
  const { session } = await h.openSession(d, await h.createLoginToken(d, email, T0), T0);
  if (role) sqlite.prepare("UPDATE hub_members SET role=? WHERE email=?").run(role, email);
  return (await h.getSession(d, session, T0 + 1))!;
}

const base = (over: Partial<mk.ListingInput> = {}): mk.ListingInput => ({
  title: "Vélo enfant", description: "Très bon état", price: 150, category: "enfants", condition: "bon", city: "Casablanca", ...over,
});

/** Insert a listing directly (bypasses the daily rate limit) for list/search/pagination tests. */
function raw(memberId: number, over: Record<string, unknown> = {}) {
  const o = { title: "Objet", description: "desc", price: 10, category: "autre", item_condition: "bon", city: "", status: "active", ...over };
  return Number(sqlite.prepare(
    "INSERT INTO mk_listings (member_id,title,description,price,category,item_condition,city,status) VALUES (?,?,?,?,?,?,?,?)",
  ).run(memberId, o.title, o.description, o.price, o.category, o.item_condition, o.city, o.status).lastInsertRowid);
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE t_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, status TEXT);");
  for (const f of ["hub.sql", "marketplace.sql"]) {
    const sql = readFileSync(new URL(`./d1/${f}`, import.meta.url), "utf8");
    sqlite.exec(sql);
    sqlite.exec(sql); // idempotent
  }
  d = fakeD1(sqlite);
});

describe("normalizePhone", () => {
  it("accepts empty, strips separators, validates digits", () => {
    expect(mk.normalizePhone(undefined)).toBeNull();
    expect(mk.normalizePhone("")).toBeNull();
    expect(mk.normalizePhone("  ")).toBeNull();
    expect(mk.normalizePhone("+212 6.12-34 56 78")).toBe("+212612345678");
    expect(mk.normalizePhone("06 12 34 56 78")).toBe("0612345678");
    for (const bad of ["abc", "123", "+1234567890123456", "12 34 56 7a 89", 5, {}]) {
      expect(() => mk.normalizePhone(bad as any)).toThrow(/Téléphone invalide/);
    }
  });
});

describe("listings write", () => {
  it("creates with photos; validates every field", async () => {
    const a = await member("a@x.ma");
    const { id } = await mk.createListing(d, a, base({ mediaPaths: [`${a.id}/a.jpg`, `${a.id}/b.jpg`], phone: "+212 612345678", whatsapp: true }), T0);
    const got = await mk.getListing(d, a.id, id);
    expect(got).toMatchObject({ title: "Vélo enfant", price: 150, category: "enfants", condition: "bon", status: "active", mine: true, contact: { phone: "+212612345678", whatsapp: true } });
    expect(got.media).toEqual([`${a.id}/a.jpg`, `${a.id}/b.jpg`]);
    const bad = async (over: Partial<mk.ListingInput>) => expect(mk.createListing(d, a, base(over), T0)).rejects.toMatchObject({ code: "invalid" });
    await bad({ title: "  " });
    await bad({ title: "x".repeat(81) });
    await bad({ description: "" });
    await bad({ price: -1 });
    await bad({ price: 1.5 });
    await bad({ price: NaN });
    await bad({ price: 10_000_000 });
    await bad({ category: "voitures" });
    await bad({ condition: "casse" });
    await bad({ city: "v".repeat(61) });
    await bad({ phone: "12" });
    await bad({ phone: "0612345678", whatsapp: true }); // WhatsApp needs +country code
    await bad({ mediaPaths: [1, 2, 3, 4, 5].map(i => `${a.id}/${i}.jpg`) });
    await bad({ mediaPaths: ["999/x.jpg"] });
    await bad({ mediaPaths: [`${a.id}/../x.jpg`] });
    await expect(mk.createListing(d, a, base({ price: 0 }), T0 + 5)).resolves.toBeTruthy(); // free is allowed
  });

  it("rate-limits 5 listings per 24 hours", async () => {
    const a = await member("a@x.ma");
    for (let i = 0; i < 5; i++) await mk.createListing(d, a, base({ title: `t${i}` }), T0 + i);
    await expect(mk.createListing(d, a, base(), T0 + 10)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(mk.createListing(d, a, base(), T0 + DAY + 100)).resolves.toBeTruthy();
  });

  it("stores markup as text and a phone-less listing exposes no contact", async () => {
    const a = await member("a@x.ma");
    const { id } = await mk.createListing(d, a, base({ title: "<script>alert(1)</script>" }), T0);
    const got = await mk.getListing(d, a.id, id);
    expect(got.title).toBe("<script>alert(1)</script>");
    expect(got.contact).toBeNull();
    expect((got as any).contact_phone).toBeUndefined();
  });

  it("update: owner only, replaces photos, not on hidden", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await mk.createListing(d, a, base({ mediaPaths: [`${a.id}/a.jpg`] }), T0);
    await expect(mk.updateListing(d, b, id, base(), T0 + 1)).rejects.toMatchObject({ code: "forbidden" });
    await mk.updateListing(d, a, id, base({ title: "Nouveau", price: 99, mediaPaths: [`${a.id}/c.jpg`, `${a.id}/d.jpg`] }), T0 + 2);
    expect(await mk.getListing(d, a.id, id)).toMatchObject({ title: "Nouveau", price: 99, media: [`${a.id}/c.jpg`, `${a.id}/d.jpg`] });
    await mk.hideListing(d, id);
    await expect(mk.updateListing(d, a, id, base(), T0 + 3)).rejects.toMatchObject({ code: "not_found" });
    await expect(mk.updateListing(d, a, 9999, base(), T0 + 3)).rejects.toMatchObject({ code: "not_found" });
  });

  it("status sold/active: owner only; invalid values rejected", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await mk.createListing(d, a, base(), T0);
    await expect(mk.setListingStatus(d, b, id, "sold", T0)).rejects.toMatchObject({ code: "forbidden" });
    await expect(mk.setListingStatus(d, a, id, "hidden" as any, T0)).rejects.toMatchObject({ code: "invalid" });
    await mk.setListingStatus(d, a, id, "sold", T0 + 1);
    expect((await mk.getListing(d, a.id, id)).status).toBe("sold");
    await mk.setListingStatus(d, a, id, "active", T0 + 2);
    expect((await mk.getListing(d, a.id, id)).status).toBe("active");
  });

  it("hide: owner, moderator or admin; others forbidden; hidden is 404 and leaves the list", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const mod = await member("m@x.ma", "Mona", "moderator");
    const l1 = (await mk.createListing(d, a, base({ title: "l1" }), T0)).id;
    const l2 = (await mk.createListing(d, a, base({ title: "l2" }), T0 + 1)).id;
    const l3 = (await mk.createListing(d, a, base({ title: "l3" }), T0 + 2)).id;
    await expect(mk.hideListing(d, l1, b)).rejects.toMatchObject({ code: "forbidden" });
    await mk.hideListing(d, l1, a);
    await mk.hideListing(d, l2, mod);
    await mk.hideListing(d, l3); // admin
    for (const x of [l1, l2, l3]) await expect(mk.getListing(d, b.id, x)).rejects.toMatchObject({ code: "not_found" });
    expect((await mk.listListings(d, b.id)).listings).toEqual([]);
    await expect(mk.hideListing(d, 9999)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("listings read", () => {
  it("list: newest first, cover photo, cursor pagination, no description or phone", async () => {
    const a = await member("a@x.ma");
    const ids: number[] = [];
    for (let i = 0; i < 25; i++) ids.push(raw(a.id, { title: `o${i}` }));
    sqlite.prepare("INSERT INTO mk_listing_media (listing_id, r2_key, position) VALUES (?,?,0)").run(ids[24], `${a.id}/cover.jpg`);
    sqlite.prepare("UPDATE mk_listings SET contact_phone='+212600000000' WHERE id=?").run(ids[24]);
    const p1 = await mk.listListings(d, a.id);
    expect(p1.listings).toHaveLength(20);
    expect(p1.listings[0]).toMatchObject({ id: ids[24], cover: `${a.id}/cover.jpg`, seller: { display_name: "Amina B." } });
    expect(JSON.stringify(p1)).not.toContain("+212600000000");
    expect(JSON.stringify(p1)).not.toContain("description");
    const p2 = await mk.listListings(d, a.id, { cursor: p1.nextCursor });
    expect(p2.listings).toHaveLength(5);
    expect(p2.nextCursor).toBeNull();
  });

  it("filters: category, mine, sold stays visible, hidden excluded; bad category rejected", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    raw(a.id, { title: "livre 1", category: "livres" });
    raw(b.id, { title: "table", category: "maison" });
    raw(b.id, { title: "vendu", category: "maison", status: "sold" });
    raw(b.id, { title: "masque", category: "maison", status: "hidden" });
    expect((await mk.listListings(d, a.id, { category: "maison" })).listings.map(l => l.title).sort()).toEqual(["table", "vendu"]);
    expect((await mk.listListings(d, a.id, { mine: true })).listings.map(l => l.title)).toEqual(["livre 1"]);
    await expect(mk.listListings(d, a.id, { category: "voitures" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("search: title or description, wildcards are literal, long patterns rejected", async () => {
    const a = await member("a@x.ma");
    raw(a.id, { title: "Table basse", description: "bois" });
    raw(a.id, { title: "Lampe", description: "pour la table" });
    raw(a.id, { title: "Remise 50%", description: "x" });
    raw(a.id, { title: "a_b", description: "x" });
    const t = async (q: string) => (await mk.listListings(d, a.id, { q })).listings.map(l => l.title).sort();
    expect(await t("table")).toEqual(["Lampe", "Table basse"]);
    expect(await t("50%")).toEqual(["Remise 50%"]);
    expect(await t("%")).toEqual(["Remise 50%"]);
    expect(await t("_")).toEqual(["a_b"]);
  });

  it("search too long -> invalid", async () => {
    const a = await member("a@x.ma");
    await expect(mk.listListings(d, a.id, { q: "é".repeat(30) })).rejects.toMatchObject({ code: "invalid" });
    await expect(mk.listListings(d, a.id, { q: "x".repeat(49) })).rejects.toMatchObject({ code: "invalid" });
    await expect(mk.listListings(d, a.id, { q: "x".repeat(48) })).resolves.toBeTruthy();
  });

  it("sellers that are suspended or no longer confirmed vanish (list and detail)", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const la = raw(a.id, { title: "de A" });
    const lb = raw(b.id, { title: "de B" });
    sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id=?").run(a.id);
    sqlite.prepare("UPDATE t_volunteers SET status='cancelled' WHERE email='b@x.ma'").run();
    const viewer = await member("c@x.ma", "Chakib");
    expect((await mk.listListings(d, viewer.id)).listings).toEqual([]);
    await expect(mk.getListing(d, viewer.id, la)).rejects.toMatchObject({ code: "not_found" });
    await expect(mk.getListing(d, viewer.id, lb)).rejects.toMatchObject({ code: "not_found" });
  });

  it("detail: mine flag, contact whatsapp flag, raw media keys only for the owner", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await mk.createListing(d, a, base({ phone: "0612345678", mediaPaths: [`${a.id}/a.jpg`] }), T0);
    const asOwner = await mk.getListing(d, a.id, id);
    const asOther = await mk.getListing(d, b.id, id);
    expect(asOwner).toMatchObject({ mine: true, contact: { phone: "0612345678", whatsapp: false } });
    expect(asOther).toMatchObject({ mine: false, contact: { phone: "0612345678", whatsapp: false } });
    expect(asOwner.media_keys).toEqual([`${a.id}/a.jpg`]);
    expect(asOther.media_keys).toBeUndefined();
    await expect(mk.getListing(d, a.id, 9999)).rejects.toMatchObject({ code: "not_found" });
  });
});
```

- [ ] **Step 4: Lancer, vérifier l'échec**

Run: `npx vitest run worker/market-d1.test.ts`
Expected: FAIL (`Cannot find module './market-d1'`).

- [ ] **Step 5: Implémenter `worker/market-d1.ts` (annonces)**

```ts
/**
 * Marketplace data layer on Cloudflare D1 (tables mk_*). Reuses hub members/sessions.
 * No HTTP / Supabase imports: testable with a fake D1. Time is always passed in (nowMs).
 */
import type { D1Like } from "./gallery-d1";
import { HOUR_MS, HubError, cleanBody, iso, isOwnPath, type MemberRow } from "./hub-d1";

export const MK_CATEGORIES = ["maison", "mode", "high-tech", "enfants", "livres", "vehicules", "autre"] as const;
export const MK_CONDITIONS = ["neuf", "bon", "correct"] as const;
export const MK_LIMITS = {
  listingsPerDay: 5, commentsPerHour: 30, messagesPerHour: 30, threadsPerHour: 20,
  title: 80, description: 2000, city: 60, comment: 500, message: 1000, photos: 4, maxPrice: 9_999_999, reason: 300, likePatternBytes: 50,
};
const DAY_MS = 24 * HOUR_MS;

/** Sellers whose hub account is suspended, or whose volunteer is no longer confirmed/present, vanish. m = hub_members alias. */
export const SELLER_OK = `m.status = 'active' AND EXISTS (SELECT 1 FROM t_volunteers v WHERE lower(v.email) = m.email AND v.status IN ('confirmed','present'))`;

export interface Seller { id: number; display_name: string; avatar_key: string | null }
export interface ListingCard { id: number; title: string; price: number; category: string; condition: string; city: string; status: "active" | "sold"; created_at: string; seller: Seller; cover: string | null }
export interface ListingDetail extends Omit<ListingCard, "cover"> {
  description: string; updated_at: string; media: string[]; mine: boolean;
  contact: { phone: string; whatsapp: boolean } | null;
  media_keys?: string[]; // owner only
}
export interface ListingInput { title: string; description: string; price: number; category: string; condition: string; city?: string; phone?: unknown; whatsapp?: boolean; mediaPaths?: string[] }

export function normalizePhone(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") throw new HubError("invalid", "Téléphone invalide");
  const p = raw.replace(/[\s.\-()]/g, "");
  if (p === "") return null;
  if (!/^\+?\d{8,15}$/.test(p)) throw new HubError("invalid", "Téléphone invalide (8 à 15 chiffres)");
  return p;
}

interface Clean { title: string; description: string; price: number; category: string; condition: string; city: string; phone: string | null; whatsapp: boolean; media: string[] }
function clean(member: MemberRow, i: ListingInput): Clean {
  const title = cleanBody(i.title, MK_LIMITS.title, "Titre");
  const description = cleanBody(i.description, MK_LIMITS.description, "Description");
  if (!Number.isSafeInteger(i.price) || i.price < 0 || i.price > MK_LIMITS.maxPrice) throw new HubError("invalid", "Prix invalide (entier en MAD, 0 = gratuit)");
  if (!(MK_CATEGORIES as readonly string[]).includes(i.category)) throw new HubError("invalid", "Catégorie invalide");
  if (!(MK_CONDITIONS as readonly string[]).includes(i.condition)) throw new HubError("invalid", "État invalide");
  const city = typeof i.city === "string" ? i.city.trim() : "";
  if (city.length > MK_LIMITS.city) throw new HubError("invalid", "Ville trop longue (60 caractères max)");
  const phone = normalizePhone(i.phone);
  const whatsapp = i.whatsapp === true && phone !== null;
  if (whatsapp && !phone!.startsWith("+")) throw new HubError("invalid", "Pour WhatsApp, saisissez le numéro au format international (+212…)");
  const media = i.mediaPaths ?? [];
  if (media.length > MK_LIMITS.photos || !media.every(p => isOwnPath(member.id, p))) throw new HubError("invalid", "Photos invalides (4 max)");
  return { title, description, price: i.price, category: i.category, condition: i.condition, city, phone, whatsapp, media };
}

export async function createListing(d: D1Like, member: MemberRow, input: ListingInput, nowMs: number): Promise<{ id: number }> {
  const c = clean(member, input);
  const n = await d.prepare("SELECT COUNT(*) AS n FROM mk_listings WHERE member_id = ? AND created_at > ?").bind(member.id, iso(nowMs - DAY_MS)).first<{ n: number }>();
  if ((n?.n ?? 0) >= MK_LIMITS.listingsPerDay) throw new HubError("rate_limited", "Limite de 5 annonces par jour atteinte");
  const row = await d.prepare(
    "INSERT INTO mk_listings (member_id, title, description, price, category, item_condition, city, contact_phone, contact_whatsapp, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
  ).bind(member.id, c.title, c.description, c.price, c.category, c.condition, c.city, c.phone, c.whatsapp ? 1 : 0, iso(nowMs), iso(nowMs)).first<{ id: number }>();
  // ponytail: listing then photos are two statements (not atomic); a failed photo insert leaves a photo-less listing
  if (c.media.length) await d.batch(c.media.map((p, i) => d.prepare("INSERT INTO mk_listing_media (listing_id, r2_key, position) VALUES (?,?,?)").bind(row!.id, p, i)));
  return { id: row!.id };
}

async function ownedListing(d: D1Like, member: MemberRow, id: number): Promise<void> {
  const r = await d.prepare("SELECT member_id, status FROM mk_listings WHERE id = ?").bind(id).first<{ member_id: number; status: string }>();
  if (!r || r.status === "hidden") throw new HubError("not_found", "Annonce introuvable");
  if (r.member_id !== member.id) throw new HubError("forbidden", "Action non autorisée");
}

export async function updateListing(d: D1Like, member: MemberRow, id: number, input: ListingInput, nowMs: number): Promise<void> {
  const c = clean(member, input);
  await ownedListing(d, member, id);
  await d.batch([
    d.prepare("UPDATE mk_listings SET title=?, description=?, price=?, category=?, item_condition=?, city=?, contact_phone=?, contact_whatsapp=?, updated_at=? WHERE id=?")
      .bind(c.title, c.description, c.price, c.category, c.condition, c.city, c.phone, c.whatsapp ? 1 : 0, iso(nowMs), id),
    d.prepare("DELETE FROM mk_listing_media WHERE listing_id = ?").bind(id),
    ...c.media.map((p, i) => d.prepare("INSERT INTO mk_listing_media (listing_id, r2_key, position) VALUES (?,?,?)").bind(id, p, i)),
  ]);
}

export async function setListingStatus(d: D1Like, member: MemberRow, id: number, status: "active" | "sold", nowMs: number): Promise<void> {
  if (status !== "active" && status !== "sold") throw new HubError("invalid", "Statut invalide");
  await ownedListing(d, member, id);
  await d.prepare("UPDATE mk_listings SET status = ?, updated_at = ? WHERE id = ?").bind(status, iso(nowMs), id).run();
}

/** Soft delete. With an actor: owner or moderator only. Without: admin (caller already authorised). */
export async function hideListing(d: D1Like, id: number, actor?: MemberRow): Promise<void> {
  const r = await d.prepare("SELECT member_id FROM mk_listings WHERE id = ? AND status <> 'hidden'").bind(id).first<{ member_id: number }>();
  if (!r) throw new HubError("not_found", "Annonce introuvable");
  if (actor && actor.id !== r.member_id && actor.role !== "moderator") throw new HubError("forbidden", "Action non autorisée");
  await d.prepare("UPDATE mk_listings SET status = 'hidden' WHERE id = ?").bind(id).run();
}

export async function listListings(
  d: D1Like, viewerId: number,
  o: { cursor?: number | null; category?: string; q?: string; mine?: boolean; limit?: number } = {},
): Promise<{ listings: ListingCard[]; nextCursor: number | null }> {
  const lim = Math.min(Math.max(Math.trunc(o.limit ?? 20) || 20, 1), 50);
  const cat = o.category || null;
  if (cat !== null && !(MK_CATEGORIES as readonly string[]).includes(cat)) throw new HubError("invalid", "Catégorie invalide");
  const q = (o.q ?? "").trim();
  let pattern: string | null = null;
  if (q) {
    pattern = `%${q.replace(/[\\%_]/g, c => `\\${c}`)}%`;
    if (new TextEncoder().encode(pattern).length > MK_LIMITS.likePatternBytes) throw new HubError("invalid", "Recherche trop longue");
  }
  const cursor = o.cursor ?? null;
  const { results } = await d.prepare(
    `SELECT l.id, l.title, l.price, l.category, l.item_condition AS condition, l.city, l.status, l.created_at,
            m.id AS seller_id, m.display_name AS seller_name, m.avatar_key AS seller_avatar
     FROM mk_listings l JOIN hub_members m ON m.id = l.member_id
     WHERE l.status IN ('active','sold') AND ${SELLER_OK}
       AND (? IS NULL OR l.id < ?) AND (? IS NULL OR l.category = ?) AND (? = 0 OR l.member_id = ?)
       AND (? IS NULL OR l.title LIKE ? ESCAPE '\\' OR l.description LIKE ? ESCAPE '\\')
     ORDER BY l.id DESC LIMIT ?`,
  ).bind(cursor, cursor, cat, cat, o.mine ? 1 : 0, viewerId, pattern, pattern, pattern, lim + 1).all<any>();
  const page = results.slice(0, lim);
  const covers = new Map<number, string>();
  if (page.length) {
    const ids = page.map(r => r.id);
    const m = await d.prepare(`SELECT listing_id, r2_key FROM mk_listing_media WHERE position = 0 AND listing_id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<{ listing_id: number; r2_key: string }>();
    for (const row of m.results) covers.set(row.listing_id, row.r2_key);
  }
  const listings: ListingCard[] = page.map(r => ({
    id: r.id, title: r.title, price: r.price, category: r.category, condition: r.condition, city: r.city, status: r.status, created_at: r.created_at,
    seller: { id: r.seller_id, display_name: r.seller_name, avatar_key: r.seller_avatar }, cover: covers.get(r.id) ?? null,
  }));
  return { listings, nextCursor: results.length > lim ? listings[listings.length - 1].id : null };
}

export async function getListing(d: D1Like, viewerId: number, id: number): Promise<ListingDetail> {
  const r = await d.prepare(
    `SELECT l.*, l.item_condition AS condition, m.id AS seller_id, m.display_name AS seller_name, m.avatar_key AS seller_avatar
     FROM mk_listings l JOIN hub_members m ON m.id = l.member_id
     WHERE l.id = ? AND l.status IN ('active','sold') AND ${SELLER_OK}`,
  ).bind(id).first<any>();
  if (!r) throw new HubError("not_found", "Annonce introuvable");
  const media = await d.prepare("SELECT r2_key FROM mk_listing_media WHERE listing_id = ? ORDER BY position").bind(id).all<{ r2_key: string }>();
  const keys = media.results.map(x => x.r2_key);
  const mine = r.member_id === viewerId;
  return {
    id: r.id, title: r.title, description: r.description, price: r.price, category: r.category, condition: r.condition, city: r.city,
    status: r.status, created_at: r.created_at, updated_at: r.updated_at,
    seller: { id: r.seller_id, display_name: r.seller_name, avatar_key: r.seller_avatar },
    media: keys, mine,
    contact: r.contact_phone ? { phone: r.contact_phone, whatsapp: Boolean(r.contact_whatsapp) } : null,
    ...(mine ? { media_keys: keys } : {}),
  };
}
```

- [ ] **Step 6: Lancer, vérifier le succès**

Run: `npx vitest run worker/market-d1.test.ts worker/hub-d1.test.ts`
Expected: PASS (les tests hub existants restent verts après l'ajout de `export`).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "worker/(market|hub)"; echo rc=$?`
Expected: aucune ligne (rc=1).

- [ ] **Step 8: Commit**

```bash
git add worker/d1/marketplace.sql worker/market-d1.ts worker/market-d1.test.ts worker/hub-d1.ts
git commit -m "feat(market): schema and listings data layer"
```

---

### Task 2: Commentaires, signalements et administration (données)

**Files:**
- Modify: `worker/market-d1.ts`
- Test: `worker/market-d1.test.ts`

**Interfaces:**
- Consumes: Task 1 (`HubError`, `cleanBody`, `iso`, `HOUR_MS`, `MK_LIMITS`, `SELLER_OK`, `MemberRow`).
- Produces :
  - `interface MkCommentView { id: number; listing_id: number; body: string; created_at: string; author: Seller }`
  - `addListingComment(d, member, listingId, body, nowMs): Promise<{ id: number }>`
  - `listListingComments(d, listingId): Promise<MkCommentView[]>`
  - `removeListingComment(d, actor: MemberRow, commentId): Promise<void>` (auteur ou modérateur)
  - `reportMarket(d, member, type: "listing" | "comment", id, reason): Promise<void>`
  - `interface MkReportView { id; target_type; target_id; reason; created_at; reporter: string; body: string | null; target_status: string | null }`
  - `listMarketReports(d): Promise<MkReportView[]>`, `dismissMarketReport(d, id): Promise<void>`
  - `hideMarketContent(d, type, id): Promise<void>` (admin)
  - `interface AdminListingView { id; title; price; status; seller: string; created_at: string }`, `adminListListings(d): Promise<AdminListingView[]>`

- [ ] **Step 1: Écrire les tests qui échouent** (ajouter à `worker/market-d1.test.ts`)

```ts
describe("listing comments", () => {
  it("validate, order, count, rate-limit 30/h, soft delete by author or moderator", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const mod = await member("m@x.ma", "Mona", "moderator");
    const { id } = await mk.createListing(d, a, base(), T0);
    await expect(mk.addListingComment(d, b, id, " ", T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(mk.addListingComment(d, b, id, "x".repeat(501), T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(mk.addListingComment(d, b, 9999, "ok", T0)).rejects.toMatchObject({ code: "not_found" });
    const c1 = await mk.addListingComment(d, b, id, "Dispo ?", T0 + 1);
    await mk.addListingComment(d, a, id, "Oui", T0 + 2);
    expect((await mk.listListingComments(d, id)).map(c => c.body)).toEqual(["Dispo ?", "Oui"]);
    await expect(mk.removeListingComment(d, a, c1.id)).rejects.toMatchObject({ code: "forbidden" });
    await mk.removeListingComment(d, b, c1.id);
    expect((await mk.listListingComments(d, id)).map(c => c.body)).toEqual(["Oui"]);
    const c3 = await mk.addListingComment(d, b, id, "spam", T0 + 3);
    await mk.removeListingComment(d, mod, c3.id);
    for (let i = 0; i < 28; i++) await mk.addListingComment(d, b, id, `c${i}`, T0 + 10 + i); // b already wrote 2 (one removed still counts) + 28 = 30
    await expect(mk.addListingComment(d, b, id, "over", T0 + 100)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("not on hidden or invisible listings; listing the comments of a hidden listing is 404", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await mk.createListing(d, a, base(), T0);
    await mk.hideListing(d, id);
    await expect(mk.addListingComment(d, b, id, "x", T0)).rejects.toMatchObject({ code: "not_found" });
    await expect(mk.listListingComments(d, id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("market reports and admin", () => {
  it("report once per reporter; target must be visible; reason validated; inherited keys rejected", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await mk.createListing(d, a, base({ title: "Annonce louche" }), T0);
    const c = await mk.addListingComment(d, a, id, "achetez ici", T0 + 1);
    await expect(mk.reportMarket(d, b, "listing", id, "")).rejects.toMatchObject({ code: "invalid" });
    await expect(mk.reportMarket(d, b, "listing", id, "x".repeat(301))).rejects.toMatchObject({ code: "invalid" });
    await expect(mk.reportMarket(d, b, "listing", 9999, "spam")).rejects.toMatchObject({ code: "not_found" });
    await expect(mk.reportMarket(d, b, "constructor" as any, 1, "spam")).rejects.toMatchObject({ code: "invalid" });
    await mk.reportMarket(d, b, "listing", id, "arnaque");
    await mk.reportMarket(d, b, "listing", id, "arnaque bis");
    await mk.reportMarket(d, b, "comment", c.id, "pub");
    const list = await mk.listMarketReports(d);
    expect(list).toHaveLength(2);
    expect(list.find(r => r.target_type === "listing")).toMatchObject({ target_id: id, reason: "arnaque", reporter: "Brahim B.", body: "Annonce louche", target_status: "active" });
    expect(list.find(r => r.target_type === "comment")).toMatchObject({ body: "achetez ici", target_status: "visible" });
  });

  it("hideMarketContent hides listing or comment; dismiss deletes; adminListListings shows every status", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const l = (await mk.createListing(d, a, base({ title: "L1" }), T0)).id;
    const c = await mk.addListingComment(d, b, l, "bof", T0 + 1);
    await mk.reportMarket(d, a, "comment", c.id, "insulte");
    await mk.hideMarketContent(d, "comment", c.id);
    expect(await mk.listListingComments(d, l)).toEqual([]);
    expect((await mk.listMarketReports(d))[0]).toMatchObject({ target_status: "hidden" });
    await mk.dismissMarketReport(d, (await mk.listMarketReports(d))[0].id);
    expect(await mk.listMarketReports(d)).toEqual([]);
    await mk.hideMarketContent(d, "listing", l);
    const all = await mk.adminListListings(d);
    expect(all[0]).toMatchObject({ id: l, title: "L1", status: "hidden", seller: "Amina B." });
    await expect(mk.hideMarketContent(d, "listing", 9999)).rejects.toMatchObject({ code: "not_found" });
    await expect(mk.hideMarketContent(d, "constructor" as any, 1)).rejects.toMatchObject({ code: "invalid" });
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run worker/market-d1.test.ts`
Expected: FAIL (`mk.addListingComment is not a function`).

- [ ] **Step 3: Implémenter (ajouter à `worker/market-d1.ts`)**

```ts
// ---- comments -------------------------------------------------------------

export interface MkCommentView { id: number; listing_id: number; body: string; created_at: string; author: Seller }

async function visibleListing(d: D1Like, id: number): Promise<void> {
  const r = await d.prepare(`SELECT 1 AS ok FROM mk_listings l JOIN hub_members m ON m.id = l.member_id WHERE l.id = ? AND l.status IN ('active','sold') AND ${SELLER_OK}`).bind(id).first();
  if (!r) throw new HubError("not_found", "Annonce introuvable");
}

export async function addListingComment(d: D1Like, member: MemberRow, listingId: number, rawBody: string, nowMs: number): Promise<{ id: number }> {
  const body = cleanBody(rawBody, MK_LIMITS.comment, "Commentaire");
  await visibleListing(d, listingId);
  const n = await d.prepare("SELECT COUNT(*) AS n FROM mk_comments WHERE member_id = ? AND created_at > ?").bind(member.id, iso(nowMs - HOUR_MS)).first<{ n: number }>();
  if ((n?.n ?? 0) >= MK_LIMITS.commentsPerHour) throw new HubError("rate_limited", "Trop de commentaires, réessayez plus tard");
  const row = await d.prepare("INSERT INTO mk_comments (listing_id, member_id, body, created_at) VALUES (?,?,?,?) RETURNING id").bind(listingId, member.id, body, iso(nowMs)).first<{ id: number }>();
  return { id: row!.id };
}

export async function listListingComments(d: D1Like, listingId: number): Promise<MkCommentView[]> {
  await visibleListing(d, listingId);
  const { results } = await d.prepare(
    `SELECT c.id, c.listing_id, c.body, c.created_at, m.id AS author_id, m.display_name AS author_name, m.avatar_key AS author_avatar
     FROM mk_comments c JOIN hub_members m ON m.id = c.member_id WHERE c.listing_id = ? AND c.status = 'visible' ORDER BY c.id ASC LIMIT 200`,
  ).bind(listingId).all<any>();
  return results.map(r => ({ id: r.id, listing_id: r.listing_id, body: r.body, created_at: r.created_at, author: { id: r.author_id, display_name: r.author_name, avatar_key: r.author_avatar } }));
}

export async function removeListingComment(d: D1Like, actor: MemberRow, commentId: number): Promise<void> {
  const r = await d.prepare("SELECT member_id FROM mk_comments WHERE id = ? AND status = 'visible'").bind(commentId).first<{ member_id: number }>();
  if (!r) throw new HubError("not_found", "Commentaire introuvable");
  if (r.member_id !== actor.id && actor.role !== "moderator") throw new HubError("forbidden", "Action non autorisée");
  await d.prepare("UPDATE mk_comments SET status = 'hidden' WHERE id = ?").bind(commentId).run();
}

// ---- reports / admin ------------------------------------------------------

const MK_TABLE = { listing: "mk_listings", comment: "mk_comments" } as const;
function mkTable(type: string): "mk_listings" | "mk_comments" {
  if (!Object.hasOwn(MK_TABLE, type)) throw new HubError("invalid", "Type invalide");
  return MK_TABLE[type as keyof typeof MK_TABLE];
}

export interface MkReportView { id: number; target_type: "listing" | "comment"; target_id: number; reason: string; created_at: string; reporter: string; body: string | null; target_status: string | null }
export interface AdminListingView { id: number; title: string; price: number; status: string; seller: string; created_at: string }

export async function reportMarket(d: D1Like, member: MemberRow, type: "listing" | "comment", id: number, rawReason: string): Promise<void> {
  const t = mkTable(type);
  const reason = cleanBody(rawReason, MK_LIMITS.reason, "Motif");
  const visible = t === "mk_listings" ? "status IN ('active','sold')" : "status = 'visible'";
  if (!(await d.prepare(`SELECT 1 AS ok FROM ${t} WHERE id = ? AND ${visible}`).bind(id).first())) throw new HubError("not_found", "Contenu introuvable");
  await d.prepare("INSERT OR IGNORE INTO mk_reports (target_type, target_id, member_id, reason) VALUES (?,?,?,?)").bind(type, id, member.id, reason).run();
}

export async function listMarketReports(d: D1Like): Promise<MkReportView[]> {
  const { results } = await d.prepare(
    `SELECT r.id, r.target_type, r.target_id, r.reason, r.created_at, m.display_name AS reporter,
       CASE r.target_type WHEN 'listing' THEN (SELECT title FROM mk_listings WHERE id = r.target_id) ELSE (SELECT body FROM mk_comments WHERE id = r.target_id) END AS body,
       CASE r.target_type WHEN 'listing' THEN (SELECT status FROM mk_listings WHERE id = r.target_id) ELSE (SELECT status FROM mk_comments WHERE id = r.target_id) END AS target_status
     FROM mk_reports r JOIN hub_members m ON m.id = r.member_id ORDER BY r.id DESC LIMIT 100`,
  ).all<MkReportView>();
  return results;
}

export async function dismissMarketReport(d: D1Like, id: number): Promise<void> {
  await d.prepare("DELETE FROM mk_reports WHERE id = ?").bind(id).run();
}

export async function hideMarketContent(d: D1Like, type: "listing" | "comment", id: number): Promise<void> {
  const t = mkTable(type);
  if (!(await d.prepare(`SELECT 1 AS ok FROM ${t} WHERE id = ?`).bind(id).first())) throw new HubError("not_found", "Contenu introuvable");
  await d.prepare(`UPDATE ${t} SET status = 'hidden' WHERE id = ?`).bind(id).run();
}

export async function adminListListings(d: D1Like): Promise<AdminListingView[]> {
  const { results } = await d.prepare(
    "SELECT l.id, l.title, l.price, l.status, m.display_name AS seller, l.created_at FROM mk_listings l JOIN hub_members m ON m.id = l.member_id ORDER BY l.id DESC LIMIT 100",
  ).all<AdminListingView>();
  return results;
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run worker/market-d1.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/market-d1.ts worker/market-d1.test.ts
git commit -m "feat(market): comments, reports and admin data functions"
```

---

### Task 3: Routes HTTP `market/*` (annonces, commentaires, signalements, admin)

**Files:**
- Create: `worker/hub-http.ts`
- Modify: `worker/hub.ts` (importer les helpers, déléguer `market/*`)
- Create: `worker/market.ts`
- Test: `worker/market.test.ts`

**Interfaces:**
- Consumes : tout `market-d1.ts` (Tasks 1–2), `hub-d1.ts`, helpers `readJson/num/id/str`.
- Produces :
  - `hub-http.ts` exporte `readJson(request)`, `num(v)`, `id(v)`, `str(v)` (déplacés tels quels depuis `hub.ts`).
  - `market.ts` exporte `interface MarketCtx { d: D1Like; request: Request; url: URL; path: string; now: () => number; json: (data: unknown, status?: number) => Response; member: () => Promise<H.MemberRow>; admin: () => Promise<void>; sign: (p: string | null) => Promise<string | null> }` et `handleMarketRoute(c: MarketCtx): Promise<Response | null>` (`path` = chemin après `market/`).
  - Routes : `GET listings`, `POST listings`, `GET|PUT|DELETE listings/:id`, `POST listings/:id/status`, `GET|POST listings/:id/comments`, `DELETE comments/:id`, `POST report`, `GET admin/listings`, `GET admin/reports`, `POST admin/hide`, `POST admin/reports/:id/dismiss`.
  - Les photos/avatars sont renvoyés en URLs signées : `cover`, `media[]`, `seller.avatar`, `author.avatar`. `media_keys` (propriétaire) reste en chemins bruts.

- [ ] **Step 1: Extraire les helpers HTTP**

Créer `worker/hub-http.ts` avec les fonctions actuelles de `hub.ts` (lignes 24–46) :

```ts
import * as H from "./hub-d1";

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    throw new H.HubError("invalid", "JSON invalide");
  }
}
export const num = (v: unknown) => {
  if (typeof v !== "string" && typeof v !== "number") return NaN;
  const n = /^\d+$/.test(String(v)) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : NaN;
};
export const id = (v: unknown) => {
  const n = num(v);
  if (Number.isNaN(n)) throw new H.HubError("invalid", "Identifiant invalide");
  return n;
};
export const str = (v: unknown) => {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new H.HubError("invalid", "Champ texte invalide");
  return v;
};
```

Dans `worker/hub.ts` : supprimer ces quatre définitions (de `async function readJson` jusqu'à la fin de `const str = …;`) et ajouter `import { id, readJson, str } from "./hub-http";` (`num` n'est plus utilisé dans `hub.ts`). Vérifier : `npx vitest run worker/hub.test.ts worker/hub-d1.test.ts` doit rester vert **avant** de continuer.

- [ ] **Step 2: Écrire les tests qui échouent `worker/market.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import { handleHubRequest, type HubDeps, type HubEnv } from "./hub";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

function fakeD1(sqlite: InstanceType<typeof DatabaseSync>): D1Like {
  const stmt = (sql: string, params: unknown[] = []): D1Stmt => ({
    bind: (...v) => stmt(sql, v),
    all: async () => ({ results: sqlite.prepare(sql).all(...(params as any[])) as any[] }),
    first: async () => ((sqlite.prepare(sql).get(...(params as any[])) as any) ?? null),
    run: async () => sqlite.prepare(sql).run(...(params as any[])),
  });
  return {
    prepare: sql => stmt(sql),
    batch: async s => {
      sqlite.exec("BEGIN");
      try { for (const x of s) await x.run(); sqlite.exec("COMMIT"); } catch (e) { sqlite.exec("ROLLBACK"); throw e; }
      return [];
    },
  };
}

const CORS = { "Access-Control-Allow-Origin": "https://www.ftourbabrayan.ma" };
const T0 = Date.parse("2026-10-10T12:00:00.000Z");
let sqlite: InstanceType<typeof DatabaseSync>;
let env: HubEnv;
let mails: string[];
let clock: number;

const deps = (): HubDeps => ({
  now: () => clock,
  sendMail: async (_to, _s, html) => { mails.push(html); },
  adminUser: async req => {
    const r = req.headers.get("x-admin");
    return r ? { role: r === "demo" ? "super_admin" : r, isDemo: r === "demo" } : null;
  },
});

async function call(method: string, path: string, o: { token?: string; admin?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (o.token) headers.authorization = `Bearer ${o.token}`;
  if (o.admin) headers["x-admin"] = o.admin;
  if (o.body !== undefined) headers["content-type"] = "application/json";
  const res = await handleHubRequest(new Request(`https://w.test${path}`, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) }), env, CORS, deps());
  return res!;
}

async function signIn(email: string, first = "Amina") {
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?, 'confirmed')").run(first, "Benali", email);
  await call("POST", "/hub/login", { body: { email } });
  const token = /token=([a-f0-9]{64})/.exec(mails[mails.length - 1])![1];
  const v = (await (await call("POST", "/hub/verify", { body: { token } })).json()) as { session: string; member: { id: number } };
  return { session: v.session, id: v.member.id };
}

const listing = (over: Record<string, unknown> = {}) => ({ title: "Vélo", description: "Bon état", price: 150, category: "enfants", condition: "bon", city: "Rabat", ...over });

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE t_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, status TEXT);");
  for (const f of ["hub.sql", "marketplace.sql"]) sqlite.exec(readFileSync(new URL(`./d1/${f}`, import.meta.url), "utf8"));
  env = { DB: fakeD1(sqlite), JWT_SECRET: "test-secret", MEDIA_BASE_URL: "https://m.test", GALLERY_MEDIA: undefined, PUBLIC_APP_URL: "https://site.test" };
  mails = [];
  clock = T0;
});

describe("market http: listings", () => {
  it("needs a session; unknown market route is a JSON 404", async () => {
    expect((await call("GET", "/hub/market/listings")).status).toBe(401);
    expect((await call("POST", "/hub/market/listings", { body: listing() })).status).toBe(401);
    const a = await signIn("a@x.ma");
    const r = await call("GET", "/hub/market/nope", { token: a.session });
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ error: "not_found" });
  });

  it("create -> list (cover signed, no phone) -> detail (phone, signed media)", async () => {
    const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim");
    const created = await call("POST", "/hub/market/listings", { token: a.session, body: listing({ phone: "+212 600000000", whatsapp: true, media: [`${a.id}/p.jpg`] }) });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: number };
    const list = (await (await call("GET", "/hub/market/listings", { token: b.session })).json()) as any;
    expect(list.listings[0]).toMatchObject({ id, title: "Vélo", price: 150, seller: { display_name: "Amina B." } });
    expect(list.listings[0].cover).toContain(`https://m.test/media-signed/private/hub/${a.id}/p.jpg?exp=`);
    expect(JSON.stringify(list)).not.toContain("+212600000000");
    const det = (await (await call("GET", `/hub/market/listings/${id}`, { token: b.session })).json()) as any;
    expect(det.listing).toMatchObject({ contact: { phone: "+212600000000", whatsapp: true }, mine: false });
    expect(det.listing.media[0]).toContain("/media-signed/private/hub/");
    expect(det.listing.media_keys).toBeUndefined();
    expect(JSON.stringify(det)).not.toContain("a@x.ma");
  });

  it("owner sees media_keys; update and status via PUT / POST; others forbidden", async () => {
    const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim");
    const { id } = (await (await call("POST", "/hub/market/listings", { token: a.session, body: listing({ media: [`${a.id}/p.jpg`] }) })).json()) as { id: number };
    const own = (await (await call("GET", `/hub/market/listings/${id}`, { token: a.session })).json()) as any;
    expect(own.listing.media_keys).toEqual([`${a.id}/p.jpg`]);
    expect((await call("PUT", `/hub/market/listings/${id}`, { token: b.session, body: listing() })).status).toBe(403);
    expect((await call("PUT", `/hub/market/listings/${id}`, { token: a.session, body: listing({ title: "Nouveau" }) })).status).toBe(200);
    expect((await call("POST", `/hub/market/listings/${id}/status`, { token: b.session, body: { status: "sold" } })).status).toBe(403);
    expect((await call("POST", `/hub/market/listings/${id}/status`, { token: a.session, body: { status: "hidden" } })).status).toBe(400);
    expect((await call("POST", `/hub/market/listings/${id}/status`, { token: a.session, body: { status: "sold" } })).status).toBe(200);
    const det = (await (await call("GET", `/hub/market/listings/${id}`, { token: b.session })).json()) as any;
    expect(det.listing).toMatchObject({ title: "Nouveau", status: "sold" });
  });

  it("hostile input is a 400, never a 500", async () => {
    const a = await signIn("a@x.ma");
    for (const over of [{ price: "12" }, { price: -1 }, { price: 1.5 }, { title: {} }, { title: 5 }, { category: "x" }, { phone: 5 }, { media: ["999/a.jpg"] }, { media: ["1/../a.jpg"] }]) {
      const r = await call("POST", "/hub/market/listings", { token: a.session, body: listing(over) });
      expect(r.status, JSON.stringify(over)).toBe(400);
    }
    for (const p of ["/hub/market/listings/abc", "/hub/market/listings/0", "/hub/market/listings/99999999999999999999", "/hub/market/listings?cursor=abc&category=nope"]) {
      expect([400, 404]).toContain((await call("GET", p, { token: a.session })).status);
    }
    expect((await call("GET", "/hub/market/listings?category=nope", { token: a.session })).status).toBe(400);
    expect((await call("GET", `/hub/market/listings?q=${"é".repeat(30)}`, { token: a.session })).status).toBe(400);
  });

  it("delete hides (owner), 404 afterwards; 429 on the sixth listing of the day", async () => {
    const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim");
    const { id } = (await (await call("POST", "/hub/market/listings", { token: a.session, body: listing() })).json()) as { id: number };
    expect((await call("DELETE", `/hub/market/listings/${id}`, { token: b.session })).status).toBe(403);
    expect((await call("DELETE", `/hub/market/listings/${id}`, { token: a.session })).status).toBe(200);
    expect((await call("GET", `/hub/market/listings/${id}`, { token: b.session })).status).toBe(404);
    for (let i = 0; i < 4; i++) expect((await call("POST", "/hub/market/listings", { token: a.session, body: listing() })).status).toBe(200);
    expect((await call("POST", "/hub/market/listings", { token: a.session, body: listing() })).status).toBe(429);
  });
});

describe("market http: comments, reports, admin", () => {
  it("comments + report flow", async () => {
    const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim");
    const { id } = (await (await call("POST", "/hub/market/listings", { token: a.session, body: listing() })).json()) as { id: number };
    expect((await call("POST", `/hub/market/listings/${id}/comments`, { token: b.session, body: { body: {} } })).status).toBe(400);
    const c = (await (await call("POST", `/hub/market/listings/${id}/comments`, { token: b.session, body: { body: "Dispo ?" } })).json()) as { id: number };
    const got = (await (await call("GET", `/hub/market/listings/${id}/comments`, { token: a.session })).json()) as any;
    expect(got.comments[0]).toMatchObject({ body: "Dispo ?", author: { display_name: "Brahim B." } });
    expect(JSON.stringify(got)).not.toContain("@x.ma");
    expect((await call("DELETE", `/hub/market/comments/${c.id}`, { token: a.session })).status).toBe(403);
    expect((await call("POST", "/hub/market/report", { token: b.session, body: { type: "listing", id, reason: "arnaque" } })).status).toBe(200);
    expect((await call("POST", "/hub/market/report", { token: b.session, body: { type: "constructor", id, reason: "x" } })).status).toBe(400);
    expect((await call("DELETE", `/hub/market/comments/${c.id}`, { token: b.session })).status).toBe(200);
  });

  it("admin routes: no admin / user role / demo -> 403; real admin works", async () => {
    const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim");
    const { id } = (await (await call("POST", "/hub/market/listings", { token: a.session, body: listing() })).json()) as { id: number };
    await call("POST", "/hub/market/report", { token: b.session, body: { type: "listing", id, reason: "arnaque" } });
    for (const adm of [undefined, "user", "demo"]) {
      expect((await call("GET", "/hub/market/admin/listings", { admin: adm })).status, String(adm)).toBe(403);
      expect((await call("GET", "/hub/market/admin/reports", { admin: adm })).status, String(adm)).toBe(403);
      expect((await call("POST", "/hub/market/admin/hide", { admin: adm, body: { type: "listing", id } })).status, String(adm)).toBe(403);
    }
    const listings = (await (await call("GET", "/hub/market/admin/listings", { admin: "admin_ops" })).json()) as any;
    expect(listings.listings[0]).toMatchObject({ id, status: "active", seller: "Amina B." });
    const reports = (await (await call("GET", "/hub/market/admin/reports", { admin: "admin" })).json()) as any;
    expect(reports.reports[0]).toMatchObject({ target_id: id, reason: "arnaque" });
    expect((await call("POST", "/hub/market/admin/hide", { admin: "admin", body: { type: "listing", id } })).status).toBe(200);
    expect((await call("GET", `/hub/market/listings/${id}`, { token: b.session })).status).toBe(404);
    expect((await call("POST", `/hub/market/admin/reports/${reports.reports[0].id}/dismiss`, { admin: "admin" })).status).toBe(200);
  });
});
```

- [ ] **Step 3: Lancer, vérifier l'échec**

Run: `npx vitest run worker/market.test.ts`
Expected: FAIL (les routes `market/*` répondent 404 « Route inconnue »).

- [ ] **Step 4: Implémenter `worker/market.ts` (annonces, commentaires, signalements, admin)**

```ts
/** REST routes of the marketplace, called from handleHubRequest for any /hub/market/* path. */
import type { D1Like } from "./gallery-d1";
import * as H from "./hub-d1";
import * as M from "./market-d1";
import { id, readJson, str } from "./hub-http";

export interface MarketCtx {
  d: D1Like;
  request: Request;
  url: URL;
  path: string; // after "market/"
  now: () => number;
  json: (data: unknown, status?: number) => Response;
  member: () => Promise<H.MemberRow>;
  admin: () => Promise<void>;
  sign: (p: string | null) => Promise<string | null>;
}

const seller = async (s: M.Seller, sign: MarketCtx["sign"]) => ({ id: s.id, display_name: s.display_name, avatar: await sign(s.avatar_key) });

function listingInput(b: Record<string, unknown>): M.ListingInput {
  return {
    title: str(b.title), description: str(b.description),
    price: typeof b.price === "number" ? b.price : NaN,
    category: str(b.category), condition: str(b.condition), city: str(b.city),
    phone: b.phone, whatsapp: b.whatsapp === true,
    mediaPaths: Array.isArray(b.media) ? b.media.filter((x): x is string => typeof x === "string") : [],
  };
}

export async function handleMarketRoute(c: MarketCtx): Promise<Response | null> {
  const { d, request, url, path, now, json, member, admin, sign } = c;
  const match = (method: string, re: RegExp) => (request.method === method ? re.exec(path) : null);
  let m: RegExpExecArray | null;

  // ---- listings ----------------------------------------------------------
  if (match("GET", /^listings$/)) {
    const me = await member();
    const cur = url.searchParams.get("cursor");
    const r = await M.listListings(d, me.id, {
      cursor: cur && /^\d+$/.test(cur) ? Number(cur) : null,
      category: url.searchParams.get("category") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      mine: url.searchParams.get("mine") === "1",
    });
    return json({
      listings: await Promise.all(r.listings.map(async ({ cover, seller: s, ...rest }) => ({ ...rest, cover: await sign(cover), seller: await seller(s, sign) }))),
      nextCursor: r.nextCursor,
    });
  }
  if (match("POST", /^listings$/)) {
    const me = await member();
    return json(await M.createListing(d, me, listingInput(await readJson(request)), now()));
  }
  if ((m = match("GET", /^listings\/(\d+)$/))) {
    const me = await member();
    const l = await M.getListing(d, me.id, id(m[1]));
    const { seller: s, media, ...rest } = l;
    return json({ listing: { ...rest, seller: await seller(s, sign), media: await Promise.all(media.map(sign)) } });
  }
  if ((m = match("PUT", /^listings\/(\d+)$/))) {
    const me = await member();
    await M.updateListing(d, me, id(m[1]), listingInput(await readJson(request)), now());
    return json({ ok: true });
  }
  if ((m = match("DELETE", /^listings\/(\d+)$/))) {
    await M.hideListing(d, id(m[1]), await member());
    return json({ ok: true });
  }
  if ((m = match("POST", /^listings\/(\d+)\/status$/))) {
    const me = await member();
    await M.setListingStatus(d, me, id(m[1]), str((await readJson(request)).status) as "active" | "sold", now());
    return json({ ok: true });
  }

  // ---- comments / report -------------------------------------------------
  if ((m = match("GET", /^listings\/(\d+)\/comments$/))) {
    await member();
    const list = await M.listListingComments(d, id(m[1]));
    return json({ comments: await Promise.all(list.map(async x => ({ ...x, author: await seller(x.author, sign) }))) });
  }
  if ((m = match("POST", /^listings\/(\d+)\/comments$/))) {
    const me = await member();
    return json(await M.addListingComment(d, me, id(m[1]), str((await readJson(request)).body), now()));
  }
  if ((m = match("DELETE", /^comments\/(\d+)$/))) {
    await M.removeListingComment(d, await member(), id(m[1]));
    return json({ ok: true });
  }
  if (match("POST", /^report$/)) {
    const me = await member();
    const b = await readJson(request);
    await M.reportMarket(d, me, str(b.type) as "listing" | "comment", id(b.id), str(b.reason));
    return json({ ok: true });
  }

  // ---- admin (Supabase bearer + role) ------------------------------------
  if (match("GET", /^admin\/listings$/)) { await admin(); return json({ listings: await M.adminListListings(d) }); }
  if (match("GET", /^admin\/reports$/)) { await admin(); return json({ reports: await M.listMarketReports(d) }); }
  if (match("POST", /^admin\/hide$/)) {
    await admin();
    const b = await readJson(request);
    await M.hideMarketContent(d, str(b.type) as "listing" | "comment", id(b.id));
    return json({ ok: true });
  }
  if ((m = match("POST", /^admin\/reports\/(\d+)\/dismiss$/))) {
    await admin();
    await M.dismissMarketReport(d, id(m[1]));
    return json({ ok: true });
  }

  return null;
}
```

- [ ] **Step 5: Brancher dans `worker/hub.ts`**

Ajouter l'import `import { handleMarketRoute } from "./market";` puis, juste avant la ligne `return json({ error: "not_found", message: "Route inconnue" }, 404);` :

```ts
    // ---- marketplace -------------------------------------------------------
    if (path.startsWith("market/")) {
      const r = await handleMarketRoute({ d, request, url, path: path.slice("market/".length), now, json, member, admin, sign });
      if (r) return r;
    }

```

- [ ] **Step 6: Lancer, vérifier le succès**

Run: `npx vitest run worker/market.test.ts worker/market-d1.test.ts worker/hub.test.ts worker/hub-d1.test.ts`
Expected: PASS. Puis `npx tsc --noEmit 2>&1 | grep -E "worker/(market|hub)"; echo rc=$?` → aucune ligne.

- [ ] **Step 7: Commit**

```bash
git add worker/hub-http.ts worker/hub.ts worker/market.ts worker/market.test.ts
git commit -m "feat(market): REST routes for listings, comments, reports and admin"
```

---

### Task 4: Client — annonces (liste, détail, formulaire), navigation, admin

**Files:**
- Modify: `client/src/features/hub/api.ts` (exporter `call`)
- Create: `client/src/features/hub/useHubMember.ts`
- Create: `client/src/features/hub/market/market-api.ts`
- Create: `client/src/features/hub/market/format.ts`
- Create: `client/src/features/hub/market/pages/MarketPage.tsx`
- Create: `client/src/features/hub/market/pages/ListingDetailPage.tsx`
- Create: `client/src/features/hub/market/pages/ListingFormPage.tsx`
- Create: `client/src/features/hub/admin/MarketAdmin.tsx`
- Modify: `client/src/features/hub/components/HubShell.tsx`, `client/src/App.tsx`, `client/src/features/hub/admin/AdminHub.tsx`

**Interfaces:**
- Consumes : routes `market/*` (Task 3), `uploadImage`, `getMe`, `Avatar`, `HubShell`.
- Produces : `market-api.ts` (`listListings`, `getListing`, `createListing`, `updateListing`, `setListingStatus`, `removeListing`, `listComments`, `addListingComment`, `removeListingComment`, `reportMarket`, `adminListings`, `adminMarketReports`, `adminMarketHide`, `adminMarketDismiss`, types) ; `useHubMember()` ; pages ; routes.

Pas de harnais de test React : vérification = `tsc` (aucune erreur dans les fichiers touchés) + `vite build`.

- [ ] **Step 1: Exporter `call` et créer le hook**

Dans `client/src/features/hub/api.ts` : remplacer `async function call<T>(` par `export async function call<T>(`.

Créer `client/src/features/hub/useHubMember.ts` :

```ts
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";
import * as hub from "./api";

/** Current hub member; sends the visitor back to the login screen when the session is missing or revoked. */
export function useHubMember(): hub.Member | undefined {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const [me, setMe] = useState<hub.Member | undefined>();
  useEffect(() => {
    const login = `/${lang}/benevole/espace`;
    hub.getMe().then(setMe).catch(() => setLocation(login));
    const back = () => setLocation(login);
    window.addEventListener("hub:unauthorized", back);
    return () => window.removeEventListener("hub:unauthorized", back);
  }, [lang, setLocation]);
  return me;
}
```

- [ ] **Step 2: Créer `market/format.ts` et `market/market-api.ts`**

`format.ts` :

```ts
export const CATEGORIES: { value: string; label: string }[] = [
  { value: "maison", label: "Maison" }, { value: "mode", label: "Mode" }, { value: "high-tech", label: "High-tech" },
  { value: "enfants", label: "Enfants" }, { value: "livres", label: "Livres" }, { value: "vehicules", label: "Véhicules" }, { value: "autre", label: "Autre" },
];
export const CONDITIONS: { value: string; label: string }[] = [{ value: "neuf", label: "Neuf" }, { value: "bon", label: "Bon état" }, { value: "correct", label: "État correct" }];
export const price = (p: number) => (p === 0 ? "Gratuit" : `${p.toLocaleString("fr-FR")} MAD`);
export const label = (list: { value: string; label: string }[], v: string) => list.find(x => x.value === v)?.label ?? v;
```

`market-api.ts` :

```ts
import { call } from "../api";

export interface Seller { id: number; display_name: string; avatar: string | null }
export interface ListingCard { id: number; title: string; price: number; category: string; condition: string; city: string; status: "active" | "sold"; created_at: string; seller: Seller; cover: string | null }
export interface ListingDetail extends Omit<ListingCard, "cover"> {
  description: string; updated_at: string; media: (string | null)[]; mine: boolean;
  contact: { phone: string; whatsapp: boolean } | null; media_keys?: string[];
}
export interface ListingForm { title: string; description: string; price: number; category: string; condition: string; city: string; phone: string; whatsapp: boolean; media: string[] }
export interface MkComment { id: number; listing_id: number; body: string; created_at: string; author: Seller }
export interface MkReport { id: number; target_type: "listing" | "comment"; target_id: number; reason: string; created_at: string; reporter: string; body: string | null; target_status: string | null }
export interface AdminListing { id: number; title: string; price: number; status: string; seller: string; created_at: string }

export const listListings = (p: { cursor?: number | null; category?: string; q?: string; mine?: boolean }) => {
  const qs = new URLSearchParams();
  if (p.cursor) qs.set("cursor", String(p.cursor));
  if (p.category) qs.set("category", p.category);
  if (p.q?.trim()) qs.set("q", p.q.trim());
  if (p.mine) qs.set("mine", "1");
  const s = qs.toString();
  return call<{ listings: ListingCard[]; nextCursor: number | null }>("GET", `market/listings${s ? `?${s}` : ""}`);
};
export const getListing = (id: number) => call<{ listing: ListingDetail }>("GET", `market/listings/${id}`).then(r => r.listing);
export const createListing = (f: ListingForm) => call<{ id: number }>("POST", "market/listings", { body: f });
export const updateListing = (id: number, f: ListingForm) => call<{ ok: true }>("PUT", `market/listings/${id}`, { body: f });
export const setListingStatus = (id: number, status: "active" | "sold") => call<{ ok: true }>("POST", `market/listings/${id}/status`, { body: { status } });
export const removeListing = (id: number) => call<{ ok: true }>("DELETE", `market/listings/${id}`);
export const listComments = (id: number) => call<{ comments: MkComment[] }>("GET", `market/listings/${id}/comments`).then(r => r.comments);
export const addListingComment = (id: number, body: string) => call<{ id: number }>("POST", `market/listings/${id}/comments`, { body: { body } });
export const removeListingComment = (id: number) => call<{ ok: true }>("DELETE", `market/comments/${id}`);
export const reportMarket = (type: "listing" | "comment", id: number, reason: string) => call<{ ok: true }>("POST", "market/report", { body: { type, id, reason } });

export const adminListings = () => call<{ listings: AdminListing[] }>("GET", "market/admin/listings", { admin: true }).then(r => r.listings);
export const adminMarketReports = () => call<{ reports: MkReport[] }>("GET", "market/admin/reports", { admin: true }).then(r => r.reports);
export const adminMarketHide = (type: "listing" | "comment", id: number) => call<{ ok: true }>("POST", "market/admin/hide", { admin: true, body: { type, id } });
export const adminMarketDismiss = (id: number) => call<{ ok: true }>("POST", `market/admin/reports/${id}/dismiss`, { admin: true });
```

- [ ] **Step 3: Page liste `market/pages/MarketPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as mk from "../market-api";
import { CATEGORIES, CONDITIONS, label, price } from "../format";

const select = "h-10 rounded-md border border-input bg-white px-3 text-sm";

export default function MarketPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const base = `/${lang}/benevole/espace/marketplace`;
  const [items, setItems] = useState<mk.ListingCard[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);

  const load = useCallback(async (cursor: number | null = null) => {
    try {
      const r = await mk.listListings({ cursor, category, q, mine });
      setItems(prev => (cursor ? [...(prev ?? []), ...r.listings] : r.listings));
      setNext(r.nextCursor);
    } catch (e) {
      toast.error((e as Error).message);
      if (!cursor) setItems([]);
    }
  }, [category, q, mine]);

  // ponytail: reload on every filter/search change (no debounce); fine at this scale
  useEffect(() => { if (me) load(); }, [me, load]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  return (
    <HubShell me={me}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Marketplace</h1>
        <Link href={`${base}/nouveau`} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"><Plus size={16} /> Vendre</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[10rem] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
          <Input aria-label="Rechercher" className="pl-9" value={q} maxLength={24} onChange={e => setQ(e.target.value)} placeholder="Rechercher un objet…" />
        </div>
        <select aria-label="Catégorie" className={select} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> Mes annonces</label>
      </div>

      {items === null && <Loader2 className="mx-auto animate-spin text-blue-700" />}
      {items?.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Aucune annonce pour l'instant.</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {items?.map(l => (
          <Link key={l.id} href={`${base}/${l.id}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md">
            <div className="relative aspect-square bg-slate-100">
              {l.cover ? <img src={l.cover} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400">Pas de photo</div>}
              {l.status === "sold" && <span className="absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-0.5 text-xs font-semibold text-white">Vendu</span>}
            </div>
            <div className="space-y-1 p-3">
              <p className="font-bold text-slate-900">{price(l.price)}</p>
              <p className="line-clamp-2 text-sm text-slate-800">{l.title}</p>
              <p className="text-xs text-slate-500">{label(CATEGORIES, l.category)} · {label(CONDITIONS, l.condition)}{l.city ? ` · ${l.city}` : ""}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500"><Avatar name={l.seller.display_name} src={l.seller.avatar} size={18} />{l.seller.display_name}</p>
            </div>
          </Link>
        ))}
      </div>
      {next !== null && <Button variant="outline" className="w-full bg-white" onClick={() => load(next)}>Voir plus</Button>}
    </HubShell>
  );
}
```

- [ ] **Step 4: Page détail `market/pages/ListingDetailPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { Flag, Loader2, MessageCircle, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as mk from "../market-api";
import { CATEGORIES, CONDITIONS, label, price } from "../format";

export default function ListingDetailPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/:lang/benevole/espace/marketplace/:id");
  const listingId = Number(params?.id);
  const base = `/${lang}/benevole/espace/marketplace`;
  const [l, setL] = useState<mk.ListingDetail | null | undefined>(undefined);
  const [comments, setComments] = useState<mk.MkComment[]>([]);
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState(0);

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { toast.error((e as Error).message); } };
  const loadComments = useCallback(() => mk.listComments(listingId).then(setComments).catch(() => undefined), [listingId]);

  useEffect(() => {
    if (!me || !Number.isSafeInteger(listingId)) return;
    mk.getListing(listingId).then(setL).catch(() => setL(null));
    loadComments();
  }, [me, listingId, loadComments]);

  if (!me || l === undefined) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (l === null) return (
    <HubShell me={me}><p className="rounded-xl bg-white p-8 text-center text-slate-600">Cette annonce n'existe plus. <Link href={base} className="text-blue-700 underline">Retour à la marketplace</Link></p></HubShell>
  );

  const photos = l.media.filter((u): u is string => !!u);
  const digits = l.contact?.phone.replace(/^\+/, "");

  return (
    <HubShell me={me}>
      <Link href={base} className="text-sm text-blue-700 underline">← Marketplace</Link>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {photos.length > 0 && (
          <div>
            <img src={photos[photo]} alt="" className="max-h-[28rem] w-full bg-slate-100 object-contain" />
            {photos.length > 1 && (
              <div className="flex gap-2 p-2">
                {photos.map((u, i) => (
                  <button key={u} type="button" aria-label={`Photo ${i + 1}`} onClick={() => setPhoto(i)} className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${i === photo ? "border-blue-700" : "border-transparent"}`}>
                    <img src={u} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-slate-900">{l.title}</h1>
            <p className="whitespace-nowrap text-xl font-bold text-blue-800">{price(l.price)}</p>
          </div>
          <p className="text-sm text-slate-500">{label(CATEGORIES, l.category)} · {label(CONDITIONS, l.condition)}{l.city ? ` · ${l.city}` : ""}{l.status === "sold" ? " · VENDU" : ""}</p>
          <p className="whitespace-pre-wrap break-words text-slate-900">{l.description}</p>
          <div className="flex items-center gap-2 border-t border-slate-200 pt-3 text-sm">
            <Avatar name={l.seller.display_name} src={l.seller.avatar} size={36} />
            <span className="font-semibold text-slate-900">{l.seller.display_name}</span>
          </div>

          {l.mine ? (
            <div className="flex flex-wrap gap-2">
              <Link href={`${base}/${l.id}/modifier`} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200">Modifier</Link>
              <Button variant="outline" onClick={() => act(async () => { await mk.setListingStatus(l.id, l.status === "sold" ? "active" : "sold"); setL(await mk.getListing(l.id)); })}>
                {l.status === "sold" ? "Remettre en vente" : "Marquer comme vendu"}
              </Button>
              <Button variant="outline" onClick={() => { if (window.confirm("Supprimer cette annonce ?")) act(async () => { await mk.removeListing(l.id); setLocation(base); }); }}><Trash2 size={16} className="mr-1" /> Supprimer</Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {l.contact && <a href={`tel:${l.contact.phone}`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Phone size={16} /> Appeler</a>}
              {l.contact?.whatsapp && <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"><MessageCircle size={16} /> WhatsApp</a>}
              {/* ponytail: native prompt for the report reason; replace with a dialog if reports become frequent */}
              <Button variant="ghost" onClick={() => { const r = window.prompt("Motif du signalement ?"); if (r?.trim()) act(async () => { await mk.reportMarket("listing", l.id, r); toast.success("Merci, signalement envoyé."); }); }}><Flag size={16} className="mr-1" /> Signaler</Button>
            </div>
          )}
        </div>
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Questions et commentaires">
        <h2 className="font-bold text-slate-900">Questions ({comments.length})</h2>
        {comments.map(c => (
          <div key={c.id} className="flex items-start gap-2">
            <Avatar name={c.author.display_name} src={c.author.avatar} size={32} />
            <div className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-3 py-2 text-sm">
              <p className="font-semibold text-slate-900">{c.author.display_name}</p>
              <p className="break-words text-slate-800">{c.body}</p>
            </div>
            {(c.author.id === me.id || me.role === "moderator") && (
              <button type="button" aria-label="Supprimer le commentaire" className="mt-2 text-slate-500" onClick={() => act(async () => { await mk.removeListingComment(c.id); await loadComments(); })}><Trash2 size={14} /></button>
            )}
          </div>
        ))}
        <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (!draft.trim()) return; act(async () => { await mk.addListingComment(l.id, draft); setDraft(""); await loadComments(); }); }}>
          <Avatar name={me.display_name} src={me.avatar} size={32} />
          <Input aria-label="Votre question" className="rounded-full" value={draft} maxLength={500} onChange={e => setDraft(e.target.value)} placeholder="Posez une question publique…" />
        </form>
      </section>
    </HubShell>
  );
}
```

- [ ] **Step 5: Formulaire `market/pages/ListingFormPage.tsx`** (création `nouveau` et modification `:id/modifier`)

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import { useHubMember } from "../../useHubMember";
import * as hub from "../../api";
import * as mk from "../market-api";
import { CATEGORIES, CONDITIONS } from "../format";

const MAX = 4;
const select = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";

interface Kept { key: string; url: string | null }

export default function ListingFormPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/:lang/benevole/espace/marketplace/:id/modifier");
  const editId = match ? Number(params?.id) : null;
  const base = `/${lang}/benevole/espace/marketplace`;
  const [f, setF] = useState({ title: "", description: "", price: "", category: "autre", condition: "bon", city: "", phone: "", whatsapp: false });
  const [kept, setKept] = useState<Kept[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(editId === null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => files.map(x => URL.createObjectURL(x)), [files]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);

  useEffect(() => {
    if (!me || editId === null) return;
    mk.getListing(editId).then(l => {
      if (!l.mine) { setLocation(base); return; }
      setF({ title: l.title, description: l.description, price: String(l.price), category: l.category, condition: l.condition, city: l.city, phone: l.contact?.phone ?? "", whatsapp: l.contact?.whatsapp ?? false });
      setKept((l.media_keys ?? []).map((key, i) => ({ key, url: l.media[i] ?? null })));
      setReady(true);
    }).catch(() => setLocation(base));
  }, [me, editId, base, setLocation]);

  if (!me || !ready) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }));
  const total = kept.length + files.length;

  const pick = (list: FileList | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter(x => x.type.startsWith("image/"));
    if (kept.length + files.length + imgs.length > MAX) toast.info("4 photos maximum");
    setFiles(prev => [...prev, ...imgs].slice(0, MAX - kept.length));
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(f.price);
    if (!Number.isSafeInteger(priceNum) || priceNum < 0) { toast.error("Prix invalide (nombre entier en MAD, 0 = gratuit)"); return; }
    setBusy(true);
    try {
      const uploaded = await Promise.all(files.map(hub.uploadImage));
      const body: mk.ListingForm = { ...f, price: priceNum, media: [...kept.map(k => k.key), ...uploaded] };
      if (editId === null) { const r = await mk.createListing(body); setLocation(`${base}/${r.id}`); }
      else { await mk.updateListing(editId, body); setLocation(`${base}/${editId}`); }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HubShell me={me}>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{editId === null ? "Vendre un objet" : "Modifier l'annonce"}</h1>
        <Input aria-label="Titre" required maxLength={80} value={f.title} onChange={set("title")} placeholder="Titre (ex. Vélo enfant 6-8 ans)" />
        <Textarea aria-label="Description" required maxLength={2000} rows={5} value={f.description} onChange={set("description")} placeholder="Décrivez l'objet : état, taille, raison de la vente…" />
        <div className="grid grid-cols-2 gap-3">
          <Input aria-label="Prix en MAD" required inputMode="numeric" value={f.price} onChange={set("price")} placeholder="Prix en MAD (0 = gratuit)" />
          <Input aria-label="Ville" maxLength={60} value={f.city} onChange={set("city")} placeholder="Ville" />
          <select aria-label="Catégorie" className={select} value={f.category} onChange={set("category")}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          <select aria-label="État" className={select} value={f.condition} onChange={set("condition")}>{CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        </div>
        <div className="space-y-2">
          <Input aria-label="Téléphone (facultatif)" value={f.phone} onChange={set("phone")} placeholder="Téléphone (facultatif) — format +212…" />
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={f.whatsapp} onChange={e => setF(p => ({ ...p, whatsapp: e.target.checked }))} /> Joignable sur WhatsApp (numéro au format international)</label>
          <p className="text-xs text-slate-500">Votre numéro sera visible des autres membres de l'espace bénévole.</p>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {kept.map(k => (
              <div key={k.key} className="relative h-20 w-20">
                {k.url ? <img src={k.url} alt="" className="h-20 w-20 rounded-lg object-cover" /> : <div className="h-20 w-20 rounded-lg bg-slate-200" />}
                <button type="button" aria-label="Retirer la photo" className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white" onClick={() => setKept(kept.filter(x => x.key !== k.key))}><X size={14} /></button>
              </div>
            ))}
            {files.map((x, i) => (
              <div key={i} className="relative h-20 w-20">
                <img src={previews[i]} alt="" className="h-20 w-20 rounded-lg object-cover" />
                <button type="button" aria-label="Retirer la photo" className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={14} /></button>
              </div>
            ))}
          </div>
          <input ref={fileRef} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => pick(e.target.files)} />
          <Button type="button" variant="outline" disabled={total >= MAX} onClick={() => fileRef.current?.click()}><ImagePlus size={16} className="mr-2" /> Ajouter des photos ({total}/{MAX})</Button>
        </div>
        <Button type="submit" className="w-full bg-blue-700 hover:bg-blue-800" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : editId === null ? "Publier l'annonce" : "Enregistrer"}</Button>
      </form>
    </HubShell>
  );
}
```

- [ ] **Step 6: Navigation, routes, admin**

`client/src/features/hub/components/HubShell.tsx` :
- ajouter `Store` à l'import lucide ; dans la nav latérale, après le lien « Fil d'actualité » : `<Link href={`${base}/marketplace`} className={link}><Store size={18} /> Marketplace</Link>` ;
- barre mobile : passer `grid-cols-3` à `grid-cols-4` et ajouter après « Fil » : `<Link href={`${base}/marketplace`} className="flex flex-col items-center gap-0.5 py-2"><Store size={20} />Marketplace</Link>`.

`client/src/App.tsx` : importer les trois pages (`MarketPage`, `ListingDetailPage`, `ListingFormPage` depuis `@/features/hub/market/pages/…`) et, **avant** la route `/:lang/benevole/espace/profil`, ajouter dans cet ordre (le plus spécifique d'abord, le `Switch` de wouter matche l'ordre) :

```tsx
      <Route path="/:lang/benevole/espace/marketplace/nouveau" component={ListingFormPage} />
      <Route path="/:lang/benevole/espace/marketplace/:id/modifier" component={ListingFormPage} />
      <Route path="/:lang/benevole/espace/marketplace/:id" component={ListingDetailPage} />
      <Route path="/:lang/benevole/espace/marketplace" component={MarketPage} />
```

Créer `client/src/features/hub/admin/MarketAdmin.tsx` :

```tsx
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as mk from "../market/market-api";
import { price } from "../market/format";

export default function MarketAdmin() {
  const [listings, setListings] = useState<mk.AdminListing[]>([]);
  const [reports, setReports] = useState<mk.MkReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [l, r] = await Promise.allSettled([mk.adminListings(), mk.adminMarketReports()]);
    if (l.status === "fulfilled") setListings(l.value); else toast.error((l.reason as Error).message);
    if (r.status === "fulfilled") setReports(r.value); else toast.error((r.reason as Error).message);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Marketplace : signalements ({reports.length})</h2>
        {!loading && reports.length === 0 && <p className="text-sm text-muted-foreground">Aucun signalement.</p>}
        {reports.map(r => (
          <div key={r.id} className="rounded-lg border p-3 text-sm space-y-1">
            <p><strong>{r.target_type === "listing" ? "Annonce" : "Commentaire"} #{r.target_id}</strong> — signalé par {r.reporter} : « {r.reason} »</p>
            <p className="whitespace-pre-wrap break-words rounded bg-muted p-2">{r.body ?? "(contenu supprimé)"}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={busy || r.target_status === "hidden"} onClick={() => window.confirm("Masquer ce contenu ?") && run(() => mk.adminMarketHide(r.target_type, r.target_id), "Contenu masqué")}>
                {r.target_status === "hidden" ? "Déjà masqué" : "Masquer"}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => mk.adminMarketDismiss(r.id))}>Ignorer</Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Marketplace : annonces ({listings.length})</h2>
        {!loading && listings.length === 0 && <p className="text-sm text-muted-foreground">Aucune annonce.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th className="p-2">Titre</th><th className="p-2">Vendeur</th><th className="p-2">Prix</th><th className="p-2">Statut</th><th className="p-2" /></tr></thead>
            <tbody>
              {listings.map(l => (
                <tr key={l.id} className="border-t">
                  <td className="p-2 break-words">{l.title}</td>
                  <td className="p-2">{l.seller}</td>
                  <td className="p-2 whitespace-nowrap">{price(l.price)}</td>
                  <td className="p-2">{l.status}</td>
                  <td className="p-2">
                    <Button size="sm" variant="destructive" disabled={busy || l.status === "hidden"} onClick={() => window.confirm(`Masquer l'annonce « ${l.title} » ?`) && run(() => mk.adminMarketHide("listing", l.id), "Annonce masquée")}>Masquer</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
```

Dans `client/src/features/hub/admin/AdminHub.tsx` : ajouter `import MarketAdmin from "./MarketAdmin";` puis insérer `<MarketAdmin />` juste avant la fermeture `</div>` du conteneur `space-y-8 p-4` (après la section « Membres »).

- [ ] **Step 7: Vérifier**

Run: `npx tsc --noEmit 2>&1 | grep -E "features/hub|App.tsx"; echo rc=$?` — Expected: aucune ligne (rc=1).
Run: `npx vite build 2>&1 | tail -2` — Expected: build OK.

- [ ] **Step 8: Commit**

```bash
git add client/src/features/hub client/src/App.tsx
git commit -m "feat(market): marketplace UI (list, detail, form) and admin section"
```

> **Jalon 1 prêt à déployer ici** (voir Task 8, étapes A). La messagerie n'est pas encore branchée.

---

### Task 5: Messagerie — données

**Files:**
- Modify: `worker/market-d1.ts`
- Test: `worker/market-d1.test.ts`

**Interfaces:**
- Consumes : Tasks 1–2 (`SELLER_OK`, `MK_LIMITS`, `HubError`, `cleanBody`, `iso`, `HOUR_MS`, `MemberRow`).
- Produces :
  - `openThread(d, buyer, listingId, nowMs): Promise<{ id: number; created: boolean }>`
  - `interface ThreadSummary { id: number; listing_id: number; listing_title: string; listing_status: string; cover: string | null; other: Seller; last_body: string | null; last_message_at: string; unread: number }`
  - `listThreads(d, memberId): Promise<ThreadSummary[]>`
  - `interface MessageView { id: number; sender_id: number; body: string; created_at: string; read_at: string | null }`
  - `listMessages(d, member, threadId, before?: number | null): Promise<{ messages: MessageView[]; nextCursor: number | null; other: Seller; listing: { id: number; title: string; status: string } }>`
  - `sendMessage(d, member, threadId, body, nowMs): Promise<{ id: number }>`
  - `markThreadRead(d, member, threadId, nowMs): Promise<void>`
  - `unreadTotal(d, memberId): Promise<number>`

- [ ] **Step 1: Écrire les tests qui échouent** (ajouter à `worker/market-d1.test.ts`)

```ts
describe("messaging", () => {
  async function setup() {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim"); const c = await member("c@x.ma", "Chakib");
    const { id } = await mk.createListing(d, a, base(), T0);
    return { a, b, c, listingId: id };
  }

  it("openThread: unique per (listing, buyer); not with yourself; not on hidden; not new on sold", async () => {
    const { a, b, listingId } = await setup();
    const t1 = await mk.openThread(d, b, listingId, T0 + 1);
    expect(t1.created).toBe(true);
    expect(await mk.openThread(d, b, listingId, T0 + 2)).toEqual({ id: t1.id, created: false });
    await expect(mk.openThread(d, a, listingId, T0 + 3)).rejects.toMatchObject({ code: "invalid" });
    await expect(mk.openThread(d, b, 9999, T0 + 3)).rejects.toMatchObject({ code: "not_found" });
    await mk.setListingStatus(d, a, listingId, "sold", T0 + 4);
    expect((await mk.openThread(d, b, listingId, T0 + 5)).created).toBe(false); // existing continues
    const c = await member("c2@x.ma", "Chakib");
    await expect(mk.openThread(d, c, listingId, T0 + 6)).rejects.toMatchObject({ code: "invalid" }); // sold: no new thread
    await mk.hideListing(d, listingId);
    await expect(mk.openThread(d, b, listingId, T0 + 7)).rejects.toMatchObject({ code: "not_found" });
  });

  it("send/list: participants only, ordering, validation, 404 for outsiders", async () => {
    const { a, b, c, listingId } = await setup();
    const t = await mk.openThread(d, b, listingId, T0 + 1);
    await expect(mk.sendMessage(d, b, t.id, " ", T0 + 2)).rejects.toMatchObject({ code: "invalid" });
    await expect(mk.sendMessage(d, b, t.id, "x".repeat(1001), T0 + 2)).rejects.toMatchObject({ code: "invalid" });
    await mk.sendMessage(d, b, t.id, "Bonjour, dispo ?", T0 + 3);
    await mk.sendMessage(d, a, t.id, "Oui", T0 + 4);
    const msgs = await mk.listMessages(d, b, t.id);
    expect(msgs.messages.map(m => m.body)).toEqual(["Bonjour, dispo ?", "Oui"]);
    expect(msgs.other).toMatchObject({ id: a.id, display_name: "Amina B." });
    expect(msgs.listing).toMatchObject({ id: listingId, title: "Vélo enfant" });
    for (const outsider of [c]) {
      await expect(mk.listMessages(d, outsider, t.id)).rejects.toMatchObject({ code: "not_found" });
      await expect(mk.sendMessage(d, outsider, t.id, "intrus", T0 + 5)).rejects.toMatchObject({ code: "not_found" });
      await expect(mk.markThreadRead(d, outsider, t.id, T0 + 5)).rejects.toMatchObject({ code: "not_found" });
    }
    await expect(mk.listMessages(d, a, 9999)).rejects.toMatchObject({ code: "not_found" });
  });

  it("inbox: both sides, last message, unread counts, seller sees a thread only once a message exists", async () => {
    const { a, b, listingId } = await setup();
    const t = await mk.openThread(d, b, listingId, T0 + 1);
    expect(await mk.listThreads(d, a.id)).toEqual([]); // empty thread hidden from the seller
    expect(await mk.listThreads(d, b.id)).toHaveLength(1); // buyer sees it
    await mk.sendMessage(d, b, t.id, "Bonjour", T0 + 2);
    await mk.sendMessage(d, b, t.id, "Toujours dispo ?", T0 + 3);
    const inboxA = await mk.listThreads(d, a.id);
    expect(inboxA[0]).toMatchObject({ id: t.id, listing_title: "Vélo enfant", other: { id: b.id, display_name: "Brahim B." }, last_body: "Toujours dispo ?", unread: 2 });
    expect((await mk.listThreads(d, b.id))[0].unread).toBe(0);
    expect(await mk.unreadTotal(d, a.id)).toBe(2);
    await mk.markThreadRead(d, a, t.id, T0 + 4);
    expect(await mk.unreadTotal(d, a.id)).toBe(0);
    expect((await mk.listMessages(d, b, t.id)).messages[0].read_at).not.toBeNull();
  });

  it("messages stay private from admins: no admin-style access exists on the data layer", async () => {
    const { b, listingId } = await setup();
    const t = await mk.openThread(d, b, listingId, T0 + 1);
    await mk.sendMessage(d, b, t.id, "secret", T0 + 2);
    expect(Object.keys(mk).filter(k => /admin/i.test(k)).sort()).toEqual(["adminListListings"]);
    expect(JSON.stringify(await mk.adminListListings(d))).not.toContain("secret");
    expect(JSON.stringify(await mk.listMarketReports(d))).not.toContain("secret");
  });

  it("a hidden listing or a removed seller closes the thread", async () => {
    const { a, b, listingId } = await setup();
    const t = await mk.openThread(d, b, listingId, T0 + 1);
    await mk.sendMessage(d, b, t.id, "hello", T0 + 2);
    await mk.hideListing(d, listingId);
    await expect(mk.sendMessage(d, b, t.id, "encore", T0 + 3)).rejects.toMatchObject({ code: "not_found" });
    expect(await mk.listThreads(d, a.id)).toEqual([]);
  });

  it("pagination: 50 latest, older via cursor", async () => {
    const { a, b, listingId } = await setup();
    const t = await mk.openThread(d, b, listingId, T0);
    const ins = sqlite.prepare("INSERT INTO mk_messages (thread_id, sender_id, body, created_at) VALUES (?,?,?,?)");
    for (let i = 0; i < 60; i++) ins.run(t.id, i % 2 ? a.id : b.id, `m${i}`, new Date(T0 + i).toISOString());
    const p1 = await mk.listMessages(d, b, t.id);
    expect(p1.messages).toHaveLength(50);
    expect(p1.messages[0].body).toBe("m10");
    expect(p1.messages[49].body).toBe("m59");
    const p2 = await mk.listMessages(d, b, t.id, p1.nextCursor);
    expect(p2.messages.map(m => m.body)).toEqual(["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"]);
    expect(p2.nextCursor).toBeNull();
  });

  it("rate limits: 30 messages/h and 20 new threads/h", async () => {
    const { b, listingId } = await setup();
    const t = await mk.openThread(d, b, listingId, T0);
    for (let i = 0; i < 30; i++) await mk.sendMessage(d, b, t.id, `m${i}`, T0 + i);
    await expect(mk.sendMessage(d, b, t.id, "over", T0 + 100)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(mk.sendMessage(d, b, t.id, "later", T0 + HOUR + 100)).resolves.toBeTruthy();
    const seller = await member("s@x.ma", "Sami");
    const buyer = await member("buyer@x.ma", "Basma");
    const ids: number[] = [];
    for (let i = 0; i < 21; i++) ids.push(raw(seller.id, { title: `s${i}` }));
    for (let i = 0; i < 20; i++) await mk.openThread(d, buyer, ids[i], T0 + 1000 + i);
    await expect(mk.openThread(d, buyer, ids[20], T0 + 2000)).rejects.toMatchObject({ code: "rate_limited" });
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run worker/market-d1.test.ts`
Expected: FAIL (`mk.openThread is not a function`).

- [ ] **Step 3: Implémenter (ajouter à `worker/market-d1.ts`)**

```ts
// ---- messaging -------------------------------------------------------------

export interface ThreadSummary { id: number; listing_id: number; listing_title: string; listing_status: string; cover: string | null; other: Seller; last_body: string | null; last_message_at: string; unread: number }
export interface MessageView { id: number; sender_id: number; body: string; created_at: string; read_at: string | null }
interface ThreadRow { id: number; listing_id: number; buyer_id: number; seller_id: number; listing_status: string; listing_title: string }

/** Thread the member takes part in, on a non-hidden listing. Outsiders get a 404 (existence is not revealed). */
async function participantThread(d: D1Like, member: MemberRow, threadId: number): Promise<ThreadRow> {
  const t = await d.prepare(
    `SELECT t.id, t.listing_id, t.buyer_id, t.seller_id, l.status AS listing_status, l.title AS listing_title
     FROM mk_threads t JOIN mk_listings l ON l.id = t.listing_id WHERE t.id = ?`,
  ).bind(threadId).first<ThreadRow>();
  if (!t || (t.buyer_id !== member.id && t.seller_id !== member.id) || t.listing_status === "hidden") throw new HubError("not_found", "Discussion introuvable");
  return t;
}

export async function openThread(d: D1Like, buyer: MemberRow, listingId: number, nowMs: number): Promise<{ id: number; created: boolean }> {
  const l = await d.prepare(
    `SELECT l.id, l.member_id, l.status FROM mk_listings l JOIN hub_members m ON m.id = l.member_id WHERE l.id = ? AND l.status IN ('active','sold') AND ${SELLER_OK}`,
  ).bind(listingId).first<{ id: number; member_id: number; status: string }>();
  if (!l) throw new HubError("not_found", "Annonce introuvable");
  if (l.member_id === buyer.id) throw new HubError("invalid", "Vous ne pouvez pas vous écrire à vous-même");
  const existing = await d.prepare("SELECT id FROM mk_threads WHERE listing_id = ? AND buyer_id = ?").bind(listingId, buyer.id).first<{ id: number }>();
  if (existing) return { id: existing.id, created: false };
  if (l.status === "sold") throw new HubError("invalid", "Cette annonce est vendue");
  const n = await d.prepare("SELECT COUNT(*) AS n FROM mk_threads WHERE buyer_id = ? AND created_at > ?").bind(buyer.id, iso(nowMs - HOUR_MS)).first<{ n: number }>();
  if ((n?.n ?? 0) >= MK_LIMITS.threadsPerHour) throw new HubError("rate_limited", "Trop de nouvelles discussions, réessayez plus tard");
  const row = await d.prepare(
    "INSERT INTO mk_threads (listing_id, buyer_id, seller_id, created_at, last_message_at) VALUES (?,?,?,?,?) ON CONFLICT(listing_id, buyer_id) DO UPDATE SET listing_id = excluded.listing_id RETURNING id",
  ).bind(listingId, buyer.id, l.member_id, iso(nowMs), iso(nowMs)).first<{ id: number }>();
  return { id: row!.id, created: true };
}

export async function sendMessage(d: D1Like, member: MemberRow, threadId: number, rawBody: string, nowMs: number): Promise<{ id: number }> {
  const t = await participantThread(d, member, threadId);
  const body = cleanBody(rawBody, MK_LIMITS.message, "Message");
  const n = await d.prepare("SELECT COUNT(*) AS n FROM mk_messages WHERE sender_id = ? AND created_at > ?").bind(member.id, iso(nowMs - HOUR_MS)).first<{ n: number }>();
  if ((n?.n ?? 0) >= MK_LIMITS.messagesPerHour) throw new HubError("rate_limited", "Trop de messages, réessayez plus tard");
  const row = await d.prepare("INSERT INTO mk_messages (thread_id, sender_id, body, created_at) VALUES (?,?,?,?) RETURNING id").bind(t.id, member.id, body, iso(nowMs)).first<{ id: number }>();
  await d.prepare("UPDATE mk_threads SET last_message_at = ? WHERE id = ?").bind(iso(nowMs), t.id).run();
  return { id: row!.id };
}

export async function listThreads(d: D1Like, memberId: number): Promise<ThreadSummary[]> {
  const { results } = await d.prepare(
    `SELECT t.id, t.listing_id, t.last_message_at, l.title AS listing_title, l.status AS listing_status,
       (SELECT r2_key FROM mk_listing_media WHERE listing_id = l.id AND position = 0) AS cover,
       o.id AS other_id, o.display_name AS other_name, o.avatar_key AS other_avatar,
       (SELECT body FROM mk_messages WHERE thread_id = t.id ORDER BY id DESC LIMIT 1) AS last_body,
       (SELECT COUNT(*) FROM mk_messages WHERE thread_id = t.id AND sender_id <> ? AND read_at IS NULL) AS unread
     FROM mk_threads t
     JOIN mk_listings l ON l.id = t.listing_id
     JOIN hub_members o ON o.id = CASE WHEN t.buyer_id = ? THEN t.seller_id ELSE t.buyer_id END
     WHERE l.status <> 'hidden' AND (t.buyer_id = ? OR (t.seller_id = ? AND EXISTS (SELECT 1 FROM mk_messages WHERE thread_id = t.id)))
     ORDER BY t.last_message_at DESC, t.id DESC LIMIT 100`,
  ).bind(memberId, memberId, memberId, memberId).all<any>();
  return results.map(r => ({
    id: r.id, listing_id: r.listing_id, listing_title: r.listing_title, listing_status: r.listing_status, cover: r.cover,
    other: { id: r.other_id, display_name: r.other_name, avatar_key: r.other_avatar },
    last_body: r.last_body, last_message_at: r.last_message_at, unread: r.unread,
  }));
}

export async function listMessages(d: D1Like, member: MemberRow, threadId: number, before: number | null = null) {
  const t = await participantThread(d, member, threadId);
  const { results } = await d.prepare(
    "SELECT id, sender_id, body, created_at, read_at FROM mk_messages WHERE thread_id = ? AND (? IS NULL OR id < ?) ORDER BY id DESC LIMIT 51",
  ).bind(threadId, before, before).all<MessageView>();
  const page = results.slice(0, 50).reverse();
  const otherId = t.buyer_id === member.id ? t.seller_id : t.buyer_id;
  const o = await d.prepare("SELECT id, display_name, avatar_key FROM hub_members WHERE id = ?").bind(otherId).first<Seller>();
  return {
    messages: page,
    nextCursor: results.length > 50 ? page[0].id : null,
    other: o!,
    listing: { id: t.listing_id, title: t.listing_title, status: t.listing_status },
  };
}

export async function markThreadRead(d: D1Like, member: MemberRow, threadId: number, nowMs: number): Promise<void> {
  await participantThread(d, member, threadId);
  await d.prepare("UPDATE mk_messages SET read_at = ? WHERE thread_id = ? AND sender_id <> ? AND read_at IS NULL").bind(iso(nowMs), threadId, member.id).run();
}

export async function unreadTotal(d: D1Like, memberId: number): Promise<number> {
  const r = await d.prepare(
    `SELECT COUNT(*) AS n FROM mk_messages x JOIN mk_threads t ON t.id = x.thread_id JOIN mk_listings l ON l.id = t.listing_id
     WHERE (t.buyer_id = ? OR t.seller_id = ?) AND x.sender_id <> ? AND x.read_at IS NULL AND l.status <> 'hidden'`,
  ).bind(memberId, memberId, memberId).first<{ n: number }>();
  return r?.n ?? 0;
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run worker/market-d1.test.ts`
Expected: PASS. (Le test « messages stay private » vérifie aussi que le seul export contenant `admin` est `adminListListings`.)

- [ ] **Step 5: Commit**

```bash
git add worker/market-d1.ts worker/market-d1.test.ts
git commit -m "feat(market): private messaging data layer"
```

---

### Task 6: Messagerie — routes HTTP

**Files:**
- Modify: `worker/market.ts`
- Test: `worker/market.test.ts`

**Interfaces:**
- Consumes : Task 5 (`openThread`, `sendMessage`, `listThreads`, `listMessages`, `markThreadRead`, `unreadTotal`), `MarketCtx`.
- Produces routes : `POST listings/:id/thread` → `{ id, created }` ; `GET threads` → `{ threads }` (cover et avatar signés) ; `GET threads/:id/messages?cursor=` → `{ messages, nextCursor, other, listing }` ; `POST threads/:id/messages` `{body}` → `{ id }` ; `POST threads/:id/read` → `{ ok }` ; `GET unread` → `{ count }`.

- [ ] **Step 1: Écrire les tests qui échouent** (ajouter à `worker/market.test.ts`)

```ts
describe("market http: messaging", () => {
  async function pair() {
    const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim"); const c = await signIn("c@x.ma", "Chakib");
    const { id } = (await (await call("POST", "/hub/market/listings", { token: a.session, body: listing() })).json()) as { id: number };
    return { a, b, c, id };
  }

  it("open thread, exchange, unread, read, inbox", async () => {
    const { a, b, id } = await pair();
    const t = (await (await call("POST", `/hub/market/listings/${id}/thread`, { token: b.session })).json()) as { id: number; created: boolean };
    expect(t.created).toBe(true);
    expect((await call("POST", `/hub/market/threads/${t.id}/messages`, { token: b.session, body: { body: {} } })).status).toBe(400);
    expect((await call("POST", `/hub/market/threads/${t.id}/messages`, { token: b.session, body: { body: "Bonjour" } })).status).toBe(200);
    expect(await (await call("GET", "/hub/market/unread", { token: a.session })).json()).toEqual({ count: 1 });
    const inbox = (await (await call("GET", "/hub/market/threads", { token: a.session })).json()) as any;
    expect(inbox.threads[0]).toMatchObject({ id: t.id, last_body: "Bonjour", unread: 1, other: { display_name: "Brahim B." } });
    expect(JSON.stringify(inbox)).not.toContain("@x.ma");
    const msgs = (await (await call("GET", `/hub/market/threads/${t.id}/messages`, { token: a.session })).json()) as any;
    expect(msgs.messages[0]).toMatchObject({ body: "Bonjour", sender_id: b.id });
    expect(msgs.other.display_name).toBe("Brahim B.");
    expect((await call("POST", `/hub/market/threads/${t.id}/read`, { token: a.session })).status).toBe(200);
    expect(await (await call("GET", "/hub/market/unread", { token: a.session })).json()).toEqual({ count: 0 });
  });

  it("outsiders get 404, yourself is 400, anonymous 401, admins cannot read", async () => {
    const { a, b, c, id } = await pair();
    expect((await call("POST", `/hub/market/listings/${id}/thread`, { token: a.session })).status).toBe(400);
    const t = (await (await call("POST", `/hub/market/listings/${id}/thread`, { token: b.session })).json()) as { id: number };
    await call("POST", `/hub/market/threads/${t.id}/messages`, { token: b.session, body: { body: "secret" } });
    for (const [m, p, body] of [["GET", `/hub/market/threads/${t.id}/messages`, undefined], ["POST", `/hub/market/threads/${t.id}/messages`, { body: "x" }], ["POST", `/hub/market/threads/${t.id}/read`, undefined]] as const) {
      expect((await call(m, p, { token: c.session, body })).status, `${m} ${p}`).toBe(404);
      expect((await call(m, p, { body })).status, `${m} ${p} anon`).toBe(401);
      expect((await call(m, p, { admin: "admin", body })).status, `${m} ${p} admin`).toBe(401); // admin bearer is not a member session
    }
    expect((await call("GET", "/hub/market/threads/abc/messages", { token: a.session })).status).toBe(404); // not a numeric id: route does not match
    expect((await call("GET", "/hub/market/threads/99999999999999999999/messages", { token: a.session })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run worker/market.test.ts`
Expected: FAIL (404 « Route inconnue »).

- [ ] **Step 3: Implémenter (ajouter dans `handleMarketRoute`, avant `return null;`)**

```ts
  // ---- messaging ---------------------------------------------------------
  if ((m = match("POST", /^listings\/(\d+)\/thread$/))) {
    const me = await member();
    return json(await M.openThread(d, me, id(m[1]), now()));
  }
  if (match("GET", /^threads$/)) {
    const me = await member();
    const threads = await M.listThreads(d, me.id);
    return json({ threads: await Promise.all(threads.map(async ({ cover, other, ...t }) => ({ ...t, cover: await sign(cover), other: await seller(other, sign) }))) });
  }
  if ((m = match("GET", /^threads\/(\d+)\/messages$/))) {
    const me = await member();
    const cur = url.searchParams.get("cursor");
    const r = await M.listMessages(d, me, id(m[1]), cur && /^\d+$/.test(cur) ? Number(cur) : null);
    return json({ ...r, other: await seller(r.other, sign) });
  }
  if ((m = match("POST", /^threads\/(\d+)\/messages$/))) {
    const me = await member();
    return json(await M.sendMessage(d, me, id(m[1]), str((await readJson(request)).body), now()));
  }
  if ((m = match("POST", /^threads\/(\d+)\/read$/))) {
    const me = await member();
    await M.markThreadRead(d, me, id(m[1]), now());
    return json({ ok: true });
  }
  if (match("GET", /^unread$/)) {
    const me = await member();
    return json({ count: await M.unreadTotal(d, me.id) });
  }
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run worker`
Expected: tout vert sauf les 2 échecs `worker/email.group.test.ts` déjà connus. `npx tsc --noEmit 2>&1 | grep -E "worker/(market|hub)"` → aucune ligne.

- [ ] **Step 5: Commit**

```bash
git add worker/market.ts worker/market.test.ts
git commit -m "feat(market): messaging routes"
```

---

### Task 7: Client — messagerie (bouton, boîte de réception, conversation, badge)

**Files:**
- Modify: `client/src/features/hub/market/market-api.ts`
- Create: `client/src/features/hub/market/pages/InboxPage.tsx`
- Create: `client/src/features/hub/market/pages/ConversationPage.tsx`
- Modify: `client/src/features/hub/market/pages/ListingDetailPage.tsx`
- Modify: `client/src/features/hub/components/HubShell.tsx`, `client/src/App.tsx`

**Interfaces:**
- Consumes : routes Task 6.
- Produces : fonctions `openThread`, `listThreads`, `listMessages`, `sendMessage`, `markRead`, `unreadCount` ; pages `InboxPage`, `ConversationPage`.

- [ ] **Step 1: Ajouter à `market-api.ts`**

```ts
export interface Thread { id: number; listing_id: number; listing_title: string; listing_status: string; cover: string | null; other: Seller; last_body: string | null; last_message_at: string; unread: number }
export interface Message { id: number; sender_id: number; body: string; created_at: string; read_at: string | null }

export const openThread = (listingId: number) => call<{ id: number; created: boolean }>("POST", `market/listings/${listingId}/thread`);
export const listThreads = () => call<{ threads: Thread[] }>("GET", "market/threads").then(r => r.threads);
export const listMessages = (threadId: number, cursor?: number | null) =>
  call<{ messages: Message[]; nextCursor: number | null; other: Seller; listing: { id: number; title: string; status: string } }>("GET", `market/threads/${threadId}/messages${cursor ? `?cursor=${cursor}` : ""}`);
export const sendMessage = (threadId: number, body: string) => call<{ id: number }>("POST", `market/threads/${threadId}/messages`, { body: { body } });
export const markRead = (threadId: number) => call<{ ok: true }>("POST", `market/threads/${threadId}/read`);
export const unreadCount = () => call<{ count: number }>("GET", "market/unread").then(r => r.count);
```

- [ ] **Step 2: Bouton « Envoyer un message » dans `ListingDetailPage.tsx`**

Dans la branche non-propriétaire (là où se trouvent « Appeler », « WhatsApp », « Signaler »), ajouter avant « Signaler » :

```tsx
<Button className="bg-blue-700 hover:bg-blue-800" disabled={l.status === "sold"} onClick={() => act(async () => { const t = await mk.openThread(l.id); setLocation(`${base}/messages/${t.id}`); })}>
  <MessageCircle size={16} className="mr-2" /> Envoyer un message
</Button>
```

(Pour une annonce vendue, le bouton est désactivé ; une discussion existante reste accessible depuis la boîte de réception.) Importer `MessageCircle` est déjà fait ; `setLocation` et `base` existent dans le composant.

- [ ] **Step 3: Boîte de réception `InboxPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as mk from "../market-api";

export default function InboxPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const base = `/${lang}/benevole/espace/marketplace`;
  const [threads, setThreads] = useState<mk.Thread[] | null>(null);

  useEffect(() => {
    if (!me) return;
    mk.listThreads().then(setThreads).catch(e => { toast.error((e as Error).message); setThreads([]); });
  }, [me]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  return (
    <HubShell me={me}>
      <h1 className="text-xl font-bold text-slate-900">Mes messages</h1>
      {threads === null && <Loader2 className="mx-auto animate-spin text-blue-700" />}
      {threads?.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Aucune discussion. Ouvrez une annonce et cliquez sur « Envoyer un message ».</p>}
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {threads?.map(t => (
          <li key={t.id}>
            <Link href={`${base}/messages/${t.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
              <Avatar name={t.other.display_name} src={t.other.avatar} size={44} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between gap-2"><span className="truncate font-semibold text-slate-900">{t.other.display_name}</span>{t.unread > 0 && <span className="rounded-full bg-blue-700 px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${t.unread} non lus`}>{t.unread}</span>}</p>
                <p className="truncate text-xs text-slate-500">{t.listing_title}{t.listing_status === "sold" ? " · Vendu" : ""}</p>
                <p className={`truncate text-sm ${t.unread > 0 ? "font-semibold text-slate-900" : "text-slate-600"}`}>{t.last_body ?? "Nouvelle discussion"}</p>
              </div>
              {t.cover && <img src={t.cover} alt="" className="h-12 w-12 rounded-lg object-cover" />}
            </Link>
          </li>
        ))}
      </ul>
    </HubShell>
  );
}
```

- [ ] **Step 4: Conversation `ConversationPage.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as mk from "../market-api";

const POLL_MS = 10_000;

export default function ConversationPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, params] = useRoute("/:lang/benevole/espace/marketplace/messages/:threadId");
  const threadId = Number(params?.threadId);
  const base = `/${lang}/benevole/espace/marketplace`;
  const [data, setData] = useState<Awaited<ReturnType<typeof mk.listMessages>> | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await mk.listMessages(threadId);
      setData(r);
      if (r.messages.some(m => m.sender_id !== me?.id && !m.read_at)) mk.markRead(threadId).catch(() => undefined);
    } catch {
      setData(null);
    }
  }, [threadId, me?.id]);

  // ponytail: polling every 10 s instead of websockets; fine for a small community
  useEffect(() => {
    if (!me || !Number.isSafeInteger(threadId)) return;
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [me, threadId, load]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [data?.messages.length]);

  if (!me || data === undefined) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (data === null) return <HubShell me={me}><p className="rounded-xl bg-white p-8 text-center text-slate-600">Discussion introuvable. <Link href={`${base}/messages`} className="text-blue-700 underline">Mes messages</Link></p></HubShell>;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try { await mk.sendMessage(threadId, draft); setDraft(""); await load(); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <HubShell me={me}>
      <Link href={`${base}/messages`} className="text-sm text-blue-700 underline">← Mes messages</Link>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-200 p-3">
          <Avatar name={data.other.display_name} src={data.other.avatar} size={40} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{data.other.display_name}</p>
            <Link href={`${base}/${data.listing.id}`} className="block truncate text-xs text-blue-700 underline">{data.listing.title}</Link>
          </div>
        </header>
        <div className="max-h-[60vh] min-h-[16rem] space-y-2 overflow-y-auto bg-slate-50 p-3">
          {data.nextCursor !== null && <p className="text-center text-xs text-slate-400">Messages plus anciens non affichés</p>}
          {data.messages.map(m => {
            const mine = m.sender_id === me.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${mine ? "bg-blue-700 text-white" : "bg-white text-slate-900 shadow-sm"}`}>{m.body}</p>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
          <Input aria-label="Votre message" value={draft} maxLength={1000} onChange={e => setDraft(e.target.value)} placeholder="Écrivez un message…" className="rounded-full" />
          <Button type="submit" aria-label="Envoyer" className="bg-blue-700 hover:bg-blue-800" disabled={busy || !draft.trim()}><Send size={16} /></Button>
        </form>
      </div>
    </HubShell>
  );
}
```

- [ ] **Step 5: Routes et badge**

`client/src/App.tsx` : importer `InboxPage` et `ConversationPage` et, **avant** `…/marketplace/:id` (donc avant `nouveau` et `:id/modifier` aussi, pour que `messages` ne soit pas pris pour un `:id`), ajouter :

```tsx
      <Route path="/:lang/benevole/espace/marketplace/messages/:threadId" component={ConversationPage} />
      <Route path="/:lang/benevole/espace/marketplace/messages" component={InboxPage} />
```

`client/src/features/hub/components/HubShell.tsx` — ajouter les imports `useEffect, useState` (react), `Mail` (lucide-react) et `import * as mk from "../market/market-api";`, puis dans le composant, après `const base = …` :

```tsx
  const [unread, setUnread] = useState(0);
  // ponytail: poll the unread counter every 30 s instead of push notifications
  useEffect(() => {
    let alive = true;
    const tick = () => { mk.unreadCount().then(n => { if (alive) setUnread(n); }).catch(() => undefined); };
    tick();
    const t = setInterval(() => { if (!document.hidden) tick(); }, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
```

Navigation latérale, après le lien « Marketplace » :

```tsx
              <Link href={`${base}/marketplace/messages`} className={link}>
                <Mail size={18} /> Mes messages
                {unread > 0 && <span className="ml-auto rounded-full bg-blue-700 px-2 text-xs font-semibold text-white" aria-label={`${unread} messages non lus`}>{unread}</span>}
              </Link>
```

Menu du compte (`details`), avant « Retour au site » : `<Link href={`${base}/marketplace/messages`} className="block px-4 py-2 hover:bg-slate-100">Mes messages{unread > 0 ? ` (${unread})` : ""}</Link>`.

Barre mobile : remplacer le lien Marketplace par

```tsx
        <Link href={`${base}/marketplace`} className="relative flex flex-col items-center gap-0.5 py-2">
          <Store size={20} />Marketplace
          {unread > 0 && <span className="absolute right-6 top-1.5 h-2.5 w-2.5 rounded-full bg-blue-600" aria-label="Messages non lus" />}
        </Link>
```

- [ ] **Step 6: Vérifier**

Run: `npx tsc --noEmit 2>&1 | grep -E "features/hub|App.tsx"; echo rc=$?` — Expected: aucune ligne (rc=1).
Run: `npx vite build 2>&1 | tail -2` — Expected: build OK.

- [ ] **Step 7: Commit**

```bash
git add client/src/features/hub client/src/App.tsx
git commit -m "feat(market): private messaging UI (inbox, conversation, unread badge)"
```

---

### Task 8: Mise en production (lancée par l'utilisateur) et vérification

**Files:** aucun changement de code. Les agents n'exécutent ni écriture de prod, ni déploiement, ni push.

- [ ] **Step 1: Suite de tests**

Run: `npx vitest run worker 2>&1 | tail -6`
Expected: seuls les 2 échecs `worker/email.group.test.ts` déjà connus.

- [ ] **Step 2: Schéma sur la D1 de prod** (idempotent ; prérequis `hub.sql` déjà appliqué)

```
! cd ~/Documents/Projects/ftour-bab-rayan-v3.3 && npx wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/marketplace.sql
```

Expected : `Executed N queries` sans erreur (7 tables + index).

- [ ] **Step 3: Reconstruire et déployer le Worker** (obligatoire : `wrangler deploy` publie `dist/worker.js`)

```
! cd ~/Documents/Projects/ftour-bab-rayan-v3.3 && pnpm build:cloudflare && npx wrangler deploy
```

- [ ] **Step 4: Fumée sans compte** (avec paramètre anti-cache)

```
curl -s -w " [%{http_code}]\n" "https://api.ftourbabrayan.ma/hub/market/listings?cb=$RANDOM"          # 401 JSON
curl -s -w " [%{http_code}]\n" -H 'x-demo-access: 1' "https://api.ftourbabrayan.ma/hub/market/admin/listings?cb=$RANDOM"   # 403 JSON
curl -s -w " [%{http_code}]\n" "https://api.ftourbabrayan.ma/hub/market/threads/1/messages?cb=$RANDOM"   # 401 JSON
```

- [ ] **Step 5: Front** (le build a déjà eu lieu à l'étape 3)

```
! cd ~/Documents/Projects/ftour-bab-rayan-v3.3 && npx wrangler pages deploy dist/public --project-name=ftour-bab-rayan-v3-3 --branch=main
```

- [ ] **Step 6: Parcours manuel (deux vrais comptes bénévoles confirmés)**
  1. Compte A : Marketplace → Vendre → titre, description, prix, catégorie, 2 photos, téléphone `+212…` + WhatsApp → l'annonce s'affiche.
  2. Compte B : trouver l'annonce (recherche et filtre), poser une question publique, cliquer Appeler/WhatsApp, puis « Envoyer un message ».
  3. Compte A : badge de non-lus, ouvrir la discussion, répondre ; B voit la réponse (rafraîchissement ≤ 10 s).
  4. A marque « vendu » : l'annonce reste visible avec le badge Vendu ; un 3ᵉ compte ne peut plus ouvrir de nouvelle discussion.
  5. B signale l'annonce ; `/admin/hub` → section Marketplace : masquer ; l'annonce disparaît pour tous.
  6. Une URL `…/media/private/hub/<id>/<fichier>` renvoie 404 ; le lien signé d'une photo fonctionne puis expire après 1 h.

- [ ] **Step 7: Push** (après accord de l'utilisateur)

```bash
git push origin main
```

---

## Auto-revue

**Couverture de la spec :** tables et index (Task 1, schéma complet y compris threads/messages) · règles annonce, téléphone, WhatsApp, visibilité, suspension (Task 1) · commentaires, signalements, admin (Task 2) · API `market/*` annonces/commentaires/signalement/admin (Task 3) · messagerie : unicité, soi-même, vendue/masquée, privé, non-lus, limites (Tasks 5–6) · écrans liste/détail/formulaire/admin (Task 4), boîte de réception/conversation/badge (Task 7) · déploiement et reconstruction du bundle (Task 8). Recherche LIKE ≤ 50 octets (Task 1). Pas de lecture des messages par les admins : aucune fonction admin sur `mk_messages` (test explicite, Task 5).

**Écarts décidés au plan par rapport à la spec :** `mk_uploads` n'existe pas (les photos passent par `POST /hub/media`, limite partagée) ; `GET market/unread` ajouté pour le badge ; le propriétaire reçoit `media_keys` (chemins) pour pouvoir modifier ses photos ; un fil sans message est caché au vendeur (anti-spam) mais visible de l'acheteur ; WhatsApp exige un numéro au format international.

**Cohérence des types :** `Seller {id, display_name, avatar_key}` côté données ↔ `{id, display_name, avatar}` côté client (le handler signe `avatar_key` en `avatar`) ; `ListingCard.cover`, `ListingDetail.media`, `media_keys` ; `ThreadSummary.other` / `Thread.other` ; routes `PUT`/`POST`/`DELETE` uniquement.
