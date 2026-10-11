# Amis, abonnements et favoris Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demandes d'ami, suivi unilatéral, favoris privés et filtre du fil (Tous / Amis / Abonnements / Favoris) dans l'espace bénévole.

**Architecture:** Deux tables (`hub_friendships`, `hub_follows`) dans `worker/d1/social.sql` ; couche données `worker/social-d1.ts` (reçoit `nowMs`, aucun `Date` au niveau module) ; routes `worker/social.ts` déléguées depuis `worker/hub.ts` par le préfixe `social/` ; le filtre du fil s'ajoute à `loadPosts` de `worker/hub-d1.ts` (`scope`). Client : dossier `client/src/features/hub/social/`.

**Tech Stack:** TypeScript, Cloudflare Worker + D1 (SQLite), vitest + `node:sqlite` (faux D1), React 19 + wouter + Tailwind + sonner.

**Spec:** `docs/superpowers/specs/2026-10-11-friends-follow-design.md`

## Global Constraints

- CORS : seulement GET/POST/PUT/DELETE/OPTIONS (pas de PATCH). Les nouvelles routes sont POST/DELETE/GET.
- Schéma idempotent (`CREATE … IF NOT EXISTS`), appliqué à la main par l'utilisateur AVANT le déploiement du Worker. Les agents ne poussent, ne déploient et n'exécutent aucune commande distante.
- Jamais d'email ni de téléphone dans les réponses JSON.
- Visibilité d'un membre : `m.status = 'active' AND EXISTS (SELECT 1 FROM t_volunteers v WHERE lower(v.email) = m.email AND v.status IN ('confirmed','present'))`. Membre invisible, suspendu ou soi-même → `not_found` (404).
- Entrées : `id()` / `str()` de `worker/hub-http.ts` ; `Object.hasOwn` pour toute table de correspondance indexée par une entrée.
- Quota D1 (lectures gratuites dépassées) : aucun polling nouveau, aucun scan non indexé ; le badge réutilise la requête existante `GET notifications/unread`.
- Ne jamais `git commit -a` (l'arbre contient des fichiers non liés) : `git add` explicite par fichier. Commits terminés par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Style : 2 espaces, double quotes, point-virgule, messages d'erreur en français, commentaires `// ponytail:` pour les raccourcis assumés.

## Review Focus

- Demande croisée (A→B pendant que B→A est en attente) : une seule ligne, acceptée, suivis mutuels — jamais deux lignes.
- Accepter/refuser une demande qui n'est pas la mienne ou qui n'existe plus → 404, jamais d'effet sur un tiers.
- `unfollow` d'un ami → 409 ; `favorite` sans suivi → 409 ; retirer un suivi retire l'étoile (la ligne disparaît).
- `feed?scope=…` : valeur inconnue (`__proto__`, `constructor`, vide) → 400 ; `all` identique à aujourd'hui ; annonces épinglées toujours présentes ; posts masqués jamais.
- Membre suspendu ou non confirmé absent de toutes les listes et de `relation` (404), ses posts absents du fil filtré n'est pas requis (le fil `all` les gère déjà).
- Les réponses ne contiennent aucun champ `email`.

---

### Task 1: Schéma et couche données

**Files:**
- Create: `worker/d1/social.sql`
- Create: `worker/social-d1.ts`
- Modify: `worker/hub-d1.ts` (type `HubErrorCode` : ajouter `"conflict"`)
- Modify: `worker/hub.ts` (map `STATUS` : `conflict: 409`)
- Test: `worker/social.test.ts`

**Interfaces:**
- Produces (exports de `worker/social-d1.ts`) :
  - `SOCIAL_LIMITS = { requestsPerHour: 20, pendingSent: 50, following: 200, page: 50 }`
  - `type Friendship = "none" | "sent" | "received" | "friends"`
  - `interface Relation { friendship: Friendship; following: boolean; favorite: boolean; friends_count: number; followers_count: number }`
  - `interface PersonRow { id: number; display_name: string; avatar_key: string | null; favorite?: boolean }`
  - `relation(d, meId, targetId): Promise<Relation>`
  - `requestFriend(d, meId, targetId, nowMs): Promise<{ friendship: Friendship }>`
  - `acceptFriend(d, meId, fromId, nowMs): Promise<void>`, `declineFriend(d, meId, fromId): Promise<void>`, `removeFriend(d, meId, otherId): Promise<void>`
  - `follow(d, meId, targetId, nowMs): Promise<void>`, `unfollow(d, meId, targetId): Promise<void>`, `setFavorite(d, meId, targetId, on: boolean): Promise<void>`
  - `listFriends(d, meId, cursor: number | null): Promise<{ people: PersonRow[]; nextCursor: number | null }>`, `listFollowing(…)` (même forme, `favorite` renseigné)
  - `listRequests(d, meId): Promise<{ received: PersonRow[]; sent: PersonRow[] }>`
  - `pendingCount(d, meId): Promise<number>`
- Consumes: `HubError`, `iso`, `HOUR_MS` de `worker/hub-d1.ts` ; `D1Like` de `worker/gallery-d1`.

- [ ] **Step 1: Écrire `worker/d1/social.sql`**

```sql
-- Amis et abonnements de l'espace bénévole. Idempotent.
CREATE TABLE IF NOT EXISTS hub_friendships (
  requester_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_hub_friendships_addressee ON hub_friendships(addressee_id, status);

CREATE TABLE IF NOT EXISTS hub_follows (
  follower_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0,1)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS idx_hub_follows_followee ON hub_follows(followee_id);
```

- [ ] **Step 2: Ajouter le code d'erreur `conflict`**

Dans `worker/hub-d1.ts`, repérer `type HubErrorCode` (au-dessus de `class HubError`) et y ajouter `| "conflict"`. Dans `worker/hub.ts` ligne ~30, la map devient :
`const STATUS: Record<H.HubErrorCode, number> = { unauthorized: 401, forbidden: 403, not_found: 404, invalid: 400, rate_limited: 429, conflict: 409 };`
Vérifier avec `npx tsc --noEmit -p .` qu'aucune autre `Record<HubErrorCode, …>` ne casse (les ajuster si besoin).

- [ ] **Step 3: Écrire le test d'abord (échec attendu)**

Créer `worker/social.test.ts` : copier l'en-tête de `worker/market.test.ts` (imports, `fakeD1`, `CORS`, `T0`, variables, `deps`, `call`, `signIn`) tel quel, `beforeEach` chargeant `["hub.sql", "social.sql"]`, puis :

```ts
import * as S from "./social-d1";

const ids = async () => { const a = await signIn("a@x.ma"); const b = await signIn("b@x.ma", "Brahim"); const c = await signIn("c@x.ma", "Chaima"); return { a, b, c }; };

describe("social data: friendships", () => {
  it("request -> accept creates one accepted row and mutual follows", async () => {
    const { a, b } = await ids();
    expect(await S.requestFriend(env.DB, a.id, b.id, clock)).toEqual({ friendship: "sent" });
    expect((await S.relation(env.DB, b.id, a.id)).friendship).toBe("received");
    await S.acceptFriend(env.DB, b.id, a.id, clock);
    expect((await S.relation(env.DB, a.id, b.id))).toMatchObject({ friendship: "friends", following: true });
    expect((await S.relation(env.DB, b.id, a.id))).toMatchObject({ friendship: "friends", following: true, friends_count: 1, followers_count: 1 });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_friendships").get()).toEqual({ n: 1 });
  });
  it("crossed request accepts instead of duplicating", async () => {
    const { a, b } = await ids();
    await S.requestFriend(env.DB, a.id, b.id, clock);
    expect(await S.requestFriend(env.DB, b.id, a.id, clock)).toEqual({ friendship: "friends" });
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_friendships").get()).toEqual({ n: 1 });
  });
  it("duplicates and strangers", async () => {
    const { a, b, c } = await ids();
    await S.requestFriend(env.DB, a.id, b.id, clock);
    await expect(S.requestFriend(env.DB, a.id, b.id, clock)).rejects.toMatchObject({ code: "conflict" });
    await expect(S.requestFriend(env.DB, a.id, a.id, clock)).rejects.toMatchObject({ code: "not_found" });
    await expect(S.acceptFriend(env.DB, c.id, a.id, clock)).rejects.toMatchObject({ code: "not_found" });
    await expect(S.acceptFriend(env.DB, a.id, b.id, clock)).rejects.toMatchObject({ code: "not_found" }); // sender cannot accept
    await expect(S.declineFriend(env.DB, c.id, a.id)).rejects.toMatchObject({ code: "not_found" });
  });
  it("decline, cancel and unfriend delete the row", async () => {
    const { a, b, c } = await ids();
    await S.requestFriend(env.DB, a.id, b.id, clock);
    await S.declineFriend(env.DB, b.id, a.id);
    await S.requestFriend(env.DB, a.id, c.id, clock);
    await S.removeFriend(env.DB, a.id, c.id); // cancel
    await S.requestFriend(env.DB, a.id, b.id, clock);
    await S.acceptFriend(env.DB, b.id, a.id, clock);
    await S.removeFriend(env.DB, b.id, a.id); // unfriend by the addressee
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_friendships").get()).toEqual({ n: 0 });
    expect((await S.relation(env.DB, a.id, b.id))).toMatchObject({ friendship: "none", following: true }); // follows stay
    await expect(S.removeFriend(env.DB, a.id, b.id)).rejects.toMatchObject({ code: "not_found" });
  });
  it("suspended or unconfirmed members are 404", async () => {
    const { a, b } = await ids();
    sqlite.prepare("UPDATE hub_members SET status = 'suspended' WHERE id = ?").run(b.id);
    await expect(S.requestFriend(env.DB, a.id, b.id, clock)).rejects.toMatchObject({ code: "not_found" });
    await expect(S.relation(env.DB, a.id, b.id)).rejects.toMatchObject({ code: "not_found" });
    sqlite.prepare("UPDATE hub_members SET status = 'active' WHERE id = ?").run(b.id);
    sqlite.prepare("UPDATE t_volunteers SET status = 'cancelled' WHERE email = 'b@x.ma'").run();
    await expect(S.follow(env.DB, a.id, b.id, clock)).rejects.toMatchObject({ code: "not_found" });
  });
  it("rate limit: 20 requests per hour, 50 pending", async () => {
    const { a } = await ids();
    const others: number[] = [];
    for (let i = 0; i < 21; i++) { const r = sqlite.prepare("INSERT INTO hub_members (email, display_name) VALUES (?,?) RETURNING id").get(`o${i}@x.ma`, `O${i}`) as { id: number }; sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES ('O','X',?, 'confirmed')").run(`o${i}@x.ma`); others.push(r.id); }
    for (let i = 0; i < 20; i++) await S.requestFriend(env.DB, a.id, others[i], clock);
    await expect(S.requestFriend(env.DB, a.id, others[20], clock)).rejects.toMatchObject({ code: "rate_limited" });
    await S.requestFriend(env.DB, a.id, others[20], clock + 3_600_001); // window passed
  });
});

describe("social data: follow and favorite", () => {
  it("follow, favorite, unfollow removes the star; idempotent follow", async () => {
    const { a, b } = await ids();
    await expect(S.setFavorite(env.DB, a.id, b.id, true)).rejects.toMatchObject({ code: "conflict" });
    await S.follow(env.DB, a.id, b.id, clock); await S.follow(env.DB, a.id, b.id, clock);
    await S.setFavorite(env.DB, a.id, b.id, true);
    expect((await S.listFollowing(env.DB, a.id, null)).people).toEqual([expect.objectContaining({ id: b.id, favorite: true })]);
    await S.unfollow(env.DB, a.id, b.id);
    expect((await S.listFollowing(env.DB, a.id, null)).people).toEqual([]);
    expect((await S.relation(env.DB, a.id, b.id)).favorite).toBe(false);
  });
  it("cannot unfollow a friend", async () => {
    const { a, b } = await ids();
    await S.requestFriend(env.DB, a.id, b.id, clock); await S.acceptFriend(env.DB, b.id, a.id, clock);
    await expect(S.unfollow(env.DB, a.id, b.id)).rejects.toMatchObject({ code: "conflict" });
  });
  it("lists carry no email; requests split received/sent; pendingCount", async () => {
    const { a, b, c } = await ids();
    await S.requestFriend(env.DB, a.id, b.id, clock); await S.requestFriend(env.DB, c.id, a.id, clock);
    const r = await S.listRequests(env.DB, a.id);
    expect(r.received.map(p => p.id)).toEqual([c.id]); expect(r.sent.map(p => p.id)).toEqual([b.id]);
    expect(await S.pendingCount(env.DB, a.id)).toBe(1);
    expect(JSON.stringify(r)).not.toContain("@");
    expect((await S.listFriends(env.DB, a.id, null)).people).toEqual([]);
  });
});
```

- [ ] **Step 4: Lancer le test, vérifier l'échec**

Run: `npx vitest run worker/social.test.ts` — Expected: FAIL (`social-d1` introuvable).

- [ ] **Step 5: Implémenter `worker/social-d1.ts`**

```ts
/** Friends / follows / favorites. Data layer only; routes live in social.ts. */
import type { D1Like } from "./gallery-d1";
import { HubError, HOUR_MS, iso } from "./hub-d1";

export const SOCIAL_LIMITS = { requestsPerHour: 20, pendingSent: 50, following: 200, page: 50 } as const;
export type Friendship = "none" | "sent" | "received" | "friends";
export interface Relation { friendship: Friendship; following: boolean; favorite: boolean; friends_count: number; followers_count: number }
export interface PersonRow { id: number; display_name: string; avatar_key: string | null; favorite?: boolean }

const VISIBLE = "m.status = 'active' AND EXISTS (SELECT 1 FROM t_volunteers v WHERE lower(v.email) = m.email AND v.status IN ('confirmed','present'))";
const notFound = () => new HubError("not_found", "Membre introuvable");

async function visibleTarget(d: D1Like, meId: number, targetId: number): Promise<void> {
  if (targetId === meId) throw notFound();
  const r = await d.prepare(`SELECT m.id FROM hub_members m WHERE m.id = ? AND ${VISIBLE}`).bind(targetId).first();
  if (!r) throw notFound();
}

async function friendshipRow(d: D1Like, a: number, b: number) {
  return d.prepare("SELECT requester_id, status FROM hub_friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)")
    .bind(a, b, b, a).first<{ requester_id: number; status: "pending" | "accepted" }>();
}

export async function relation(d: D1Like, meId: number, targetId: number): Promise<Relation> {
  await visibleTarget(d, meId, targetId);
  const fr = await friendshipRow(d, meId, targetId);
  const fo = await d.prepare("SELECT favorite FROM hub_follows WHERE follower_id = ? AND followee_id = ?").bind(meId, targetId).first<{ favorite: number }>();
  const fc = await d.prepare("SELECT COUNT(*) AS n FROM hub_friendships WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)").bind(targetId, targetId).first<{ n: number }>();
  const ec = await d.prepare("SELECT COUNT(*) AS n FROM hub_follows WHERE followee_id = ?").bind(targetId).first<{ n: number }>();
  // ponytail: counts include members who became invisible; fine for a social counter
  const friendship: Friendship = !fr ? "none" : fr.status === "accepted" ? "friends" : fr.requester_id === meId ? "sent" : "received";
  return { friendship, following: fo != null, favorite: fo?.favorite === 1, friends_count: fc?.n ?? 0, followers_count: ec?.n ?? 0 };
}

const mutualFollow = (d: D1Like, a: number, b: number, nowMs: number) => d.batch([
  d.prepare("INSERT OR IGNORE INTO hub_follows (follower_id, followee_id, created_at) VALUES (?,?,?)").bind(a, b, iso(nowMs)),
  d.prepare("INSERT OR IGNORE INTO hub_follows (follower_id, followee_id, created_at) VALUES (?,?,?)").bind(b, a, iso(nowMs)),
]);

export async function acceptFriend(d: D1Like, meId: number, fromId: number, nowMs: number): Promise<void> {
  await visibleTarget(d, meId, fromId);
  const r = await d.prepare("UPDATE hub_friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ? AND status = 'pending' RETURNING 1 AS ok").bind(fromId, meId).first();
  if (!r) throw new HubError("not_found", "Demande introuvable");
  await mutualFollow(d, meId, fromId, nowMs);
}

export async function requestFriend(d: D1Like, meId: number, targetId: number, nowMs: number): Promise<{ friendship: Friendship }> {
  await visibleTarget(d, meId, targetId);
  const ex = await friendshipRow(d, meId, targetId);
  if (ex) {
    if (ex.status === "accepted") throw new HubError("conflict", "Vous êtes déjà amis");
    if (ex.requester_id === meId) throw new HubError("conflict", "Demande déjà envoyée");
    await acceptFriend(d, meId, targetId, nowMs); // crossed request
    return { friendship: "friends" };
  }
  const recent = await d.prepare("SELECT COUNT(*) AS n FROM hub_friendships WHERE requester_id = ? AND created_at > ?").bind(meId, iso(nowMs - HOUR_MS)).first<{ n: number }>();
  const pending = await d.prepare("SELECT COUNT(*) AS n FROM hub_friendships WHERE requester_id = ? AND status = 'pending'").bind(meId).first<{ n: number }>();
  if ((recent?.n ?? 0) >= SOCIAL_LIMITS.requestsPerHour || (pending?.n ?? 0) >= SOCIAL_LIMITS.pendingSent) throw new HubError("rate_limited", "Trop de demandes d'ami, réessayez plus tard");
  await d.prepare("INSERT INTO hub_friendships (requester_id, addressee_id, created_at) VALUES (?,?,?)").bind(meId, targetId, iso(nowMs)).run();
  return { friendship: "sent" };
}

export async function declineFriend(d: D1Like, meId: number, fromId: number): Promise<void> {
  const r = await d.prepare("DELETE FROM hub_friendships WHERE requester_id = ? AND addressee_id = ? AND status = 'pending' RETURNING 1 AS ok").bind(fromId, meId).first();
  if (!r) throw new HubError("not_found", "Demande introuvable");
}

/** Cancel my pending request or remove a friend (either side). Follows are kept. */
export async function removeFriend(d: D1Like, meId: number, otherId: number): Promise<void> {
  const r = await d.prepare("DELETE FROM hub_friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?) RETURNING 1 AS ok").bind(meId, otherId, otherId, meId).first();
  if (!r) throw new HubError("not_found", "Relation introuvable");
}

export async function follow(d: D1Like, meId: number, targetId: number, nowMs: number): Promise<void> {
  await visibleTarget(d, meId, targetId);
  const n = await d.prepare("SELECT COUNT(*) AS n FROM hub_follows WHERE follower_id = ?").bind(meId).first<{ n: number }>();
  if ((n?.n ?? 0) >= SOCIAL_LIMITS.following) throw new HubError("rate_limited", "Limite d'abonnements atteinte");
  await d.prepare("INSERT OR IGNORE INTO hub_follows (follower_id, followee_id, created_at) VALUES (?,?,?)").bind(meId, targetId, iso(nowMs)).run();
}

export async function unfollow(d: D1Like, meId: number, targetId: number): Promise<void> {
  const fr = await friendshipRow(d, meId, targetId);
  if (fr?.status === "accepted") throw new HubError("conflict", "Retirez d'abord cet ami pour ne plus le suivre");
  await d.prepare("DELETE FROM hub_follows WHERE follower_id = ? AND followee_id = ?").bind(meId, targetId).run();
}

export async function setFavorite(d: D1Like, meId: number, targetId: number, on: boolean): Promise<void> {
  const r = await d.prepare("UPDATE hub_follows SET favorite = ? WHERE follower_id = ? AND followee_id = ? RETURNING 1 AS ok").bind(on ? 1 : 0, meId, targetId).first();
  if (!r) throw new HubError("conflict", "Suivez d'abord ce membre");
}

const page = async (d: D1Like, sql: string, binds: unknown[], limit = SOCIAL_LIMITS.page) => {
  const { results } = await d.prepare(sql).bind(...binds, limit + 1).all<PersonRow & { favorite?: number }>();
  const people = results.slice(0, limit).map(r => ({ id: r.id, display_name: r.display_name, avatar_key: r.avatar_key, ...(r.favorite === undefined ? {} : { favorite: r.favorite === 1 }) }));
  return { people, nextCursor: results.length > limit ? people[people.length - 1].id : null };
};

export function listFriends(d: D1Like, meId: number, cursor: number | null) {
  return page(d,
    `SELECT m.id, m.display_name, m.avatar_key FROM hub_friendships fr
     JOIN hub_members m ON m.id = CASE WHEN fr.requester_id = ? THEN fr.addressee_id ELSE fr.requester_id END
     WHERE fr.status = 'accepted' AND (fr.requester_id = ? OR fr.addressee_id = ?) AND m.id > ? AND ${VISIBLE}
     ORDER BY m.id LIMIT ?`, [meId, meId, meId, cursor ?? 0]);
}

export function listFollowing(d: D1Like, meId: number, cursor: number | null) {
  return page(d,
    `SELECT m.id, m.display_name, m.avatar_key, f.favorite FROM hub_follows f JOIN hub_members m ON m.id = f.followee_id
     WHERE f.follower_id = ? AND m.id > ? AND ${VISIBLE} ORDER BY m.id LIMIT ?`, [meId, cursor ?? 0]);
}

export async function listRequests(d: D1Like, meId: number): Promise<{ received: PersonRow[]; sent: PersonRow[] }> {
  const q = (own: string, other: string) => `SELECT m.id, m.display_name, m.avatar_key FROM hub_friendships fr JOIN hub_members m ON m.id = fr.${other}
    WHERE fr.${own} = ? AND fr.status = 'pending' AND ? IS NOT NULL AND ${VISIBLE} ORDER BY fr.created_at DESC LIMIT ?`;
  const [received, sent] = await Promise.all([
    page(d, q("addressee_id", "requester_id"), [meId, 1]),
    page(d, q("requester_id", "addressee_id"), [meId, 1]),
  ]);
  return { received: received.people, sent: sent.people };
}

export async function pendingCount(d: D1Like, meId: number): Promise<number> {
  const r = await d.prepare("SELECT COUNT(*) AS n FROM hub_friendships WHERE addressee_id = ? AND status = 'pending'").bind(meId).first<{ n: number }>();
  return r?.n ?? 0;
}
```

Si la clause `? IS NOT NULL` de `listRequests` est jugée bruyante, la remplacer par un `page()` sans curseur ; le comportement doit rester : jusqu'à 50 demandes visibles par côté.

- [ ] **Step 6: Lancer les tests**

Run: `npx vitest run worker/social.test.ts && npx tsc --noEmit -p .` — Expected: PASS, tsc propre.

- [ ] **Step 7: Commit**

```bash
git add worker/d1/social.sql worker/social-d1.ts worker/social.test.ts worker/hub-d1.ts worker/hub.ts
git commit -m "feat(hub): friends, follows and favorites data layer"
```

---

### Task 2: Routes HTTP, filtre du fil et compteur de demandes

**Files:**
- Create: `worker/social.ts`
- Modify: `worker/hub.ts` (délégation `social/`, `feed` avec `scope`, `notifications/unread` avec `friend_requests`)
- Modify: `worker/hub-d1.ts` (`loadPosts`/`feed` : `scope`)
- Test: `worker/social.test.ts` (ajouter un bloc `describe("social http")`)

**Interfaces:**
- Consumes (Task 1) : toutes les fonctions de `worker/social-d1.ts`.
- Produces :
  - `handleSocialRoute(c: SocialCtx): Promise<Response | null>` (même `Ctx` que `MarketCtx`, `path` = après `social/`).
  - `H.FEED_SCOPES`, `H.FeedScope`, `H.feed(d, viewerId, cursor, limit, scope)`.
  - Réponses : `GET social/relation/:id` → `Relation` ; listes → `{ people: [{id, display_name, avatar, favorite?}], nextCursor }` ; `social/requests` → `{ received, sent }` (mêmes personnes, `avatar` signé) ; `GET notifications/unread` → `{ unread, friend_requests }`.

- [ ] **Step 1: Tests HTTP d'abord (échec attendu)**

Ajouter à `worker/social.test.ts` :

```ts
const post = (path: string, token: string, body: unknown) => call("POST", `/hub/social/${path}`, { token, body });

describe("social http", () => {
  it("needs a session; unknown route is JSON 404; bad ids are 400", async () => {
    expect((await call("GET", "/hub/social/friends")).status).toBe(401);
    const { a } = await ids();
    const r = await call("GET", "/hub/social/nope", { token: a.session });
    expect(r.status).toBe(404); expect(await r.json()).toMatchObject({ error: "not_found" });
    expect((await post("friend/request", a.session, { id: "x" })).status).toBe(400);
    expect((await call("GET", "/hub/social/relation/abc", { token: a.session })).status).toBe(404);
  });
  it("friend flow over HTTP, conflict is 409, no email leaks", async () => {
    const { a, b } = await ids();
    expect((await post("friend/request", a.session, { id: b.id })).status).toBe(200);
    expect((await post("friend/request", a.session, { id: b.id })).status).toBe(409);
    const unread = (await (await call("GET", "/hub/notifications/unread", { token: b.session })).json()) as any;
    expect(unread.friend_requests).toBe(1);
    expect((await post("friend/accept", b.session, { id: a.id })).status).toBe(200);
    const rel = (await (await call("GET", `/hub/social/relation/${b.id}`, { token: a.session })).json()) as any;
    expect(rel).toMatchObject({ friendship: "friends", following: true });
    const list = await (await call("GET", "/hub/social/friends", { token: a.session })).text();
    expect(list).toContain("Brahim"); expect(list).not.toContain("@");
    expect((await call("DELETE", `/hub/social/follow/${b.id}`, { token: a.session })).status).toBe(409);
    expect((await call("DELETE", `/hub/social/friend/${b.id}`, { token: a.session })).status).toBe(200);
  });
  it("favorite requires a follow (409), then works", async () => {
    const { a, b } = await ids();
    expect((await post("favorite", a.session, { id: b.id, on: true })).status).toBe(409);
    await post("follow", a.session, { id: b.id });
    expect((await post("favorite", a.session, { id: b.id, on: true })).status).toBe(200);
    expect((await post("favorite", a.session, { id: b.id, on: "yes" })).status).toBe(400);
  });
});

describe("feed scope", () => {
  const publish = (s: string, body: string) => call("POST", "/hub/posts", { token: s, body: { body } });
  const bodies = async (token: string, scope: string) => ((await (await call("GET", `/hub/feed?scope=${scope}`, { token })).json()) as any).posts.map((p: any) => p.body);
  it("filters friends / following / favorites, keeps pinned, rejects unknown scope", async () => {
    const { a, b, c } = await ids();
    await publish(b.session, "post de B"); await publish(c.session, "post de C");
    expect((await bodies(a.session, "all")).sort()).toEqual(["post de B", "post de C"]);
    expect(await bodies(a.session, "following")).toEqual([]);
    await post("follow", a.session, { id: c.id });
    expect(await bodies(a.session, "following")).toEqual(["post de C"]);
    expect(await bodies(a.session, "favorites")).toEqual([]);
    await post("favorite", a.session, { id: c.id, on: true });
    expect(await bodies(a.session, "favorites")).toEqual(["post de C"]);
    expect(await bodies(a.session, "friends")).toEqual([]);
    await post("friend/request", b.session, { id: a.id }); await post("friend/accept", a.session, { id: b.id });
    expect(await bodies(a.session, "friends")).toEqual(["post de B"]);
    for (const bad of ["", "nope", "__proto__", "constructor"]) expect((await call("GET", `/hub/feed?scope=${bad}`, { token: a.session })).status).toBe(400);
    expect((await call("GET", "/hub/feed", { token: a.session })).status).toBe(200);
  });
});
```

Run: `npx vitest run worker/social.test.ts` — Expected: FAIL (routes absentes).

- [ ] **Step 2: Filtre du fil dans `worker/hub-d1.ts`**

Ajouter au-dessus de `loadPosts` :

```ts
export const FEED_SCOPES = ["all", "friends", "following", "favorites"] as const;
export type FeedScope = (typeof FEED_SCOPES)[number];
const FOLLOW = "AND EXISTS (SELECT 1 FROM hub_follows f WHERE f.follower_id = ? AND f.followee_id = p.member_id";
const SCOPE_SQL: Record<FeedScope, string> = {
  all: "",
  friends: "AND EXISTS (SELECT 1 FROM hub_friendships fr WHERE fr.status = 'accepted' AND ((fr.requester_id = ? AND fr.addressee_id = p.member_id) OR (fr.addressee_id = ? AND fr.requester_id = p.member_id)))",
  following: `${FOLLOW})`,
  favorites: `${FOLLOW} AND f.favorite = 1)`,
};
```

`loadPosts(d, viewerId, pinned, cursor, limit, scope: FeedScope = "all")` : insérer `${SCOPE_SQL[scope]}` dans le `WHERE` après `AND (? IS NULL OR p.id < ?)` et, dans `.bind(...)`, ajouter après `cursor, cursor` : `...(scope === "friends" ? [viewerId, viewerId] : scope === "all" ? [] : [viewerId])`, puis `limit`. `feed(d, viewerId, cursor = null, limit = 20, scope: FeedScope = "all")` passe `scope` uniquement à l'appel des posts non épinglés ; l'appel des épinglés reste `"all"`.

- [ ] **Step 3: Routes `worker/social.ts`**

```ts
/** REST routes of friends / follows, called from handleHubRequest for any /hub/social/* path. */
import type { D1Like } from "./gallery-d1";
import * as H from "./hub-d1";
import * as S from "./social-d1";
import { id, readJson } from "./hub-http";

export interface SocialCtx {
  d: D1Like; request: Request; url: URL; path: string; now: () => number;
  json: (data: unknown, status?: number) => Response;
  member: () => Promise<H.MemberRow>;
  sign: (p: string | null) => Promise<string | null>;
}

export async function handleSocialRoute(c: SocialCtx): Promise<Response | null> {
  const { d, request, url, path, now, json, member, sign } = c;
  const match = (method: string, re: RegExp) => (request.method === method ? re.exec(path) : null);
  const person = async (p: S.PersonRow) => ({ id: p.id, display_name: p.display_name, avatar: await sign(p.avatar_key), ...(p.favorite === undefined ? {} : { favorite: p.favorite }) });
  const page = async (r: { people: S.PersonRow[]; nextCursor: number | null }) => json({ people: await Promise.all(r.people.map(person)), nextCursor: r.nextCursor });
  const cursor = () => { const v = url.searchParams.get("cursor"); return v && /^\d+$/.test(v) ? Number(v) : null; };
  let m: RegExpExecArray | null;

  if ((m = match("GET", /^relation\/(\d+)$/))) { const me = await member(); return json(await S.relation(d, me.id, id(m[1]))); }
  if (match("POST", /^friend\/request$/)) { const me = await member(); return json(await S.requestFriend(d, me.id, id((await readJson(request)).id), now())); }
  if (match("POST", /^friend\/accept$/)) { const me = await member(); await S.acceptFriend(d, me.id, id((await readJson(request)).id), now()); return json({ ok: true }); }
  if (match("POST", /^friend\/decline$/)) { const me = await member(); await S.declineFriend(d, me.id, id((await readJson(request)).id)); return json({ ok: true }); }
  if ((m = match("DELETE", /^friend\/(\d+)$/))) { const me = await member(); await S.removeFriend(d, me.id, id(m[1])); return json({ ok: true }); }
  if (match("POST", /^follow$/)) { const me = await member(); await S.follow(d, me.id, id((await readJson(request)).id), now()); return json({ ok: true }); }
  if ((m = match("DELETE", /^follow\/(\d+)$/))) { const me = await member(); await S.unfollow(d, me.id, id(m[1])); return json({ ok: true }); }
  if (match("POST", /^favorite$/)) {
    const me = await member(); const b = await readJson(request);
    if (typeof b.on !== "boolean") throw new H.HubError("invalid", "Valeur invalide");
    await S.setFavorite(d, me.id, id(b.id), b.on); return json({ ok: true });
  }
  if (match("GET", /^friends$/)) { const me = await member(); return page(await S.listFriends(d, me.id, cursor())); }
  if (match("GET", /^following$/)) { const me = await member(); return page(await S.listFollowing(d, me.id, cursor())); }
  if (match("GET", /^requests$/)) {
    const me = await member(); const r = await S.listRequests(d, me.id);
    return json({ received: await Promise.all(r.received.map(person)), sent: await Promise.all(r.sent.map(person)) });
  }
  return null;
}
```

- [ ] **Step 4: Câbler `worker/hub.ts`**

1. Importer `handleSocialRoute` et `* as S from "./social-d1"`.
2. À côté de `if (path.startsWith("market/"))` (≈ ligne 376), ajouter un bloc identique pour `social/` : `const r = await handleSocialRoute({ d, request, url, path: path.slice("social/".length), now, json, member, sign }); if (r) return r;` puis, comme les autres modules, un 404 JSON `not_found` si `r` est `null` (reprendre exactement le motif du bloc `market/`).
3. `feed` : `const scope = url.searchParams.get("scope") ?? "all"; if (!H.FEED_SCOPES.includes(scope as H.FeedScope)) throw new H.HubError("invalid", "Filtre invalide");` (`includes` sur un tableau, pas d'accès par clé : `__proto__`/`constructor` sont rejetés) puis `H.feed(d, me.id, cursor, 20, scope as H.FeedScope)`.
4. `notifications/unread` : `return json({ unread: await N.unreadCount(d, me.id), friend_requests: await S.pendingCount(d, me.id).catch(() => 0) });` (le `catch` évite de casser le badge tant que `social.sql` n'est pas appliqué).

- [ ] **Step 5: Lancer toute la suite hub**

Run: `npx vitest run worker/hub worker/market worker/pro worker/stay worker/social worker/hub-demo.test.ts && npx tsc --noEmit -p .` — Expected: tout vert, tsc propre. Les tests existants de `feed` (sans `scope`) doivent rester verts.

- [ ] **Step 6: Commit**

```bash
git add worker/social.ts worker/hub.ts worker/hub-d1.ts worker/social.test.ts
git commit -m "feat(hub): social routes, feed scope filter and friend request count"
```

---

### Task 3: Client — API, barre de relation du profil, filtre du fil

**Files:**
- Create: `client/src/features/hub/social/social-api.ts`
- Create: `client/src/features/hub/social/RelationBar.tsx`
- Modify: `client/src/features/hub/api.ts` (`getFeed(cursor, scope?)`, `unreadNotifications` → renvoie aussi `friend_requests`)
- Modify: `client/src/features/hub/pages/HubProfilePage.tsx` (afficher `RelationBar` si `readOnly`)
- Modify: `client/src/features/hub/pages/HubPage.tsx` (pastilles de filtre)

**Interfaces:**
- Consumes : routes de la Task 2 ; `call` exporté de `client/src/features/hub/api.ts`.
- Produces (`social-api.ts`) : `type Relation`, `type Person = { id: number; display_name: string; avatar: string | null; favorite?: boolean }`, `getRelation(id)`, `requestFriend(id)`, `acceptFriend(id)`, `declineFriend(id)`, `removeFriend(id)`, `follow(id)`, `unfollow(id)`, `setFavorite(id, on)`, `getFriends(cursor?)`, `getFollowing(cursor?)`, `getRequests()`, `type FeedScope`. `hub.getFeed(cursor, scope = "all")`. `hub.unreadNotifications()` conserve son type de retour actuel (`number`) ; ajouter `hub.pendingFriendRequests()` qui renvoie `friend_requests` depuis la même réponse (un seul appel réseau : mutualiser via une fonction `unreadSummary()` appelée par les deux).

- [ ] **Step 1: Écrire `social-api.ts`**

```ts
import { call } from "../api";

export type FeedScope = "all" | "friends" | "following" | "favorites";
export type Friendship = "none" | "sent" | "received" | "friends";
export interface Relation { friendship: Friendship; following: boolean; favorite: boolean; friends_count: number; followers_count: number }
export interface Person { id: number; display_name: string; avatar: string | null; favorite?: boolean }

const post = (path: string, body: unknown) => call<unknown>("POST", `social/${path}`, { body });
export const getRelation = (id: number) => call<Relation>("GET", `social/relation/${id}`);
export const requestFriend = (id: number) => post("friend/request", { id });
export const acceptFriend = (id: number) => post("friend/accept", { id });
export const declineFriend = (id: number) => post("friend/decline", { id });
export const removeFriend = (id: number) => call<unknown>("DELETE", `social/friend/${id}`);
export const follow = (id: number) => post("follow", { id });
export const unfollow = (id: number) => call<unknown>("DELETE", `social/follow/${id}`);
export const setFavorite = (id: number, on: boolean) => post("favorite", { id, on });
const q = (cursor?: number | null) => (cursor ? `?cursor=${cursor}` : "");
export const getFriends = (cursor?: number | null) => call<{ people: Person[]; nextCursor: number | null }>("GET", `social/friends${q(cursor)}`);
export const getFollowing = (cursor?: number | null) => call<{ people: Person[]; nextCursor: number | null }>("GET", `social/following${q(cursor)}`);
export const getRequests = () => call<{ received: Person[]; sent: Person[] }>("GET", "social/requests");
```

Si `call` n'est pas déjà exporté sous ce nom/signature, adapter (il l'est : `api.ts:24`).

- [ ] **Step 2: `api.ts`**

`getFeed = (cursor, scope = "all") =>` construit `feed?cursor=…&scope=…` avec `URLSearchParams` (n'ajouter `scope` que s'il vaut autre chose que `all`). Lire la fonction `unreadNotifications` actuelle : faire pointer `unreadNotifications` et le nouveau `pendingFriendRequests` vers un unique `GET notifications/unread` (type `{ unread: number; friend_requests?: number }`), sans second appel dans `HubShell` (Task 4).

- [ ] **Step 3: `RelationBar.tsx`**

Composant `RelationBar({ memberId })` : charge `getRelation(memberId)` (état `null` = rien d'affiché ; en cas d'erreur, `toast.error` et ne rien rendre). Boutons (classes comme `HubProfilePage`, `Button` de `@/components/ui/button`) selon `friendship` : `none` → « Ajouter en ami » (`requestFriend`) ; `sent` → « Demande envoyée · Annuler » (`removeFriend`) ; `received` → « Accepter » / « Refuser » ; `friends` → « Amis ✓ » avec action « Retirer » (`window.confirm` d'abord). Bouton « Suivre » / « Suivi ✓ » (désactivé avec `title` explicatif quand `friendship === "friends"`), et, si `following`, bouton ★ « Favori » (`aria-pressed`, `Star` de lucide-react, rempli si `favorite`). Chaque action : `try { await …; setRel(await getRelation(memberId)) } catch (e) { toast.error((e as Error).message) }`, avec un `busy` qui désactive les boutons. Affiche « N amis · N abonnés ». Accessibilité : `aria-label` sur les boutons-icônes, cibles ≥ 40 px.

- [ ] **Step 4: Brancher le profil et le fil**

`HubProfilePage.tsx` : quand `readOnly` est vrai, rendre `<RelationBar memberId={viewedId!} />` sous l'en-tête du profil. `HubPage.tsx` : état `scope` initialisé depuis `localStorage["hub.feedScope"]` (lecture/écriture dans `try/catch`, valeur validée contre la liste, défaut `all`), pastilles `Tous / Amis / Abonnements / Favoris` (`role="tablist"` ou boutons `aria-pressed`) au-dessus du `Composer`, `load()` passe `scope` à `hub.getFeed` ; changer de filtre recharge depuis le début ; état vide spécifique : « Aucune publication dans ce filtre. » + lien vers « Mes amis » (Task 4) pour `friends/following/favorites`. Lire `HubPage.tsx` autour des lignes 48–70 et 280–290 avant d'éditer ; ne pas casser `load(null, { silent: true })`.

- [ ] **Step 5: Vérifier**

Run: `npx tsc --noEmit -p .` puis `npx vitest run worker/social.test.ts` — Expected: tsc propre, tests verts.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/hub/social/social-api.ts client/src/features/hub/social/RelationBar.tsx client/src/features/hub/api.ts client/src/features/hub/pages/HubProfilePage.tsx client/src/features/hub/pages/HubPage.tsx
git commit -m "feat(hub): relation bar on profiles and feed scope filter"
```

---

### Task 4: Page « Mes amis », route et badge de navigation

**Files:**
- Create: `client/src/features/hub/social/FriendsPage.tsx`
- Modify: `client/src/App.tsx` (route `/:lang/benevole/espace/amis`, avant toute route à paramètre `:id` du hub)
- Modify: `client/src/features/hub/components/HubShell.tsx` (lien « Amis » + badge)

**Interfaces:**
- Consumes : `social-api.ts` (Task 3), `hub.pendingFriendRequests()` (Task 3), `HubShell`, `Avatar`, `useHubMember` (voir une page existante comme `MeetupPage`/`MarketPage` pour le motif de garde de session).

- [ ] **Step 1: `FriendsPage.tsx`**

Page enveloppée dans `HubShell me={me}` (même motif de chargement/redirection que `HubProfilePage` : `hub.getMe()`, redirection vers `/${lang}/benevole/espace` sur échec). Trois onglets (état local, boutons `aria-pressed`) : **Demandes** (reçues avec Accepter/Refuser, envoyées avec Annuler), **Amis** (liste + « Retirer » avec `window.confirm`), **Suivis** (liste + ★ basculable via `setFavorite` + « Ne plus suivre » ; si l'API renvoie 409 parce que c'est un ami, afficher le message du serveur via `toast.error`). Chaque ligne : `Avatar` + nom, lien vers `/${lang}/benevole/espace/membre/${id}`. Pagination « Voir plus » avec `nextCursor`. États : chargement, vide (« Aucune demande », etc.), erreur avec bouton Réessayer. Après chaque action, recharger l'onglet courant. Mobile d'abord.

- [ ] **Step 2: Route et navigation**

`App.tsx` : importer et déclarer `<Route path="/:lang/benevole/espace/amis" component={FriendsPage} />` à côté des autres routes `benevole/espace/*` (spécifique avant les routes `:id`). `HubShell.tsx` : ajouter l'état `friendReq` rempli dans `tick()` via `hub.pendingFriendRequests()` (réutilise la requête déjà faite par `unreadNotifications`, pas de nouvel intervalle) ; ajouter dans `navLinks` `{ href: \`${base}/amis\`, label: "Amis", short: "Amis", icon: <Users size={18} aria-hidden />, active: path.startsWith(\`${base}/amis\`), badge: friendReq, badgeLabel: "demandes d'ami" }`. Vérifier la barre mobile : elle affichait déjà 6–7 onglets, si elle déborde, placer « Amis » dans le menu déroulant (comme « Mon profil ») plutôt que dans la barre basse.

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit -p .` — Expected: propre. Lancer `pnpm build:cloudflare` pour vérifier que le bundle se construit (ne pas déployer).

- [ ] **Step 4: Commit**

```bash
git add client/src/features/hub/social/FriendsPage.tsx client/src/App.tsx client/src/features/hub/components/HubShell.tsx
git commit -m "feat(hub): friends page and nav badge"
```

---

### Task 5: Données de démo, nettoyage et notes d'exploitation

**Files:**
- Modify: `scripts/hub-demo/build.ts` (lignes `hub_friendships` / `hub_follows` entre profils de démo)
- Modify: `worker/hub-demo.test.ts` (test du nouveau contenu)
- Modify: `docs/superpowers/specs/2026-10-11-friends-follow-design.md` (statut → « implémenté »)

**Interfaces:**
- Consumes : les tables de la Task 1 ; les helpers de `build.ts` (lire le fichier pour le motif d'insertion par email `@demo.ftour.invalid` et le motif de `cleanupSql`).

- [ ] **Step 1: Test d'abord**

Dans `worker/hub-demo.test.ts` (qui exécute `seedSql()` sur un SQLite en mémoire), charger aussi `social.sql` dans le schéma, puis tester : après le seed il y a ≥ 8 amitiés `accepted` + ≥ 2 `pending` + des `hub_follows` dont ≥ 3 favoris, tous entre membres démo, aucun `requester_id = addressee_id` ; après `cleanupSql()` les deux tables ne contiennent plus de ligne impliquant un membre démo (les lignes avec de vrais membres sont aussi supprimées). Run : échec attendu.

- [ ] **Step 2: Implémenter dans `build.ts`**

Ajouter la génération déterministe des lignes (amitiés acceptées avec suivis mutuels, quelques demandes en attente, quelques suivis unilatéraux dont des favoris), insérées par sous-requête sur l'email comme les autres tables ; le nettoyage supprime explicitement ces lignes pour les membres démo avant la suppression des membres (FK cascade en filet). `social.sql` doit être appliqué avant `seed.sql` — le noter dans l'en-tête commentaire du fichier généré.

- [ ] **Step 3: Régénérer et vérifier**

Run: `npx tsx scripts/hub-demo/generate.ts` puis `npx vitest run worker/hub-demo.test.ts worker/social.test.ts` — Expected: vert. Ne pas toucher `seed.sql` avec `--me` (l'utilisateur régénère avec son email).

- [ ] **Step 4: Commit**

```bash
git add scripts/hub-demo/build.ts scripts/hub-demo/seed.sql scripts/hub-demo/cleanup.sql worker/hub-demo.test.ts docs/superpowers/specs/2026-10-11-friends-follow-design.md
git commit -m "feat(hub-demo): friendships, follows and favorites in demo data"
```

- [ ] **Step 5: Rapport final (aucune action distante)**

Rappeler à l'utilisateur, dans l'ordre : `npx wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/social.sql` (après le retour du quota D1), puis `pnpm build:cloudflare` et le déploiement du Worker, puis, s'il rejoue la démo, `seed.sql` régénéré.
