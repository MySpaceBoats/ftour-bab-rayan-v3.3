# Espace bénévole Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un espace privé pour les bénévoles confirmés : annonces épinglées, fil de publications avec photos privées, likes, commentaires, signalements, profils, modération admin.

**Architecture:** Module D1 écrit à la main (`worker/hub-d1.ts`, tables `hub_*`) + handler REST `/hub/*` dans le Worker (`worker/hub.ts`), branché dans `worker/index.ts` comme `handleMediaRequest`. Identité propre : lien magique par Resend → jeton de session aléatoire (haché en D1) envoyé en `Authorization: Bearer`. Photos dans R2 sous `private/hub/…`, servies par URLs signées. Client React dans `client/src/features/hub/`.

**Tech Stack:** TypeScript, Cloudflare Worker + D1 + R2, vitest + `node:sqlite` (D1 factice), React 19, wouter, sonner, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-10-09-volunteer-hub-design.md` (voir « Écarts décidés au plan » en fin de spec).

## Global Constraints

- Tests hermétiques : aucun accès réseau, Supabase, Resend ni R2 réels. D1 = `node:sqlite` en mémoire.
- Pas de `.skip` / `.only`. TS strict ; ne pas ajouter de dépendance.
- Bénévole éligible = ligne `t_volunteers` avec `status IN ('confirmed','present')` (email insensible à la casse).
- Jetons de lien et de session : 32 octets aléatoires hex, stockés **hachés SHA-256**. Lien : 15 min, usage unique. Session : 30 jours.
- Limites : post ≤ 2000 car., commentaire ≤ 500, ≤ 4 photos/post, 10 posts/h, 30 commentaires/h, 20 demandes d'upload/h, 3 liens de connexion/h/email, raison de signalement ≤ 300.
- Photos : bucket logique `hub` → clés R2 `private/hub/<memberId>/<uuid>.<ext>`, jamais servies par `/media`. URLs signées 1 h.
- CORS du Worker n'autorise que `GET, POST, PUT, DELETE, OPTIONS` : **pas de PATCH**, utiliser `PUT`.
- Le Worker gèle `Date` au chargement du module : toujours `Date.now()` / `deps.now()` **dans** les fonctions, jamais au niveau module.
- Ne pas committer `CLAUDE.md`, `.planning/STATE.md`, `.claude-flow/`, ni secrets. Toujours `git add <fichiers précis>` (jamais `commit -a`).
- Ne pas déployer en production : le déploiement Worker/Pages et l'application de `hub.sql` sur la D1 de prod sont lancés par l'utilisateur (Task 8).
- Projet Pages de prod : `ftour-bab-rayan-v3-3`. Ne jamais toucher `ftour-bab-rayan`.

## Review Focus

- Email inconnu / non confirmé à `POST /hub/login` : même réponse 200 qu'un email valide, aucun mail envoyé (pas d'énumération).
- Lien magique ouvert deux fois (scanner d'emails, double clic) : le second échoue proprement ; la vérification se fait par `POST`, jamais par `GET`.
- Bénévole passé à `cancelled` ou membre suspendu pendant qu'il est connecté : la requête suivante répond 401.
- Chemin de photo d'un autre membre ou contenant `..` dans `POST /hub/posts` : refusé (400).
- Texte contenant du HTML ou `<script>` : stocké tel quel, rendu échappé (React) ; jamais `dangerouslySetInnerHTML`.
- Auteur d'une publication masquée ou membre suspendu : ses contenus restent cohérents (pas de 500 dans le fil).
- Admin en mode démo (`x-demo-access`) : lecture seule sur `/hub/admin/*`.
- Limite connue, hors périmètre : photos orphelines (upload sans publication) non nettoyées ; à traiter avec un cron R2 plus tard.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `worker/d1/hub.sql` (créer) | Schéma D1 `hub_*`, idempotent |
| `worker/hub-d1.ts` (créer) | Couche données + règles métier (sans HTTP) |
| `worker/hub-d1.test.ts` (créer) | Tests D1 en mémoire |
| `worker/hub.ts` (créer) | Handler HTTP `/hub/*` |
| `worker/hub.test.ts` (créer) | Tests du handler avec `Request` |
| `worker/index.ts` (modifier) | Brancher `handleHubRequest` |
| `client/src/features/hub/api.ts` (créer) | Client REST + stockage du jeton |
| `client/src/features/hub/components/{Composer,PostCard}.tsx` (créer) | UI du fil |
| `client/src/features/hub/pages/{HubPage,HubProfilePage}.tsx` (créer) | Pages publiques |
| `client/src/features/hub/admin/AdminHub.tsx` (créer) | Page admin |
| `client/src/App.tsx`, `AdminRoutes.tsx`, `adminRouteMap.ts`, `shared/rbac/permissions.ts` (modifier) | Routes et menu |
| `client/src/features/public/pages/Benevole.tsx` (modifier) | Lien d'entrée |

---

### Task 1: Schéma et identité (lien magique, sessions, profil)

**Files:**
- Create: `worker/d1/hub.sql`
- Create: `worker/hub-d1.ts`
- Test: `worker/hub-d1.test.ts`

**Interfaces:**
- Produces (utilisés par les Tasks 2–4) :
  - `class HubError(code: "unauthorized"|"forbidden"|"not_found"|"invalid"|"rate_limited", message)`
  - `LIMITS`, `LOGIN_TTL_MS`, `SESSION_TTL_MS`, `TEAM_EMAIL`
  - `sha256Hex(s)`, `randomToken()`
  - `isEligible(d, email): Promise<boolean>`
  - `canRequestLogin(d, email, nowMs): Promise<boolean>`
  - `createLoginToken(d, email, nowMs): Promise<string>`
  - `openSession(d, loginToken, nowMs): Promise<{ session: string; member: MemberView }>`
  - `getSession(d, sessionToken, nowMs): Promise<MemberRow | null>`
  - `revokeSession(d, sessionToken, nowMs): Promise<void>`
  - `updateProfile(d, member, { display_name?, bio?, avatar_key? }): Promise<MemberView>`
  - `memberView(row): MemberView`
  - types `MemberRow`, `MemberView`

- [ ] **Step 1: Écrire le schéma `worker/d1/hub.sql`**

```sql
-- Espace bénévole. Idempotent. Appliquer : wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/hub.sql
CREATE TABLE IF NOT EXISTS hub_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_key TEXT,
  bio TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','moderator')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS hub_login_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hub_login_email ON hub_login_tokens(email, created_at);

CREATE TABLE IF NOT EXISTS hub_sessions (
  token_hash TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS hub_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  kind TEXT NOT NULL DEFAULT 'post' CHECK (kind IN ('post','announcement')),
  pinned INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_hub_posts_feed ON hub_posts(status, pinned, id DESC);
CREATE INDEX IF NOT EXISTS idx_hub_posts_member ON hub_posts(member_id, created_at);

-- r2_key = chemin dans le bucket logique "hub" (<memberId>/<uuid>.<ext>), pas la clé R2 complète
CREATE TABLE IF NOT EXISTS hub_post_media (
  post_id INTEGER NOT NULL REFERENCES hub_posts(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
  PRIMARY KEY (post_id, position)
);

CREATE TABLE IF NOT EXISTS hub_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES hub_posts(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_hub_comments_post ON hub_comments(post_id, id);
CREATE INDEX IF NOT EXISTS idx_hub_comments_member ON hub_comments(member_id, created_at);

CREATE TABLE IF NOT EXISTS hub_likes (
  post_id INTEGER NOT NULL REFERENCES hub_posts(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (post_id, member_id)
);

CREATE TABLE IF NOT EXISTS hub_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment')),
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 300),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (target_type, target_id, member_id)
);

CREATE TABLE IF NOT EXISTS hub_uploads (
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hub_uploads_member ON hub_uploads(member_id, created_at);
```

- [ ] **Step 2: Écrire les tests qui échouent `worker/hub-d1.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import * as h from "./hub-d1";

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

const T0 = Date.parse("2026-10-09T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
let sqlite: InstanceType<typeof DatabaseSync>;
let d: D1Like;

const vol = (email: string, status = "confirmed", first = "Amina", last = "Benali") =>
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?,?)").run(first, last, email, status);

async function login(email: string, now = T0) {
  return h.openSession(d, await h.createLoginToken(d, email, now), now);
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE t_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, status TEXT);");
  const sql = readFileSync(new URL("./d1/hub.sql", import.meta.url), "utf8");
  sqlite.exec(sql);
  sqlite.exec(sql); // idempotent
  d = fakeD1(sqlite);
});

describe("hub identity", () => {
  it("isEligible: confirmed/present only, case-insensitive", async () => {
    vol("ok@x.ma", "confirmed"); vol("here@x.ma", "present"); vol("new@x.ma", "registered"); vol("gone@x.ma", "cancelled");
    expect(await h.isEligible(d, "OK@x.ma ")).toBe(true);
    expect(await h.isEligible(d, "here@x.ma")).toBe(true);
    expect(await h.isEligible(d, "new@x.ma")).toBe(false);
    expect(await h.isEligible(d, "gone@x.ma")).toBe(false);
    expect(await h.isEligible(d, "nobody@x.ma")).toBe(false);
  });

  it("login token is single-use, expires, and is stored hashed", async () => {
    const raw = await h.createLoginToken(d, "a@x.ma", T0);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_login_tokens WHERE token_hash = ?").get(raw)).toEqual({ n: 0 });
    vol("a@x.ma");
    await h.openSession(d, raw, T0 + 1000);
    await expect(h.openSession(d, raw, T0 + 2000)).rejects.toMatchObject({ code: "unauthorized" });
    const late = await h.createLoginToken(d, "a@x.ma", T0);
    await expect(h.openSession(d, late, T0 + h.LOGIN_TTL_MS + 1)).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("opens a session, creates the member once, names it from the volunteer", async () => {
    vol("a@x.ma");
    const a = await login("A@x.ma");
    expect(a.member).toMatchObject({ display_name: "Amina B.", role: "member" });
    expect(JSON.stringify(a.member)).not.toContain("a@x.ma");
    await login("a@x.ma", T0 + 1000);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_members").get()).toEqual({ n: 1 });
    expect((await h.getSession(d, a.session, T0 + 5000))?.email).toBe("a@x.ma");
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_sessions WHERE token_hash = ?").get(a.session)).toEqual({ n: 0 });
  });

  it("refuses non-eligible volunteers and suspended members", async () => {
    vol("new@x.ma", "registered");
    await expect(login("new@x.ma")).rejects.toMatchObject({ code: "forbidden" });
    vol("s@x.ma");
    const s = await login("s@x.ma");
    sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id=?").run(s.member.id);
    expect(await h.getSession(d, s.session, T0 + 10)).toBeNull();
    await expect(login("s@x.ma", T0 + 20)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("session ends on revoke and on expiry", async () => {
    vol("a@x.ma");
    const a = await login("a@x.ma");
    expect(await h.getSession(d, a.session, T0 + h.SESSION_TTL_MS + 1)).toBeNull();
    expect(await h.getSession(d, a.session, T0 + 1)).not.toBeNull();
    await h.revokeSession(d, a.session, T0 + 2);
    expect(await h.getSession(d, a.session, T0 + 3)).toBeNull();
    expect(await h.getSession(d, "", T0)).toBeNull();
  });

  it("canRequestLogin allows 3 links per hour per email", async () => {
    for (let i = 0; i < 3; i++) {
      expect(await h.canRequestLogin(d, "a@x.ma", T0 + i)).toBe(true);
      await h.createLoginToken(d, "a@x.ma", T0 + i);
    }
    expect(await h.canRequestLogin(d, "a@x.ma", T0 + 10)).toBe(false);
    expect(await h.canRequestLogin(d, "a@x.ma", T0 + HOUR + 10)).toBe(true);
  });

  it("updateProfile validates name, bio and avatar ownership", async () => {
    vol("a@x.ma");
    const { member } = await login("a@x.ma");
    const row = (await h.getSession(d, (await login("a@x.ma", T0 + 1)).session, T0 + 2))!;
    expect(await h.updateProfile(d, row, { display_name: " Nadia ", bio: "Hello", avatar_key: `${member.id}/p.jpg` }))
      .toMatchObject({ display_name: "Nadia", bio: "Hello", avatar_key: `${member.id}/p.jpg` });
    await expect(h.updateProfile(d, row, { display_name: "" })).rejects.toMatchObject({ code: "invalid" });
    await expect(h.updateProfile(d, row, { display_name: "x".repeat(41) })).rejects.toMatchObject({ code: "invalid" });
    await expect(h.updateProfile(d, row, { bio: "x".repeat(301) })).rejects.toMatchObject({ code: "invalid" });
    await expect(h.updateProfile(d, row, { avatar_key: "999/p.jpg" })).rejects.toMatchObject({ code: "invalid" });
    await expect(h.updateProfile(d, row, { avatar_key: `${member.id}/../x.jpg` })).rejects.toMatchObject({ code: "invalid" });
  });
});
```

- [ ] **Step 3: Lancer, vérifier l'échec**

Run: `npx vitest run worker/hub-d1.test.ts`
Expected: FAIL (`Cannot find module './hub-d1'`).

- [ ] **Step 4: Implémenter `worker/hub-d1.ts` (partie identité)**

```ts
/**
 * Volunteer hub data layer on Cloudflare D1 (tables hub_*). No HTTP / Supabase imports: testable with a fake D1.
 * Time is always passed in (nowMs): the Worker freezes Date at module load.
 */
import type { D1Like } from "./gallery-d1";

export type HubErrorCode = "unauthorized" | "forbidden" | "not_found" | "invalid" | "rate_limited";
export class HubError extends Error {
  constructor(public code: HubErrorCode, message: string) { super(message); }
}

export const LOGIN_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
export const LIMITS = { postsPerHour: 10, commentsPerHour: 30, uploadsPerHour: 20, loginsPerHour: 3, post: 2000, comment: 500, media: 4, reason: 300, name: 40, bio: 300 };
export const TEAM_EMAIL = "equipe@hub.ftourbabrayan.ma"; // never a volunteer email: cannot log in

export interface MemberRow { id: number; email: string; display_name: string; avatar_key: string | null; bio: string; role: "member" | "moderator"; status: "active" | "suspended"; created_at: string }
export type MemberView = Omit<MemberRow, "email" | "status" | "created_at">;

export const iso = (ms: number) => new Date(ms).toISOString();
const normEmail = (e: string) => e.trim().toLowerCase();

export async function sha256Hex(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
}
export function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("");
}
export function memberView(m: MemberRow): MemberView {
  return { id: m.id, display_name: m.display_name, avatar_key: m.avatar_key, bio: m.bio, role: m.role };
}

export async function isEligible(d: D1Like, email: string): Promise<boolean> {
  const r = await d.prepare("SELECT 1 AS ok FROM t_volunteers WHERE lower(email) = ? AND status IN ('confirmed','present') LIMIT 1").bind(normEmail(email)).first();
  return r != null;
}

export async function canRequestLogin(d: D1Like, email: string, nowMs: number): Promise<boolean> {
  const r = await d.prepare("SELECT COUNT(*) AS n FROM hub_login_tokens WHERE email = ? AND created_at > ?").bind(normEmail(email), iso(nowMs - HOUR_MS)).first<{ n: number }>();
  return (r?.n ?? 0) < LIMITS.loginsPerHour;
}

export async function createLoginToken(d: D1Like, email: string, nowMs: number): Promise<string> {
  const raw = randomToken();
  await d.prepare("DELETE FROM hub_login_tokens WHERE expires_at < ?").bind(iso(nowMs - HOUR_MS)).run();
  await d.prepare("INSERT INTO hub_login_tokens (token_hash, email, created_at, expires_at) VALUES (?,?,?,?)")
    .bind(await sha256Hex(raw), normEmail(email), iso(nowMs), iso(nowMs + LOGIN_TTL_MS)).run();
  return raw;
}

async function upsertMember(d: D1Like, email: string): Promise<MemberRow> {
  const e = normEmail(email);
  const existing = await d.prepare("SELECT * FROM hub_members WHERE email = ?").bind(e).first<MemberRow>();
  if (existing) return existing;
  const v = await d.prepare("SELECT first_name, last_name FROM t_volunteers WHERE lower(email) = ? ORDER BY id LIMIT 1").bind(e).first<{ first_name: string; last_name: string }>();
  const name = v ? `${v.first_name} ${String(v.last_name ?? "").charAt(0)}.`.trim() : e.split("@")[0];
  const row = await d.prepare("INSERT INTO hub_members (email, display_name) VALUES (?,?) ON CONFLICT(email) DO UPDATE SET email = excluded.email RETURNING *")
    .bind(e, name.slice(0, LIMITS.name)).first<MemberRow>();
  return row!;
}

export async function openSession(d: D1Like, loginToken: string, nowMs: number): Promise<{ session: string; member: MemberView }> {
  const used = await d.prepare("UPDATE hub_login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING email")
    .bind(iso(nowMs), await sha256Hex(loginToken), iso(nowMs)).first<{ email: string }>();
  if (!used) throw new HubError("unauthorized", "Lien invalide ou expiré");
  if (!(await isEligible(d, used.email))) throw new HubError("forbidden", "Accès réservé aux bénévoles confirmés");
  const member = await upsertMember(d, used.email);
  if (member.status !== "active") throw new HubError("forbidden", "Compte suspendu");
  const session = randomToken();
  await d.prepare("INSERT INTO hub_sessions (token_hash, member_id, expires_at) VALUES (?,?,?)")
    .bind(await sha256Hex(session), member.id, iso(nowMs + SESSION_TTL_MS)).run();
  return { session, member: memberView(member) };
}

export async function getSession(d: D1Like, sessionToken: string, nowMs: number): Promise<MemberRow | null> {
  if (!sessionToken) return null;
  return d.prepare(
    "SELECT m.* FROM hub_sessions s JOIN hub_members m ON m.id = s.member_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND m.status = 'active'",
  ).bind(await sha256Hex(sessionToken), iso(nowMs)).first<MemberRow>();
}

export async function revokeSession(d: D1Like, sessionToken: string, nowMs: number): Promise<void> {
  await d.prepare("UPDATE hub_sessions SET revoked_at = ? WHERE token_hash = ?").bind(iso(nowMs), await sha256Hex(sessionToken)).run();
}

export async function updateProfile(d: D1Like, member: MemberRow, input: { display_name?: string; bio?: string; avatar_key?: string | null }): Promise<MemberView> {
  const name = input.display_name === undefined ? member.display_name : input.display_name.trim();
  const bio = input.bio === undefined ? member.bio : input.bio.trim();
  const avatar = input.avatar_key === undefined ? member.avatar_key : input.avatar_key;
  if (name.length < 1 || name.length > LIMITS.name) throw new HubError("invalid", "Nom invalide (1 à 40 caractères)");
  if (bio.length > LIMITS.bio) throw new HubError("invalid", "Bio trop longue (300 caractères max)");
  if (avatar != null && !isOwnPath(member.id, avatar)) throw new HubError("invalid", "Photo invalide");
  const row = await d.prepare("UPDATE hub_members SET display_name = ?, bio = ?, avatar_key = ? WHERE id = ? RETURNING *")
    .bind(name, bio, avatar, member.id).first<MemberRow>();
  return memberView(row!);
}

/** A bucket-relative media path must be "<memberId>/<file>" with no traversal. */
export function isOwnPath(memberId: number, path: string): boolean {
  return typeof path === "string" && !path.includes("..") && /^\d+\/[\w.\-]+$/.test(path) && path.startsWith(`${memberId}/`);
}
```

- [ ] **Step 5: Lancer, vérifier le succès**

Run: `npx vitest run worker/hub-d1.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add worker/d1/hub.sql worker/hub-d1.ts worker/hub-d1.test.ts
git commit -m "feat(hub): schema and magic-link identity layer"
```

---

### Task 2: Publications, fil, likes, commentaires, limites

**Files:**
- Modify: `worker/hub-d1.ts` (ajouter à la suite)
- Test: `worker/hub-d1.test.ts` (ajouter un `describe`)

**Interfaces:**
- Consumes: `HubError`, `LIMITS`, `iso`, `isOwnPath`, `MemberRow` (Task 1).
- Produces :
  - `interface PostView { id; body; kind: "post"|"announcement"; pinned: boolean; created_at; author: { id; display_name; avatar_key: string|null }; like_count; comment_count; liked: boolean; media: string[] }`
  - `interface CommentView { id; post_id; body; created_at; author: { id; display_name; avatar_key } }`
  - `createPost(d, member, { body: string; mediaPaths?: string[] }, nowMs): Promise<{ id: number }>`
  - `feed(d, viewerId, cursor?: number|null, limit?: number): Promise<{ pinned: PostView[]; posts: PostView[]; nextCursor: number|null }>`
  - `toggleLike(d, memberId, postId): Promise<{ liked: boolean; count: number }>`
  - `addComment(d, member, postId, body, nowMs): Promise<{ id: number }>`
  - `listComments(d, postId): Promise<CommentView[]>`
  - `removeContent(d, actor: MemberRow, type: "post"|"comment", id): Promise<void>` (propriétaire ou modérateur)
  - `recordUpload(d, memberId, nowMs): Promise<void>` (limite 20/h)

- [ ] **Step 1: Écrire les tests qui échouent** (ajouter à `worker/hub-d1.test.ts`)

```ts
async function member(email: string, first = "Amina", role?: "moderator") {
  vol(email, "confirmed", first, "Benali");
  const { session } = await login(email);
  const row = (await h.getSession(d, session, T0 + 1))!;
  if (role) sqlite.prepare("UPDATE hub_members SET role=? WHERE id=?").run(role, row.id);
  return (await h.getSession(d, session, T0 + 1))!;
}

describe("hub posts", () => {
  it("validates body and media", async () => {
    const m = await member("a@x.ma");
    await expect(h.createPost(d, m, { body: "  " }, T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(h.createPost(d, m, { body: "x".repeat(2001) }, T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(h.createPost(d, m, { body: "ok", mediaPaths: [1, 2, 3, 4, 5].map(i => `${m.id}/${i}.jpg`) }, T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(h.createPost(d, m, { body: "ok", mediaPaths: ["999/x.jpg"] }, T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(h.createPost(d, m, { body: "ok", mediaPaths: [`${m.id}/../x.jpg`] }, T0)).rejects.toMatchObject({ code: "invalid" });
  });

  it("rate-limits 10 posts per hour", async () => {
    const m = await member("a@x.ma");
    for (let i = 0; i < 10; i++) await h.createPost(d, m, { body: `p${i}` }, T0 + i);
    await expect(h.createPost(d, m, { body: "p11" }, T0 + 20)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(h.createPost(d, m, { body: "later" }, T0 + 60 * 60 * 1000 + 100)).resolves.toBeTruthy();
  });

  it("feed: newest first, cursor pagination, pinned only on first page, hidden excluded, media attached", async () => {
    const m = await member("a@x.ma");
    const ids: number[] = [];
    for (let i = 0; i < 25; i++) {
      ids.push((await h.createPost(d, m, { body: `p${i}`, mediaPaths: i === 24 ? [`${m.id}/a.jpg`, `${m.id}/b.jpg`] : [] }, T0 + i * 7 * 60 * 1000)).id);
    }
    sqlite.prepare("UPDATE hub_posts SET pinned=1, kind='announcement' WHERE id=?").run(ids[3]);
    sqlite.prepare("UPDATE hub_posts SET status='hidden' WHERE id=?").run(ids[10]);
    const p1 = await h.feed(d, m.id);
    expect(p1.pinned.map(p => p.id)).toEqual([ids[3]]);
    expect(p1.posts).toHaveLength(20);
    expect(p1.posts[0]).toMatchObject({ id: ids[24], media: [`${m.id}/a.jpg`, `${m.id}/b.jpg`], author: { display_name: "Amina B." } });
    expect(p1.posts.map(p => p.id)).not.toContain(ids[3]);
    expect(p1.posts.map(p => p.id)).not.toContain(ids[10]);
    const p2 = await h.feed(d, m.id, p1.nextCursor);
    expect(p2.pinned).toEqual([]);
    expect(p2.posts.length).toBe(3);
    expect(p2.nextCursor).toBeNull();
  });

  it("likes toggle per member, counts, liked flag, hidden post rejected", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await h.createPost(d, a, { body: "hello" }, T0);
    expect(await h.toggleLike(d, b.id, id)).toEqual({ liked: true, count: 1 });
    expect((await h.feed(d, b.id)).posts[0]).toMatchObject({ like_count: 1, liked: true });
    expect((await h.feed(d, a.id)).posts[0]).toMatchObject({ like_count: 1, liked: false });
    expect(await h.toggleLike(d, b.id, id)).toEqual({ liked: false, count: 0 });
    sqlite.prepare("UPDATE hub_posts SET status='hidden' WHERE id=?").run(id);
    await expect(h.toggleLike(d, b.id, id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("comments: validate, count, list ascending, rate-limit 30/h", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const { id } = await h.createPost(d, a, { body: "hello" }, T0);
    await expect(h.addComment(d, b, id, "", T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(h.addComment(d, b, id, "x".repeat(501), T0)).rejects.toMatchObject({ code: "invalid" });
    await expect(h.addComment(d, b, 9999, "ok", T0)).rejects.toMatchObject({ code: "not_found" });
    await h.addComment(d, b, id, "first", T0 + 1);
    await h.addComment(d, a, id, "second", T0 + 2);
    expect((await h.listComments(d, id)).map(c => c.body)).toEqual(["first", "second"]);
    expect((await h.feed(d, a.id)).posts[0].comment_count).toBe(2);
    for (let i = 0; i < 29; i++) await h.addComment(d, b, id, `c${i}`, T0 + 10 + i);
    await expect(h.addComment(d, b, id, "over", T0 + 100)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("removeContent: owner or moderator only; removed content disappears", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const mod = await member("m@x.ma", "Mona", "moderator");
    const p = await h.createPost(d, a, { body: "mine" }, T0);
    const c = await h.addComment(d, a, p.id, "mine too", T0 + 1);
    await expect(h.removeContent(d, b, "post", p.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(h.removeContent(d, b, "comment", c.id)).rejects.toMatchObject({ code: "forbidden" });
    await h.removeContent(d, a, "comment", c.id);
    expect(await h.listComments(d, p.id)).toEqual([]);
    await h.removeContent(d, mod, "post", p.id);
    expect((await h.feed(d, a.id)).posts).toEqual([]);
    await expect(h.removeContent(d, a, "post", 9999)).rejects.toMatchObject({ code: "not_found" });
  });

  it("recordUpload allows 20 per hour", async () => {
    const a = await member("a@x.ma");
    for (let i = 0; i < 20; i++) await h.recordUpload(d, a.id, T0 + i);
    await expect(h.recordUpload(d, a.id, T0 + 30)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(h.recordUpload(d, a.id, T0 + 60 * 60 * 1000 + 100)).resolves.toBeUndefined();
  });

  it("feed survives a suspended author", async () => {
    const a = await member("a@x.ma");
    await h.createPost(d, a, { body: "still here" }, T0);
    sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id=?").run(a.id);
    expect((await h.feed(d, a.id)).posts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run worker/hub-d1.test.ts`
Expected: FAIL (`h.createPost is not a function`).

- [ ] **Step 3: Implémenter (ajouter à `worker/hub-d1.ts`)**

```ts
// ---- posts / feed / likes / comments -------------------------------------

export interface PostView {
  id: number; body: string; kind: "post" | "announcement"; pinned: boolean; created_at: string;
  author: { id: number; display_name: string; avatar_key: string | null };
  like_count: number; comment_count: number; liked: boolean; media: string[];
}
export interface CommentView { id: number; post_id: number; body: string; created_at: string; author: { id: number; display_name: string; avatar_key: string | null } }

async function countSince(d: D1Like, table: "hub_posts" | "hub_comments" | "hub_uploads", memberId: number, nowMs: number): Promise<number> {
  const r = await d.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE member_id = ? AND created_at > ?`).bind(memberId, iso(nowMs - HOUR_MS)).first<{ n: number }>();
  return r?.n ?? 0;
}

function cleanBody(raw: unknown, max: number, label: string): string {
  const body = typeof raw === "string" ? raw.trim() : "";
  if (body.length < 1 || body.length > max) throw new HubError("invalid", `${label} invalide (1 à ${max} caractères)`);
  return body;
}

export async function recordUpload(d: D1Like, memberId: number, nowMs: number): Promise<void> {
  if ((await countSince(d, "hub_uploads", memberId, nowMs)) >= LIMITS.uploadsPerHour) throw new HubError("rate_limited", "Trop de photos envoyées, réessayez plus tard");
  await d.prepare("INSERT INTO hub_uploads (member_id, created_at) VALUES (?,?)").bind(memberId, iso(nowMs)).run();
}

export async function createPost(d: D1Like, member: MemberRow, input: { body: string; mediaPaths?: string[] }, nowMs: number): Promise<{ id: number }> {
  const body = cleanBody(input.body, LIMITS.post, "Message");
  const media = input.mediaPaths ?? [];
  if (media.length > LIMITS.media || !media.every(p => isOwnPath(member.id, p))) throw new HubError("invalid", "Photos invalides (4 max)");
  if ((await countSince(d, "hub_posts", member.id, nowMs)) >= LIMITS.postsPerHour) throw new HubError("rate_limited", "Trop de publications, réessayez plus tard");
  // ponytail: post then media are two statements (not atomic); a failed media insert leaves a text-only post
  const row = await d.prepare("INSERT INTO hub_posts (member_id, body, created_at) VALUES (?,?,?) RETURNING id").bind(member.id, body, iso(nowMs)).first<{ id: number }>();
  if (media.length) await d.batch(media.map((p, i) => d.prepare("INSERT INTO hub_post_media (post_id, r2_key, position) VALUES (?,?,?)").bind(row!.id, p, i)));
  return { id: row!.id };
}

async function loadPosts(d: D1Like, viewerId: number, pinned: 0 | 1, cursor: number | null, limit: number): Promise<PostView[]> {
  const { results } = await d.prepare(
    `SELECT p.id, p.body, p.kind, p.pinned, p.created_at, m.id AS author_id, m.display_name AS author_name, m.avatar_key AS author_avatar,
       (SELECT COUNT(*) FROM hub_likes l WHERE l.post_id = p.id) AS like_count,
       (SELECT COUNT(*) FROM hub_comments c WHERE c.post_id = p.id AND c.status = 'visible') AS comment_count,
       EXISTS(SELECT 1 FROM hub_likes l WHERE l.post_id = p.id AND l.member_id = ?) AS liked
     FROM hub_posts p JOIN hub_members m ON m.id = p.member_id
     WHERE p.status = 'visible' AND p.pinned = ? AND (? IS NULL OR p.id < ?)
     ORDER BY p.id DESC LIMIT ?`,
  ).bind(viewerId, pinned, cursor, cursor, limit).all<any>();
  const posts: PostView[] = results.map(r => ({
    id: r.id, body: r.body, kind: r.kind, pinned: Boolean(r.pinned), created_at: r.created_at,
    author: { id: r.author_id, display_name: r.author_name, avatar_key: r.author_avatar },
    like_count: r.like_count, comment_count: r.comment_count, liked: Boolean(r.liked), media: [],
  }));
  if (posts.length) {
    const ids = posts.map(p => p.id);
    const m = await d.prepare(`SELECT post_id, r2_key FROM hub_post_media WHERE post_id IN (${ids.map(() => "?").join(",")}) ORDER BY post_id, position`).bind(...ids).all<{ post_id: number; r2_key: string }>();
    for (const row of m.results) posts.find(p => p.id === row.post_id)!.media.push(row.r2_key);
  }
  return posts;
}

export async function feed(d: D1Like, viewerId: number, cursor: number | null = null, limit = 20) {
  const lim = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
  const pinned = cursor == null ? await loadPosts(d, viewerId, 1, null, 5) : [];
  const rows = await loadPosts(d, viewerId, 0, cursor, lim + 1);
  const posts = rows.slice(0, lim);
  return { pinned, posts, nextCursor: rows.length > lim ? posts[posts.length - 1].id : null };
}

async function visiblePost(d: D1Like, postId: number): Promise<void> {
  if (!(await d.prepare("SELECT 1 AS ok FROM hub_posts WHERE id = ? AND status = 'visible'").bind(postId).first())) throw new HubError("not_found", "Publication introuvable");
}

export async function toggleLike(d: D1Like, memberId: number, postId: number): Promise<{ liked: boolean; count: number }> {
  await visiblePost(d, postId);
  const removed = await d.prepare("DELETE FROM hub_likes WHERE post_id = ? AND member_id = ? RETURNING 1 AS x").bind(postId, memberId).first();
  if (!removed) await d.prepare("INSERT OR IGNORE INTO hub_likes (post_id, member_id) VALUES (?,?)").bind(postId, memberId).run();
  const c = await d.prepare("SELECT COUNT(*) AS n FROM hub_likes WHERE post_id = ?").bind(postId).first<{ n: number }>();
  return { liked: !removed, count: c?.n ?? 0 };
}

export async function addComment(d: D1Like, member: MemberRow, postId: number, rawBody: string, nowMs: number): Promise<{ id: number }> {
  const body = cleanBody(rawBody, LIMITS.comment, "Commentaire");
  await visiblePost(d, postId);
  if ((await countSince(d, "hub_comments", member.id, nowMs)) >= LIMITS.commentsPerHour) throw new HubError("rate_limited", "Trop de commentaires, réessayez plus tard");
  const row = await d.prepare("INSERT INTO hub_comments (post_id, member_id, body, created_at) VALUES (?,?,?,?) RETURNING id").bind(postId, member.id, body, iso(nowMs)).first<{ id: number }>();
  return { id: row!.id };
}

export async function listComments(d: D1Like, postId: number): Promise<CommentView[]> {
  const { results } = await d.prepare(
    `SELECT c.id, c.post_id, c.body, c.created_at, m.id AS author_id, m.display_name AS author_name, m.avatar_key AS author_avatar
     FROM hub_comments c JOIN hub_members m ON m.id = c.member_id WHERE c.post_id = ? AND c.status = 'visible' ORDER BY c.id ASC LIMIT 200`,
  ).bind(postId).all<any>();
  return results.map(r => ({ id: r.id, post_id: r.post_id, body: r.body, created_at: r.created_at, author: { id: r.author_id, display_name: r.author_name, avatar_key: r.author_avatar } }));
}

const TABLE = { post: "hub_posts", comment: "hub_comments" } as const;

/** Soft delete (status = hidden). Owner or moderator. Admin hides go through hideContent (Task 3). */
export async function removeContent(d: D1Like, actor: MemberRow, type: "post" | "comment", id: number): Promise<void> {
  const t = TABLE[type];
  if (!t) throw new HubError("invalid", "Type invalide");
  const row = await d.prepare(`SELECT member_id FROM ${t} WHERE id = ? AND status = 'visible'`).bind(id).first<{ member_id: number }>();
  if (!row) throw new HubError("not_found", "Contenu introuvable");
  if (row.member_id !== actor.id && actor.role !== "moderator") throw new HubError("forbidden", "Action non autorisée");
  await d.prepare(`UPDATE ${t} SET status = 'hidden' WHERE id = ?`).bind(id).run();
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run worker/hub-d1.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/hub-d1.ts worker/hub-d1.test.ts
git commit -m "feat(hub): posts, feed, likes, comments and rate limits"
```

---

### Task 3: Signalements et administration

**Files:**
- Modify: `worker/hub-d1.ts`
- Test: `worker/hub-d1.test.ts`

**Interfaces:**
- Consumes: Task 1–2 (`HubError`, `LIMITS`, `iso`, `MemberRow`, `TABLE`, `createPost`, `feed`, `listComments`).
- Produces :
  - `reportContent(d, member, type: "post"|"comment", id, reason): Promise<void>`
  - `listReports(d): Promise<ReportView[]>` avec `ReportView { id; target_type; target_id; reason; created_at; reporter: string; body: string|null; target_status: string|null }`
  - `dismissReport(d, id): Promise<void>`
  - `hideContent(d, type, id): Promise<void>` (admin, sans contrôle de propriété)
  - `postAnnouncement(d, { body, pinned }, nowMs): Promise<{ id: number }>`
  - `listMembers(d): Promise<AdminMemberView[]>` avec `AdminMemberView { id; email; display_name; role; status; created_at }`
  - `adminUpdateMember(d, id, { status?, role? }): Promise<void>`

- [ ] **Step 1: Écrire les tests qui échouent** (ajouter à `worker/hub-d1.test.ts`)

```ts
describe("hub moderation and admin", () => {
  it("reports: stored once per reporter, target must be visible, reason validated", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const p = await h.createPost(d, a, { body: "bad stuff" }, T0);
    await expect(h.reportContent(d, b, "post", p.id, "")).rejects.toMatchObject({ code: "invalid" });
    await expect(h.reportContent(d, b, "post", p.id, "x".repeat(301))).rejects.toMatchObject({ code: "invalid" });
    await expect(h.reportContent(d, b, "post", 9999, "spam")).rejects.toMatchObject({ code: "not_found" });
    await expect(h.reportContent(d, b, "bogus" as any, 1, "spam")).rejects.toMatchObject({ code: "invalid" });
    await h.reportContent(d, b, "post", p.id, "spam");
    await h.reportContent(d, b, "post", p.id, "spam again");
    const list = await h.listReports(d);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ target_type: "post", target_id: p.id, reason: "spam", reporter: "Brahim B.", body: "bad stuff", target_status: "visible" });
  });

  it("hideContent hides regardless of owner; dismissReport deletes the report", async () => {
    const a = await member("a@x.ma"); const b = await member("b@x.ma", "Brahim");
    const p = await h.createPost(d, a, { body: "bad" }, T0);
    const c = await h.addComment(d, a, p.id, "bad too", T0 + 1);
    await h.reportContent(d, b, "comment", c.id, "rude");
    await h.hideContent(d, "comment", c.id);
    expect(await h.listComments(d, p.id)).toEqual([]);
    expect((await h.listReports(d))[0]).toMatchObject({ target_status: "hidden" });
    await h.dismissReport(d, (await h.listReports(d))[0].id);
    expect(await h.listReports(d)).toEqual([]);
    await expect(h.hideContent(d, "post", 9999)).rejects.toMatchObject({ code: "not_found" });
  });

  it("postAnnouncement uses the team member, pinned shows on first page only", async () => {
    const a = await member("a@x.ma");
    await expect(h.postAnnouncement(d, { body: " ", pinned: true }, T0)).rejects.toMatchObject({ code: "invalid" });
    const x = await h.postAnnouncement(d, { body: "Réunion samedi", pinned: true }, T0);
    await h.postAnnouncement(d, { body: "Autre", pinned: false }, T0 + 1);
    const f = await h.feed(d, a.id);
    expect(f.pinned.map(p => p.id)).toEqual([x.id]);
    expect(f.pinned[0]).toMatchObject({ kind: "announcement", pinned: true, author: { display_name: "Équipe Ftour" } });
    expect(f.posts[0]).toMatchObject({ kind: "announcement", pinned: false });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_members WHERE email = ?").get(h.TEAM_EMAIL)).toEqual({ n: 1 });
    await expect(login(h.TEAM_EMAIL)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("listMembers + adminUpdateMember (status, role), suspended member loses access", async () => {
    const a = await member("a@x.ma");
    const { session } = await login("a@x.ma", T0 + 5);
    const list = await h.listMembers(d);
    expect(list[0]).toMatchObject({ email: "a@x.ma", role: "member", status: "active" });
    await h.adminUpdateMember(d, a.id, { role: "moderator" });
    expect((await h.getSession(d, session, T0 + 6))?.role).toBe("moderator");
    await h.adminUpdateMember(d, a.id, { status: "suspended" });
    expect(await h.getSession(d, session, T0 + 7)).toBeNull();
    await expect(h.adminUpdateMember(d, a.id, { status: "bogus" as any })).rejects.toMatchObject({ code: "invalid" });
    await expect(h.adminUpdateMember(d, a.id, { role: "root" as any })).rejects.toMatchObject({ code: "invalid" });
    await expect(h.adminUpdateMember(d, 9999, { status: "active" })).rejects.toMatchObject({ code: "not_found" });
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run worker/hub-d1.test.ts`
Expected: FAIL (`h.reportContent is not a function`).

- [ ] **Step 3: Implémenter (ajouter à `worker/hub-d1.ts`)**

```ts
// ---- moderation / admin ---------------------------------------------------

export interface ReportView { id: number; target_type: "post" | "comment"; target_id: number; reason: string; created_at: string; reporter: string; body: string | null; target_status: string | null }
export interface AdminMemberView { id: number; email: string; display_name: string; role: string; status: string; created_at: string }

export async function reportContent(d: D1Like, member: MemberRow, type: "post" | "comment", id: number, rawReason: string): Promise<void> {
  const t = TABLE[type];
  if (!t) throw new HubError("invalid", "Type invalide");
  const reason = cleanBody(rawReason, LIMITS.reason, "Motif");
  if (!(await d.prepare(`SELECT 1 AS ok FROM ${t} WHERE id = ? AND status = 'visible'`).bind(id).first())) throw new HubError("not_found", "Contenu introuvable");
  await d.prepare("INSERT OR IGNORE INTO hub_reports (target_type, target_id, member_id, reason) VALUES (?,?,?,?)").bind(type, id, member.id, reason).run();
}

export async function listReports(d: D1Like): Promise<ReportView[]> {
  const { results } = await d.prepare(
    `SELECT r.id, r.target_type, r.target_id, r.reason, r.created_at, m.display_name AS reporter,
       CASE r.target_type WHEN 'post' THEN (SELECT body FROM hub_posts WHERE id = r.target_id) ELSE (SELECT body FROM hub_comments WHERE id = r.target_id) END AS body,
       CASE r.target_type WHEN 'post' THEN (SELECT status FROM hub_posts WHERE id = r.target_id) ELSE (SELECT status FROM hub_comments WHERE id = r.target_id) END AS target_status
     FROM hub_reports r JOIN hub_members m ON m.id = r.member_id ORDER BY r.id DESC LIMIT 100`,
  ).all<ReportView>();
  return results;
}

export async function dismissReport(d: D1Like, id: number): Promise<void> {
  await d.prepare("DELETE FROM hub_reports WHERE id = ?").bind(id).run();
}

export async function hideContent(d: D1Like, type: "post" | "comment", id: number): Promise<void> {
  const t = TABLE[type];
  if (!t) throw new HubError("invalid", "Type invalide");
  if (!(await d.prepare(`SELECT 1 AS ok FROM ${t} WHERE id = ?`).bind(id).first())) throw new HubError("not_found", "Contenu introuvable");
  await d.prepare(`UPDATE ${t} SET status = 'hidden' WHERE id = ?`).bind(id).run();
}

async function teamMemberId(d: D1Like): Promise<number> {
  const row = await d.prepare("INSERT INTO hub_members (email, display_name, role) VALUES (?, 'Équipe Ftour', 'moderator') ON CONFLICT(email) DO UPDATE SET email = excluded.email RETURNING id")
    .bind(TEAM_EMAIL).first<{ id: number }>();
  return row!.id;
}

export async function postAnnouncement(d: D1Like, input: { body: string; pinned: boolean }, nowMs: number): Promise<{ id: number }> {
  const body = cleanBody(input.body, LIMITS.post, "Annonce");
  const row = await d.prepare("INSERT INTO hub_posts (member_id, body, kind, pinned, created_at) VALUES (?,?,'announcement',?,?) RETURNING id")
    .bind(await teamMemberId(d), body, input.pinned ? 1 : 0, iso(nowMs)).first<{ id: number }>();
  return { id: row!.id };
}

export async function listMembers(d: D1Like): Promise<AdminMemberView[]> {
  const { results } = await d.prepare("SELECT id, email, display_name, role, status, created_at FROM hub_members WHERE email <> ? ORDER BY id DESC LIMIT 500").bind(TEAM_EMAIL).all<AdminMemberView>();
  return results;
}

export async function adminUpdateMember(d: D1Like, id: number, input: { status?: "active" | "suspended"; role?: "member" | "moderator" }): Promise<void> {
  if (input.status !== undefined && !["active", "suspended"].includes(input.status)) throw new HubError("invalid", "Statut invalide");
  if (input.role !== undefined && !["member", "moderator"].includes(input.role)) throw new HubError("invalid", "Rôle invalide");
  const row = await d.prepare("UPDATE hub_members SET status = COALESCE(?, status), role = COALESCE(?, role) WHERE id = ? RETURNING id")
    .bind(input.status ?? null, input.role ?? null, id).first();
  if (!row) throw new HubError("not_found", "Membre introuvable");
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run worker/hub-d1.test.ts`
Expected: PASS (18 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/hub-d1.ts worker/hub-d1.test.ts
git commit -m "feat(hub): reports, announcements and admin member controls"
```

---

### Task 4: Handler HTTP `/hub/*`

**Files:**
- Create: `worker/hub.ts`
- Test: `worker/hub.test.ts`

**Interfaces:**
- Consumes: tout `hub-d1.ts` ; `createR2Storage`, `MediaEnv` (`worker/media-r2.ts`) ; `sendEmail` (`worker/email.ts`) ; `createWorkerContext` (`worker/context.ts`).
- Produces : `handleHubRequest(request: Request, env: HubEnv, cors: Record<string,string>, deps?: HubDeps): Promise<Response | null>` — renvoie `null` si le chemin ne commence pas par `/hub/`.
- Routes (toutes JSON, `Cache-Control: no-store`) :
  - Membre : `POST login`, `POST verify`, `POST logout`, `GET me`, `PUT me`, `GET feed?cursor=`, `POST posts`, `DELETE posts/:id`, `POST posts/:id/like`, `GET posts/:id/comments`, `POST posts/:id/comments`, `DELETE comments/:id`, `POST media`, `POST report`.
  - Admin (Bearer Supabase + rôle) : `GET admin/reports`, `POST admin/reports/:id/dismiss`, `POST admin/posts`, `POST admin/hide`, `GET admin/members`, `PUT admin/members/:id`.
  - Réponses d'erreur : `{ error: <code>, message }` avec 401/403/404/400/429, 500 `{ error: "internal" }`.

- [ ] **Step 1: Écrire les tests qui échouent `worker/hub.test.ts`**

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
const T0 = Date.parse("2026-10-09T12:00:00.000Z");
let sqlite: InstanceType<typeof DatabaseSync>;
let env: HubEnv;
let mails: { to: string; subject: string; html: string }[];
let clock: number;

const deps = (): HubDeps => ({
  now: () => clock,
  sendMail: async (to, subject, html) => { mails.push({ to, subject, html }); },
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
const tokenFromMail = () => /token=([a-f0-9]{64})/.exec(mails[mails.length - 1].html)![1];

async function signIn(email = "a@x.ma") {
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('Amina','Benali',?, 'confirmed')").run(email);
  await call("POST", "/hub/login", { body: { email } });
  const v = await call("POST", "/hub/verify", { body: { token: tokenFromMail() } });
  return (await v.json()) as { session: string; member: { id: number } };
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE t_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, status TEXT);");
  sqlite.exec(readFileSync(new URL("./d1/hub.sql", import.meta.url), "utf8"));
  env = { DB: fakeD1(sqlite), JWT_SECRET: "test-secret", MEDIA_BASE_URL: "https://m.test", GALLERY_MEDIA: undefined, PUBLIC_APP_URL: "https://site.test" };
  mails = [];
  clock = T0;
});

describe("hub http", () => {
  it("ignores non-hub paths; unknown hub path is 404; CORS is applied; bad JSON is 400", async () => {
    expect(await handleHubRequest(new Request("https://w.test/api/trpc"), env, CORS, deps())).toBeNull();
    const r = await call("GET", "/hub/nope");
    expect(r.status).toBe(404);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(CORS["Access-Control-Allow-Origin"]);
    const bad = await handleHubRequest(new Request("https://w.test/hub/login", { method: "POST", body: "{nope" }), env, CORS, deps());
    expect(bad!.status).toBe(400);
  });

  it("login: same answer for unknown/ineligible, no mail; eligible gets one mail with a 15-min link; 3/h cap", async () => {
    sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('N','B','new@x.ma','registered')").run();
    for (const email of ["nobody@x.ma", "new@x.ma"]) {
      const r = await call("POST", "/hub/login", { body: { email } });
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ ok: true });
    }
    expect(mails).toHaveLength(0);
    expect((await call("POST", "/hub/login", { body: { email: "not-an-email" } })).status).toBe(400);
    sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('A','B','a@x.ma','confirmed')").run();
    for (let i = 0; i < 5; i++) expect((await call("POST", "/hub/login", { body: { email: "a@x.ma" } })).status).toBe(200);
    expect(mails).toHaveLength(3);
    expect(mails[0].to).toBe("a@x.ma");
    expect(mails[0].html).toContain("https://site.test/fr/benevole/espace?token=");
  });

  it("verify opens a session usable on /hub/me; token is single-use; logout revokes", async () => {
    const { session, member } = await signIn();
    const me = await call("GET", "/hub/me", { token: session });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ member: { id: member.id, display_name: "Amina B." } });
    expect((await call("POST", "/hub/verify", { body: { token: tokenFromMail() } })).status).toBe(401);
    expect((await call("GET", "/hub/me")).status).toBe(401);
    expect((await call("POST", "/hub/logout", { token: session })).status).toBe(200);
    expect((await call("GET", "/hub/me", { token: session })).status).toBe(401);
  });

  it("a suspended member gets 401 on the next request", async () => {
    const { session, member } = await signIn();
    sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id=?").run(member.id);
    expect((await call("GET", "/hub/feed", { token: session })).status).toBe(401);
  });

  it("post, feed with signed photo URL, like, comment, delete", async () => {
    const { session, member } = await signIn();
    const up = await call("POST", "/hub/media", { token: session, body: { contentType: "image/jpeg" } });
    const { path, uploadUrl } = (await up.json()) as { path: string; uploadUrl: string };
    expect(path).toMatch(new RegExp(`^${member.id}/[0-9a-f-]{36}\\.jpg$`));
    expect(uploadUrl).toContain(`https://m.test/media-upload/private/hub/${path}?exp=`);
    expect((await call("POST", "/hub/media", { token: session, body: { contentType: "text/html" } })).status).toBe(400);

    const created = await call("POST", "/hub/posts", { token: session, body: { body: "Salam <script>alert(1)</script>", media: [path] } });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: number };
    const feed = (await (await call("GET", "/hub/feed", { token: session })).json()) as any;
    expect(feed.posts[0].body).toBe("Salam <script>alert(1)</script>");
    expect(feed.posts[0].media[0]).toContain(`https://m.test/media-signed/private/hub/${path}?exp=`);

    expect(await (await call("POST", `/hub/posts/${id}/like`, { token: session })).json()).toEqual({ liked: true, count: 1 });
    const c = await call("POST", `/hub/posts/${id}/comments`, { token: session, body: { body: "bravo" } });
    expect(c.status).toBe(200);
    const comments = (await (await call("GET", `/hub/posts/${id}/comments`, { token: session })).json()) as any;
    expect(comments.comments[0]).toMatchObject({ body: "bravo" });
    expect((await call("DELETE", `/hub/comments/${comments.comments[0].id}`, { token: session })).status).toBe(200);
    expect((await call("DELETE", `/hub/posts/${id}`, { token: session })).status).toBe(200);
    expect(((await (await call("GET", "/hub/feed", { token: session })).json()) as any).posts).toEqual([]);
  });

  it("refuses another member's photo path and path traversal", async () => {
    const { session } = await signIn();
    expect((await call("POST", "/hub/posts", { token: session, body: { body: "x", media: ["999/a.jpg"] } })).status).toBe(400);
    expect((await call("POST", "/hub/posts", { token: session, body: { body: "x", media: ["1/../a.jpg"] } })).status).toBe(400);
  });

  it("profile update through PUT /hub/me", async () => {
    const { session } = await signIn();
    const r = await call("PUT", "/hub/me", { token: session, body: { display_name: "Nadia", bio: "Hi" } });
    expect(await r.json()).toMatchObject({ member: { display_name: "Nadia", bio: "Hi" } });
  });

  it("report flow and admin gate", async () => {
    const a = await signIn("a@x.ma");
    const b = await signIn("b@x.ma");
    const { id } = (await (await call("POST", "/hub/posts", { token: a.session, body: { body: "bad" } })).json()) as { id: number };
    expect((await call("POST", "/hub/report", { token: b.session, body: { type: "post", id, reason: "spam" } })).status).toBe(200);

    expect((await call("GET", "/hub/admin/reports")).status).toBe(403);
    expect((await call("GET", "/hub/admin/reports", { admin: "user" })).status).toBe(403);
    const reports = (await (await call("GET", "/hub/admin/reports", { admin: "admin_ops" })).json()) as any;
    expect(reports.reports[0]).toMatchObject({ target_id: id, reason: "spam" });

    expect((await call("POST", "/hub/admin/hide", { admin: "admin", body: { type: "post", id } })).status).toBe(200);
    expect(((await (await call("GET", "/hub/feed", { token: b.session })).json()) as any).posts).toEqual([]);
    expect((await call("POST", `/hub/admin/reports/${reports.reports[0].id}/dismiss`, { admin: "admin" })).status).toBe(200);
  });

  it("admin announcements and member control; demo mode is read-only", async () => {
    const a = await signIn();
    expect((await call("POST", "/hub/admin/posts", { admin: "demo", body: { body: "x", pinned: true } })).status).toBe(403);
    expect((await call("GET", "/hub/admin/members", { admin: "demo" })).status).toBe(200);
    expect((await call("POST", "/hub/admin/posts", { admin: "admin", body: { body: "Réunion", pinned: true } })).status).toBe(200);
    const feed = (await (await call("GET", "/hub/feed", { token: a.session })).json()) as any;
    expect(feed.pinned[0]).toMatchObject({ body: "Réunion", kind: "announcement" });
    const members = (await (await call("GET", "/hub/admin/members", { admin: "admin" })).json()) as any;
    expect(members.members[0].email).toBe("a@x.ma");
    expect((await call("PUT", `/hub/admin/members/${a.member.id}`, { admin: "admin", body: { status: "suspended" } })).status).toBe(200);
    expect((await call("GET", "/hub/me", { token: a.session })).status).toBe(401);
    expect((await call("PUT", `/hub/admin/members/${a.member.id}`, { admin: "admin", body: { status: "nope" } })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run worker/hub.test.ts`
Expected: FAIL (`Cannot find module './hub'`).

- [ ] **Step 3: Implémenter `worker/hub.ts`**

```ts
/** REST handler for the volunteer hub. Mounted from worker/index.ts like handleMediaRequest. */
import type { D1Like } from "./gallery-d1";
import { createR2Storage, type MediaEnv } from "./media-r2";
import { sendEmail } from "./email";
import { createWorkerContext } from "./context";
import type { Env } from "./index";
import * as H from "./hub-d1";

export interface HubEnv extends MediaEnv { DB?: D1Like; RESEND_API_KEY?: string; EMAIL_PROVIDER_KEY?: string; PUBLIC_APP_URL?: string }
export interface HubDeps {
  now?: () => number;
  sendMail?: (to: string, subject: string, html: string) => Promise<unknown>;
  adminUser?: (request: Request) => Promise<{ role: string; isDemo?: boolean } | null>;
}

// mirrors client ROUTE_ROLES for '/admin/benevoles' (ADMIN_BASE + admin_ops)
const ADMIN_ROLES = new Set(["super_admin", "admin", "admin_ops"]);
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const STATUS: Record<H.HubErrorCode, number> = { unauthorized: 401, forbidden: 403, not_found: 404, invalid: 400, rate_limited: 429 };
const SIGN_TTL_S = 3600;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    throw new H.HubError("invalid", "JSON invalide");
  }
}
const num = (v: unknown) => (typeof v === "string" || typeof v === "number") && /^\d+$/.test(String(v)) ? Number(v) : NaN;

export async function handleHubRequest(request: Request, env: HubEnv, cors: Record<string, string>, deps: HubDeps = {}): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/hub/")) return null;
  const path = url.pathname.slice("/hub/".length).replace(/\/$/, "");
  const now = deps.now ?? Date.now;
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const match = (method: string, re: RegExp) => (request.method === method ? re.exec(path) : null);

  try {
    if (!env.DB) throw new Error("D1 binding DB is not configured");
    const d = env.DB;
    const storage = createR2Storage(env, now).from("hub");
    const sign = async (p: string | null) => (p ? ((await storage.createSignedUrl(p, SIGN_TTL_S)).data?.signedUrl ?? null) : null);
    const present = async (p: H.PostView) => ({
      ...p,
      media: await Promise.all(p.media.map(sign)),
      author: { ...p.author, avatar: await sign(p.author.avatar_key) },
    });
    const sendMail = deps.sendMail ?? ((to: string, subject: string, html: string) =>
      sendEmail({ to, subject, html, apiKey: env.RESEND_API_KEY || env.EMAIL_PROVIDER_KEY || "" }));

    const member = async () => {
      const a = request.headers.get("authorization") ?? "";
      const m = a.startsWith("Bearer ") ? await H.getSession(d, a.slice(7), now()) : null;
      if (!m) throw new H.HubError("unauthorized", "Connexion requise");
      return m;
    };
    const admin = async () => {
      const u = await (deps.adminUser ?? (async (req: Request) => (await createWorkerContext(req, env as unknown as Env)).user))(request);
      if (!u || !ADMIN_ROLES.has(u.role)) throw new H.HubError("forbidden", "Réservé aux administrateurs");
      if (u.isDemo && request.method !== "GET") throw new H.HubError("forbidden", "Mode démo en lecture seule");
    };

    let m: RegExpExecArray | null;

    // ---- session -----------------------------------------------------------
    if (match("POST", /^login$/)) {
      const email = String((await readJson(request)).email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 320) throw new H.HubError("invalid", "Email invalide");
      // same answer whether or not the email is eligible (no enumeration)
      if ((await H.isEligible(d, email)) && (await H.canRequestLogin(d, email, now()))) {
        const token = await H.createLoginToken(d, email, now());
        const base = (env.PUBLIC_APP_URL || "https://www.ftourbabrayan.ma").replace(/\/$/, "");
        const link = `${base}/fr/benevole/espace?token=${token}`;
        await sendMail(email, "Votre lien de connexion — Espace bénévole", `<p>Bonjour,</p><p>Voici votre lien de connexion à l'espace bénévole Ftour Bab Rayan (valable 15 minutes, usage unique) :</p><p><a href="${link}">Ouvrir l'espace bénévole</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`);
      }
      return json({ ok: true });
    }
    if (match("POST", /^verify$/)) {
      const token = String((await readJson(request)).token ?? "");
      return json(await H.openSession(d, token, now()));
    }
    if (match("POST", /^logout$/)) {
      const a = request.headers.get("authorization") ?? "";
      if (a.startsWith("Bearer ")) await H.revokeSession(d, a.slice(7), now());
      return json({ ok: true });
    }
    if (match("GET", /^me$/)) {
      const me = await member();
      return json({ member: { ...H.memberView(me), avatar: await sign(me.avatar_key) } });
    }
    if (match("PUT", /^me$/)) {
      const me = await member();
      const b = await readJson(request);
      const view = await H.updateProfile(d, me, {
        ...(typeof b.display_name === "string" ? { display_name: b.display_name } : {}),
        ...(typeof b.bio === "string" ? { bio: b.bio } : {}),
        ...("avatar_key" in b ? { avatar_key: typeof b.avatar_key === "string" ? b.avatar_key : null } : {}),
      });
      return json({ member: { ...view, avatar: await sign(view.avatar_key) } });
    }

    // ---- feed / posts ------------------------------------------------------
    if (match("GET", /^feed$/)) {
      const me = await member();
      const c = url.searchParams.get("cursor");
      const f = await H.feed(d, me.id, c && /^\d+$/.test(c) ? Number(c) : null);
      return json({ pinned: await Promise.all(f.pinned.map(present)), posts: await Promise.all(f.posts.map(present)), nextCursor: f.nextCursor });
    }
    if (match("POST", /^posts$/)) {
      const me = await member();
      const b = await readJson(request);
      const media = Array.isArray(b.media) ? b.media.filter((x): x is string => typeof x === "string") : [];
      return json(await H.createPost(d, me, { body: String(b.body ?? ""), mediaPaths: media }, now()));
    }
    if ((m = match("DELETE", /^posts\/(\d+)$/))) {
      await H.removeContent(d, await member(), "post", Number(m[1]));
      return json({ ok: true });
    }
    if ((m = match("POST", /^posts\/(\d+)\/like$/))) {
      const me = await member();
      return json(await H.toggleLike(d, me.id, Number(m[1])));
    }
    if ((m = match("GET", /^posts\/(\d+)\/comments$/))) {
      await member();
      const comments = await H.listComments(d, Number(m[1]));
      return json({ comments: await Promise.all(comments.map(async c => ({ ...c, author: { ...c.author, avatar: await sign(c.author.avatar_key) } }))) });
    }
    if ((m = match("POST", /^posts\/(\d+)\/comments$/))) {
      const me = await member();
      return json(await H.addComment(d, me, Number(m[1]), String((await readJson(request)).body ?? ""), now()));
    }
    if ((m = match("DELETE", /^comments\/(\d+)$/))) {
      await H.removeContent(d, await member(), "comment", Number(m[1]));
      return json({ ok: true });
    }

    // ---- media / report ----------------------------------------------------
    if (match("POST", /^media$/)) {
      const me = await member();
      const ext = EXT[String((await readJson(request)).contentType ?? "")];
      if (!ext) throw new H.HubError("invalid", "Format d'image non supporté (jpeg, png, webp, gif)");
      await H.recordUpload(d, me.id, now());
      const p = `${me.id}/${crypto.randomUUID()}.${ext}`;
      const r = await storage.createSignedUploadUrl(p);
      if (!r.data) throw new Error(r.error?.message ?? "signed upload failed");
      return json({ path: p, uploadUrl: r.data.signedUrl });
    }
    if (match("POST", /^report$/)) {
      const me = await member();
      const b = await readJson(request);
      await H.reportContent(d, me, b.type as "post" | "comment", num(b.id), String(b.reason ?? ""));
      return json({ ok: true });
    }

    // ---- admin (Supabase bearer + role) ------------------------------------
    if (match("GET", /^admin\/reports$/)) { await admin(); return json({ reports: await H.listReports(d) }); }
    if ((m = match("POST", /^admin\/reports\/(\d+)\/dismiss$/))) { await admin(); await H.dismissReport(d, Number(m[1])); return json({ ok: true }); }
    if (match("POST", /^admin\/posts$/)) {
      await admin();
      const b = await readJson(request);
      return json(await H.postAnnouncement(d, { body: String(b.body ?? ""), pinned: b.pinned === true }, now()));
    }
    if (match("POST", /^admin\/hide$/)) {
      await admin();
      const b = await readJson(request);
      await H.hideContent(d, b.type as "post" | "comment", num(b.id));
      return json({ ok: true });
    }
    if (match("GET", /^admin\/members$/)) { await admin(); return json({ members: await H.listMembers(d) }); }
    if ((m = match("PUT", /^admin\/members\/(\d+)$/))) {
      await admin();
      const b = await readJson(request);
      await H.adminUpdateMember(d, Number(m[1]), { status: b.status as any, role: b.role as any });
      return json({ ok: true });
    }

    return json({ error: "not_found", message: "Route inconnue" }, 404);
  } catch (e) {
    if (e instanceof H.HubError) return json({ error: e.code, message: e.message }, STATUS[e.code]);
    console.error("[hub]", e);
    return json({ error: "internal" }, 500);
  }
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run worker/hub.test.ts worker/hub-d1.test.ts`
Expected: PASS (9 + 18 tests).

- [ ] **Step 5: Typecheck des fichiers du hub**

Run: `npx tsc --noEmit 2>&1 | grep -E "worker/hub"; echo "rc=$?"`
Expected: aucune ligne `worker/hub…` (rc=1 de grep = pas d'erreur trouvée). Corriger toute erreur dans ces fichiers uniquement ; les autres erreurs de `tsc` existent déjà.

- [ ] **Step 6: Commit**

```bash
git add worker/hub.ts worker/hub.test.ts
git commit -m "feat(hub): REST handler for the volunteer hub"
```

---

### Task 5: Brancher le handler dans le Worker

**Files:**
- Modify: `worker/index.ts` (import près de la ligne 47 ; appel juste après le bloc `handleMediaRequest`, ~ligne 161-162)

**Interfaces:**
- Consumes: `handleHubRequest(request, env, cors)` (Task 4).

- [ ] **Step 1: Ajouter l'import**

Après `import { handleMediaRequest } from './media-r2';` ajouter :

```ts
import { handleHubRequest } from './hub';
```

- [ ] **Step 2: Ajouter l'appel**

Juste après :

```ts
    const media = await handleMediaRequest(request, env, baseCorsHeaders);
    if (media) return media;
```

ajouter :

```ts

    // Volunteer hub REST API (/hub/*)
    const hub = await handleHubRequest(request, env, baseCorsHeaders);
    if (hub) return hub;
```

- [ ] **Step 3: Vérifier**

Run: `npx vitest run worker 2>&1 | tail -8` puis `npx tsc --noEmit 2>&1 | grep -E "worker/(index|hub)"; echo "rc=$?"`
Expected: les tests hub passent ; seuls les 2 échecs `email.group` déjà connus restent ; aucune erreur TS dans `worker/index.ts` ni `worker/hub*.ts`.

- [ ] **Step 4: Commit**

```bash
git add worker/index.ts
git commit -m "feat(hub): mount /hub routes in the Worker"
```

---

### Task 6: Client — API, page de connexion, fil, profil

**Files:**
- Create: `client/src/features/hub/api.ts`
- Create: `client/src/features/hub/components/Composer.tsx`
- Create: `client/src/features/hub/components/PostCard.tsx`
- Create: `client/src/features/hub/pages/HubPage.tsx`
- Create: `client/src/features/hub/pages/HubProfilePage.tsx`
- Modify: `client/src/App.tsx` (imports ~ligne 31 ; routes ~ligne 333)
- Modify: `client/src/features/public/pages/Benevole.tsx` (lien d'entrée)

**Interfaces:**
- Consumes: routes `/hub/*` (Task 4) ; `getStoredSession` de `@/_core/authSession` (admin, Task 7).
- Produces (`api.ts`) : `getHubToken/setHubToken`, `HubApiError`, types `Member`, `Post`, `Comment`, `Report`, `AdminMember`, et fonctions `requestLogin`, `verifyLogin`, `getMe`, `updateMe`, `logout`, `getFeed`, `createPost`, `toggleLike`, `getComments`, `addComment`, `removePost`, `removeComment`, `report`, `uploadImage`, `adminReports`, `adminDismiss`, `adminHide`, `adminAnnounce`, `adminMembers`, `adminUpdateMember`.

Pas de test automatisé côté client (le dépôt n'a pas de harnais React) : la vérification est `tsc` + `vite build` + parcours manuel (Step 7).

- [ ] **Step 1: Créer `client/src/features/hub/api.ts`**

```ts
import { getStoredSession } from "@/_core/authSession";

// The static site and the Worker live on different origins: the hub token travels in an Authorization header (no cookie).
const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "/api/trpc";
const ORIGIN = new URL(apiBase, window.location.origin).origin;
const KEY = "hub_session";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const getHubToken = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setHubToken = (t: string | null) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };

export class HubApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export interface Member { id: number; display_name: string; bio: string; role: "member" | "moderator"; avatar_key: string | null; avatar?: string | null }
export interface Author { id: number; display_name: string; avatar: string | null }
export interface Post { id: number; body: string; kind: "post" | "announcement"; pinned: boolean; created_at: string; author: Author; like_count: number; comment_count: number; liked: boolean; media: (string | null)[] }
export interface Comment { id: number; post_id: number; body: string; created_at: string; author: Author }
export interface Report { id: number; target_type: "post" | "comment"; target_id: number; reason: string; created_at: string; reporter: string; body: string | null; target_status: string | null }
export interface AdminMember { id: number; email: string; display_name: string; role: "member" | "moderator"; status: "active" | "suspended"; created_at: string }

async function call<T>(method: string, path: string, opts: { body?: unknown; admin?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  // ponytail: admin calls use the stored Supabase access token as-is; tRPC refreshes it on the next admin request
  const token = opts.admin ? getStoredSession()?.accessToken : getHubToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${ORIGIN}/hub/${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  } catch {
    throw new HubApiError(0, "network", "Connexion impossible, réessayez.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HubApiError(res.status, data.error ?? "error", data.message ?? "Une erreur est survenue.");
  return data as T;
}

export const requestLogin = (email: string) => call<{ ok: true }>("POST", "login", { body: { email } });
export const verifyLogin = (token: string) => call<{ session: string; member: Member }>("POST", "verify", { body: { token } });
export const getMe = () => call<{ member: Member }>("GET", "me").then(r => r.member);
export const updateMe = (b: { display_name?: string; bio?: string; avatar_key?: string | null }) => call<{ member: Member }>("PUT", "me", { body: b }).then(r => r.member);
export const logout = () => call<{ ok: true }>("POST", "logout").finally(() => setHubToken(null));
export const getFeed = (cursor: number | null) => call<{ pinned: Post[]; posts: Post[]; nextCursor: number | null }>("GET", `feed${cursor ? `?cursor=${cursor}` : ""}`);
export const createPost = (body: string, media: string[]) => call<{ id: number }>("POST", "posts", { body: { body, media } });
export const toggleLike = (id: number) => call<{ liked: boolean; count: number }>("POST", `posts/${id}/like`);
export const getComments = (id: number) => call<{ comments: Comment[] }>("GET", `posts/${id}/comments`).then(r => r.comments);
export const addComment = (id: number, body: string) => call<{ id: number }>("POST", `posts/${id}/comments`, { body: { body } });
export const removePost = (id: number) => call<{ ok: true }>("DELETE", `posts/${id}`);
export const removeComment = (id: number) => call<{ ok: true }>("DELETE", `comments/${id}`);
export const report = (type: "post" | "comment", id: number, reason: string) => call<{ ok: true }>("POST", "report", { body: { type, id, reason } });

/** Uploads one image to R2 through a signed URL; returns the bucket-relative path to send with the post. */
export async function uploadImage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new HubApiError(0, "too_large", "Image trop lourde (8 Mo max).");
  const { path, uploadUrl } = await call<{ path: string; uploadUrl: string }>("POST", "media", { body: { contentType: file.type } });
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!res.ok) throw new HubApiError(res.status, "upload", "Envoi de la photo impossible.");
  return path;
}

export const adminReports = () => call<{ reports: Report[] }>("GET", "admin/reports", { admin: true }).then(r => r.reports);
export const adminDismiss = (id: number) => call<{ ok: true }>("POST", `admin/reports/${id}/dismiss`, { admin: true });
export const adminHide = (type: "post" | "comment", id: number) => call<{ ok: true }>("POST", "admin/hide", { admin: true, body: { type, id } });
export const adminAnnounce = (body: string, pinned: boolean) => call<{ id: number }>("POST", "admin/posts", { admin: true, body: { body, pinned } });
export const adminMembers = () => call<{ members: AdminMember[] }>("GET", "admin/members", { admin: true }).then(r => r.members);
export const adminUpdateMember = (id: number, b: { status?: "active" | "suspended"; role?: "member" | "moderator" }) => call<{ ok: true }>("PUT", `admin/members/${id}`, { admin: true, body: b });
```

- [ ] **Step 2: Créer `client/src/features/hub/components/Composer.tsx`**

```tsx
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import * as hub from "../api";

const MAX_PHOTOS = 4;

export default function Composer({ onPosted }: { onPosted: () => void }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)].filter(f => f.type.startsWith("image/")).slice(0, MAX_PHOTOS);
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const paths = await Promise.all(files.map(hub.uploadImage));
      await hub.createPost(body, paths);
      setBody("");
      setFiles([]);
      onPosted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white p-3 space-y-3">
      <Textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={3} placeholder="Partagez un moment, une photo, un remerciement…" />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative h-20 w-20">
              <img src={URL.createObjectURL(f)} alt="" className="h-20 w-20 rounded-lg object-cover" />
              <button type="button" aria-label="Retirer la photo" className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={e => pick(e.target.files)} />
        <Button type="button" variant="ghost" size="sm" disabled={files.length >= MAX_PHOTOS} onClick={() => fileRef.current?.click()}>
          <ImagePlus size={16} className="mr-1" /> Photo ({files.length}/{MAX_PHOTOS})
        </Button>
        <Button type="button" onClick={submit} disabled={busy || !body.trim()}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Publier"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Créer `client/src/features/hub/components/PostCard.tsx`**

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { Flag, Heart, MessageCircle, Pin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as hub from "../api";

const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function PostCard({ post, me, onChanged }: { post: hub.Post; me: hub.Member; onChanged: () => void }) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.like_count);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<hub.Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const canDelete = post.author.id === me.id || me.role === "moderator";

  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e) { toast.error((e as Error).message); }
  };
  const loadComments = () => act(async () => setComments(await hub.getComments(post.id)));

  return (
    <article className={`rounded-xl border bg-white p-4 space-y-3 ${post.kind === "announcement" ? "border-amber-400 bg-amber-50" : ""}`}>
      <header className="flex items-center justify-between text-sm">
        <div>
          <span className="font-semibold">{post.author.display_name}</span>
          <span className="ml-2 text-muted-foreground">{when(post.created_at)}</span>
        </div>
        {post.pinned && <span className="flex items-center gap-1 text-amber-700"><Pin size={14} /> Annonce</span>}
      </header>

      <p className="whitespace-pre-wrap break-words">{post.body}</p>

      {post.media.some(Boolean) && (
        <div className="grid grid-cols-2 gap-2">
          {post.media.filter((u): u is string => !!u).map(u => <img key={u} src={u} alt="" loading="lazy" className="w-full rounded-lg object-cover" />)}
        </div>
      )}

      <footer className="flex items-center gap-1 text-sm">
        <Button variant="ghost" size="sm" aria-pressed={liked} onClick={() => act(async () => { const r = await hub.toggleLike(post.id); setLiked(r.liked); setLikes(r.count); })}>
          <Heart size={16} className={liked ? "mr-1 fill-red-500 text-red-500" : "mr-1"} /> {likes}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setOpen(!open); if (!open && !comments) loadComments(); }}>
          <MessageCircle size={16} className="mr-1" /> {comments ? comments.length : post.comment_count}
        </Button>
        <span className="flex-1" />
        {/* ponytail: native prompt for the report reason; replace with a dialog if reports become frequent */}
        <Button variant="ghost" size="sm" aria-label="Signaler" onClick={() => { const r = window.prompt("Motif du signalement ?"); if (r?.trim()) act(async () => { await hub.report("post", post.id, r); toast.success("Merci, signalement envoyé."); }); }}>
          <Flag size={16} />
        </Button>
        {canDelete && (
          <Button variant="ghost" size="sm" aria-label="Supprimer" onClick={() => { if (window.confirm("Supprimer cette publication ?")) act(async () => { await hub.removePost(post.id); onChanged(); }); }}>
            <Trash2 size={16} />
          </Button>
        )}
      </footer>

      {open && (
        <div className="space-y-2 border-t pt-3">
          {(comments ?? []).map(c => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
              <p className="break-words"><span className="font-semibold">{c.author.display_name}</span> {c.body}</p>
              {(c.author.id === me.id || me.role === "moderator") && (
                <button type="button" aria-label="Supprimer le commentaire" className="text-muted-foreground" onClick={() => act(async () => { await hub.removeComment(c.id); await loadComments(); })}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (!draft.trim()) return; act(async () => { await hub.addComment(post.id, draft); setDraft(""); await loadComments(); }); }}>
            <Input value={draft} onChange={e => setDraft(e.target.value)} maxLength={500} placeholder="Votre commentaire…" />
            <Button type="submit" size="sm" disabled={!draft.trim()}>Envoyer</Button>
          </form>
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Créer `client/src/features/hub/pages/HubPage.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import * as hub from "../api";
import Composer from "../components/Composer";
import PostCard from "../components/PostCard";

export default function HubPage() {
  const { lang } = useI18n();
  const [me, setMe] = useState<hub.Member | null | undefined>(undefined); // undefined = loading
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pinned, setPinned] = useState<hub.Post[]>([]);
  const [posts, setPosts] = useState<hub.Post[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const started = useRef(false); // StrictMode runs effects twice: the magic link is single-use

  const load = useCallback(async (cursor: number | null = null) => {
    try {
      const f = await hub.getFeed(cursor);
      if (cursor === null) { setPinned(f.pinned); setPosts(f.posts); } else setPosts(p => [...p, ...f.posts]);
      setNext(f.nextCursor);
    } catch (e) {
      if (e instanceof hub.HubApiError && e.status === 401) { hub.setHubToken(null); setMe(null); } else toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const token = new URLSearchParams(window.location.search).get("token");
      try {
        if (token) {
          const r = await hub.verifyLogin(token);
          hub.setHubToken(r.session);
          window.history.replaceState({}, "", window.location.pathname);
          setMe(r.member);
        } else if (hub.getHubToken()) setMe(await hub.getMe());
        else setMe(null);
      } catch (e) {
        hub.setHubToken(null);
        setMe(null);
        if (token) toast.error((e as Error).message);
      }
    })();
  }, []);

  useEffect(() => { if (me) load(); }, [me, load]);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await hub.requestLogin(email.trim()); setSent(true); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#faf6ec]">
      <Navbar />
      <main className="container max-w-2xl py-8 space-y-4">
        <h1 className="text-2xl font-bold">Espace bénévole</h1>

        {me === undefined && <Loader2 className="animate-spin" />}

        {me === null && (
          <form onSubmit={sendLink} className="rounded-xl border bg-white p-4 space-y-3">
            {sent ? (
              <p>Si cet email correspond à un bénévole confirmé, un lien de connexion vient d'être envoyé. Il est valable 15 minutes.</p>
            ) : (
              <>
                <p>Entrez l'email utilisé lors de votre inscription. Nous vous envoyons un lien de connexion.</p>
                <Input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
                <Button type="submit" disabled={busy || !email.trim()}>{busy ? <Loader2 size={16} className="animate-spin" /> : "Recevoir mon lien"}</Button>
              </>
            )}
          </form>
        )}

        {me && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span>Connecté·e : <strong>{me.display_name}</strong></span>
              <span className="space-x-3">
                <Link href={`/${lang}/benevole/espace/profil`} className="underline">Mon profil</Link>
                <button type="button" className="underline" onClick={async () => { await hub.logout().catch(() => undefined); setMe(null); setSent(false); }}>Se déconnecter</button>
              </span>
            </div>
            <Composer onPosted={() => load()} />
            {pinned.map(p => <PostCard key={`pin-${p.id}`} post={p} me={me} onChanged={() => load()} />)}
            {posts.map(p => <PostCard key={p.id} post={p} me={me} onChanged={() => load()} />)}
            {posts.length === 0 && pinned.length === 0 && <p className="text-muted-foreground">Aucune publication pour l'instant. Lancez la conversation !</p>}
            {next !== null && <Button variant="outline" className="w-full" onClick={() => load(next)}>Voir plus</Button>}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 5: Créer `client/src/features/hub/pages/HubProfilePage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import * as hub from "../api";

export default function HubProfilePage() {
  const { lang } = useI18n();
  const [me, setMe] = useState<hub.Member | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hub.getMe().then(m => { setMe(m); setName(m.display_name); setBio(m.bio); }).catch(() => { window.location.href = `/${lang}/benevole/espace`; });
  }, [lang]);

  const save = async (avatarKey?: string) => {
    setBusy(true);
    try {
      const m = await hub.updateMe({ display_name: name, bio, ...(avatarKey ? { avatar_key: avatarKey } : {}) });
      setMe(m);
      toast.success("Profil enregistré");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    try { await save(await hub.uploadImage(file)); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="min-h-screen bg-[#faf6ec]">
      <Navbar />
      <main className="container max-w-xl py-8 space-y-4">
        <h1 className="text-2xl font-bold">Mon profil</h1>
        {me && (
          <div className="rounded-xl border bg-white p-4 space-y-4">
            {me.avatar && <img src={me.avatar} alt="" className="h-24 w-24 rounded-full object-cover" />}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => pickAvatar(e.target.files?.[0])} />
            <Input value={name} onChange={e => setName(e.target.value)} maxLength={40} aria-label="Nom affiché" />
            <Textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={300} rows={3} aria-label="Bio" placeholder="Quelques mots sur vous" />
            <Button onClick={() => save()} disabled={busy || !name.trim()}>Enregistrer</Button>
          </div>
        )}
        <Link href={`/${lang}/benevole/espace`} className="underline text-sm">← Retour à l'espace</Link>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 6: Routes et lien d'entrée**

Dans `client/src/App.tsx`, après `import BenevoleGalerieUpload …` ajouter :

```tsx
import HubPage from "@/features/hub/pages/HubPage";
import HubProfilePage from "@/features/hub/pages/HubProfilePage";
```

et, après `<Route path="/:lang/benevole/photos" component={BenevoleGalerieUpload} />`, ajouter (le profil avant l'espace) :

```tsx
      <Route path="/:lang/benevole/espace/profil" component={HubProfilePage} />
      <Route path="/:lang/benevole/espace" component={HubPage} />
```

Dans `client/src/features/public/pages/Benevole.tsx`, juste après le `</Button>` du bouton « Uploader des photos » (~ligne 1232, `navigate(\`/${lang}/benevole/photos\`)`), ajouter un bouton frère :

```tsx
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => navigate(`/${lang}/benevole/espace`)}
                    >
                      {lang === "ar" ? "فضاء المتطوعين" : lang === "en" ? "Volunteer space" : "Espace bénévole"}
                    </Button>
```

- [ ] **Step 7: Vérifier**

Run: `npx tsc --noEmit 2>&1 | grep -E "features/hub|App.tsx|Benevole.tsx"; echo "rc=$?"` — Expected: aucune ligne (rc=1).
Run: `npx vite build 2>&1 | tail -4` — Expected: build OK.
Manuel (après déploiement Worker + front, Task 8) : voir checklist Task 8.

- [ ] **Step 8: Commit**

```bash
git add client/src/features/hub client/src/App.tsx client/src/features/public/pages/Benevole.tsx
git commit -m "feat(hub): volunteer space UI (login, feed, profile)"
```

---

### Task 7: Client — administration

**Files:**
- Create: `client/src/features/hub/admin/AdminHub.tsx`
- Modify: `client/src/features/ops/admin/AdminRoutes.tsx`
- Modify: `client/src/features/ops/admin/_shell/adminRouteMap.ts`
- Modify: `client/src/shared/rbac/permissions.ts`

**Interfaces:**
- Consumes: fonctions `admin*` de `api.ts` (Task 6).

- [ ] **Step 1: Créer `client/src/features/hub/admin/AdminHub.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import * as hub from "../api";

export default function AdminHub() {
  const [reports, setReports] = useState<hub.Report[]>([]);
  const [members, setMembers] = useState<hub.AdminMember[]>([]);
  const [announce, setAnnounce] = useState("");
  const [pinned, setPinned] = useState(true);

  const reload = useCallback(async () => {
    try { setReports(await hub.adminReports()); setMembers(await hub.adminMembers()); } catch (e) { toast.error((e as Error).message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) toast.success(ok); await reload(); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-8 p-4">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Publier une annonce</h2>
        <Textarea value={announce} onChange={e => setAnnounce(e.target.value)} maxLength={2000} rows={3} placeholder="Annonce visible par tous les bénévoles" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> Épingler en haut du fil</label>
        <Button disabled={!announce.trim()} onClick={() => run(async () => { await hub.adminAnnounce(announce, pinned); setAnnounce(""); }, "Annonce publiée")}>Publier</Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Signalements ({reports.length})</h2>
        {reports.length === 0 && <p className="text-sm text-muted-foreground">Aucun signalement.</p>}
        {reports.map(r => (
          <div key={r.id} className="rounded-lg border p-3 text-sm space-y-1">
            <p><strong>{r.target_type === "post" ? "Publication" : "Commentaire"} #{r.target_id}</strong> — signalé par {r.reporter} : « {r.reason} »</p>
            <p className="whitespace-pre-wrap break-words rounded bg-muted p-2">{r.body ?? "(contenu supprimé)"}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={r.target_status === "hidden"} onClick={() => run(() => hub.adminHide(r.target_type, r.target_id), "Contenu masqué")}>
                {r.target_status === "hidden" ? "Déjà masqué" : "Masquer"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => run(() => hub.adminDismiss(r.id))}>Ignorer</Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Membres ({members.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th className="p-2">Nom</th><th className="p-2">Email</th><th className="p-2">Rôle</th><th className="p-2">Statut</th><th className="p-2" /></tr></thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-t">
                  <td className="p-2">{m.display_name}</td>
                  <td className="p-2">{m.email}</td>
                  <td className="p-2">{m.role}</td>
                  <td className="p-2">{m.status}</td>
                  <td className="p-2 space-x-2 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => run(() => hub.adminUpdateMember(m.id, { role: m.role === "moderator" ? "member" : "moderator" }))}>
                      {m.role === "moderator" ? "Retirer modérateur" : "Nommer modérateur"}
                    </Button>
                    <Button size="sm" variant={m.status === "active" ? "destructive" : "default"} onClick={() => run(() => hub.adminUpdateMember(m.id, { status: m.status === "active" ? "suspended" : "active" }))}>
                      {m.status === "active" ? "Suspendre" : "Réactiver"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Routes admin** — dans `AdminRoutes.tsx`, ajouter l'import `import AdminHub from '@/features/hub/admin/AdminHub';` avec les autres, puis près de la route `/admin/benevoles` :

```tsx
      <Route path="/admin/hub" component={AdminHub} />
      <Route path="/admin3/hub" component={AdminHub} />
```

- [ ] **Step 3: Menu et titres** — dans `adminRouteMap.ts` :
  - dans le groupe qui contient `{ id: 'benevoles-groupes', … }`, ajouter après lui : `{ id: 'hub', label: 'Espace bénévole', route: '/admin/hub' },`
  - dans la map route→id (près de `'/admin/benevoles-groupes': 'benevoles-groupes',`) : `'/admin/hub': 'hub',`
  - dans la map route→titre (près de `'/admin/benevoles-groupes': 'Groupes Bénévoles',`) : `'/admin/hub': 'Espace bénévole',`

- [ ] **Step 4: RBAC** — dans `client/src/shared/rbac/permissions.ts`, sous `'/admin/benevoles': [...ADMIN_BASE, ROLES.ADMIN_OPS],` ajouter :

```ts
  '/admin/hub': [...ADMIN_BASE, ROLES.ADMIN_OPS],
```

`ADMIN_BASE = [SUPER_ADMIN, ADMIN]` (vérifié) : `ADMIN_ROLES` de `worker/hub.ts` (`super_admin, admin, admin_ops`) est aligné.

- [ ] **Step 5: Vérifier**

Run: `npx tsc --noEmit 2>&1 | grep -E "features/hub|AdminRoutes|permissions|adminRouteMap"; echo "rc=$?"` — Expected: seules les erreurs `adminRouteMap.ts` de clés dupliquées déjà présentes (`/admin/goodies`, `/admin/pastries`) ; rien d'autre.
Run: `npx vite build 2>&1 | tail -3` — Expected: build OK.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/hub/admin client/src/features/ops/admin/AdminRoutes.tsx client/src/features/ops/admin/_shell/adminRouteMap.ts client/src/shared/rbac/permissions.ts
git commit -m "feat(hub): admin page (announcements, reports, members)"
```

---

### Task 8: Mise en production (lancée par l'utilisateur) et vérification

**Files:** aucun changement de code.

Le classifieur bloque les écritures de production par l'agent : l'utilisateur exécute ces commandes avec `!`. Ordre obligatoire : schéma avant Worker, Worker avant front.

- [ ] **Step 1: Suite de tests complète**

Run: `npx vitest run 2>&1 | tail -8`
Expected: tous les tests passent sauf les 2 échecs `worker/email.group.test.ts` déjà connus.

- [ ] **Step 2: Appliquer le schéma sur la D1 de prod**

```
! cd ~/Documents/Projects/ftour-bab-rayan-v3.3 && npx wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/hub.sql
```

Expected: succès, tables `hub_*` créées (idempotent, rejouable).

- [ ] **Step 3: Déployer le Worker** (même commande que les déploiements précédents, avec les bindings du `wrangler.toml` racine)

```
! cd ~/Documents/Projects/ftour-bab-rayan-v3.3 && npx wrangler deploy
```

Rollback : redéployer la version précédente (`npx wrangler rollback`). Les routes `/hub/*` sont nouvelles, aucun impact sur l'existant.

- [ ] **Step 4: Test de fumée du Worker**

```
curl -s -X POST https://ftour-bab-rayan-v2.reda-sebbani-43b.workers.dev/hub/login -H 'content-type: application/json' -d '{"email":"inconnu@example.com"}'
```

Expected: `{"ok":true}` et aucun email. Puis `curl -s https://ftour-bab-rayan-v2.reda-sebbani-43b.workers.dev/hub/me` → `{"error":"unauthorized",…}` (401).

- [ ] **Step 5: Déployer le front**

```
! cd ~/Documents/Projects/ftour-bab-rayan-v3.3 && npx vite build && npx wrangler pages deploy dist/public --project-name=ftour-bab-rayan-v3-3 --branch=main
```

- [ ] **Step 6: Parcours manuel (un vrai bénévole confirmé)**
  1. `/fr/benevole/espace` → saisir l'email → recevoir le mail → cliquer le lien → arriver connecté ; recliquer le même lien → message d'erreur.
  2. Publier un texte avec 2 photos ; recharger : les photos s'affichent (URLs `media-signed`) ; copier l'URL d'une photo dans une fenêtre privée après 1 h → 403.
  3. Liker, commenter, supprimer son commentaire, signaler une publication d'un autre membre.
  4. Admin `/admin/hub` : publier une annonce épinglée (visible en tête du fil), masquer le contenu signalé, suspendre le membre → sa page renvoie à la connexion.
  5. Vérifier qu'un email non confirmé ne reçoit aucun mail.

- [ ] **Step 7: Push**

```bash
git push origin main
```

(Après accord de l'utilisateur.)

---

## Auto-revue

**Couverture de la spec :** identité (Task 1) · tables (Task 1, + `hub_uploads` ajoutée) · fil/likes/commentaires/limites (Task 2) · signalements, annonces, membres (Task 3) · API complète (Task 4) · photos privées via `createR2Storage().from("hub")` → `private/hub/…`, jamais servies par `/media` (Task 4 + test des URLs signées ; garde déjà assurée par `key.startsWith("private/")` dans `media-r2.ts`) · UI publique et admin (Tasks 6–7) · liens d'entrée : bouton sur `/benevole` (Task 6) ; **le lien dans l'email de confirmation d'inscription n'est pas dans ce plan** (voir ci-dessous) · livraison (Task 8).

**Hors plan, à décider :** lien « Espace bénévole » dans l'email de confirmation d'inscription (`generateVolunteerConfirmationEmail`, `worker/email.ts:167`). Petit, mais touche un email transactionnel existant : à faire après validation de l'espace.

**Cohérence des types :** `MemberRow/MemberView`, `PostView` (back) ↔ `Post` (front : `author.avatar`, `media` signées) ; `createPost(d, member, {body, mediaPaths}, nowMs)` appelé avec ces champs dans `hub.ts` ; `removeContent`/`hideContent`/`reportContent` prennent `"post"|"comment"` partout ; routes PUT (pas PATCH) côté client et handler.
