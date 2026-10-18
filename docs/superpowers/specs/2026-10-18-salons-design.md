# Salons — design

Date: 2026-10-18 · Statut: à relire par Reda

## Objectif
Un onglet **Salons** dans l'espace membre (Hub). Tout membre connecté crée un salon thématique ; tous les salons actifs sont listés sous l'onglet. Chaque salon a son **feed** de messages et sa **visio de groupe** (Jitsi embarqué).

## Hypothèses (à corriger si fausses)
- Salons ouverts à tous les membres du Hub : pas d'invitation, pas de salon privé.
- Le créateur archive son salon ; l'admin masque ou supprime un salon.
- Un auteur supprime ses propres messages. Pas de modération fine, pas de signalement.
- Pas de pièces jointes dans le feed (texte seul).

## Hors périmètre (YAGNI)
Salons privés/sur invitation, rôles par salon, réactions, fils de réponses, pièces jointes, notifications push/email, indicateur « visio en cours », push temps réel via Durable Object.

## Données — `worker/d1/salon.sql` (idempotent, préfixe `sl_`, prérequis `hub.sql`)
```sql
sl_salons(
  id INTEGER PK AUTOINCREMENT,
  member_id INTEGER NOT NULL → hub_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length BETWEEN 1 AND 80),
  topic TEXT NOT NULL CHECK (length BETWEEN 1 AND 500),
  room  TEXT NOT NULL UNIQUE,          -- jeton aléatoire (16+ car.), jamais exposé hors salon
  status TEXT NOT NULL DEFAULT 'active' CHECK IN ('active','archived','hidden'),
  last_post_at TEXT,
  created_at TEXT NOT NULL DEFAULT now
)  + index (status, last_post_at DESC)
sl_posts(
  id INTEGER PK AUTOINCREMENT,
  salon_id INTEGER NOT NULL → sl_salons(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL → hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length BETWEEN 1 AND 2000),
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT now
)  + index (salon_id, id DESC)
```
Application : `wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/salon.sql` (staging : `--env staging`). **Changement de base de prod : exécuté uniquement sur accord explicite de Reda.**

## API — `worker/salon.ts` (routes) + `worker/salon-d1.ts` (logique)
Branché dans `worker/hub.ts` comme Meetup : `if (path.startsWith("salon/")) handleSalonRoute(...)`. Mêmes helpers (`member()`, `admin()`, `sign()`, `readJson`, `id`, `HubError`). Validation zod en entrée.

| Méthode & chemin | Rôle |
|---|---|
| `GET salons?cursor=` | Salons `active`, tri `last_post_at` puis `created_at` DESC ; carte = id, titre, sujet, créateur (nom + avatar signé), nb messages, `last_post_at`. **Sans `room`.** |
| `POST salons` | Crée (`title`, `topic`). Limite : 5 salons/jour/membre (`rate_limited`). Génère `room` via `crypto.randomUUID()` sans tirets. |
| `GET salons/:id` | Détail + `room` (membre connecté uniquement) ; 404 si `hidden` ; `archived` lisible en lecture seule. |
| `GET salons/:id/posts?cursor=` | Messages non supprimés, 30 par page, plus récents d'abord ; auteur = nom + avatar signé. |
| `POST salons/:id/posts` | Poste (`body`). Refusé si salon non `active`. Limite : 20 messages/minute/membre. Met à jour `last_post_at`. |
| `DELETE salons/:id/posts/:postId` | Soft delete (`deleted_at`) par l'auteur. |
| `POST salons/:id/archive` | Créateur uniquement → `archived`. |
| `GET admin/salons` · `POST admin/hide` · `POST admin/delete` | Même schéma que Meetup (`admin()`). |

Erreurs : `HubError` (`invalid`, `not_found`, `forbidden`, `rate_limited`), comme Meetup.

## Client — `client/src/features/hub/salon/`
- `salon-api.ts` : appels REST typés (calqué sur `meetup-api.ts`).
- `pages/SalonsPage.tsx` : liste + formulaire « Nouveau salon » (titre, sujet).
- `pages/SalonPage.tsx` : en-tête (titre, sujet, créateur), feed + composeur, panneau visio. Bouton « Archiver » pour le créateur.
- `components/JitsiPanel.tsx` : bouton « Rejoindre la visio » ; au clic seulement, rend l'iframe.
- Routes dans `App.tsx` : `/:lang/benevole/espace/salons` et `/:lang/benevole/espace/salons/:id`.
- `HubShell.tsx` : entrée « Salons » (icône `MessagesSquare`) entre Meetup et Messages, sur desktop et mobile.
- Feed : polling 10 s quand `document.hidden` est faux, arrêt sinon ; les nouveaux messages s'ajoutent sans perdre le scroll. Réutilise `Avatar`, `StatePanel`, `Composer` s'ils conviennent, sinon composeur simple.
- Accessibilité : feed en `role="log"` `aria-live="polite"`, composeur étiqueté, bouton visio clavier-accessible.

## Visio — Jitsi
- Iframe vers `https://<JITSI_DOMAIN>/babrayan-<room>#userInfo.displayName="<nom>"&config.prejoinPageEnabled=false` avec `allow="camera; microphone; display-capture; fullscreen"`. Aucun média avant le clic.
- `JITSI_DOMAIN` : variable publique côté client (`VITE_JITSI_DOMAIN`), défaut `meet.jit.si`.
- Le nom de salle contient le jeton `room` : seuls les membres du Hub qui ouvrent le salon le connaissent.
- **Risque connu, à vérifier avant livraison** : le serveur public `meet.jit.si` limite l'usage en iframe (durée, connexion modérateur). Test réel obligatoire. Si bloquant : Jitsi as a Service (8x8.vc, domaine + JWT) ou serveur Jitsi à Reda, ce qui ajouterait un secret Worker et une génération de JWT (hors de cette spec, nouvelle itération).

## Sécurité
- Toutes les routes exigent un membre Hub authentifié ; `room` renvoyé seulement par `GET salons/:id`.
- Texte rendu comme texte (pas de HTML), longueurs bornées côté serveur.
- Soft delete des messages ; masquage admin retire le salon des listes et du détail.
- Pas de nouveau secret ni de binding Cloudflare.

## Tests
- `worker/salon-d1.test.ts` (même harnais que `meetup-d1.test.ts`, `test-d1.ts`) : création + limites, `room` absent de la liste et présent du détail, pagination, droits (auteur / créateur / admin), salon archivé refuse les posts, salon masqué introuvable, rate limit messages.
- `worker/salon.test.ts` : routage et codes HTTP.
- Vérification : `pnpm check` + `vitest run worker/salon*.test.ts`. Les 2 échecs existants de `worker/email.group.test.ts` sont connus et hors sujet.
- Test manuel de la visio sur un déploiement (2 navigateurs) avant de conclure.

## Déploiement
Branche dédiée depuis `origin/main`, PR, puis migration D1 de prod et `pnpm build:cloudflare && wrangler deploy`, chacun seulement sur ordre explicite de Reda.

## Livraison par étapes
1. SQL + `salon-d1.ts` + tests.
2. Routes + branchement `hub.ts`.
3. Client : liste, salon, feed, onglet.
4. Visio Jitsi + test réel du risque d'embarquement.
