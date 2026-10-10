# Sous-espace Pro (réseau professionnel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à l'espace bénévole un sous-espace « Pro » (feed professionnel, offres d'emploi, messagerie privée) accessible par un onglet unique.

**Architecture:** Tables D1 `pro_*` dédiées, couche données `worker/pro-d1.ts` (testée sur SQLite en mémoire), routes `/hub/pro/*` dans `worker/pro.ts` branchées depuis `handleHubRequest`, UI React sous `client/src/features/hub/pro/`. Réutilise identité, sessions, upload de photos, garde admin et utilitaires du hub ; n'ajoute aucun `ALTER` et ne modifie aucun fichier `market*`.

**Tech Stack:** TypeScript 5.9, Cloudflare Workers + D1 (SQLite), vitest + `node:sqlite`, React 19, wouter, Tailwind, shadcn/ui, sonner, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-10-pro-network-design.md`

## Global Constraints

- Routes : `/hub/pro/*` uniquement ; **pas de `PATCH`** (CORS) ; erreurs `{error, message}` 400/401/403/404/429 ; `Cache-Control: no-store` (via `json()` du hub).
- Schéma : `worker/d1/pro.sql`, préfixe `pro_`, idempotent (`CREATE TABLE/INDEX IF NOT EXISTS`), **aucun `ALTER`** sur les tables existantes ; clés étrangères en cascade vers `hub_members`.
- Limites : post 1–2000 car., commentaire 1–500, lien ≤ 300 (`http(s)://` seulement), ≤ 4 photos (`isOwnPath`), 10 posts/h, 30 commentaires/h, 3 offres/24 h, message 1–1000, 30 messages/h, 20 nouvelles discussions/h, motif 1–300, titre d'offre 1–80, description d'offre 1–3000, contact ≤ 120, titre pro ≤ 80, entreprise ≤ 80, ville ≤ 60, compétences ≤ 8 × ≤ 30, recherche `q` ≤ 50 octets de motif `LIKE`.
- Types d'offre : `cdi, cdd, stage, freelance, benevolat`. Statuts d'offre : `open, closed, hidden`.
- Les admins **ne lisent pas** les messages privés. Aucune réponse JSON ne contient d'email.
- Tests hermétiques (`node:sqlite` en mémoire), aucun `.skip/.only` ; vérifié = `pnpm test` + `pnpm check` verts.
- Le temps est toujours passé en paramètre (`nowMs`) : le Worker fige `Date` au chargement du module.
- Français, mobile d'abord. Style : 2 espaces, guillemets doubles, point-virgule (comme `hub-d1.ts`) ; commentaires `// ponytail: …` pour les raccourcis assumés.
- Commits : message `feat(pro): …`, terminé par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Lien de post `javascript:` / `data:` / texte libre → refusé (jamais rendu en `<a>`) — testé Task 2.
2. Compétences : doublons, vides, 9 éléments, non-chaînes → normalisées ou refusées — testé Task 1.
3. Tiers qui lit ou écrit dans une discussion → **404** (existence non révélée) ; message à un membre suspendu refusé — testé Task 8.
4. Contenu d'un auteur suspendu (post, offre, discussion) invisible partout — testé Tasks 2, 5, 8.
5. Recherche `q` avec `%`, `_` et plus de 50 caractères ; offre fermée absente de la liste publique mais visible dans « mes offres » — testé Task 5.
6. « Postuler » deux fois à la même offre → même discussion ; nouvelle discussion sur une offre fermée refusée — testé Task 8.

## Précisions apportées au spec (décidées au plan)

- `pro_threads` gagne la colonne `created_by` (pour limiter les nouvelles discussions et masquer à l'autre participant une discussion encore vide).
- La liste publique des offres ne montre que `open` ; `mine=1` montre `open` et `closed`. Le détail montre `open` et `closed`.
- Le contact d'une offre est du texte brut (jamais lien cliquable).

## File Structure

| Fichier | Rôle |
|---|---|
| `worker/d1/pro.sql` (créer) | Schéma `pro_*` complet |
| `worker/test-d1.ts` (créer) | Helpers de test partagés : `fakeD1`, `openDb` |
| `worker/pro-d1.ts` (créer) | Couche données : profil, feed, offres, messagerie, signalements |
| `worker/pro-d1.test.ts` (créer) | Tests de la couche données |
| `worker/pro.ts` (créer) | Routes `/hub/pro/*` |
| `worker/pro.test.ts` (créer) | Tests des routes |
| `worker/hub.ts` (modifier) | Délègue `pro/…` à `handlePro` |
| `client/src/features/hub/pro/pro-api.ts` (créer) | Types + appels API |
| `client/src/features/hub/pro/format.ts` (créer) | `ago`, types d'offre |
| `client/src/features/hub/pro/ProLayout.tsx` (créer) | `HubShell` + barre d'onglets Feed · Emplois · Messages |
| `client/src/features/hub/pro/components/ProPostCard.tsx`, `ProComposer.tsx` (créer) | Carte de post, zone de publication |
| `client/src/features/hub/pro/pages/*.tsx` (créer) | `ProFeedPage`, `ProProfilePage`, `ProMemberPage`, `ProJobsPage`, `ProJobDetailPage`, `ProJobFormPage`, `ProInboxPage`, `ProConversationPage` |
| `client/src/features/hub/admin/ProAdmin.tsx` (créer), `AdminHub.tsx` (modifier) | Section admin « Pro » |
| `client/src/features/hub/components/HubShell.tsx` (modifier) | Entrée « Pro » (latéral + 5ᵉ onglet mobile) |
| `client/src/App.tsx` (modifier) | Routes `/pro/*` |

Commandes : tests worker `pnpm vitest run worker/<fichier>` ; types `pnpm check` ; tout `pnpm test`.

---

# JALON 1 — Profil pro + feed

### Task 1: Schéma, helpers de test, profil pro

**Files:**
- Create: `worker/d1/pro.sql`, `worker/test-d1.ts`, `worker/pro-d1.ts`, `worker/pro-d1.test.ts`
- Modify: `docs/superpowers/specs/2026-10-10-pro-network-design.md` (précisions)

**Interfaces:**
- Produces (`pro-d1.ts`): `PRO_LIMITS`, `JOB_TYPES`, `memberOk(alias: string): string`, `interface Person {id:number; display_name:string; avatar_key:string|null; headline?:string}`, `interface ProProfile {headline:string; company:string; city:string; skills:string[]; open_to_work:boolean}`, `interface ProProfileView extends ProProfile {member:Person; bio:string; mine:boolean}`, `saveProfile(d, member, input:Record<string,unknown>, nowMs): Promise<ProProfile>`, `getProfile(d, viewerId, memberId): Promise<ProProfileView>`.
- Produces (`test-d1.ts`): `fakeD1(sqlite): D1Like`, `openDb(): Sqlite`, `type Sqlite`.

- [ ] **Step 1: Écrire le schéma**

`worker/d1/pro.sql` :

```sql
-- Sous-espace Pro de l'espace bénévole. Idempotent. Prérequis : worker/d1/hub.sql.
-- Appliquer : wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/pro.sql
CREATE TABLE IF NOT EXISTS pro_profiles (
  member_id INTEGER PRIMARY KEY REFERENCES hub_members(id) ON DELETE CASCADE,
  headline TEXT NOT NULL DEFAULT '' CHECK (length(headline) <= 80),
  company TEXT NOT NULL DEFAULT '' CHECK (length(company) <= 80),
  city TEXT NOT NULL DEFAULT '' CHECK (length(city) <= 60),
  skills TEXT NOT NULL DEFAULT '[]',
  open_to_work INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pro_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  link TEXT CHECK (link IS NULL OR length(link) <= 300),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_pro_posts_status ON pro_posts(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_pro_posts_member ON pro_posts(member_id, created_at);

-- r2_key = chemin dans le bucket logique "hub" (<memberId>/<uuid>.<ext>)
CREATE TABLE IF NOT EXISTS pro_post_media (
  post_id INTEGER NOT NULL REFERENCES pro_posts(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
  PRIMARY KEY (post_id, position)
);

CREATE TABLE IF NOT EXISTS pro_likes (
  post_id INTEGER NOT NULL REFERENCES pro_posts(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, member_id)
);

CREATE TABLE IF NOT EXISTS pro_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES pro_posts(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_pro_comments_post ON pro_comments(post_id, id);
CREATE INDEX IF NOT EXISTS idx_pro_comments_member ON pro_comments(member_id, created_at);

CREATE TABLE IF NOT EXISTS pro_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  company TEXT NOT NULL CHECK (length(company) BETWEEN 1 AND 80),
  city TEXT NOT NULL DEFAULT '' CHECK (length(city) <= 60),
  type TEXT NOT NULL CHECK (type IN ('cdi','cdd','stage','freelance','benevolat')),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 3000),
  contact TEXT CHECK (contact IS NULL OR length(contact) <= 120),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_pro_jobs_status ON pro_jobs(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_pro_jobs_type ON pro_jobs(type, status, id DESC);
CREATE INDEX IF NOT EXISTS idx_pro_jobs_member ON pro_jobs(member_id, created_at);

-- member_a < member_b (paire ordonnée, interdit aussi la discussion avec soi-même) ; job_id 0 = discussion directe
CREATE TABLE IF NOT EXISTS pro_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_a INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  member_b INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL,
  UNIQUE (member_a, member_b, job_id),
  CHECK (member_a < member_b)
);
CREATE INDEX IF NOT EXISTS idx_pro_threads_a ON pro_threads(member_a, last_message_at);
CREATE INDEX IF NOT EXISTS idx_pro_threads_b ON pro_threads(member_b, last_message_at);
CREATE INDEX IF NOT EXISTS idx_pro_threads_creator ON pro_threads(created_by, created_at);

CREATE TABLE IF NOT EXISTS pro_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES pro_threads(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_pro_messages_thread ON pro_messages(thread_id, id);
CREATE INDEX IF NOT EXISTS idx_pro_messages_sender ON pro_messages(sender_id, created_at);

CREATE TABLE IF NOT EXISTS pro_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment','job')),
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 300),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (target_type, target_id, member_id)
);
```

- [ ] **Step 2: Écrire les helpers de test partagés**

`worker/test-d1.ts` :

```ts
/** Shared test helpers: an in-memory SQLite exposed as a D1Like, preloaded with the hub + pro schemas. */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
export type Sqlite = InstanceType<typeof DatabaseSync>;

export function fakeD1(sqlite: Sqlite): D1Like {
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

/** Fresh database: t_volunteers stub + hub.sql + pro.sql. */
export function openDb(): Sqlite {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE t_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, status TEXT);");
  for (const f of ["hub.sql", "pro.sql"]) sqlite.exec(readFileSync(new URL(`./d1/${f}`, import.meta.url), "utf8"));
  return sqlite;
}
```

- [ ] **Step 3: Écrire les tests du profil (échouent)**

`worker/pro-d1.test.ts` :

```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { D1Like } from "./gallery-d1";
import { fakeD1, openDb, type Sqlite } from "./test-d1";
import * as h from "./hub-d1";
import * as pro from "./pro-d1";

const T0 = Date.parse("2026-10-10T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let sqlite: Sqlite;
let d: D1Like;

async function member(email: string, first = "Amina", role?: "moderator") {
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?,'confirmed')").run(first, "Benali", email);
  const { session } = await h.openSession(d, await h.createLoginToken(d, email, T0), T0);
  if (role) sqlite.prepare("UPDATE hub_members SET role=? WHERE email=?").run(role, email);
  return (await h.getSession(d, session, T0 + 1))!;
}
const suspend = (id: number) => sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id=?").run(id);

beforeEach(() => {
  sqlite = openDb();
  d = fakeD1(sqlite);
});

describe("pro profile", () => {
  it("returns defaults, then saves and normalises", async () => {
    const a = await member("a@x.ma");
    expect(await pro.getProfile(d, a.id, a.id)).toMatchObject({ headline: "", company: "", skills: [], open_to_work: false, mine: true });
    await pro.saveProfile(d, a, { headline: " Dev ", company: "Acme", city: "Rabat", skills: ["React", " react ", "", "SQL"], open_to_work: true }, T0);
    expect(await pro.getProfile(d, a.id, a.id)).toMatchObject({ headline: "Dev", company: "Acme", city: "Rabat", skills: ["React", "SQL"], open_to_work: true });
  });

  it("saving twice updates the same row", async () => {
    const a = await member("a@x.ma");
    await pro.saveProfile(d, a, { headline: "A" }, T0);
    await pro.saveProfile(d, a, { headline: "B" }, T0 + 1);
    expect((await pro.getProfile(d, a.id, a.id)).headline).toBe("B");
    expect((sqlite.prepare("SELECT COUNT(*) AS n FROM pro_profiles").get() as { n: number }).n).toBe(1);
  });

  it("rejects invalid input", async () => {
    const a = await member("a@x.ma");
    const bad: Record<string, unknown>[] = [
      { headline: "x".repeat(81) }, { company: "x".repeat(81) }, { city: "x".repeat(61) },
      { skills: Array.from({ length: 9 }, (_, i) => `s${i}`) }, { skills: ["x".repeat(31)] }, { skills: "react" }, { skills: [1] }, { company: 5 },
    ];
    for (const b of bad) await expect(pro.saveProfile(d, a, b, T0)).rejects.toMatchObject({ code: "invalid" });
  });

  it("is visible to other members; suspended or unknown members are not found", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    await pro.saveProfile(d, a, { headline: "Dev" }, T0);
    expect(await pro.getProfile(d, b.id, a.id)).toMatchObject({ headline: "Dev", mine: false, member: { id: a.id } });
    suspend(a.id);
    await expect(pro.getProfile(d, b.id, a.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(pro.getProfile(d, b.id, 9999)).rejects.toMatchObject({ code: "not_found" });
  });
});
```

(`DAY` est utilisé dans les tests des tâches suivantes ; laissez-le déclaré.)

- [ ] **Step 4: Lancer les tests, vérifier l'échec**

Run: `pnpm vitest run worker/pro-d1.test.ts`
Expected: FAIL — `Failed to resolve import "./pro-d1"`.

- [ ] **Step 5: Implémenter le profil**

`worker/pro-d1.ts` :

```ts
/**
 * Professional network data layer on Cloudflare D1 (tables pro_*). Reuses hub members/sessions.
 * No HTTP / Supabase imports: testable with a fake D1. Time is always passed in (nowMs).
 */
import type { D1Like } from "./gallery-d1";
import { HOUR_MS, HubError, cleanBody, iso, isOwnPath, type MemberRow } from "./hub-d1";

export const JOB_TYPES = ["cdi", "cdd", "stage", "freelance", "benevolat"] as const;
export const PRO_LIMITS = {
  postsPerHour: 10, commentsPerHour: 30, jobsPerDay: 3, messagesPerHour: 30, threadsPerHour: 20,
  post: 2000, comment: 500, link: 300, media: 4, headline: 80, company: 80, city: 60, skills: 8, skill: 30,
  jobTitle: 80, jobDescription: 3000, contact: 120, message: 1000, reason: 300, likePatternBytes: 50,
};
const DAY_MS = 24 * HOUR_MS;

/** A member whose hub account is suspended, or whose volunteer is no longer confirmed/present, vanishes. a = hub_members alias. */
export const memberOk = (a: string) =>
  `${a}.status = 'active' AND EXISTS (SELECT 1 FROM t_volunteers v WHERE lower(v.email) = ${a}.email AND v.status IN ('confirmed','present'))`;
const AUTHOR_OK = memberOk("m");

export interface Person { id: number; display_name: string; avatar_key: string | null; headline?: string }

type Counted = "pro_posts" | "pro_comments" | "pro_jobs" | "pro_messages" | "pro_threads";
async function recent(d: D1Like, table: Counted, col: "member_id" | "sender_id" | "created_by", id: number, sinceMs: number): Promise<number> {
  const r = await d.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ? AND created_at > ?`).bind(id, iso(sinceMs)).first<{ n: number }>();
  return r?.n ?? 0;
}

// ---- profile ----------------------------------------------------------------

export interface ProProfile { headline: string; company: string; city: string; skills: string[]; open_to_work: boolean }
export interface ProProfileView extends ProProfile { member: Person; bio: string; mine: boolean }

function text(v: unknown, max: number, label: string): string {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new HubError("invalid", `${label} invalide`);
  const s = v.trim();
  if (s.length > max) throw new HubError("invalid", `${label} trop long (${max} caractères max)`);
  return s;
}

function cleanSkills(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || !raw.every(s => typeof s === "string")) throw new HubError("invalid", "Compétences invalides");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw.map(x => x.trim()).filter(Boolean)) {
    if (s.length > PRO_LIMITS.skill) throw new HubError("invalid", "Compétence trop longue (30 caractères max)");
    if (!seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
  }
  if (out.length > PRO_LIMITS.skills) throw new HubError("invalid", "8 compétences maximum");
  return out;
}

function parseSkills(raw: unknown): string[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch { return []; }
}

/** Full replacement (PUT semantics): omitted fields become empty. */
export async function saveProfile(d: D1Like, member: MemberRow, input: Record<string, unknown>, nowMs: number): Promise<ProProfile> {
  const p: ProProfile = {
    headline: text(input.headline, PRO_LIMITS.headline, "Titre"),
    company: text(input.company, PRO_LIMITS.company, "Entreprise"),
    city: text(input.city, PRO_LIMITS.city, "Ville"),
    skills: cleanSkills(input.skills),
    open_to_work: input.open_to_work === true,
  };
  await d.prepare(
    `INSERT INTO pro_profiles (member_id, headline, company, city, skills, open_to_work, updated_at) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(member_id) DO UPDATE SET headline = excluded.headline, company = excluded.company, city = excluded.city,
       skills = excluded.skills, open_to_work = excluded.open_to_work, updated_at = excluded.updated_at`,
  ).bind(member.id, p.headline, p.company, p.city, JSON.stringify(p.skills), p.open_to_work ? 1 : 0, iso(nowMs)).run();
  return p;
}

export async function getProfile(d: D1Like, viewerId: number, memberId: number): Promise<ProProfileView> {
  const r = await d.prepare(
    `SELECT m.id, m.display_name, m.avatar_key, m.bio, p.headline, p.company, p.city, p.skills, p.open_to_work
     FROM hub_members m LEFT JOIN pro_profiles p ON p.member_id = m.id WHERE m.id = ? AND ${AUTHOR_OK}`,
  ).bind(memberId).first<any>();
  if (!r) throw new HubError("not_found", "Membre introuvable");
  return {
    member: { id: r.id, display_name: r.display_name, avatar_key: r.avatar_key, headline: r.headline ?? "" },
    bio: r.bio, headline: r.headline ?? "", company: r.company ?? "", city: r.city ?? "",
    skills: parseSkills(r.skills), open_to_work: Boolean(r.open_to_work), mine: r.id === viewerId,
  };
}
```

(`recent`, `DAY_MS`, `cleanBody`, `isOwnPath`, `PRO_LIMITS.*` sont utilisés par les tâches suivantes ; si `pnpm check` signale des imports inutilisés, ignorez-les jusqu'à la Task 2.)

- [ ] **Step 6: Lancer les tests, vérifier le succès**

Run: `pnpm vitest run worker/pro-d1.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Consigner les précisions dans le spec**

Ajouter à la fin de `docs/superpowers/specs/2026-10-10-pro-network-design.md` :

```markdown

## Précisions décidées au plan (2026-10-10)

- `pro_threads` gagne `created_by` (limite de nouvelles discussions ; discussion encore vide invisible pour l'autre participant).
- Liste publique des offres : `open` seulement ; `mine=1` : `open` + `closed` ; détail : `open` + `closed`.
- Le contact d'une offre est du texte brut, jamais un lien cliquable.
```

- [ ] **Step 8: Commit**

```bash
git add worker/d1/pro.sql worker/test-d1.ts worker/pro-d1.ts worker/pro-d1.test.ts docs/superpowers/specs/2026-10-10-pro-network-design.md
git commit -m "feat(pro): schema, test helpers and professional profile data layer

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Feed, likes, commentaires, signalements (données)

**Files:**
- Modify: `worker/pro-d1.ts` (ajouter à la fin), `worker/pro-d1.test.ts` (ajouter à la fin)

**Interfaces:**
- Consumes: `recent`, `AUTHOR_OK`, `PRO_LIMITS`, `Person` (Task 1).
- Produces: `cleanLink(raw: unknown): string | null`, `PostView`, `createPost(d, member, {body, link?, mediaPaths?}, nowMs): Promise<{id}>`, `feed(d, viewerId, cursor?, limit?): Promise<{posts: PostView[]; nextCursor: number|null}>`, `toggleLike(d, memberId, postId): Promise<{liked; count}>`, `addComment(d, member, postId, body, nowMs)`, `listComments(d, postId): Promise<CommentView[]>`, `removeContent(d, actor, "post"|"comment", id)`, `type TargetType = "post"|"comment"|"job"`, `reportContent(d, member, type, id, reason)`, `listReports(d): Promise<ReportView[]>`, `dismissReport(d, id)`, `hideContent(d, type, id)`.

- [ ] **Step 1: Écrire les tests (échouent)**

Ajouter à `worker/pro-d1.test.ts` :

```ts
const post = (over: Partial<Parameters<typeof pro.createPost>[2]> = {}) => ({ body: "Bonjour le réseau", ...over });

describe("pro link", () => {
  it("accepts http(s) and rejects everything else", () => {
    expect(pro.cleanLink(undefined)).toBeNull();
    expect(pro.cleanLink("")).toBeNull();
    expect(pro.cleanLink(" https://example.com/a ")).toBe("https://example.com/a");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x.ma", "pas un lien", 42, `https://x.ma/${"a".repeat(300)}`])
      expect(() => pro.cleanLink(bad)).toThrow(h.HubError);
  });
});

describe("pro feed", () => {
  it("creates posts and lists newest first with counters", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    await pro.saveProfile(d, a, { headline: "Dev" }, T0);
    const p1 = await pro.createPost(d, a, post({ body: "premier" }), T0);
    const p2 = await pro.createPost(d, a, post({ body: "second", link: "https://example.com" }), T0 + 1);
    await pro.toggleLike(d, b.id, p2.id);
    await pro.addComment(d, b, p2.id, "bravo", T0 + 2);
    const f = await pro.feed(d, b.id);
    expect(f.posts.map(p => p.id)).toEqual([p2.id, p1.id]);
    expect(f.posts[0]).toMatchObject({ link: "https://example.com/", like_count: 1, comment_count: 1, liked: true, author: { id: a.id, headline: "Dev" } });
    expect(f.posts[1]).toMatchObject({ liked: false, like_count: 0 });
    expect(f.nextCursor).toBeNull();
  });

  it("paginates with a numeric cursor", async () => {
    const a = await member("a@x.ma");
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) ids.push((await pro.createPost(d, a, post({ body: `p${i}` }), T0 + i)).id);
    const first = await pro.feed(d, a.id, null, 2);
    expect(first.posts.map(p => p.id)).toEqual([ids[2], ids[1]]);
    expect(first.nextCursor).toBe(ids[1]);
    const second = await pro.feed(d, a.id, first.nextCursor, 2);
    expect(second.posts.map(p => p.id)).toEqual([ids[0]]);
    expect(second.nextCursor).toBeNull();
  });

  it("validates body and photos", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    for (const body of ["", "   ", "x".repeat(2001)]) await expect(pro.createPost(d, a, post({ body }), T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.createPost(d, a, post({ mediaPaths: Array.from({ length: 5 }, (_, i) => `${a.id}/${i}.jpg`) }), T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.createPost(d, a, post({ mediaPaths: [`${b.id}/x.jpg`] }), T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.createPost(d, a, post({ mediaPaths: [`${a.id}/../x.jpg`] }), T0)).rejects.toMatchObject({ code: "invalid" });
    const ok = await pro.createPost(d, a, post({ mediaPaths: [`${a.id}/a.jpg`, `${a.id}/b.png`] }), T0);
    expect((await pro.feed(d, a.id)).posts.find(p => p.id === ok.id)!.media).toEqual([`${a.id}/a.jpg`, `${a.id}/b.png`]);
  });

  it("limits posts to 10 per hour", async () => {
    const a = await member("a@x.ma");
    for (let i = 0; i < 10; i++) await pro.createPost(d, a, post(), T0);
    await expect(pro.createPost(d, a, post(), T0)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(pro.createPost(d, a, post(), T0 + HOUR + 1)).resolves.toBeDefined();
  });

  it("hides posts of suspended authors", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const p = await pro.createPost(d, a, post(), T0);
    suspend(a.id);
    expect((await pro.feed(d, b.id)).posts).toEqual([]);
    await expect(pro.toggleLike(d, b.id, p.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("pro likes and comments", () => {
  it("toggles likes", async () => {
    const a = await member("a@x.ma");
    const p = await pro.createPost(d, a, post(), T0);
    expect(await pro.toggleLike(d, a.id, p.id)).toEqual({ liked: true, count: 1 });
    expect(await pro.toggleLike(d, a.id, p.id)).toEqual({ liked: false, count: 0 });
  });

  it("adds, lists and removes comments (author or moderator only)", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const mod = await member("m@x.ma", "Sara", "moderator");
    const p = await pro.createPost(d, a, post(), T0);
    const c = await pro.addComment(d, b, p.id, "  super  ", T0);
    expect((await pro.listComments(d, p.id)).map(x => x.body)).toEqual(["super"]);
    await expect(pro.addComment(d, b, p.id, "", T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.removeContent(d, a, "comment", c.id)).rejects.toMatchObject({ code: "forbidden" });
    await pro.removeContent(d, mod, "comment", c.id);
    expect(await pro.listComments(d, p.id)).toEqual([]);
  });

  it("limits comments to 30 per hour", async () => {
    const a = await member("a@x.ma");
    const p = await pro.createPost(d, a, post(), T0);
    for (let i = 0; i < 30; i++) await pro.addComment(d, a, p.id, "c", T0);
    await expect(pro.addComment(d, a, p.id, "c", T0)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("removes a post: owner or moderator, not others", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const p = await pro.createPost(d, a, post(), T0);
    await expect(pro.removeContent(d, b, "post", p.id)).rejects.toMatchObject({ code: "forbidden" });
    await pro.removeContent(d, a, "post", p.id);
    expect((await pro.feed(d, a.id)).posts).toEqual([]);
    await expect(pro.removeContent(d, a, "post", p.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("pro reports", () => {
  it("reports, lists, dismisses and hides", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const p = await pro.createPost(d, a, post({ body: "contenu litigieux" }), T0);
    await pro.reportContent(d, b, "post", p.id, "spam");
    await pro.reportContent(d, b, "post", p.id, "spam encore"); // same reporter + target: ignored
    const reports = await pro.listReports(d);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ target_type: "post", target_id: p.id, reason: "spam", reporter: b.display_name, body: "contenu litigieux", target_status: "visible" });
    await pro.hideContent(d, "post", p.id);
    expect((await pro.listReports(d))[0].target_status).toBe("hidden");
    expect((await pro.feed(d, b.id)).posts).toEqual([]);
    await pro.dismissReport(d, reports[0].id);
    expect(await pro.listReports(d)).toEqual([]);
  });

  it("rejects unknown types, empty reasons and missing targets", async () => {
    const a = await member("a@x.ma");
    await expect(pro.reportContent(d, a, "member" as any, 1, "x")).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.reportContent(d, a, "post", 999, "x")).rejects.toMatchObject({ code: "not_found" });
    const p = await pro.createPost(d, a, post(), T0);
    await expect(pro.reportContent(d, a, "post", p.id, "  ")).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.hideContent(d, "post", 999)).rejects.toMatchObject({ code: "not_found" });
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm vitest run worker/pro-d1.test.ts`
Expected: FAIL — `pro.cleanLink is not a function` / `pro.createPost is not a function`.

- [ ] **Step 3: Implémenter**

Ajouter à la fin de `worker/pro-d1.ts` :

```ts
// ---- feed -------------------------------------------------------------------

export interface PostView {
  id: number; body: string; link: string | null; created_at: string;
  author: Person & { headline: string };
  like_count: number; comment_count: number; liked: boolean; media: string[];
}
export interface CommentView { id: number; post_id: number; body: string; created_at: string; author: Person }

/** Only http(s) links are kept (never javascript:, data:, …); returns the normalised URL. */
export function cleanLink(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") throw new HubError("invalid", "Lien invalide");
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new HubError("invalid", "Lien invalide"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new HubError("invalid", "Lien invalide (http ou https)");
  if (u.href.length > PRO_LIMITS.link) throw new HubError("invalid", "Lien trop long (300 caractères max)");
  return u.href;
}

export async function createPost(d: D1Like, member: MemberRow, input: { body: string; link?: unknown; mediaPaths?: string[] }, nowMs: number): Promise<{ id: number }> {
  const body = cleanBody(input.body, PRO_LIMITS.post, "Message");
  const link = cleanLink(input.link);
  const media = input.mediaPaths ?? [];
  if (media.length > PRO_LIMITS.media || !media.every(p => isOwnPath(member.id, p))) throw new HubError("invalid", "Photos invalides (4 max)");
  if ((await recent(d, "pro_posts", "member_id", member.id, nowMs - HOUR_MS)) >= PRO_LIMITS.postsPerHour) throw new HubError("rate_limited", "Trop de publications, réessayez plus tard");
  // ponytail: post then media are two statements (not atomic); a failed media insert leaves a text-only post
  const row = await d.prepare("INSERT INTO pro_posts (member_id, body, link, created_at) VALUES (?,?,?,?) RETURNING id").bind(member.id, body, link, iso(nowMs)).first<{ id: number }>();
  if (media.length) await d.batch(media.map((p, i) => d.prepare("INSERT INTO pro_post_media (post_id, r2_key, position) VALUES (?,?,?)").bind(row!.id, p, i)));
  return { id: row!.id };
}

export async function feed(d: D1Like, viewerId: number, cursor: number | null = null, limit = 20): Promise<{ posts: PostView[]; nextCursor: number | null }> {
  const lim = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
  const { results } = await d.prepare(
    `SELECT p.id, p.body, p.link, p.created_at, m.id AS author_id, m.display_name AS author_name, m.avatar_key AS author_avatar, COALESCE(pp.headline, '') AS author_headline,
       (SELECT COUNT(*) FROM pro_likes l WHERE l.post_id = p.id) AS like_count,
       (SELECT COUNT(*) FROM pro_comments c WHERE c.post_id = p.id AND c.status = 'visible') AS comment_count,
       EXISTS(SELECT 1 FROM pro_likes l WHERE l.post_id = p.id AND l.member_id = ?) AS liked
     FROM pro_posts p JOIN hub_members m ON m.id = p.member_id LEFT JOIN pro_profiles pp ON pp.member_id = m.id
     WHERE p.status = 'visible' AND ${AUTHOR_OK} AND (? IS NULL OR p.id < ?)
     ORDER BY p.id DESC LIMIT ?`,
  ).bind(viewerId, cursor, cursor, lim + 1).all<any>();
  const posts: PostView[] = results.slice(0, lim).map(r => ({
    id: r.id, body: r.body, link: r.link, created_at: r.created_at,
    author: { id: r.author_id, display_name: r.author_name, avatar_key: r.author_avatar, headline: r.author_headline },
    like_count: r.like_count, comment_count: r.comment_count, liked: Boolean(r.liked), media: [],
  }));
  if (posts.length) {
    const ids = posts.map(p => p.id);
    const m = await d.prepare(`SELECT post_id, r2_key FROM pro_post_media WHERE post_id IN (${ids.map(() => "?").join(",")}) ORDER BY post_id, position`).bind(...ids).all<{ post_id: number; r2_key: string }>();
    for (const row of m.results) posts.find(p => p.id === row.post_id)!.media.push(row.r2_key);
  }
  return { posts, nextCursor: results.length > lim ? posts[posts.length - 1].id : null };
}

async function visiblePost(d: D1Like, postId: number): Promise<void> {
  const r = await d.prepare(`SELECT 1 AS ok FROM pro_posts p JOIN hub_members m ON m.id = p.member_id WHERE p.id = ? AND p.status = 'visible' AND ${AUTHOR_OK}`).bind(postId).first();
  if (!r) throw new HubError("not_found", "Publication introuvable");
}

export async function toggleLike(d: D1Like, memberId: number, postId: number): Promise<{ liked: boolean; count: number }> {
  await visiblePost(d, postId);
  const removed = await d.prepare("DELETE FROM pro_likes WHERE post_id = ? AND member_id = ? RETURNING 1 AS x").bind(postId, memberId).first();
  if (!removed) await d.prepare("INSERT OR IGNORE INTO pro_likes (post_id, member_id) VALUES (?,?)").bind(postId, memberId).run();
  const c = await d.prepare("SELECT COUNT(*) AS n FROM pro_likes WHERE post_id = ?").bind(postId).first<{ n: number }>();
  return { liked: !removed, count: c?.n ?? 0 };
}

export async function addComment(d: D1Like, member: MemberRow, postId: number, rawBody: string, nowMs: number): Promise<{ id: number }> {
  const body = cleanBody(rawBody, PRO_LIMITS.comment, "Commentaire");
  await visiblePost(d, postId);
  if ((await recent(d, "pro_comments", "member_id", member.id, nowMs - HOUR_MS)) >= PRO_LIMITS.commentsPerHour) throw new HubError("rate_limited", "Trop de commentaires, réessayez plus tard");
  const row = await d.prepare("INSERT INTO pro_comments (post_id, member_id, body, created_at) VALUES (?,?,?,?) RETURNING id").bind(postId, member.id, body, iso(nowMs)).first<{ id: number }>();
  return { id: row!.id };
}

export async function listComments(d: D1Like, postId: number): Promise<CommentView[]> {
  await visiblePost(d, postId);
  // ponytail: comment_count in the feed counts every visible comment, including ones by suspended authors that are filtered out here
  const { results } = await d.prepare(
    `SELECT c.id, c.post_id, c.body, c.created_at, m.id AS author_id, m.display_name AS author_name, m.avatar_key AS author_avatar
     FROM pro_comments c JOIN hub_members m ON m.id = c.member_id WHERE c.post_id = ? AND c.status = 'visible' AND ${AUTHOR_OK} ORDER BY c.id ASC LIMIT 200`,
  ).bind(postId).all<any>();
  return results.map(r => ({ id: r.id, post_id: r.post_id, body: r.body, created_at: r.created_at, author: { id: r.author_id, display_name: r.author_name, avatar_key: r.author_avatar } }));
}

/** Soft delete (status = hidden). Owner or moderator. Jobs are handled by hideJob. */
export async function removeContent(d: D1Like, actor: MemberRow, type: "post" | "comment", id: number): Promise<void> {
  const t = type === "post" ? "pro_posts" : type === "comment" ? "pro_comments" : null;
  if (!t) throw new HubError("invalid", "Type invalide");
  const row = await d.prepare(`SELECT member_id FROM ${t} WHERE id = ? AND status = 'visible'`).bind(id).first<{ member_id: number }>();
  if (!row) throw new HubError("not_found", "Contenu introuvable");
  if (row.member_id !== actor.id && actor.role !== "moderator") throw new HubError("forbidden", "Action non autorisée");
  await d.prepare(`UPDATE ${t} SET status = 'hidden' WHERE id = ?`).bind(id).run();
}

// ---- reports / admin --------------------------------------------------------

export type TargetType = "post" | "comment" | "job";
const TARGET = { post: "pro_posts", comment: "pro_comments", job: "pro_jobs" } as const;
const VISIBLE = { post: "status = 'visible'", comment: "status = 'visible'", job: "status IN ('open','closed')" } as const;
function target(type: string): TargetType {
  if (!Object.hasOwn(TARGET, type)) throw new HubError("invalid", "Type invalide");
  return type as TargetType;
}

export interface ReportView { id: number; target_type: TargetType; target_id: number; reason: string; created_at: string; reporter: string; body: string | null; target_status: string | null }

export async function reportContent(d: D1Like, member: MemberRow, rawType: string, id: number, rawReason: string): Promise<void> {
  const type = target(rawType);
  const reason = cleanBody(rawReason, PRO_LIMITS.reason, "Motif");
  if (!(await d.prepare(`SELECT 1 AS ok FROM ${TARGET[type]} WHERE id = ? AND ${VISIBLE[type]}`).bind(id).first())) throw new HubError("not_found", "Contenu introuvable");
  await d.prepare("INSERT OR IGNORE INTO pro_reports (target_type, target_id, member_id, reason) VALUES (?,?,?,?)").bind(type, id, member.id, reason).run();
}

export async function listReports(d: D1Like): Promise<ReportView[]> {
  const { results } = await d.prepare(
    `SELECT r.id, r.target_type, r.target_id, r.reason, r.created_at, m.display_name AS reporter,
       CASE r.target_type WHEN 'post' THEN (SELECT body FROM pro_posts WHERE id = r.target_id)
         WHEN 'comment' THEN (SELECT body FROM pro_comments WHERE id = r.target_id)
         ELSE (SELECT title FROM pro_jobs WHERE id = r.target_id) END AS body,
       CASE r.target_type WHEN 'post' THEN (SELECT status FROM pro_posts WHERE id = r.target_id)
         WHEN 'comment' THEN (SELECT status FROM pro_comments WHERE id = r.target_id)
         ELSE (SELECT status FROM pro_jobs WHERE id = r.target_id) END AS target_status
     FROM pro_reports r JOIN hub_members m ON m.id = r.member_id ORDER BY r.id DESC LIMIT 100`,
  ).all<ReportView>();
  return results;
}

export async function dismissReport(d: D1Like, id: number): Promise<void> {
  await d.prepare("DELETE FROM pro_reports WHERE id = ?").bind(id).run();
}

/** Admin hide (caller already authorised): no ownership check. */
export async function hideContent(d: D1Like, rawType: string, id: number): Promise<void> {
  const t = TARGET[target(rawType)];
  if (!(await d.prepare(`SELECT 1 AS ok FROM ${t} WHERE id = ?`).bind(id).first())) throw new HubError("not_found", "Contenu introuvable");
  await d.prepare(`UPDATE ${t} SET status = 'hidden' WHERE id = ?`).bind(id).run();
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `pnpm vitest run worker/pro-d1.test.ts`
Expected: PASS (tous les tests de Tasks 1–2).

- [ ] **Step 5: Commit**

```bash
git add worker/pro-d1.ts worker/pro-d1.test.ts
git commit -m "feat(pro): feed, likes, comments and reports data layer

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Routes Worker (profil, feed, signalements, admin) + montage dans le hub

**Files:**
- Create: `worker/pro.ts`, `worker/pro.test.ts`
- Modify: `worker/hub.ts` (import + bloc de délégation avant le `return json({ error: "not_found" … 404 })`)

**Interfaces:**
- Consumes: tout `pro-d1` des Tasks 1–2 ; `id`, `readJson`, `str` de `hub-http` ; contexte du hub (`d`, `request`, `url`, `now`, `json`, `member`, `admin`, `sign`).
- Produces: `handlePro(c: ProCtx): Promise<Response | null>` ; routes (chemin après `/hub/pro/`) : `GET profile/:id`, `PUT profile`, `GET feed?cursor=`, `POST posts`, `DELETE posts/:id`, `POST posts/:id/like`, `GET|POST posts/:id/comments`, `DELETE comments/:id`, `POST report`, `GET admin/reports`, `POST admin/reports/:id/dismiss`, `POST admin/hide`. Formes JSON : `{profile}`, `{posts, nextCursor}` (auteur `{id, display_name, avatar, headline}`, `media` = URLs signées), `{comments}`.

- [ ] **Step 1: Écrire les tests (échouent)**

`worker/pro.test.ts` :

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { fakeD1, openDb, type Sqlite } from "./test-d1";
import { handleHubRequest, type HubDeps, type HubEnv } from "./hub";

const CORS = { "Access-Control-Allow-Origin": "https://www.ftourbabrayan.ma" };
const T0 = Date.parse("2026-10-10T12:00:00.000Z");
let sqlite: Sqlite;
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
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?,'confirmed')").run(first, "Benali", email);
  await call("POST", "/hub/login", { body: { email } });
  const token = /token=([a-f0-9]{64})/.exec(mails[mails.length - 1])![1];
  const v = (await (await call("POST", "/hub/verify", { body: { token } })).json()) as { session: string; member: { id: number } };
  return { session: v.session, id: v.member.id };
}

beforeEach(() => {
  sqlite = openDb();
  env = { DB: fakeD1(sqlite), JWT_SECRET: "test-secret", MEDIA_BASE_URL: "https://m.test", GALLERY_MEDIA: undefined, PUBLIC_APP_URL: "https://site.test" };
  mails = [];
  clock = T0;
});

describe("pro http: auth", () => {
  it("requires a member session", async () => {
    for (const [m, p] of [["GET", "/hub/pro/feed"], ["POST", "/hub/pro/posts"], ["GET", "/hub/pro/profile/1"], ["PUT", "/hub/pro/profile"], ["POST", "/hub/pro/report"]])
      expect((await call(m, p)).status).toBe(401);
  });
  it("admin routes: 403 without role or in demo mode, 200 for an admin", async () => {
    expect((await call("GET", "/hub/pro/admin/reports")).status).toBe(403);
    expect((await call("GET", "/hub/pro/admin/reports", { admin: "demo" })).status).toBe(403);
    expect((await call("GET", "/hub/pro/admin/reports", { admin: "admin" })).status).toBe(200);
  });
  it("unknown pro route is 404", async () => {
    const a = await signIn("a@x.ma");
    expect((await call("GET", "/hub/pro/nope", { token: a.session })).status).toBe(404);
  });
});

describe("pro http: profile and feed", () => {
  it("saves and reads a profile", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    const put = await call("PUT", "/hub/pro/profile", { token: a.session, body: { headline: "Dev", skills: ["React"], open_to_work: true } });
    expect(put.status).toBe(200);
    const got = (await (await call("GET", `/hub/pro/profile/${a.id}`, { token: b.session })).json()) as any;
    expect(got.profile).toMatchObject({ headline: "Dev", skills: ["React"], open_to_work: true, mine: false, member: { id: a.id } });
    expect(JSON.stringify(got)).not.toContain("@");
    expect((await call("GET", "/hub/pro/profile/999", { token: b.session })).status).toBe(404);
    expect((await call("GET", "/hub/pro/profile/abc", { token: b.session })).status).toBe(404); // not matched by the route
  });

  it("posts, likes, comments and reads the feed", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    const created = await call("POST", "/hub/pro/posts", { token: a.session, body: { body: "Salut", link: "https://example.com" } });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: number };
    expect((await (await call("POST", `/hub/pro/posts/${id}/like`, { token: b.session })).json())).toEqual({ liked: true, count: 1 });
    expect((await call("POST", `/hub/pro/posts/${id}/comments`, { token: b.session, body: { body: "bravo" } })).status).toBe(200);
    const feed = (await (await call("GET", "/hub/pro/feed", { token: b.session })).json()) as any;
    expect(feed.posts[0]).toMatchObject({ id, body: "Salut", link: "https://example.com/", like_count: 1, comment_count: 1, liked: true, author: { id: a.id } });
    expect(JSON.stringify(feed)).not.toContain("@");
    const comments = (await (await call("GET", `/hub/pro/posts/${id}/comments`, { token: b.session })).json()) as any;
    expect(comments.comments).toHaveLength(1);
  });

  it("rejects dangerous links, bad JSON and foreign deletes", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    expect((await call("POST", "/hub/pro/posts", { token: a.session, body: { body: "x", link: "javascript:alert(1)" } })).status).toBe(400);
    const res = await handleHubRequest(new Request("https://w.test/hub/pro/posts", { method: "POST", headers: { authorization: `Bearer ${a.session}` }, body: "{oops" }), env, CORS, deps());
    expect(res!.status).toBe(400);
    const { id } = (await (await call("POST", "/hub/pro/posts", { token: a.session, body: { body: "mien" } })).json()) as { id: number };
    expect((await call("DELETE", `/hub/pro/posts/${id}`, { token: b.session })).status).toBe(403);
    expect((await call("DELETE", `/hub/pro/posts/${id}`, { token: a.session })).status).toBe(200);
  });

  it("report then admin hide removes the post from the feed", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    const { id } = (await (await call("POST", "/hub/pro/posts", { token: a.session, body: { body: "spam" } })).json()) as { id: number };
    expect((await call("POST", "/hub/pro/report", { token: b.session, body: { type: "post", id, reason: "spam" } })).status).toBe(200);
    expect((await call("POST", "/hub/pro/report", { token: b.session, body: { type: "member", id, reason: "x" } })).status).toBe(400);
    const reports = (await (await call("GET", "/hub/pro/admin/reports", { admin: "admin" })).json()) as any;
    expect(reports.reports).toHaveLength(1);
    expect((await call("POST", "/hub/pro/admin/hide", { admin: "admin", body: { type: "post", id } })).status).toBe(200);
    expect(((await (await call("GET", "/hub/pro/feed", { token: b.session })).json()) as any).posts).toEqual([]);
    expect((await call("POST", `/hub/pro/admin/reports/${reports.reports[0].id}/dismiss`, { admin: "admin" })).status).toBe(200);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm vitest run worker/pro.test.ts`
Expected: FAIL — les routes `pro/*` renvoient 404 (« Route inconnue ») là où 401/200 sont attendus.

- [ ] **Step 3: Implémenter les routes**

`worker/pro.ts` :

```ts
/** REST routes of the professional network, called from handleHubRequest for any /hub/pro/* path. */
import type { D1Like } from "./gallery-d1";
import * as H from "./hub-d1";
import * as P from "./pro-d1";
import { id, readJson, str } from "./hub-http";

export interface ProCtx {
  d: D1Like;
  request: Request;
  url: URL;
  path: string; // after "pro/"
  now: () => number;
  json: (data: unknown, status?: number) => Response;
  member: () => Promise<H.MemberRow>;
  admin: () => Promise<void>;
  sign: (p: string | null) => Promise<string | null>;
}

const cursorOf = (url: URL) => {
  const c = url.searchParams.get("cursor");
  return c && /^\d+$/.test(c) ? Number(c) : null;
};

export async function handlePro(c: ProCtx): Promise<Response | null> {
  const { d, request, url, path, now, json, member, admin, sign } = c;
  const match = (method: string, re: RegExp) => (request.method === method ? re.exec(path) : null);
  const who = async (p: P.Person) => ({
    id: p.id, display_name: p.display_name, avatar: await sign(p.avatar_key),
    ...(p.headline !== undefined ? { headline: p.headline } : {}),
  });
  let m: RegExpExecArray | null;

  // ---- profile -----------------------------------------------------------
  if ((m = match("GET", /^profile\/(\d+)$/))) {
    const me = await member();
    const { member: person, ...rest } = await P.getProfile(d, me.id, id(m[1]));
    return json({ profile: { ...rest, member: await who(person) } });
  }
  if (match("PUT", /^profile$/)) {
    const me = await member();
    return json({ profile: await P.saveProfile(d, me, await readJson(request), now()) });
  }

  // ---- feed --------------------------------------------------------------
  if (match("GET", /^feed$/)) {
    const me = await member();
    const f = await P.feed(d, me.id, cursorOf(url));
    const posts = await Promise.all(f.posts.map(async p => ({ ...p, media: await Promise.all(p.media.map(sign)), author: await who(p.author) })));
    return json({ posts, nextCursor: f.nextCursor });
  }
  if (match("POST", /^posts$/)) {
    const me = await member();
    const b = await readJson(request);
    const media = Array.isArray(b.media) ? b.media.filter((x): x is string => typeof x === "string") : [];
    return json(await P.createPost(d, me, { body: str(b.body), link: b.link, mediaPaths: media }, now()));
  }
  if ((m = match("DELETE", /^posts\/(\d+)$/))) {
    await P.removeContent(d, await member(), "post", id(m[1]));
    return json({ ok: true });
  }
  if ((m = match("POST", /^posts\/(\d+)\/like$/))) {
    const me = await member();
    return json(await P.toggleLike(d, me.id, id(m[1])));
  }
  if ((m = match("GET", /^posts\/(\d+)\/comments$/))) {
    await member();
    const comments = await P.listComments(d, id(m[1]));
    return json({ comments: await Promise.all(comments.map(async x => ({ ...x, author: await who(x.author) }))) });
  }
  if ((m = match("POST", /^posts\/(\d+)\/comments$/))) {
    const me = await member();
    return json(await P.addComment(d, me, id(m[1]), str((await readJson(request)).body), now()));
  }
  if ((m = match("DELETE", /^comments\/(\d+)$/))) {
    await P.removeContent(d, await member(), "comment", id(m[1]));
    return json({ ok: true });
  }

  // ---- report / admin ----------------------------------------------------
  if (match("POST", /^report$/)) {
    const me = await member();
    const b = await readJson(request);
    await P.reportContent(d, me, str(b.type), id(b.id), str(b.reason));
    return json({ ok: true });
  }
  if (match("GET", /^admin\/reports$/)) { await admin(); return json({ reports: await P.listReports(d) }); }
  if ((m = match("POST", /^admin\/reports\/(\d+)\/dismiss$/))) { await admin(); await P.dismissReport(d, id(m[1])); return json({ ok: true }); }
  if (match("POST", /^admin\/hide$/)) {
    await admin();
    const b = await readJson(request);
    await P.hideContent(d, str(b.type), id(b.id));
    return json({ ok: true });
  }

  return null;
}
```

- [ ] **Step 4: Brancher dans le hub**

Dans `worker/hub.ts` : ajouter après `import { handleMarketRoute } from "./market";` :

```ts
import { handlePro } from "./pro";
```

et, juste après le bloc `// ---- marketplace ---…` (avant `return json({ error: "not_found", message: "Route inconnue" }, 404);`) :

```ts
    // ---- professional network ----------------------------------------------
    if (path.startsWith("pro/")) {
      const r = await handlePro({ d, request, url, path: path.slice("pro/".length), now, json, member, admin, sign });
      if (r) return r;
    }
```

- [ ] **Step 5: Lancer, vérifier le succès**

Run: `pnpm vitest run worker/pro.test.ts worker/pro-d1.test.ts worker/hub.test.ts worker/hub-d1.test.ts`
Expected: PASS partout (les tests hub existants restent verts).

- [ ] **Step 6: Commit**

```bash
git add worker/pro.ts worker/pro.test.ts worker/hub.ts
git commit -m "feat(pro): profile, feed, report and admin routes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Client — onglet Pro, feed, profil, admin

**Files:**
- Create: `client/src/features/hub/pro/pro-api.ts`, `format.ts`, `ProLayout.tsx`, `components/ProComposer.tsx`, `components/ProPostCard.tsx`, `pages/ProFeedPage.tsx`, `pages/ProProfilePage.tsx`, `pages/ProMemberPage.tsx`, `client/src/features/hub/admin/ProAdmin.tsx`
- Modify: `client/src/features/hub/components/HubShell.tsx`, `client/src/features/hub/admin/AdminHub.tsx`, `client/src/App.tsx`

**Interfaces:**
- Consumes: `call` de `../api` ; `useHubMember`, `HubShell`, `Avatar`, `hub.uploadImage`, `hub.Member`.
- Produces (`pro-api.ts`): types `Person`, `ProProfile`, `ProProfileView`, `ProPost`, `ProComment`, `ReportType`, `ProReport` ; fonctions `getProfile(id)`, `saveProfile(p)`, `getFeed(cursor)`, `createPost({body, link, media})`, `toggleLike(id)`, `getComments(id)`, `addComment(id, body)`, `removePost(id)`, `removeComment(id)`, `report(type, id, reason)`, `adminReports()`, `adminHide(type, id)`, `adminDismiss(id)`. `ProLayout({me, active: "feed"|"jobs"|"messages"|null, children})`. `format.ts`: `ago(iso)`, `JOB_TYPES`, `typeLabel(v)`.

Pas de test client automatisé (vitest ne couvre que `server/` et `worker/`) : vérification = `pnpm check` + parcours manuel (Step 12).

- [ ] **Step 1: API client**

`client/src/features/hub/pro/pro-api.ts` :

```ts
import { call } from "../api";

export interface Person { id: number; display_name: string; avatar: string | null; headline?: string }
export interface ProProfile { headline: string; company: string; city: string; skills: string[]; open_to_work: boolean }
export interface ProProfileView extends ProProfile { member: Person; bio: string; mine: boolean }
export interface ProPost { id: number; body: string; link: string | null; created_at: string; author: Person; like_count: number; comment_count: number; liked: boolean; media: (string | null)[] }
export interface ProComment { id: number; post_id: number; body: string; created_at: string; author: Person }
export type ReportType = "post" | "comment" | "job";
export interface ProReport { id: number; target_type: ReportType; target_id: number; reason: string; created_at: string; reporter: string; body: string | null; target_status: string | null }

export const getProfile = (id: number) => call<{ profile: ProProfileView }>("GET", `pro/profile/${id}`).then(r => r.profile);
export const saveProfile = (p: ProProfile) => call<{ profile: ProProfile }>("PUT", "pro/profile", { body: p }).then(r => r.profile);

export const getFeed = (cursor: number | null) => call<{ posts: ProPost[]; nextCursor: number | null }>("GET", `pro/feed${cursor ? `?cursor=${cursor}` : ""}`);
export const createPost = (b: { body: string; link: string; media: string[] }) => call<{ id: number }>("POST", "pro/posts", { body: b });
export const toggleLike = (id: number) => call<{ liked: boolean; count: number }>("POST", `pro/posts/${id}/like`);
export const getComments = (id: number) => call<{ comments: ProComment[] }>("GET", `pro/posts/${id}/comments`).then(r => r.comments);
export const addComment = (id: number, body: string) => call<{ id: number }>("POST", `pro/posts/${id}/comments`, { body: { body } });
export const removePost = (id: number) => call<{ ok: true }>("DELETE", `pro/posts/${id}`);
export const removeComment = (id: number) => call<{ ok: true }>("DELETE", `pro/comments/${id}`);
export const report = (type: ReportType, id: number, reason: string) => call<{ ok: true }>("POST", "pro/report", { body: { type, id, reason } });

export const adminReports = () => call<{ reports: ProReport[] }>("GET", "pro/admin/reports", { admin: true }).then(r => r.reports);
export const adminHide = (type: ReportType, id: number) => call<{ ok: true }>("POST", "pro/admin/hide", { admin: true, body: { type, id } });
export const adminDismiss = (id: number) => call<{ ok: true }>("POST", `pro/admin/reports/${id}/dismiss`, { admin: true });
```

`client/src/features/hub/pro/format.ts` :

```ts
// ponytail: same helper as PostCard's private `ago`; extract to a shared util if a third copy appears
export const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
};

export const JOB_TYPES: { value: string; label: string }[] = [
  { value: "cdi", label: "CDI" }, { value: "cdd", label: "CDD" }, { value: "stage", label: "Stage" },
  { value: "freelance", label: "Freelance" }, { value: "benevolat", label: "Bénévolat" },
];
export const typeLabel = (v: string) => JOB_TYPES.find(t => t.value === v)?.label ?? v;
```

- [ ] **Step 2: Layout avec onglets**

`client/src/features/hub/pro/ProLayout.tsx` :

```tsx
import type { ReactNode } from "react";
import { Link } from "wouter";
import { useI18n } from "@/i18n";
import type * as hub from "../api";
import HubShell from "../components/HubShell";

export type ProTab = "feed" | "jobs" | "messages";
// Emplois (Task 7) et Messages (Task 10) s'ajoutent ici quand leurs pages existent.
const TABS: { key: ProTab; label: string; to: string }[] = [
  { key: "feed", label: "Feed", to: "" },
];

/** Hub frame + the Pro tab bar (Feed · Emplois · Messages). `active = null` for pages outside the tabs (profiles). */
export default function ProLayout({ me, active, children }: { me: hub.Member; active: ProTab | null; children: ReactNode }) {
  const { lang } = useI18n();
  const base = `/${lang}/benevole/espace/pro`;
  return (
    <HubShell me={me}>
      <nav aria-label="Navigation Pro" className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map(t => (
          <Link key={t.key} href={`${base}${t.to}`} aria-current={active === t.key ? "page" : undefined}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold ${active === t.key ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
            {t.label}
          </Link>
        ))}
        <Link href={`${base}/profil`} className="rounded-lg px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100">Mon profil pro</Link>
      </nav>
      {children}
    </HubShell>
  );
}
```

- [ ] **Step 3: Zone de publication**

`client/src/features/hub/pro/components/ProComposer.tsx` :

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Link2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import * as hub from "../../api";
import Avatar from "../../components/Avatar";
import * as api from "../pro-api";

const MAX_PHOTOS = 4;

export default function ProComposer({ me, onPosted }: { me: hub.Member; onPosted: () => void }) {
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);

  const pick = (list: FileList | null) => {
    if (!list) return;
    const all = [...files, ...Array.from(list)].filter(f => f.type.startsWith("image/"));
    if (all.length > MAX_PHOTOS) toast.info("4 photos maximum");
    setFiles(all.slice(0, MAX_PHOTOS));
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const media = await Promise.all(files.map(hub.uploadImage));
      await api.createPost({ body, link: link.trim(), media });
      setBody(""); setLink(""); setShowLink(false); setFiles([]);
      onPosted();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <Avatar name={me.display_name} src={me.avatar} size={40} />
        <Textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={2} aria-label="Votre publication"
          placeholder="Partagez une actualité, une réussite, une question…" className="min-h-[3rem] flex-1 resize-none rounded-2xl border-0 bg-slate-100 focus-visible:ring-2" />
      </div>
      {showLink && <Input aria-label="Lien" className="mt-3" type="url" inputMode="url" maxLength={300} value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" />}
      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={f.name + i} className="relative h-20 w-20">
              <img src={previews[i]} alt="" className="h-20 w-20 rounded-lg object-cover" />
              <button type="button" aria-label="Retirer la photo" className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
        <div className="flex gap-1">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={e => pick(e.target.files)} />
          <Button type="button" variant="ghost" size="sm" disabled={files.length >= MAX_PHOTOS} onClick={() => fileRef.current?.click()}><ImagePlus size={18} className="mr-1.5" />Photo</Button>
          <Button type="button" variant="ghost" size="sm" aria-pressed={showLink} onClick={() => setShowLink(!showLink)}><Link2 size={18} className="mr-1.5" />Lien</Button>
        </div>
        <Button type="button" className="bg-blue-700 hover:bg-blue-800" onClick={submit} disabled={busy || !body.trim()}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Publier"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Carte de post**

`client/src/features/hub/pro/components/ProPostCard.tsx` :

```tsx
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ExternalLink, Flag, Heart, MessageCircle, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import type * as hub from "../../api";
import Avatar from "../../components/Avatar";
import * as api from "../pro-api";
import { ago } from "../format";

const action = "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-slate-600 hover:bg-slate-100";

const host = (u: string) => { try { return new URL(u).hostname; } catch { return u; } };

export default function ProPostCard({ post, me, onChanged }: { post: api.ProPost; me: hub.Member; onChanged: () => void }) {
  const { lang } = useI18n();
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.like_count);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<api.ProComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const canDelete = post.author.id === me.id || me.role === "moderator";
  const commentCount = comments ? comments.length : post.comment_count;
  const photos = post.media.filter((u): u is string => !!u);
  const profile = `/${lang}/benevole/espace/pro/membre/${post.author.id}`;

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { toast.error((e as Error).message); } };
  const loadComments = () => act(async () => setComments(await api.getComments(post.id)));

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 p-4 pb-2">
        <Link href={profile}><Avatar name={post.author.display_name} src={post.author.avatar} size={44} /></Link>
        <div className="min-w-0 flex-1">
          <Link href={profile} className="font-semibold leading-tight text-slate-900 hover:underline">{post.author.display_name}</Link>
          {post.author.headline && <p className="truncate text-xs text-slate-600">{post.author.headline}</p>}
          <p className="text-xs text-slate-500">{ago(post.created_at)}</p>
        </div>
        {canDelete && (
          <button type="button" aria-label="Supprimer" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
            onClick={() => { if (window.confirm("Supprimer cette publication ?")) act(async () => { await api.removePost(post.id); onChanged(); }); }}><Trash2 size={16} /></button>
        )}
      </header>

      <p className="whitespace-pre-wrap break-words px-4 pb-3 text-[15px] text-slate-900">{post.body}</p>
      {post.link && (
        <a href={post.link} target="_blank" rel="noopener noreferrer nofollow" className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-blue-700 hover:bg-slate-100">
          <ExternalLink size={16} className="shrink-0" /><span className="truncate">{host(post.link)}</span>
        </a>
      )}
      {photos.length > 0 && (
        <div className={`grid gap-0.5 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {photos.map(u => <img key={u} src={u} alt="" loading="lazy" className={`w-full object-cover ${photos.length === 1 ? "max-h-[28rem]" : "aspect-square"}`} />)}
        </div>
      )}

      {(likes > 0 || commentCount > 0) && (
        <div className="flex items-center justify-between px-4 pt-3 text-sm text-slate-500">
          <span>{likes > 0 && <><Heart size={14} className="mr-1 inline fill-red-500 text-red-500" />{likes}</>}</span>
          <span>{commentCount > 0 && `${commentCount} commentaire${commentCount > 1 ? "s" : ""}`}</span>
        </div>
      )}
      <div className="mx-4 mt-2 flex gap-1 border-t border-slate-200 py-1">
        <button type="button" aria-label={`J'aime, ${likes}`} aria-pressed={liked} className={`${action} ${liked ? "text-red-600" : ""}`}
          onClick={() => act(async () => { const r = await api.toggleLike(post.id); setLiked(r.liked); setLikes(r.count); })}><Heart size={18} className={liked ? "fill-red-500" : ""} /> J'aime</button>
        <button type="button" aria-label={`Commentaires, ${commentCount}`} aria-expanded={open} className={action}
          onClick={() => { setOpen(!open); if (!open && !comments) loadComments(); }}><MessageCircle size={18} /> Commenter</button>
        {/* ponytail: native prompt for the report reason; replace with a dialog if reports become frequent */}
        <button type="button" aria-label="Signaler" className={action}
          onClick={() => { const r = window.prompt("Motif du signalement ?"); if (r?.trim()) act(async () => { await api.report("post", post.id, r); toast.success("Merci, signalement envoyé."); }); }}><Flag size={18} /> Signaler</button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-4">
          {(comments ?? []).map(c => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar name={c.author.display_name} src={c.author.avatar} size={32} />
              <div className="min-w-0 flex-1 rounded-2xl bg-slate-200/70 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-900">{c.author.display_name}</p>
                <p className="break-words text-slate-800">{c.body}</p>
              </div>
              {(c.author.id === me.id || me.role === "moderator") && (
                <button type="button" aria-label="Supprimer le commentaire" className="mt-2 text-slate-500" onClick={() => act(async () => { await api.removeComment(c.id); await loadComments(); })}><Trash2 size={14} /></button>
              )}
            </div>
          ))}
          <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (!draft.trim()) return; act(async () => { await api.addComment(post.id, draft); setDraft(""); await loadComments(); }); }}>
            <Avatar name={me.display_name} src={me.avatar} size={32} />
            <Input aria-label="Votre commentaire" className="rounded-full bg-white" value={draft} onChange={e => setDraft(e.target.value)} maxLength={500} placeholder="Écrivez un commentaire…" />
          </form>
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 5: Page Feed**

`client/src/features/hub/pro/pages/ProFeedPage.tsx` :

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";
import ProComposer from "../components/ProComposer";
import ProPostCard from "../components/ProPostCard";

export default function ProFeedPage() {
  const me = useHubMember();
  const [posts, setPosts] = useState<api.ProPost[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (cursor: number | null = null) => {
    const id = ++reqId.current;
    try {
      const r = await api.getFeed(cursor);
      if (id !== reqId.current) return;
      setPosts(prev => (cursor ? [...(prev ?? []), ...r.posts] : r.posts));
      setNext(r.nextCursor);
    } catch (e) {
      if (id !== reqId.current) return;
      toast.error((e as Error).message);
      if (!cursor) setPosts([]);
    }
  }, []);
  useEffect(() => { if (me) load(); }, [me, load]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  return (
    <ProLayout me={me} active="feed">
      <ProComposer me={me} onPosted={() => load()} />
      {posts === null && <Loader2 className="mx-auto animate-spin text-blue-700" />}
      {posts?.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Aucune publication pour l'instant. Lancez la conversation !</p>}
      {posts?.map(p => <ProPostCard key={p.id} post={p} me={me} onChanged={() => load()} />)}
      {next !== null && <Button variant="outline" className="w-full bg-white" onClick={() => load(next)}>Voir plus</Button>}
    </ProLayout>
  );
}
```

- [ ] **Step 6: Profil pro (édition) et fiche membre**

`client/src/features/hub/pro/pages/ProProfilePage.tsx` :

```tsx
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";

export default function ProProfilePage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [f, setF] = useState<{ headline: string; company: string; city: string; skills: string; open: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    api.getProfile(me.id).then(p => setF({ headline: p.headline, company: p.company, city: p.city, skills: p.skills.join(", "), open: p.open_to_work }))
      .catch(e => { toast.error((e as Error).message); setF({ headline: "", company: "", city: "", skills: "", open: false }); });
  }, [me]);

  if (!me || !f) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  const set = (k: keyof typeof f, v: string | boolean) => setF({ ...f, [k]: v });

  const save = async () => {
    setBusy(true);
    try {
      await api.saveProfile({ headline: f.headline, company: f.company, city: f.city, skills: f.skills.split(",").map(s => s.trim()).filter(Boolean), open_to_work: f.open });
      toast.success("Profil pro enregistré");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <ProLayout me={me} active={null}>
      <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={e => { e.preventDefault(); save(); }}>
        <h1 className="text-xl font-bold text-slate-900">Mon profil pro</h1>
        <Input aria-label="Titre professionnel" value={f.headline} maxLength={80} onChange={e => set("headline", e.target.value)} placeholder="Ex. Développeuse web, Casablanca" />
        <Input aria-label="Entreprise" value={f.company} maxLength={80} onChange={e => set("company", e.target.value)} placeholder="Entreprise" />
        <Input aria-label="Ville" value={f.city} maxLength={60} onChange={e => set("city", e.target.value)} placeholder="Ville" />
        <Input aria-label="Compétences" value={f.skills} onChange={e => set("skills", e.target.value)} placeholder="Compétences, séparées par des virgules (8 max)" />
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={f.open} onChange={e => set("open", e.target.checked)} /> Ouvert(e) aux opportunités</label>
        <div className="flex items-center gap-3">
          <Button type="submit" className="bg-blue-700 hover:bg-blue-800" disabled={busy}>Enregistrer</Button>
          <Link href={`/${lang}/benevole/espace/pro/membre/${me.id}`} className="text-sm text-blue-700 underline">Voir ma fiche</Link>
        </div>
      </form>
    </ProLayout>
  );
}
```

`client/src/features/hub/pro/pages/ProMemberPage.tsx` :

```tsx
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { Briefcase, Loader2, MapPin } from "lucide-react";
import { useI18n } from "@/i18n";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";

export default function ProMemberPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, params] = useRoute("/:lang/benevole/espace/pro/membre/:id");
  const memberId = Number(params?.id);
  const base = `/${lang}/benevole/espace/pro`;
  const [p, setP] = useState<api.ProProfileView | null | undefined>(undefined);

  useEffect(() => {
    if (!me || !Number.isSafeInteger(memberId)) return;
    api.getProfile(memberId).then(setP).catch(() => setP(null));
  }, [me, memberId]);

  if (!me || p === undefined) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (p === null) return <ProLayout me={me} active={null}><p className="rounded-xl bg-white p-8 text-center text-slate-600">Membre introuvable. <Link href={base} className="text-blue-700 underline">Retour au feed</Link></p></ProLayout>;

  return (
    <ProLayout me={me} active={null}>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="h-20 bg-gradient-to-r from-blue-800 to-blue-500" />
        <div className="space-y-3 p-4">
          <div className="-mt-12 rounded-full ring-4 ring-white w-fit"><Avatar name={p.member.display_name} src={p.member.avatar} size={80} /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{p.member.display_name}</h1>
            {p.headline && <p className="text-slate-700">{p.headline}</p>}
            <p className="mt-1 flex flex-wrap items-center gap-x-4 text-sm text-slate-500">
              {p.company && <span className="flex items-center gap-1"><Briefcase size={14} />{p.company}</span>}
              {p.city && <span className="flex items-center gap-1"><MapPin size={14} />{p.city}</span>}
            </p>
          </div>
          {p.open_to_work && <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Ouvert(e) aux opportunités</span>}
          {p.bio && <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{p.bio}</p>}
          {p.skills.length > 0 && <ul className="flex flex-wrap gap-2">{p.skills.map(s => <li key={s} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{s}</li>)}</ul>}
          {p.mine && <Link href={`${base}/profil`} className="inline-block text-sm text-blue-700 underline">Modifier mon profil pro</Link>}
        </div>
      </div>
    </ProLayout>
  );
}
```

- [ ] **Step 7: Section admin**

`client/src/features/hub/admin/ProAdmin.tsx` :

```tsx
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as api from "../pro/pro-api";

const KIND = { post: "Publication", comment: "Commentaire", job: "Offre" } as const;

export default function ProAdmin() {
  const [reports, setReports] = useState<api.ProReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try { setReports(await api.adminReports()); } catch (e) { toast.error((e as Error).message); }
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Pro : signalements ({reports.length})</h2>
      {!loading && reports.length === 0 && <p className="text-sm text-muted-foreground">Aucun signalement.</p>}
      {reports.map(r => (
        <div key={r.id} className="rounded-lg border p-3 text-sm space-y-1">
          <p><strong>{KIND[r.target_type]} #{r.target_id}</strong> — signalé par {r.reporter} : « {r.reason} »</p>
          <p className="whitespace-pre-wrap break-words rounded bg-muted p-2">{r.body ?? "(contenu supprimé)"}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={busy || r.target_status === "hidden"} onClick={() => window.confirm("Masquer ce contenu ?") && run(() => api.adminHide(r.target_type, r.target_id), "Contenu masqué")}>
              {r.target_status === "hidden" ? "Déjà masqué" : "Masquer"}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => api.adminDismiss(r.id))}>Ignorer</Button>
          </div>
        </div>
      ))}
    </section>
  );
}
```

Dans `client/src/features/hub/admin/AdminHub.tsx` : ajouter `import ProAdmin from "./ProAdmin";` sous l'import de `MarketAdmin`, et `<ProAdmin />` juste après `<MarketAdmin />`.

- [ ] **Step 8: Entrée « Pro » dans HubShell**

Dans `client/src/features/hub/components/HubShell.tsx` :
1. Import : `import { Briefcase, Home, LogOut, Mail, Newspaper, Store, User } from "lucide-react";`
2. Menu latéral : après la ligne `<Link href={`${base}/marketplace`} …>Marketplace</Link>`, ajouter :
```tsx
              <Link href={`${base}/pro`} className={link}><Briefcase size={18} /> Pro</Link>
```
3. Barre mobile : remplacer `grid-cols-4` par `grid-cols-5` et ajouter, après le lien Marketplace :
```tsx
        <Link href={`${base}/pro`} className="flex flex-col items-center gap-0.5 py-2"><Briefcase size={20} />Pro</Link>
```

- [ ] **Step 9: Routes**

Dans `client/src/App.tsx` : ajouter les imports près des autres imports du hub :

```tsx
import ProFeedPage from "@/features/hub/pro/pages/ProFeedPage";
import ProProfilePage from "@/features/hub/pro/pages/ProProfilePage";
import ProMemberPage from "@/features/hub/pro/pages/ProMemberPage";
```

et, **avant** `<Route path="/:lang/benevole/espace/profil" …/>` :

```tsx
      <Route path="/:lang/benevole/espace/pro/membre/:id" component={ProMemberPage} />
      <Route path="/:lang/benevole/espace/pro/profil" component={ProProfilePage} />
      <Route path="/:lang/benevole/espace/pro" component={ProFeedPage} />
```

- [ ] **Step 10: Vérifier les types et les tests**

Run: `pnpm check && pnpm test`
Expected: aucun erreur TypeScript ; tous les tests verts.

- [ ] **Step 11: Parcours manuel**

Appliquer `worker/d1/pro.sql` sur la D1 locale/dev, lancer le front, se connecter à l'espace bénévole. Vérifier : onglet « Pro » (latéral desktop, barre mobile à 5 entrées) → Feed ; publier un texte, un lien, une photo ; liker, commenter, signaler ; ouvrir une fiche membre ; renseigner « Mon profil pro » ; `/admin/hub` affiche « Pro : signalements » et masque un contenu. Largeur 375 px : pas de défilement horizontal.

- [ ] **Step 12: Commit**

```bash
git add client/src/features/hub/pro client/src/features/hub/admin client/src/features/hub/components/HubShell.tsx client/src/App.tsx
git commit -m "feat(pro): Pro tab with feed, professional profile and admin reports

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

**→ Jalon 1 déployable** (appliquer `worker/d1/pro.sql`, `pnpm build:cloudflare && npx wrangler deploy`, puis front).

---

# JALON 2 — Offres d'emploi

### Task 5: Offres d'emploi (données)

**Files:**
- Modify: `worker/pro-d1.ts` (ajouter), `worker/pro-d1.test.ts` (ajouter)

**Interfaces:**
- Consumes: `recent`, `AUTHOR_OK`, `JOB_TYPES`, `PRO_LIMITS`, `Person`, `hideContent` (Task 2).
- Produces: `JobInput {title; company; city?; type; description; contact?}`, `JobCard {id; title; company; city; type; status: "open"|"closed"; created_at; poster: Person}`, `JobDetail extends JobCard {description; contact: string|null; updated_at; mine: boolean}`, `createJob(d, member, input, nowMs): Promise<{id}>`, `updateJob(d, member, id, input, nowMs): Promise<void>`, `setJobStatus(d, member, id, "open"|"closed", nowMs): Promise<void>`, `hideJob(d, id, actor?): Promise<void>`, `listJobs(d, viewerId, {cursor?, type?, city?, q?, mine?, limit?}): Promise<{jobs: JobCard[]; nextCursor: number|null}>`, `getJob(d, viewerId, id): Promise<JobDetail>`, `adminListJobs(d): Promise<AdminJobView[]>`.

- [ ] **Step 1: Écrire les tests (échouent)**

Ajouter à `worker/pro-d1.test.ts` :

```ts
const job = (over: Partial<pro.JobInput> = {}): pro.JobInput => ({ title: "Développeur React", company: "Acme", city: "Casablanca", type: "cdi", description: "Nous recrutons.", contact: "rh@acme.ma", ...over });
/** Insert a job directly (bypasses the daily rate limit) for list/search/pagination tests. */
function rawJob(memberId: number, over: Record<string, unknown> = {}) {
  const o = { title: "Poste", company: "Co", city: "", type: "cdi", description: "desc", status: "open", ...over };
  return Number(sqlite.prepare("INSERT INTO pro_jobs (member_id,title,company,city,type,description,status) VALUES (?,?,?,?,?,?,?)")
    .run(memberId, o.title, o.company, o.city, o.type, o.description, o.status).lastInsertRowid);
}

describe("pro jobs: write", () => {
  it("creates a job and reads its detail (contact visible, mine flag)", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    await pro.saveProfile(d, a, { headline: "RH" }, T0);
    const { id } = await pro.createJob(d, a, job(), T0);
    expect(await pro.getJob(d, a.id, id)).toMatchObject({ title: "Développeur React", company: "Acme", type: "cdi", status: "open", contact: "rh@acme.ma", mine: true, poster: { id: a.id, headline: "RH" } });
    expect((await pro.getJob(d, b.id, id)).mine).toBe(false);
  });

  it("validates input", async () => {
    const a = await member("a@x.ma");
    const bad: Partial<pro.JobInput>[] = [
      { title: "" }, { title: "x".repeat(81) }, { company: "" }, { company: "x".repeat(81) }, { city: "x".repeat(61) },
      { type: "interim" }, { description: "" }, { description: "x".repeat(3001) }, { contact: "x".repeat(121) }, { contact: 5 as any },
    ];
    for (const over of bad) await expect(pro.createJob(d, a, job(over), T0)).rejects.toMatchObject({ code: "invalid" });
  });

  it("limits to 3 jobs per 24 h", async () => {
    const a = await member("a@x.ma");
    for (let i = 0; i < 3; i++) await pro.createJob(d, a, job(), T0);
    await expect(pro.createJob(d, a, job(), T0)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(pro.createJob(d, a, job(), T0 + DAY + 1)).resolves.toBeDefined();
  });

  it("only the owner edits or closes; hidden jobs are gone", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const { id } = await pro.createJob(d, a, job(), T0);
    await expect(pro.updateJob(d, b, id, job({ title: "Piraté" }), T0)).rejects.toMatchObject({ code: "forbidden" });
    await expect(pro.setJobStatus(d, b, id, "closed", T0)).rejects.toMatchObject({ code: "forbidden" });
    await expect(pro.setJobStatus(d, a, id, "hidden" as any, T0)).rejects.toMatchObject({ code: "invalid" });
    await pro.updateJob(d, a, id, job({ title: "Lead React", contact: "" }), T0 + 1);
    expect(await pro.getJob(d, a.id, id)).toMatchObject({ title: "Lead React", contact: null });
    await pro.setJobStatus(d, a, id, "closed", T0 + 2);
    expect((await pro.getJob(d, b.id, id)).status).toBe("closed");
    await pro.setJobStatus(d, a, id, "open", T0 + 3);
    await pro.hideJob(d, id, a);
    await expect(pro.getJob(d, a.id, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(pro.updateJob(d, a, id, job(), T0)).rejects.toMatchObject({ code: "not_found" });
  });

  it("hideJob: owner or moderator only; admin (no actor) always", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const mod = await member("m@x.ma", "Sara", "moderator");
    const id1 = rawJob(a.id), id2 = rawJob(a.id), id3 = rawJob(a.id);
    await expect(pro.hideJob(d, id1, b)).rejects.toMatchObject({ code: "forbidden" });
    await pro.hideJob(d, id1, mod);
    await pro.hideJob(d, id2, a);
    await pro.hideJob(d, id3);
    await expect(pro.hideJob(d, id3)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("pro jobs: list", () => {
  it("lists open jobs newest first; closed only under mine", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const open = rawJob(a.id, { title: "Ouverte" });
    const closed = rawJob(a.id, { title: "Fermée", status: "closed" });
    rawJob(a.id, { title: "Masquée", status: "hidden" });
    expect((await pro.listJobs(d, b.id)).jobs.map(j => j.id)).toEqual([open]);
    expect((await pro.listJobs(d, a.id, { mine: true })).jobs.map(j => j.id)).toEqual([closed, open]);
    expect((await pro.listJobs(d, b.id, { mine: true })).jobs).toEqual([]);
  });

  it("filters by type and city (case-insensitive)", async () => {
    const a = await member("a@x.ma");
    const cdi = rawJob(a.id, { type: "cdi", city: "Rabat" });
    const stage = rawJob(a.id, { type: "stage", city: "Casablanca" });
    expect((await pro.listJobs(d, a.id, { type: "stage" })).jobs.map(j => j.id)).toEqual([stage]);
    expect((await pro.listJobs(d, a.id, { city: "rabat" })).jobs.map(j => j.id)).toEqual([cdi]);
    await expect(pro.listJobs(d, a.id, { type: "interim" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("searches title, company and description; escapes % and _; rejects long queries", async () => {
    const a = await member("a@x.ma");
    const pct = rawJob(a.id, { title: "Bonus 100% garanti" });
    rawJob(a.id, { title: "Développeur" });
    const company = rawJob(a.id, { company: "Zebra Corp" });
    const desc = rawJob(a.id, { description: "maîtrise de SQL exigée" });
    expect((await pro.listJobs(d, a.id, { q: "%" })).jobs.map(j => j.id)).toEqual([pct]);
    expect((await pro.listJobs(d, a.id, { q: "_" })).jobs).toEqual([]);
    expect((await pro.listJobs(d, a.id, { q: "zebra" })).jobs.map(j => j.id)).toEqual([company]);
    expect((await pro.listJobs(d, a.id, { q: "sql" })).jobs.map(j => j.id)).toEqual([desc]);
    await expect(pro.listJobs(d, a.id, { q: "a".repeat(60) })).rejects.toMatchObject({ code: "invalid" });
  });

  it("paginates with a cursor", async () => {
    const a = await member("a@x.ma");
    const ids = [rawJob(a.id), rawJob(a.id), rawJob(a.id)];
    const first = await pro.listJobs(d, a.id, { limit: 2 });
    expect(first.jobs.map(j => j.id)).toEqual([ids[2], ids[1]]);
    expect(first.nextCursor).toBe(ids[1]);
    const second = await pro.listJobs(d, a.id, { cursor: first.nextCursor, limit: 2 });
    expect(second.jobs.map(j => j.id)).toEqual([ids[0]]);
    expect(second.nextCursor).toBeNull();
  });

  it("hides jobs of suspended posters", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const id = rawJob(a.id);
    suspend(a.id);
    expect((await pro.listJobs(d, b.id)).jobs).toEqual([]);
    await expect(pro.getJob(d, b.id, id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("reports a job and lists it for admins; admin lists all jobs", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const id = rawJob(a.id, { title: "Offre douteuse" });
    await pro.reportContent(d, b, "job", id, "arnaque");
    expect((await pro.listReports(d))[0]).toMatchObject({ target_type: "job", body: "Offre douteuse", target_status: "open" });
    await pro.hideContent(d, "job", id);
    expect((await pro.listReports(d))[0].target_status).toBe("hidden");
    expect((await pro.adminListJobs(d))[0]).toMatchObject({ id, title: "Offre douteuse", status: "hidden", poster: a.display_name });
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm vitest run worker/pro-d1.test.ts`
Expected: FAIL — `pro.createJob is not a function`.

- [ ] **Step 3: Implémenter**

Ajouter à la fin de `worker/pro-d1.ts` :

```ts
// ---- jobs -------------------------------------------------------------------

export interface JobInput { title: string; company: string; city?: string; type: string; description: string; contact?: unknown }
export interface JobCard { id: number; title: string; company: string; city: string; type: string; status: "open" | "closed"; created_at: string; poster: Person }
export interface JobDetail extends JobCard { description: string; contact: string | null; updated_at: string; mine: boolean }
export interface AdminJobView { id: number; title: string; company: string; status: string; poster: string; created_at: string }

interface CleanJob { title: string; company: string; city: string; type: string; description: string; contact: string | null }
function cleanJob(i: JobInput): CleanJob {
  const title = cleanBody(i.title, PRO_LIMITS.jobTitle, "Titre");
  const company = cleanBody(i.company, PRO_LIMITS.company, "Entreprise");
  const description = cleanBody(i.description, PRO_LIMITS.jobDescription, "Description");
  if (!(JOB_TYPES as readonly string[]).includes(i.type)) throw new HubError("invalid", "Type de contrat invalide");
  const city = text(i.city, PRO_LIMITS.city, "Ville");
  const contact = text(i.contact, PRO_LIMITS.contact, "Contact") || null;
  return { title, company, city, type: i.type, description, contact };
}

export async function createJob(d: D1Like, member: MemberRow, input: JobInput, nowMs: number): Promise<{ id: number }> {
  const c = cleanJob(input);
  if ((await recent(d, "pro_jobs", "member_id", member.id, nowMs - DAY_MS)) >= PRO_LIMITS.jobsPerDay) throw new HubError("rate_limited", "Limite de 3 offres par jour atteinte");
  const row = await d.prepare(
    "INSERT INTO pro_jobs (member_id, title, company, city, type, description, contact, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id",
  ).bind(member.id, c.title, c.company, c.city, c.type, c.description, c.contact, iso(nowMs), iso(nowMs)).first<{ id: number }>();
  return { id: row!.id };
}

async function ownedJob(d: D1Like, member: MemberRow, id: number): Promise<void> {
  const r = await d.prepare("SELECT member_id, status FROM pro_jobs WHERE id = ?").bind(id).first<{ member_id: number; status: string }>();
  if (!r || r.status === "hidden") throw new HubError("not_found", "Offre introuvable");
  if (r.member_id !== member.id) throw new HubError("forbidden", "Action non autorisée");
}

export async function updateJob(d: D1Like, member: MemberRow, id: number, input: JobInput, nowMs: number): Promise<void> {
  const c = cleanJob(input);
  await ownedJob(d, member, id);
  await d.prepare("UPDATE pro_jobs SET title=?, company=?, city=?, type=?, description=?, contact=?, updated_at=? WHERE id=?")
    .bind(c.title, c.company, c.city, c.type, c.description, c.contact, iso(nowMs), id).run();
}

export async function setJobStatus(d: D1Like, member: MemberRow, id: number, status: "open" | "closed", nowMs: number): Promise<void> {
  if (status !== "open" && status !== "closed") throw new HubError("invalid", "Statut invalide");
  await ownedJob(d, member, id);
  await d.prepare("UPDATE pro_jobs SET status = ?, updated_at = ? WHERE id = ?").bind(status, iso(nowMs), id).run();
}

/** Soft delete. With an actor: owner or moderator only. Without: admin (caller already authorised). */
export async function hideJob(d: D1Like, id: number, actor?: MemberRow): Promise<void> {
  const r = await d.prepare("SELECT member_id FROM pro_jobs WHERE id = ? AND status <> 'hidden'").bind(id).first<{ member_id: number }>();
  if (!r) throw new HubError("not_found", "Offre introuvable");
  if (actor && actor.id !== r.member_id && actor.role !== "moderator") throw new HubError("forbidden", "Action non autorisée");
  await d.prepare("UPDATE pro_jobs SET status = 'hidden' WHERE id = ?").bind(id).run();
}

export async function listJobs(
  d: D1Like, viewerId: number,
  o: { cursor?: number | null; type?: string; city?: string; q?: string; mine?: boolean; limit?: number } = {},
): Promise<{ jobs: JobCard[]; nextCursor: number | null }> {
  const lim = Math.min(Math.max(Math.trunc(o.limit ?? 20) || 20, 1), 50);
  const type = o.type || null;
  if (type !== null && !(JOB_TYPES as readonly string[]).includes(type)) throw new HubError("invalid", "Type de contrat invalide");
  const city = (o.city ?? "").trim() || null;
  if (city !== null && city.length > PRO_LIMITS.city) throw new HubError("invalid", "Ville trop longue");
  const q = (o.q ?? "").trim();
  let pattern: string | null = null;
  if (q) {
    pattern = `%${q.replace(/[\\%_]/g, c => `\\${c}`)}%`;
    if (new TextEncoder().encode(pattern).length > PRO_LIMITS.likePatternBytes) throw new HubError("invalid", "Recherche trop longue");
  }
  const cursor = o.cursor ?? null;
  const mine = o.mine ? 1 : 0;
  // public list: open jobs only; "mine" also shows the member's closed jobs
  const { results } = await d.prepare(
    `SELECT j.id, j.title, j.company, j.city, j.type, j.status, j.created_at, m.id AS poster_id, m.display_name AS poster_name, m.avatar_key AS poster_avatar
     FROM pro_jobs j JOIN hub_members m ON m.id = j.member_id
     WHERE ((? = 0 AND j.status = 'open') OR (? = 1 AND j.member_id = ? AND j.status IN ('open','closed'))) AND ${AUTHOR_OK}
       AND (? IS NULL OR j.id < ?) AND (? IS NULL OR j.type = ?) AND (? IS NULL OR lower(j.city) = lower(?))
       AND (? IS NULL OR j.title LIKE ? ESCAPE '\\' OR j.company LIKE ? ESCAPE '\\' OR j.description LIKE ? ESCAPE '\\')
     ORDER BY j.id DESC LIMIT ?`,
  ).bind(mine, mine, viewerId, cursor, cursor, type, type, city, city, pattern, pattern, pattern, pattern, lim + 1).all<any>();
  const jobs: JobCard[] = results.slice(0, lim).map(r => ({
    id: r.id, title: r.title, company: r.company, city: r.city, type: r.type, status: r.status, created_at: r.created_at,
    poster: { id: r.poster_id, display_name: r.poster_name, avatar_key: r.poster_avatar },
  }));
  return { jobs, nextCursor: results.length > lim ? jobs[jobs.length - 1].id : null };
}

export async function getJob(d: D1Like, viewerId: number, id: number): Promise<JobDetail> {
  const r = await d.prepare(
    `SELECT j.*, m.id AS poster_id, m.display_name AS poster_name, m.avatar_key AS poster_avatar, COALESCE(pp.headline, '') AS poster_headline
     FROM pro_jobs j JOIN hub_members m ON m.id = j.member_id LEFT JOIN pro_profiles pp ON pp.member_id = m.id
     WHERE j.id = ? AND j.status IN ('open','closed') AND ${AUTHOR_OK}`,
  ).bind(id).first<any>();
  if (!r) throw new HubError("not_found", "Offre introuvable");
  return {
    id: r.id, title: r.title, company: r.company, city: r.city, type: r.type, status: r.status, created_at: r.created_at, updated_at: r.updated_at,
    description: r.description, contact: r.contact ?? null, mine: r.member_id === viewerId,
    poster: { id: r.poster_id, display_name: r.poster_name, avatar_key: r.poster_avatar, headline: r.poster_headline },
  };
}

export async function adminListJobs(d: D1Like): Promise<AdminJobView[]> {
  const { results } = await d.prepare(
    "SELECT j.id, j.title, j.company, j.status, m.display_name AS poster, j.created_at FROM pro_jobs j JOIN hub_members m ON m.id = j.member_id ORDER BY j.id DESC LIMIT 100",
  ).all<AdminJobView>();
  return results;
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `pnpm vitest run worker/pro-d1.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/pro-d1.ts worker/pro-d1.test.ts
git commit -m "feat(pro): job offers data layer

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Routes des offres

**Files:**
- Modify: `worker/pro.ts` (insérer avant le dernier `return null;`), `worker/pro.test.ts` (ajouter)

**Interfaces:**
- Consumes: `createJob/updateJob/setJobStatus/hideJob/listJobs/getJob/adminListJobs` (Task 5), `who`, `cursorOf` (Task 3).
- Produces: `GET jobs?cursor=&type=&city=&q=&mine=1` → `{jobs, nextCursor}` (poster `{id, display_name, avatar}`) ; `POST jobs` → `{id}` ; `GET jobs/:id` → `{job}` (poster avec `headline`) ; `PUT jobs/:id` → `{ok}` ; `POST jobs/:id/status {status}` → `{ok}` ; `DELETE jobs/:id` → `{ok}` ; `GET admin/jobs` → `{jobs}`.

- [ ] **Step 1: Écrire les tests (échouent)**

Ajouter à `worker/pro.test.ts` :

```ts
const jobBody = (over: Record<string, unknown> = {}) => ({ title: "Dev React", company: "Acme", city: "Rabat", type: "cdi", description: "On recrute", contact: "rh@acme.ma", ...over });

describe("pro http: jobs", () => {
  it("requires a member session", async () => {
    for (const [m, p] of [["GET", "/hub/pro/jobs"], ["POST", "/hub/pro/jobs"], ["GET", "/hub/pro/jobs/1"], ["PUT", "/hub/pro/jobs/1"], ["DELETE", "/hub/pro/jobs/1"]])
      expect((await call(m, p)).status).toBe(401);
  });

  it("creates, lists, reads, edits, closes and removes a job", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    const created = await call("POST", "/hub/pro/jobs", { token: a.session, body: jobBody() });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: number };

    const list = (await (await call("GET", "/hub/pro/jobs?type=cdi&city=rabat&q=react", { token: b.session })).json()) as any;
    expect(list.jobs).toHaveLength(1);
    expect(list.jobs[0]).toMatchObject({ id, title: "Dev React", poster: { id: a.id } });
    expect(list.jobs[0].description).toBeUndefined();

    const detail = (await (await call("GET", `/hub/pro/jobs/${id}`, { token: b.session })).json()) as any;
    expect(detail.job).toMatchObject({ id, description: "On recrute", contact: "rh@acme.ma", mine: false, poster: { id: a.id } });
    expect(JSON.stringify(detail.job)).not.toMatch(/a@x\.ma|b@x\.ma/);

    expect((await call("PUT", `/hub/pro/jobs/${id}`, { token: b.session, body: jobBody() })).status).toBe(403);
    expect((await call("PUT", `/hub/pro/jobs/${id}`, { token: a.session, body: jobBody({ title: "Lead React" }) })).status).toBe(200);
    expect((await call("POST", `/hub/pro/jobs/${id}/status`, { token: a.session, body: { status: "closed" } })).status).toBe(200);
    expect(((await (await call("GET", "/hub/pro/jobs", { token: b.session })).json()) as any).jobs).toEqual([]);
    expect(((await (await call("GET", "/hub/pro/jobs?mine=1", { token: a.session })).json()) as any).jobs).toHaveLength(1);
    expect((await call("POST", `/hub/pro/jobs/${id}/status`, { token: a.session, body: { status: "hidden" } })).status).toBe(400);

    expect((await call("DELETE", `/hub/pro/jobs/${id}`, { token: b.session })).status).toBe(403);
    expect((await call("DELETE", `/hub/pro/jobs/${id}`, { token: a.session })).status).toBe(200);
    expect((await call("GET", `/hub/pro/jobs/${id}`, { token: b.session })).status).toBe(404);
  });

  it("returns 400 on invalid input and 429 past the daily limit", async () => {
    const a = await signIn("a@x.ma");
    expect((await call("POST", "/hub/pro/jobs", { token: a.session, body: jobBody({ type: "interim" }) })).status).toBe(400);
    expect((await call("GET", "/hub/pro/jobs?type=interim", { token: a.session })).status).toBe(400);
    for (let i = 0; i < 3; i++) expect((await call("POST", "/hub/pro/jobs", { token: a.session, body: jobBody() })).status).toBe(200);
    expect((await call("POST", "/hub/pro/jobs", { token: a.session, body: jobBody() })).status).toBe(429);
  });

  it("report + admin: list jobs, hide", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    const { id } = (await (await call("POST", "/hub/pro/jobs", { token: a.session, body: jobBody() })).json()) as { id: number };
    expect((await call("POST", "/hub/pro/report", { token: b.session, body: { type: "job", id, reason: "arnaque" } })).status).toBe(200);
    expect((await call("GET", "/hub/pro/admin/jobs")).status).toBe(403);
    expect(((await (await call("GET", "/hub/pro/admin/jobs", { admin: "admin" })).json()) as any).jobs[0]).toMatchObject({ id, status: "open" });
    expect((await call("POST", "/hub/pro/admin/hide", { admin: "admin", body: { type: "job", id } })).status).toBe(200);
    expect((await call("GET", `/hub/pro/jobs/${id}`, { token: b.session })).status).toBe(404);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm vitest run worker/pro.test.ts`
Expected: FAIL — 404 là où 401/200 attendus.

- [ ] **Step 3: Implémenter**

Dans `worker/pro.ts`, ajouter avant le dernier `return null;` de `handlePro`, et ajouter en haut sous `cursorOf` :

```ts
function jobInput(b: Record<string, unknown>): P.JobInput {
  return { title: str(b.title), company: str(b.company), city: str(b.city), type: str(b.type), description: str(b.description), contact: b.contact };
}
```

Bloc de routes :

```ts
  // ---- jobs --------------------------------------------------------------
  if (match("GET", /^jobs$/)) {
    const me = await member();
    const r = await P.listJobs(d, me.id, {
      cursor: cursorOf(url),
      type: url.searchParams.get("type") ?? undefined,
      city: url.searchParams.get("city") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      mine: url.searchParams.get("mine") === "1",
    });
    return json({ jobs: await Promise.all(r.jobs.map(async j => ({ ...j, poster: await who(j.poster) }))), nextCursor: r.nextCursor });
  }
  if (match("POST", /^jobs$/)) {
    const me = await member();
    return json(await P.createJob(d, me, jobInput(await readJson(request)), now()));
  }
  if ((m = match("GET", /^jobs\/(\d+)$/))) {
    const me = await member();
    const j = await P.getJob(d, me.id, id(m[1]));
    return json({ job: { ...j, poster: await who(j.poster) } });
  }
  if ((m = match("PUT", /^jobs\/(\d+)$/))) {
    const me = await member();
    await P.updateJob(d, me, id(m[1]), jobInput(await readJson(request)), now());
    return json({ ok: true });
  }
  if ((m = match("POST", /^jobs\/(\d+)\/status$/))) {
    const me = await member();
    await P.setJobStatus(d, me, id(m[1]), str((await readJson(request)).status) as "open" | "closed", now());
    return json({ ok: true });
  }
  if ((m = match("DELETE", /^jobs\/(\d+)$/))) {
    await P.hideJob(d, id(m[1]), await member());
    return json({ ok: true });
  }
  if (match("GET", /^admin\/jobs$/)) { await admin(); return json({ jobs: await P.adminListJobs(d) }); }
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `pnpm vitest run worker/pro.test.ts worker/pro-d1.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/pro.ts worker/pro.test.ts
git commit -m "feat(pro): job offers routes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Client — Emplois (liste, détail, formulaire) + admin

**Files:**
- Modify: `client/src/features/hub/pro/pro-api.ts` (ajouter), `client/src/features/hub/pro/ProLayout.tsx` (onglet Emplois), `client/src/features/hub/admin/ProAdmin.tsx` (liste des offres), `client/src/App.tsx` (routes)
- Create: `pages/ProJobsPage.tsx`, `pages/ProJobDetailPage.tsx`, `pages/ProJobFormPage.tsx` (sous `client/src/features/hub/pro/`)

**Interfaces:**
- Consumes: Task 4 (`ProLayout`, `format.ts`, `useHubMember`) ; routes Task 6.
- Produces (`pro-api.ts`): `JobCard`, `JobDetail`, `JobForm`, `AdminJob`, `listJobs({cursor, type, city, q, mine})`, `getJob(id)`, `createJob(f)`, `updateJob(id, f)`, `setJobStatus(id, "open"|"closed")`, `removeJob(id)`, `adminJobs()`.

- [ ] **Step 1: API client — offres**

Ajouter à `client/src/features/hub/pro/pro-api.ts` :

```ts
export interface JobCard { id: number; title: string; company: string; city: string; type: string; status: "open" | "closed"; created_at: string; poster: Person }
export interface JobDetail extends JobCard { description: string; contact: string | null; updated_at: string; mine: boolean }
export interface JobForm { title: string; company: string; city: string; type: string; description: string; contact: string }
export interface AdminJob { id: number; title: string; company: string; status: string; poster: string; created_at: string }

export const listJobs = (p: { cursor?: number | null; type?: string; city?: string; q?: string; mine?: boolean }) => {
  const qs = new URLSearchParams();
  if (p.cursor) qs.set("cursor", String(p.cursor));
  if (p.type) qs.set("type", p.type);
  if (p.city?.trim()) qs.set("city", p.city.trim());
  if (p.q?.trim()) qs.set("q", p.q.trim());
  if (p.mine) qs.set("mine", "1");
  const s = qs.toString();
  return call<{ jobs: JobCard[]; nextCursor: number | null }>("GET", `pro/jobs${s ? `?${s}` : ""}`);
};
export const getJob = (id: number) => call<{ job: JobDetail }>("GET", `pro/jobs/${id}`).then(r => r.job);
export const createJob = (f: JobForm) => call<{ id: number }>("POST", "pro/jobs", { body: f });
export const updateJob = (id: number, f: JobForm) => call<{ ok: true }>("PUT", `pro/jobs/${id}`, { body: f });
export const setJobStatus = (id: number, status: "open" | "closed") => call<{ ok: true }>("POST", `pro/jobs/${id}/status`, { body: { status } });
export const removeJob = (id: number) => call<{ ok: true }>("DELETE", `pro/jobs/${id}`);
export const adminJobs = () => call<{ jobs: AdminJob[] }>("GET", "pro/admin/jobs", { admin: true }).then(r => r.jobs);
```

- [ ] **Step 2: Onglet Emplois**

Dans `ProLayout.tsx`, remplacer la constante `TABS` et son commentaire par :

```tsx
// Messages (Task 10) s'ajoute ici quand sa page existe.
const TABS: { key: ProTab; label: string; to: string }[] = [
  { key: "feed", label: "Feed", to: "" },
  { key: "jobs", label: "Emplois", to: "/emplois" },
];
```

- [ ] **Step 3: Liste des offres**

`client/src/features/hub/pro/pages/ProJobsPage.tsx` :

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";
import { ago, JOB_TYPES, typeLabel } from "../format";

const select = "h-10 rounded-md border border-input bg-white px-3 text-sm";

export default function ProJobsPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const base = `/${lang}/benevole/espace/pro/emplois`;
  const [items, setItems] = useState<api.JobCard[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [type, setType] = useState("");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState({ q: "", city: "" });
  const [mine, setMine] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced({ q, city }), 250);
    return () => clearTimeout(t);
  }, [q, city]);

  const load = useCallback(async (cursor: number | null = null) => {
    const id = ++reqId.current;
    if (!cursor) setNext(null);
    try {
      const r = await api.listJobs({ cursor, type, city: debounced.city, q: debounced.q, mine });
      if (id !== reqId.current) return;
      setItems(prev => (cursor ? [...(prev ?? []), ...r.jobs] : r.jobs));
      setNext(r.nextCursor);
    } catch (e) {
      if (id !== reqId.current) return;
      toast.error((e as Error).message);
      if (!cursor) setItems([]);
    }
  }, [type, debounced, mine]);
  useEffect(() => { if (me) load(); }, [me, load]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  return (
    <ProLayout me={me} active="jobs">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Offres d'emploi</h1>
        <Link href={`${base}/nouveau`} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"><Plus size={16} /> Publier</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[10rem] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
          <Input aria-label="Rechercher" className="pl-9" value={q} maxLength={24} onChange={e => setQ(e.target.value)} placeholder="Poste, entreprise…" />
        </div>
        <Input aria-label="Ville" className="w-36" value={city} maxLength={60} onChange={e => setCity(e.target.value)} placeholder="Ville" />
        <select aria-label="Type de contrat" className={select} value={type} onChange={e => setType(e.target.value)}>
          <option value="">Tous les contrats</option>
          {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> Mes offres</label>
      </div>

      {items === null && <Loader2 className="mx-auto animate-spin text-blue-700" />}
      {items?.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Aucune offre pour l'instant.</p>}

      <ul className="space-y-3">
        {items?.map(j => (
          <li key={j.id}>
            <Link href={`${base}/${j.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{j.title}</p>
                  <p className="text-sm text-slate-700">{j.company}</p>
                </div>
                <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">{typeLabel(j.type)}</span>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                {j.city && <span className="flex items-center gap-1"><MapPin size={12} />{j.city}</span>}
                <span className="flex items-center gap-1"><Avatar name={j.poster.display_name} src={j.poster.avatar} size={16} />{j.poster.display_name}</span>
                <span>{ago(j.created_at)}</span>
                {j.status === "closed" && <span className="font-semibold text-slate-700">Fermée</span>}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {next !== null && <Button variant="outline" className="w-full bg-white" onClick={() => load(next)}>Voir plus</Button>}
    </ProLayout>
  );
}
```

- [ ] **Step 4: Détail d'une offre**

`client/src/features/hub/pro/pages/ProJobDetailPage.tsx` :

```tsx
import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { Flag, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";
import { ago, typeLabel } from "../format";

export default function ProJobDetailPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/:lang/benevole/espace/pro/emplois/:id");
  const jobId = Number(params?.id);
  const pro = `/${lang}/benevole/espace/pro`;
  const [job, setJob] = useState<api.JobDetail | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = () => api.getJob(jobId).then(setJob).catch(() => setJob(null));
  useEffect(() => { if (me && Number.isSafeInteger(jobId)) load(); }, [me, jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me || job === undefined) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (job === null) return <ProLayout me={me} active="jobs"><p className="rounded-xl bg-white p-8 text-center text-slate-600">Offre introuvable. <Link href={`${pro}/emplois`} className="text-blue-700 underline">Voir les offres</Link></p></ProLayout>;

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); after?.(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <ProLayout me={me} active="jobs">
      <Link href={`${pro}/emplois`} className="text-sm text-blue-700 underline">← Toutes les offres</Link>
      <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <header>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-slate-900">{job.title}</h1>
            <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">{typeLabel(job.type)}</span>
          </div>
          <p className="text-slate-700">{job.company}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-slate-500">
            {job.city && <span className="flex items-center gap-1"><MapPin size={14} />{job.city}</span>}
            <span>{ago(job.created_at)}</span>
          </p>
          {job.status === "closed" && <p className="mt-2 rounded bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">Cette offre est fermée.</p>}
        </header>

        <p className="whitespace-pre-wrap break-words text-[15px] text-slate-900">{job.description}</p>
        {job.contact && <p className="text-sm text-slate-700"><strong>Contact :</strong> <span className="break-all">{job.contact}</span></p>}

        <Link href={`${pro}/membre/${job.poster.id}`} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 hover:bg-slate-100">
          <Avatar name={job.poster.display_name} src={job.poster.avatar} size={44} />
          <span className="min-w-0"><span className="block font-semibold text-slate-900">{job.poster.display_name}</span>{job.poster.headline && <span className="block truncate text-xs text-slate-600">{job.poster.headline}</span>}</span>
        </Link>

        <div className="flex flex-wrap gap-2">
          {job.mine ? (
            <>
              <Link href={`${pro}/emplois/${job.id}/modifier`} className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50">Modifier</Link>
              <Button variant="outline" disabled={busy} onClick={() => run(() => api.setJobStatus(job.id, job.status === "open" ? "closed" : "open"), load)}>{job.status === "open" ? "Fermer l'offre" : "Rouvrir l'offre"}</Button>
              <Button variant="destructive" disabled={busy} onClick={() => window.confirm("Supprimer cette offre ?") && run(() => api.removeJob(job.id), () => setLocation(`${pro}/emplois`))}>Supprimer</Button>
            </>
          ) : (
            // ponytail: native prompt for the report reason, same as post cards
            <Button variant="ghost" size="sm" onClick={() => { const r = window.prompt("Motif du signalement ?"); if (r?.trim()) run(async () => { await api.report("job", job.id, r); toast.success("Merci, signalement envoyé."); }); }}><Flag size={16} className="mr-1.5" />Signaler</Button>
          )}
        </div>
      </article>
    </ProLayout>
  );
}
```

- [ ] **Step 5: Formulaire d'offre**

`client/src/features/hub/pro/pages/ProJobFormPage.tsx` :

```tsx
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";
import { JOB_TYPES } from "../format";

const EMPTY: api.JobForm = { title: "", company: "", city: "", type: "cdi", description: "", contact: "" };

export default function ProJobFormPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/:lang/benevole/espace/pro/emplois/:id/modifier");
  const editId = params?.id ? Number(params.id) : null;
  const pro = `/${lang}/benevole/espace/pro`;
  const [f, setF] = useState<api.JobForm | null>(editId ? null : EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me || !editId) return;
    api.getJob(editId).then(j => {
      if (!j.mine) return setLocation(`${pro}/emplois/${j.id}`);
      setF({ title: j.title, company: j.company, city: j.city, type: j.type, description: j.description, contact: j.contact ?? "" });
    }).catch(() => setLocation(`${pro}/emplois`));
  }, [me, editId, pro, setLocation]);

  if (!me || !f) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  const set = (k: keyof api.JobForm, v: string) => setF({ ...f, [k]: v });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const id = editId ?? (await api.createJob(f)).id;
      if (editId) await api.updateJob(editId, f);
      setLocation(`${pro}/emplois/${id}`);
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <ProLayout me={me} active="jobs">
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{editId ? "Modifier l'offre" : "Publier une offre"}</h1>
        <Input aria-label="Intitulé du poste" required maxLength={80} value={f.title} onChange={e => set("title", e.target.value)} placeholder="Intitulé du poste" />
        <Input aria-label="Entreprise" required maxLength={80} value={f.company} onChange={e => set("company", e.target.value)} placeholder="Entreprise" />
        <div className="flex gap-2">
          <Input aria-label="Ville" maxLength={60} value={f.city} onChange={e => set("city", e.target.value)} placeholder="Ville" />
          <select aria-label="Type de contrat" className="h-10 rounded-md border border-input bg-white px-3 text-sm" value={f.type} onChange={e => set("type", e.target.value)}>
            {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <Textarea aria-label="Description" required rows={8} maxLength={3000} value={f.description} onChange={e => set("description", e.target.value)} placeholder="Missions, profil recherché, conditions…" />
        <Input aria-label="Contact" maxLength={120} value={f.contact} onChange={e => set("contact", e.target.value)} placeholder="Contact (email, téléphone) — facultatif" />
        <p className="text-xs text-slate-500">Les candidats pourront aussi vous écrire en messagerie.</p>
        <Button type="submit" className="bg-blue-700 hover:bg-blue-800" disabled={busy || !f.title.trim() || !f.company.trim() || !f.description.trim()}>{editId ? "Enregistrer" : "Publier"}</Button>
      </form>
    </ProLayout>
  );
}
```

- [ ] **Step 6: Admin et routes**

Dans `client/src/features/hub/admin/ProAdmin.tsx` : remplacer l'état/`reload` pour charger aussi les offres, et ajouter une section. Remplacer la ligne `const [reports, …]` à `useEffect(() => { reload(); }, [reload]);` par :

```tsx
  const [reports, setReports] = useState<api.ProReport[]>([]);
  const [jobs, setJobs] = useState<api.AdminJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [r, j] = await Promise.allSettled([api.adminReports(), api.adminJobs()]);
    if (r.status === "fulfilled") setReports(r.value); else toast.error((r.reason as Error).message);
    if (j.status === "fulfilled") setJobs(j.value); else toast.error((j.reason as Error).message);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);
```

Envelopper le retour dans un fragment et ajouter après la `<section>` des signalements :

```tsx
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Pro : offres ({jobs.length})</h2>
        {!loading && jobs.length === 0 && <p className="text-sm text-muted-foreground">Aucune offre.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th className="p-2">Poste</th><th className="p-2">Entreprise</th><th className="p-2">Publié par</th><th className="p-2">Statut</th><th className="p-2" /></tr></thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id} className="border-t">
                  <td className="p-2 break-words">{j.title}</td><td className="p-2">{j.company}</td><td className="p-2">{j.poster}</td><td className="p-2">{j.status}</td>
                  <td className="p-2"><Button size="sm" variant="destructive" disabled={busy || j.status === "hidden"} onClick={() => window.confirm(`Masquer l'offre « ${j.title} » ?`) && run(() => api.adminHide("job", j.id), "Offre masquée")}>Masquer</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
```

(le `return (` devient `return (<> <section>…reports…</section> <section>…jobs…</section> </>);`)

Dans `client/src/App.tsx` : imports

```tsx
import ProJobsPage from "@/features/hub/pro/pages/ProJobsPage";
import ProJobDetailPage from "@/features/hub/pro/pages/ProJobDetailPage";
import ProJobFormPage from "@/features/hub/pro/pages/ProJobFormPage";
```

et, **avant** la route `…/pro/membre/:id` :

```tsx
      <Route path="/:lang/benevole/espace/pro/emplois/nouveau" component={ProJobFormPage} />
      <Route path="/:lang/benevole/espace/pro/emplois/:id/modifier" component={ProJobFormPage} />
      <Route path="/:lang/benevole/espace/pro/emplois/:id" component={ProJobDetailPage} />
      <Route path="/:lang/benevole/espace/pro/emplois" component={ProJobsPage} />
```

- [ ] **Step 7: Vérifier**

Run: `pnpm check && pnpm test`
Expected: vert.

Parcours manuel : onglet « Emplois » → publier une offre (CDI, ville, contact) → elle apparaît dans la liste ; filtrer par type/ville/recherche ; ouvrir le détail depuis un second compte (signalement), fermer/rouvrir/modifier/supprimer depuis le compte propriétaire ; `/admin/hub` → « Pro : offres » masque une offre.

- [ ] **Step 8: Commit**

```bash
git add client/src/features/hub/pro client/src/features/hub/admin/ProAdmin.tsx client/src/App.tsx
git commit -m "feat(pro): job offers UI (list, detail, form) and admin

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

**→ Jalon 2 déployable.**

---

# JALON 3 — Messagerie

### Task 8: Messagerie (données)

**Files:**
- Modify: `worker/pro-d1.ts` (ajouter), `worker/pro-d1.test.ts` (ajouter)

**Interfaces:**
- Consumes: `recent`, `memberOk`, `PRO_LIMITS`, `Person` (Task 1).
- Produces: `ThreadSummary {id; job_id; job_title: string|null; other: Person; last_body: string|null; last_message_at; unread: number}`, `MessageView {id; sender_id; body; created_at; read_at}`, `openThread(d, me, {to: number; jobId?: number}, nowMs): Promise<{id; created: boolean}>`, `sendMessage(d, me, threadId, body, nowMs): Promise<{id}>`, `listThreads(d, memberId): Promise<ThreadSummary[]>`, `listMessages(d, me, threadId, before?): Promise<{messages: MessageView[]; nextCursor: number|null; other: Person; job: {id; title}|null}>`, `markThreadRead(d, me, threadId, nowMs)`, `unreadTotal(d, memberId): Promise<number>`.

- [ ] **Step 1: Écrire les tests (échouent)**

Ajouter à `worker/pro-d1.test.ts` :

```ts
describe("pro messaging", () => {
  it("opens one thread per pair and job; applying twice reuses it", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const { id: jobId } = await pro.createJob(d, a, job(), T0);
    const direct = await pro.openThread(d, b, { to: a.id }, T0);
    expect(direct.created).toBe(true);
    expect(await pro.openThread(d, b, { to: a.id }, T0)).toEqual({ id: direct.id, created: false });
    expect(await pro.openThread(d, a, { to: b.id }, T0)).toEqual({ id: direct.id, created: false }); // order of the pair does not matter
    const apply = await pro.openThread(d, b, { to: a.id, jobId }, T0);
    expect(apply.id).not.toBe(direct.id);
    expect(await pro.openThread(d, b, { to: a.id, jobId }, T0)).toEqual({ id: apply.id, created: false });
  });

  it("refuses self, unknown, suspended, wrong-poster and hidden-job targets", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const c = await member("c@x.ma", "Sara");
    await expect(pro.openThread(d, a, { to: a.id }, T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(pro.openThread(d, a, { to: 9999 }, T0)).rejects.toMatchObject({ code: "not_found" });
    const { id: jobId } = await pro.createJob(d, a, job(), T0);
    await expect(pro.openThread(d, c, { to: b.id, jobId }, T0)).rejects.toMatchObject({ code: "invalid" }); // job belongs to a, not b
    await expect(pro.openThread(d, b, { to: a.id, jobId: 9999 }, T0)).rejects.toMatchObject({ code: "not_found" });
    await pro.hideJob(d, jobId);
    await expect(pro.openThread(d, b, { to: a.id, jobId }, T0)).rejects.toMatchObject({ code: "not_found" });
    suspend(c.id);
    await expect(pro.openThread(d, a, { to: c.id }, T0)).rejects.toMatchObject({ code: "not_found" });
  });

  it("a new thread on a closed job is refused, an existing one continues", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const c = await member("c@x.ma", "Sara");
    const { id: jobId } = await pro.createJob(d, a, job(), T0);
    const t = await pro.openThread(d, b, { to: a.id, jobId }, T0);
    await pro.setJobStatus(d, a, jobId, "closed", T0);
    await expect(pro.openThread(d, c, { to: a.id, jobId }, T0)).rejects.toMatchObject({ code: "invalid" });
    expect(await pro.openThread(d, b, { to: a.id, jobId }, T0)).toEqual({ id: t.id, created: false });
    await expect(pro.sendMessage(d, b, t.id, "Toujours intéressé", T0)).resolves.toBeDefined();
  });

  it("only the two participants read and write; outsiders get not_found", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const c = await member("c@x.ma", "Sara");
    const mod = await member("m@x.ma", "Admin", "moderator");
    const t = await pro.openThread(d, b, { to: a.id }, T0);
    await pro.sendMessage(d, b, t.id, "Bonjour", T0);
    for (const outsider of [c, mod]) {
      await expect(pro.listMessages(d, outsider, t.id)).rejects.toMatchObject({ code: "not_found" });
      await expect(pro.sendMessage(d, outsider, t.id, "intrus", T0)).rejects.toMatchObject({ code: "not_found" });
      await expect(pro.markThreadRead(d, outsider, t.id, T0)).rejects.toMatchObject({ code: "not_found" });
    }
    expect((await pro.listMessages(d, a, t.id)).messages.map(m => m.body)).toEqual(["Bonjour"]);
  });

  it("validates messages, limits to 30/h, and refuses writing to a suspended member", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const t = await pro.openThread(d, b, { to: a.id }, T0);
    for (const body of ["", "   ", "x".repeat(1001)]) await expect(pro.sendMessage(d, b, t.id, body, T0)).rejects.toMatchObject({ code: "invalid" });
    for (let i = 0; i < 30; i++) await pro.sendMessage(d, b, t.id, `m${i}`, T0);
    await expect(pro.sendMessage(d, b, t.id, "trop", T0)).rejects.toMatchObject({ code: "rate_limited" });
    suspend(a.id);
    await expect(pro.sendMessage(d, b, t.id, "plus tard", T0 + HOUR + 1)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("limits new threads to 20 per hour", async () => {
    const me = await member("me@x.ma", "Moi");
    for (let i = 0; i < 20; i++) { const o = await member(`o${i}@x.ma`, `O${i}`); await pro.openThread(d, me, { to: o.id }, T0); }
    const extra = await member("extra@x.ma", "Extra");
    await expect(pro.openThread(d, me, { to: extra.id }, T0)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("inbox: hides empty threads from the recipient, counts unread, clears them on read", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const { id: jobId } = await pro.createJob(d, a, job({ title: "Chef de projet" }), T0);
    const t = await pro.openThread(d, b, { to: a.id, jobId }, T0);
    expect(await pro.listThreads(d, a.id)).toEqual([]); // nothing written yet: invisible to the poster
    expect(await pro.listThreads(d, b.id)).toHaveLength(1);
    await pro.sendMessage(d, b, t.id, "Je postule", T0 + 1);
    await pro.sendMessage(d, b, t.id, "Voici mon CV en lien", T0 + 2);
    const inbox = await pro.listThreads(d, a.id);
    expect(inbox[0]).toMatchObject({ id: t.id, job_title: "Chef de projet", last_body: "Voici mon CV en lien", unread: 2, other: { id: b.id } });
    expect(await pro.unreadTotal(d, a.id)).toBe(2);
    expect(await pro.unreadTotal(d, b.id)).toBe(0);
    await pro.markThreadRead(d, a, t.id, T0 + 3);
    expect(await pro.unreadTotal(d, a.id)).toBe(0);
    const conv = await pro.listMessages(d, a, t.id);
    expect(conv).toMatchObject({ other: { id: b.id }, job: { id: jobId, title: "Chef de projet" }, nextCursor: null });
    expect(conv.messages.every(m => m.read_at !== null)).toBe(true);
  });

  it("inbox hides threads with suspended members and hidden-job titles", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const { id: jobId } = await pro.createJob(d, a, job(), T0);
    const t = await pro.openThread(d, b, { to: a.id, jobId }, T0);
    await pro.sendMessage(d, b, t.id, "Bonjour", T0);
    await pro.hideJob(d, jobId);
    expect((await pro.listThreads(d, a.id))[0].job_title).toBeNull();
    suspend(b.id);
    expect(await pro.listThreads(d, a.id)).toEqual([]);
    expect(await pro.unreadTotal(d, a.id)).toBe(0);
  });

  it("paginates messages 50 at a time", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    const t = await pro.openThread(d, b, { to: a.id }, T0);
    for (let i = 0; i < 55; i++) sqlite.prepare("INSERT INTO pro_messages (thread_id, sender_id, body, created_at) VALUES (?,?,?,?)").run(t.id, b.id, `m${i}`, h.iso(T0 + i));
    const first = await pro.listMessages(d, a, t.id);
    expect(first.messages).toHaveLength(50);
    expect(first.messages[49].body).toBe("m54");
    expect(first.nextCursor).not.toBeNull();
    const older = await pro.listMessages(d, a, t.id, first.nextCursor);
    expect(older.messages.map(m => m.body)).toEqual(["m0", "m1", "m2", "m3", "m4"]);
    expect(older.nextCursor).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm vitest run worker/pro-d1.test.ts`
Expected: FAIL — `pro.openThread is not a function`.

- [ ] **Step 3: Implémenter**

Ajouter à la fin de `worker/pro-d1.ts` :

```ts
// ---- messaging --------------------------------------------------------------

export interface ThreadSummary { id: number; job_id: number; job_title: string | null; other: Person; last_body: string | null; last_message_at: string; unread: number }
export interface MessageView { id: number; sender_id: number; body: string; created_at: string; read_at: string | null }
interface ThreadRow { id: number; member_a: number; member_b: number; job_id: number }

/** Thread the member takes part in. Outsiders (admins included) get a 404: existence is not revealed. */
async function participantThread(d: D1Like, member: MemberRow, threadId: number): Promise<ThreadRow> {
  const t = await d.prepare("SELECT id, member_a, member_b, job_id FROM pro_threads WHERE id = ?").bind(threadId).first<ThreadRow>();
  if (!t || (t.member_a !== member.id && t.member_b !== member.id)) throw new HubError("not_found", "Discussion introuvable");
  return t;
}

export async function openThread(d: D1Like, me: MemberRow, input: { to: number; jobId?: number }, nowMs: number): Promise<{ id: number; created: boolean }> {
  const { to } = input;
  const jobId = input.jobId ?? 0;
  if (to === me.id) throw new HubError("invalid", "Vous ne pouvez pas vous écrire à vous-même");
  const target = await d.prepare(`SELECT m.id FROM hub_members m WHERE m.id = ? AND ${AUTHOR_OK}`).bind(to).first();
  if (!target) throw new HubError("not_found", "Membre introuvable");
  let jobStatus = "";
  if (jobId > 0) {
    const j = await d.prepare("SELECT member_id, status FROM pro_jobs WHERE id = ? AND status IN ('open','closed')").bind(jobId).first<{ member_id: number; status: string }>();
    if (!j) throw new HubError("not_found", "Offre introuvable");
    if (j.member_id !== to) throw new HubError("invalid", "Destinataire invalide pour cette offre");
    jobStatus = j.status;
  }
  const [a, b] = me.id < to ? [me.id, to] : [to, me.id];
  const existing = await d.prepare("SELECT id FROM pro_threads WHERE member_a = ? AND member_b = ? AND job_id = ?").bind(a, b, jobId).first<{ id: number }>();
  if (existing) return { id: existing.id, created: false };
  if (jobStatus === "closed") throw new HubError("invalid", "Cette offre est fermée");
  if ((await recent(d, "pro_threads", "created_by", me.id, nowMs - HOUR_MS)) >= PRO_LIMITS.threadsPerHour) throw new HubError("rate_limited", "Trop de nouvelles discussions, réessayez plus tard");
  const row = await d.prepare(
    `INSERT INTO pro_threads (member_a, member_b, job_id, created_by, created_at, last_message_at) VALUES (?,?,?,?,?,?)
     ON CONFLICT(member_a, member_b, job_id) DO UPDATE SET job_id = excluded.job_id RETURNING id`,
  ).bind(a, b, jobId, me.id, iso(nowMs), iso(nowMs)).first<{ id: number }>();
  return { id: row!.id, created: true };
}

export async function sendMessage(d: D1Like, me: MemberRow, threadId: number, rawBody: string, nowMs: number): Promise<{ id: number }> {
  const t = await participantThread(d, me, threadId);
  const body = cleanBody(rawBody, PRO_LIMITS.message, "Message");
  const otherId = t.member_a === me.id ? t.member_b : t.member_a;
  if (!(await d.prepare(`SELECT 1 AS ok FROM hub_members m WHERE m.id = ? AND ${AUTHOR_OK}`).bind(otherId).first())) throw new HubError("forbidden", "Ce membre n'est plus joignable");
  if ((await recent(d, "pro_messages", "sender_id", me.id, nowMs - HOUR_MS)) >= PRO_LIMITS.messagesPerHour) throw new HubError("rate_limited", "Trop de messages, réessayez plus tard");
  const row = await d.prepare("INSERT INTO pro_messages (thread_id, sender_id, body, created_at) VALUES (?,?,?,?) RETURNING id").bind(t.id, me.id, body, iso(nowMs)).first<{ id: number }>();
  await d.prepare("UPDATE pro_threads SET last_message_at = ? WHERE id = ?").bind(iso(nowMs), t.id).run();
  return { id: row!.id };
}

export async function listThreads(d: D1Like, memberId: number): Promise<ThreadSummary[]> {
  const { results } = await d.prepare(
    `SELECT t.id, t.job_id, t.last_message_at,
       CASE WHEN j.status = 'hidden' THEN NULL ELSE j.title END AS job_title,
       o.id AS other_id, o.display_name AS other_name, o.avatar_key AS other_avatar,
       (SELECT body FROM pro_messages WHERE thread_id = t.id ORDER BY id DESC LIMIT 1) AS last_body,
       (SELECT COUNT(*) FROM pro_messages WHERE thread_id = t.id AND sender_id <> ? AND read_at IS NULL) AS unread
     FROM pro_threads t
     JOIN hub_members o ON o.id = CASE WHEN t.member_a = ? THEN t.member_b ELSE t.member_a END
     LEFT JOIN pro_jobs j ON j.id = t.job_id
     WHERE (t.member_a = ? OR t.member_b = ?) AND ${memberOk("o")}
       AND (t.created_by = ? OR EXISTS (SELECT 1 FROM pro_messages WHERE thread_id = t.id))
     ORDER BY t.last_message_at DESC, t.id DESC LIMIT 100`,
  ).bind(memberId, memberId, memberId, memberId, memberId).all<any>();
  return results.map(r => ({
    id: r.id, job_id: r.job_id, job_title: r.job_title ?? null,
    other: { id: r.other_id, display_name: r.other_name, avatar_key: r.other_avatar },
    last_body: r.last_body, last_message_at: r.last_message_at, unread: r.unread,
  }));
}

export async function listMessages(d: D1Like, me: MemberRow, threadId: number, before: number | null = null) {
  const t = await participantThread(d, me, threadId);
  const { results } = await d.prepare(
    "SELECT id, sender_id, body, created_at, read_at FROM pro_messages WHERE thread_id = ? AND (? IS NULL OR id < ?) ORDER BY id DESC LIMIT 51",
  ).bind(threadId, before, before).all<MessageView>();
  const page = results.slice(0, 50).reverse();
  const otherId = t.member_a === me.id ? t.member_b : t.member_a;
  const o = await d.prepare("SELECT id, display_name, avatar_key FROM hub_members WHERE id = ?").bind(otherId).first<Person>();
  const j = t.job_id > 0
    ? await d.prepare("SELECT id, title FROM pro_jobs WHERE id = ? AND status <> 'hidden'").bind(t.job_id).first<{ id: number; title: string }>()
    : null;
  return { messages: page, nextCursor: results.length > 50 ? page[0].id : null, other: o!, job: j ?? null };
}

export async function markThreadRead(d: D1Like, me: MemberRow, threadId: number, nowMs: number): Promise<void> {
  await participantThread(d, me, threadId);
  await d.prepare("UPDATE pro_messages SET read_at = ? WHERE thread_id = ? AND sender_id <> ? AND read_at IS NULL").bind(iso(nowMs), threadId, me.id).run();
}

export async function unreadTotal(d: D1Like, memberId: number): Promise<number> {
  const r = await d.prepare(
    `SELECT COUNT(*) AS n FROM pro_messages x JOIN pro_threads t ON t.id = x.thread_id
     JOIN hub_members o ON o.id = CASE WHEN t.member_a = ? THEN t.member_b ELSE t.member_a END
     WHERE (t.member_a = ? OR t.member_b = ?) AND x.sender_id <> ? AND x.read_at IS NULL AND ${memberOk("o")}`,
  ).bind(memberId, memberId, memberId, memberId).first<{ n: number }>();
  return r?.n ?? 0;
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `pnpm vitest run worker/pro-d1.test.ts`
Expected: PASS. Si le test « new thread on a closed job » échoue sur `openThread(c…)`, vérifier que la vérification d'existence précède bien le contrôle `jobStatus === "closed"` (c'est l'ordre du code ci-dessus).

- [ ] **Step 5: Commit**

```bash
git add worker/pro-d1.ts worker/pro-d1.test.ts
git commit -m "feat(pro): private messaging data layer

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Routes de messagerie

**Files:**
- Modify: `worker/pro.ts` (insérer avant le dernier `return null;`), `worker/pro.test.ts` (ajouter)

**Interfaces:**
- Consumes: fonctions de messagerie (Task 8), `who`, `cursorOf`.
- Produces: `POST threads {to, job_id?}` → `{id, created}` ; `GET threads` → `{threads}` (`other` avec `avatar`) ; `GET threads/:id/messages?cursor=` → `{messages, nextCursor, other, job}` ; `POST threads/:id/messages {body}` → `{id}` ; `POST threads/:id/read` → `{ok}` ; `GET unread` → `{count}`.

- [ ] **Step 1: Écrire les tests (échouent)**

Ajouter à `worker/pro.test.ts` :

```ts
describe("pro http: messaging", () => {
  it("requires a member session", async () => {
    for (const [m, p] of [["POST", "/hub/pro/threads"], ["GET", "/hub/pro/threads"], ["GET", "/hub/pro/threads/1/messages"], ["POST", "/hub/pro/threads/1/messages"], ["POST", "/hub/pro/threads/1/read"], ["GET", "/hub/pro/unread"]])
      expect((await call(m, p)).status).toBe(401);
  });

  it("applies to a job, exchanges messages, tracks unread and read", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    const { id: jobId } = (await (await call("POST", "/hub/pro/jobs", { token: a.session, body: jobBody() })).json()) as { id: number };

    const opened = await call("POST", "/hub/pro/threads", { token: b.session, body: { to: a.id, job_id: jobId } });
    expect(opened.status).toBe(200);
    const { id: tid, created } = (await opened.json()) as { id: number; created: boolean };
    expect(created).toBe(true);
    expect(((await (await call("POST", "/hub/pro/threads", { token: b.session, body: { to: a.id, job_id: jobId } })).json()) as any).id).toBe(tid);

    expect((await call("POST", `/hub/pro/threads/${tid}/messages`, { token: b.session, body: { body: "Je postule" } })).status).toBe(200);
    expect(((await (await call("GET", "/hub/pro/unread", { token: a.session })).json()) as any).count).toBe(1);

    const inbox = (await (await call("GET", "/hub/pro/threads", { token: a.session })).json()) as any;
    expect(inbox.threads[0]).toMatchObject({ id: tid, unread: 1, last_body: "Je postule", job_title: "Dev React", other: { id: b.id } });
    expect(JSON.stringify(inbox)).not.toMatch(/@x\.ma/);

    const conv = (await (await call("GET", `/hub/pro/threads/${tid}/messages`, { token: a.session })).json()) as any;
    expect(conv.messages.map((x: any) => x.body)).toEqual(["Je postule"]);
    expect(conv).toMatchObject({ other: { id: b.id }, job: { id: jobId } });
    expect((await call("POST", `/hub/pro/threads/${tid}/read`, { token: a.session })).status).toBe(200);
    expect(((await (await call("GET", "/hub/pro/unread", { token: a.session })).json()) as any).count).toBe(0);
  });

  it("outsiders and admins cannot read a thread; self-thread and bad input are rejected", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma", "Youssef");
    const c = await signIn("c@x.ma", "Sara");
    const { id: tid } = (await (await call("POST", "/hub/pro/threads", { token: b.session, body: { to: a.id } })).json()) as { id: number };
    await call("POST", `/hub/pro/threads/${tid}/messages`, { token: b.session, body: { body: "secret" } });
    expect((await call("GET", `/hub/pro/threads/${tid}/messages`, { token: c.session })).status).toBe(404);
    expect((await call("POST", `/hub/pro/threads/${tid}/messages`, { token: c.session, body: { body: "intrus" } })).status).toBe(404);
    expect((await call("GET", `/hub/pro/threads/${tid}/messages`, { admin: "admin" })).status).toBe(401); // admin role gives no member access
    expect((await call("POST", "/hub/pro/threads", { token: a.session, body: { to: a.id } })).status).toBe(400);
    expect((await call("POST", "/hub/pro/threads", { token: a.session, body: { to: "abc" } })).status).toBe(400);
    expect((await call("POST", "/hub/pro/threads", { token: a.session, body: { to: 9999 } })).status).toBe(404);
    expect((await call("POST", `/hub/pro/threads/${tid}/messages`, { token: a.session, body: { body: "" } })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm vitest run worker/pro.test.ts`
Expected: FAIL — 404 là où 401/200 attendus.

- [ ] **Step 3: Implémenter**

Dans `worker/pro.ts`, ajouter avant le dernier `return null;` :

```ts
  // ---- messaging ---------------------------------------------------------
  if (match("POST", /^threads$/)) {
    const me = await member();
    const b = await readJson(request);
    const jobId = b.job_id === undefined || b.job_id === null ? 0 : id(b.job_id);
    return json(await P.openThread(d, me, { to: id(b.to), jobId }, now()));
  }
  if (match("GET", /^threads$/)) {
    const me = await member();
    const threads = await P.listThreads(d, me.id);
    return json({ threads: await Promise.all(threads.map(async t => ({ ...t, other: await who(t.other) }))) });
  }
  if ((m = match("GET", /^threads\/(\d+)\/messages$/))) {
    const me = await member();
    const r = await P.listMessages(d, me, id(m[1]), cursorOf(url));
    return json({ ...r, other: await who(r.other) });
  }
  if ((m = match("POST", /^threads\/(\d+)\/messages$/))) {
    const me = await member();
    return json(await P.sendMessage(d, me, id(m[1]), str((await readJson(request)).body), now()));
  }
  if ((m = match("POST", /^threads\/(\d+)\/read$/))) {
    const me = await member();
    await P.markThreadRead(d, me, id(m[1]), now());
    return json({ ok: true });
  }
  if (match("GET", /^unread$/)) {
    const me = await member();
    return json({ count: await P.unreadTotal(d, me.id) });
  }
```

(`id(b.to)` lève `invalid` 400 pour `"abc"` ; un `to` valide mais inconnu donne 404 via `openThread`.)

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `pnpm vitest run worker/pro.test.ts worker/pro-d1.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/pro.ts worker/pro.test.ts
git commit -m "feat(pro): private messaging routes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Client — messagerie, « Postuler », badge non lus

**Files:**
- Modify: `pro-api.ts`, `ProLayout.tsx`, `pages/ProJobDetailPage.tsx`, `pages/ProMemberPage.tsx`, `components/HubShell.tsx` (sous `client/src/features/hub/`), `client/src/App.tsx`
- Create: `pages/ProInboxPage.tsx`, `pages/ProConversationPage.tsx` (sous `client/src/features/hub/pro/`)

**Interfaces:**
- Consumes: routes Task 9 ; `useSearch`, `useRoute`, `useLocation` de wouter.
- Produces (`pro-api.ts`): `Thread`, `Message`, `Conversation`, `openThread({to, jobId?})`, `listThreads()`, `getMessages(threadId)`, `sendMessage(threadId, body)`, `markRead(threadId)`, `unreadCount()`.

- [ ] **Step 1: API client — messagerie**

Ajouter à `client/src/features/hub/pro/pro-api.ts` :

```ts
export interface Thread { id: number; job_id: number; job_title: string | null; other: Person; last_body: string | null; last_message_at: string; unread: number }
export interface Message { id: number; sender_id: number; body: string; created_at: string; read_at: string | null }
export interface Conversation { messages: Message[]; nextCursor: number | null; other: Person; job: { id: number; title: string } | null }

export const openThread = (p: { to: number; jobId?: number }) => call<{ id: number; created: boolean }>("POST", "pro/threads", { body: { to: p.to, ...(p.jobId ? { job_id: p.jobId } : {}) } });
export const listThreads = () => call<{ threads: Thread[] }>("GET", "pro/threads").then(r => r.threads);
export const getMessages = (threadId: number) => call<Conversation>("GET", `pro/threads/${threadId}/messages`);
export const sendMessage = (threadId: number, body: string) => call<{ id: number }>("POST", `pro/threads/${threadId}/messages`, { body: { body } });
export const markRead = (threadId: number) => call<{ ok: true }>("POST", `pro/threads/${threadId}/read`);
export const unreadCount = () => call<{ count: number }>("GET", "pro/unread").then(r => r.count);
```

- [ ] **Step 2: Onglet Messages avec pastille**

Dans `ProLayout.tsx` : ajouter les imports `useEffect, useState` (depuis `react`), `import * as api from "./pro-api";`, étendre `TABS` :

```tsx
const TABS: { key: ProTab; label: string; to: string }[] = [
  { key: "feed", label: "Feed", to: "" },
  { key: "jobs", label: "Emplois", to: "/emplois" },
  { key: "messages", label: "Messages", to: "/messages" },
];
```

Dans le composant, avant le `return` :

```tsx
  const [unread, setUnread] = useState(0);
  // ponytail: poll every 30 s instead of push notifications (same as HubShell's marketplace counter)
  useEffect(() => {
    let alive = true;
    const tick = () => { api.unreadCount().then(n => { if (alive) setUnread(n); }).catch(() => undefined); };
    tick();
    const t = setInterval(() => { if (!document.hidden) tick(); }, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
```

et, dans le contenu du `Link` de chaque onglet, après `{t.label}` :

```tsx
            {t.key === "messages" && unread > 0 && <span className="ml-1.5 rounded-full bg-white px-1.5 text-xs font-bold text-blue-800 ring-1 ring-blue-700" aria-label={`${unread} messages non lus`}>{unread}</span>}
```

- [ ] **Step 3: Boîte de réception**

`client/src/features/hub/pro/pages/ProInboxPage.tsx` :

```tsx
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";
import { ago } from "../format";

export default function ProInboxPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const base = `/${lang}/benevole/espace/pro`;
  const [threads, setThreads] = useState<api.Thread[] | null>(null);

  useEffect(() => {
    if (!me) return;
    api.listThreads().then(setThreads).catch(e => { toast.error((e as Error).message); setThreads([]); });
  }, [me]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  return (
    <ProLayout me={me} active="messages">
      <h1 className="text-xl font-bold text-slate-900">Messages</h1>
      {threads === null && <Loader2 className="mx-auto animate-spin text-blue-700" />}
      {threads?.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Aucune discussion. Ouvrez une offre et cliquez sur « Postuler », ou une fiche membre et « Écrire ».</p>}
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {threads?.map(t => (
          <li key={t.id}>
            <Link href={`${base}/messages/${t.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
              <Avatar name={t.other.display_name} src={t.other.avatar} size={44} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-slate-900">{t.other.display_name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{ago(t.last_message_at)}</span>
                </p>
                {t.job_title && <p className="truncate text-xs text-blue-700">Offre : {t.job_title}</p>}
                <p className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${t.unread > 0 ? "font-semibold text-slate-900" : "text-slate-600"}`}>{t.last_body ?? "Nouvelle discussion"}</span>
                  {t.unread > 0 && <span className="shrink-0 rounded-full bg-blue-700 px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${t.unread} non lus`}>{t.unread}</span>}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </ProLayout>
  );
}
```

- [ ] **Step 4: Conversation (avec message pré-rempli quand on postule)**

`client/src/features/hub/pro/pages/ProConversationPage.tsx` :

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRoute, useSearch } from "wouter";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";

const POLL_MS = 10_000;

export default function ProConversationPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, params] = useRoute("/:lang/benevole/espace/pro/messages/:threadId");
  const apply = new URLSearchParams(useSearch()).get("postuler") === "1";
  const threadId = Number(params?.threadId);
  const base = `/${lang}/benevole/espace/pro`;
  const [data, setData] = useState<api.Conversation | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const prefilled = useRef(false);
  const sending = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.getMessages(threadId);
      setData(r);
      if (r.messages.some(m => m.sender_id !== me?.id && !m.read_at)) api.markRead(threadId).catch(() => undefined);
    } catch { setData(null); }
  }, [threadId, me?.id]);

  // ponytail: polling every 10 s instead of websockets; fine for a small community
  useEffect(() => {
    if (!me || !Number.isSafeInteger(threadId)) return;
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [me, threadId, load]);

  // "Postuler": pre-fill once, only when the conversation is still empty
  useEffect(() => {
    if (apply && data && !prefilled.current && data.messages.length === 0 && data.job) {
      prefilled.current = true;
      setDraft(`Bonjour, je suis intéressé(e) par l'offre « ${data.job.title} ». Pouvons-nous échanger ?`);
    }
  }, [apply, data]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [data?.messages.length]);

  if (!me || data === undefined) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (data === null) return <ProLayout me={me} active="messages"><p className="rounded-xl bg-white p-8 text-center text-slate-600">Discussion introuvable. <Link href={`${base}/messages`} className="text-blue-700 underline">Messages</Link></p></ProLayout>;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    // ref guard: state `busy` alone can lag behind a fast double Enter
    if (!draft.trim() || sending.current) return;
    sending.current = true;
    setBusy(true);
    try { await api.sendMessage(threadId, draft); setDraft(""); await load(); } catch (err) { toast.error((err as Error).message); } finally { sending.current = false; setBusy(false); }
  };

  return (
    <ProLayout me={me} active="messages">
      <Link href={`${base}/messages`} className="text-sm text-blue-700 underline">← Messages</Link>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-slate-200 p-3">
          <Avatar name={data.other.display_name} src={data.other.avatar} size={40} />
          <div className="min-w-0">
            <Link href={`${base}/membre/${data.other.id}`} className="font-semibold text-slate-900 hover:underline">{data.other.display_name}</Link>
            {data.job && <Link href={`${base}/emplois/${data.job.id}`} className="block truncate text-xs text-blue-700 underline">Offre : {data.job.title}</Link>}
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
    </ProLayout>
  );
}
```

- [ ] **Step 5: « Postuler » (offre) et « Écrire » (fiche membre)**

Dans `ProJobDetailPage.tsx`, dans la branche non-propriétaire (`) : (` … `<Button variant="ghost" …>Signaler</Button>`), faire précéder le bouton « Signaler » de :

```tsx
              {job.status === "open" && (
                <Button className="bg-blue-700 hover:bg-blue-800" disabled={busy}
                  onClick={() => run(async () => { const t = await api.openThread({ to: job.poster.id, jobId: job.id }); setLocation(`${pro}/messages/${t.id}?postuler=1`); })}>Postuler</Button>
              )}
```

(fragment React : envelopper `Postuler` + `Signaler` dans `<> … </>`.) Le bouton « Contacter l'auteur » pour une offre fermée n'est pas proposé ; la fiche membre reste accessible.

Dans `ProMemberPage.tsx` : ajouter `import { useLocation } from "wouter";` (fusionner avec l'import existant `Link, useRoute`), `import { toast } from "sonner";`, `import { Button } from "@/components/ui/button";`, `const [, setLocation] = useLocation();` dans le composant, et, à côté du lien « Modifier mon profil pro » :

```tsx
          {!p.mine && (
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => api.openThread({ to: p.member.id }).then(t => setLocation(`${base}/messages/${t.id}`)).catch(e => toast.error((e as Error).message))}>Écrire</Button>
          )}
```

- [ ] **Step 6: Pastille « Pro » dans HubShell**

Dans `client/src/features/hub/components/HubShell.tsx` : ajouter `import * as pro from "../pro/pro-api";`, un second état `const [proUnread, setProUnread] = useState(0);`, et dans l'effet de polling existant ajouter à `tick` : `pro.unreadCount().then(n => { if (alive) setProUnread(n); }).catch(() => undefined);`. Puis :
- menu latéral : remplacer la ligne Pro par
```tsx
              <Link href={`${base}/pro`} className={link}>
                <Briefcase size={18} /> Pro
                {proUnread > 0 && <span className="ml-auto rounded-full bg-blue-700 px-2 text-xs font-semibold text-white" aria-label={`${proUnread} messages Pro non lus`}>{proUnread}</span>}
              </Link>
```
- barre mobile : remplacer la ligne Pro par
```tsx
        <Link href={`${base}/pro`} className="relative flex flex-col items-center gap-0.5 py-2">
          <Briefcase size={20} />Pro
          {proUnread > 0 && <span className="absolute right-6 top-1.5 h-2.5 w-2.5 rounded-full bg-blue-600" aria-label="Messages Pro non lus" />}
        </Link>
```

- [ ] **Step 7: Routes**

Dans `client/src/App.tsx` : imports

```tsx
import ProInboxPage from "@/features/hub/pro/pages/ProInboxPage";
import ProConversationPage from "@/features/hub/pro/pages/ProConversationPage";
```

et, avec les autres routes `/pro/*` (les plus spécifiques d'abord) :

```tsx
      <Route path="/:lang/benevole/espace/pro/messages/:threadId" component={ProConversationPage} />
      <Route path="/:lang/benevole/espace/pro/messages" component={ProInboxPage} />
```

- [ ] **Step 8: Vérifier**

Run: `pnpm check && pnpm test`
Expected: vert.

Parcours manuel (deux comptes A et B) : B ouvre une offre de A → « Postuler » → conversation avec message pré-rempli → envoyer ; A voit la pastille sur « Pro » (latéral/mobile) et sur l'onglet Messages, ouvre la discussion (non-lus à 0), répond ; B voit la réponse en ≤ 10 s. « Postuler » une 2ᵉ fois ramène à la même conversation. « Écrire » depuis une fiche membre ouvre une discussion directe. Un 3ᵉ compte qui colle l'URL `/pro/messages/<id>` voit « Discussion introuvable ».

- [ ] **Step 9: Commit**

```bash
git add client/src/features/hub client/src/App.tsx
git commit -m "feat(pro): messaging UI, apply-to-job flow and unread badge

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

**→ Jalon 3 déployable.**

---

### Task 11: Vérification finale

**Files:** aucun nouveau.

- [ ] **Step 1: Suite complète**

Run: `pnpm test && pnpm check`
Expected: tout vert, aucun `.skip/.only` ajouté (`git diff main --stat -- worker/*.test.ts` ne montre que des ajouts) ; les tests `hub*` et `market*` existants passent sans modification.

- [ ] **Step 2: Contrôle du périmètre**

Run: `git diff --stat $(git merge-base HEAD main)..HEAD -- worker/market.ts worker/market-d1.ts worker/d1/marketplace.sql worker/d1/hub.sql`
Expected: aucune ligne (aucun fichier `market*` ni `hub.sql` modifié par ce plan).

- [ ] **Step 3: Mettre à jour le graphe**

Run: `graphify update .`
Expected: succès (AST seul, sans coût d'API).

- [ ] **Step 4: Rappel de déploiement (à lancer par l'utilisateur)**

1. `wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/pro.sql`
2. `pnpm build:cloudflare && npx wrangler deploy` (le Worker déploie `dist/worker.js` : toujours reconstruire)
3. Build et déploiement du front sur le projet Pages `ftour-bab-rayan-v3-3`.
