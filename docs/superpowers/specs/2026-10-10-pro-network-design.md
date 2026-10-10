# Sous-espace Pro (réseau professionnel) de l'espace bénévole — design

Date : 2026-10-10 · Statut : à relire · Prérequis : espace bénévole (`2026-10-09-volunteer-hub-design.md`). Indépendant du marketplace (aucun fichier `market*` modifié).

## Objectif

Un sous-espace « Pro » dans l'espace bénévole, façon LinkedIn simplifié : feed professionnel, offres d'emploi, messagerie professionnelle, avec une navigation simple (un onglet, trois sous-onglets).

Succès : un membre complète son profil pro, publie dans le feed pro, publie une offre d'emploi ; un autre membre filtre les offres, clique « Postuler » et discute en privé avec l'auteur ; un admin masque un contenu signalé.

## Hypothèses

- Réservé aux membres du hub (même identité, même session `Authorization: Bearer`, même éligibilité).
- **Tout membre peut publier des offres** (décision utilisateur) ; modération par signalement + masquage admin + limites de débit.
- « Postuler » = ouvrir une discussion liée à l'offre (message pré-rempli). Pas de CV, pas de pièce jointe.
- Pas de notifications, groupes, réseau de contacts, recommandations, recherche de membres.
- FR d'abord, mobile d'abord.

## Approche retenue

Tables `pro_*` dédiées, schéma idempotent (`CREATE TABLE IF NOT EXISTS`), qui réutilisent membres, sessions, upload de photos et garde admin du hub. Écartées : colonne `space` sur `hub_posts` (`ALTER` non idempotent en D1, mélange fil social et fil pro) ; threads du marketplace (couplés à une annonce vendeur/acheteur).

## Réutilisé du hub (inchangé)

`getSession`, `MemberRow`, `HubError`, `iso`, `isOwnPath`, `randomToken` (`hub-d1.ts`) ; `POST /hub/media` (URL signée vers `private/hub/<memberId>/<uuid>.<ext>`, limite partagée) ; signature des URLs de lecture (1 h) ; garde admin (`admin()` : rôle ∈ {super_admin, admin, admin_ops}, demo refusé) ; validation `str()`/`id()` ; enveloppe d'erreurs JSON ; garde client « réponse non JSON = erreur ».

## Données (`worker/d1/pro.sql`, préfixe `pro_`)

| Table | Colonnes principales |
|---|---|
| `pro_profiles` | member_id (PK), headline (≤ 80), company (≤ 80), city (≤ 60), skills (JSON, ≤ 8 × ≤ 30), open_to_work (0/1), updated_at |
| `pro_posts` | id, member_id, body (1–2000), link (nullable, `https?://`, ≤ 300), status (`visible`/`hidden`), created_at |
| `pro_post_media` | post_id, r2_key, position (0–3) ; PK (post_id, position) |
| `pro_likes` | post_id, member_id ; PK composée |
| `pro_comments` | id, post_id, member_id, body (1–500), status, created_at |
| `pro_jobs` | id, member_id, title (1–80), company (1–80), city (≤ 60), type (`cdi`,`cdd`,`stage`,`freelance`,`benevolat`), description (1–3000), contact (nullable, ≤ 120), status (`open`/`closed`/`hidden`), created_at, updated_at |
| `pro_threads` | id, member_a, member_b (a < b), job_id (0 = discussion directe), created_at, last_message_at ; UNIQUE (member_a, member_b, job_id) ; CHECK member_a <> member_b |
| `pro_messages` | id, thread_id, sender_id, body (1–1000), created_at, read_at (nullable) |
| `pro_reports` | id, target_type (`post`/`comment`/`job`), target_id, member_id, reason (1–300), created_at ; UNIQUE (target_type, target_id, member_id) |

Clés étrangères en cascade vers `hub_members`. Index : `pro_posts(status, id DESC)`, `pro_jobs(status, id DESC)`, `pro_jobs(type, status, id DESC)`, `pro_comments(post_id, id)`, `pro_threads(member_a)`, `pro_threads(member_b)`, `pro_messages(thread_id, id)`.

## Règles métier

- **Profil pro :** facultatif, créé à la première sauvegarde. Compétences nettoyées, dédoublonnées. Affiché sur cartes du feed, offres et conversations.
- **Feed :** 10 publications/h, 30 commentaires/h par membre. Lien validé `https?://` uniquement (jamais `javascript:`), rendu avec `rel="noopener noreferrer nofollow"`. ≤ 4 photos appartenant à l'auteur (`isOwnPath`). Suppression = masquage par l'auteur ou un modérateur.
- **Offres :** 3 créations/24 h par membre. Propriétaire modifie (`PUT`) et change le statut `open ⇄ closed` ; propriétaire ou modérateur masque ; `hidden` → 404 sauf liste admin. Recherche `q` : `LIKE` échappé sur titre, entreprise, description, ≤ 50 caractères. Filtres : `type`, `city`.
- **Visibilité :** contenus d'un membre suspendu (ou non éligible) masqués partout.
- **Messagerie :** `POST pro/threads {to, job_id?}` crée ou retrouve la discussion (refus si `to` = soi-même, membre suspendu, offre masquée ou fermée pour une nouvelle discussion ; une existante continue). Seuls les deux participants lisent et écrivent ; **les admins ne lisent pas les messages**. `read_at` posé à l'ouverture pour les messages reçus. Boîte de réception : autre participant, titre de l'offre si liée, dernier message tronqué, non-lus ; tri par `last_message_at`. Limites : 30 messages/h, 20 nouvelles discussions/h.
- **Signalement :** posts, commentaires, offres (pas les messages privés).

## API (Worker, `/hub/pro/*`, déléguée depuis `handleHubRequest` comme `market/`)

- Profil : `GET pro/profile/:memberId` (soi ou autre), `PUT pro/profile`.
- Feed : `GET pro/feed?cursor=`, `POST pro/posts`, `DELETE pro/posts/:id`, `POST pro/posts/:id/like`, `GET|POST pro/posts/:id/comments`, `DELETE pro/comments/:id`.
- Offres : `GET pro/jobs?cursor=&type=&city=&q=&mine=1`, `POST pro/jobs`, `GET pro/jobs/:id`, `PUT pro/jobs/:id`, `POST pro/jobs/:id/status {status:"open"|"closed"}`, `DELETE pro/jobs/:id` (masque).
- Messagerie : `POST pro/threads`, `GET pro/threads`, `GET pro/threads/:id/messages?cursor=`, `POST pro/threads/:id/messages`, `POST pro/threads/:id/read`.
- Signalement : `POST pro/report {type, id, reason}`.
- Admin : `GET pro/admin/reports`, `GET pro/admin/jobs`, `POST pro/admin/hide {type, id}`, `POST pro/admin/reports/:id/dismiss`.
- Pas de `PATCH` (CORS) ; erreurs `{error, message}` 400/401/403/404/429 ; `Cache-Control: no-store` ; photos et avatars en URLs signées 1 h ; curseurs numériques, 20/page.

## Code

- `worker/pro-d1.ts` (données, comme `hub-d1.ts`) + `worker/pro.ts` (routes ; reçoit du hub le même petit contexte que `market.ts`) ; `worker/hub.ts` délègue tout chemin `pro/…`.
- Client `client/src/features/hub/pro/` : `pro-api.ts`, `ProLayout` (barre Feed · Emplois · Messages), pages Feed, Emplois (liste/détail/formulaire), Messages (boîte/conversation), Profil pro ; composants carte d'offre, carte de post.
- Routes (les plus spécifiques d'abord) : `/:lang/benevole/espace/pro`, `…/pro/emplois`, `…/pro/emplois/nouveau`, `…/pro/emplois/:id`, `…/pro/emplois/:id/modifier`, `…/pro/messages`, `…/pro/messages/:threadId`, `…/pro/profil`, `…/pro/membre/:id`.
- Navigation : entrée « Pro » dans `HubShell` (latéral + 4ᵉ onglet mobile) ; section « Pro » dans `/admin/hub`.

## Sécurité

Propriété vérifiée côté serveur à chaque écriture ; chemins de photos limités à `<memberId>/…` sans `..` ; IDs entiers sûrs ; corps strictement `string` ; liens `http(s)` seulement ; aucun email dans les réponses ; messages invisibles pour les tiers (test explicite) ; limites de débit par membre ; texte rendu échappé ; demo/admin sans jeton → 403.

## Tests (vitest, hors ligne, `node:sqlite` en mémoire)

Données : validation (types, longueurs, lien, compétences, photos), propriété, statuts `open/closed/hidden`, filtres et recherche (`%`, `_`, 50+ caractères), pagination par curseur, membre suspendu masqué, commentaires, likes idempotents, discussion unique par (paire, offre), refus soi-même, accès tiers refusé, non-lus, limites horaires, signalements. Handler : routes, 401/403, demo refusé, URLs signées, absence d'email.

## Livraison (trois jalons déployables seuls)

1. **Profil pro + feed** : `pro.sql`, API profil/feed, onglet Pro dans `HubShell`, pages Feed et Profil.
2. **Emplois** : API offres, pages liste/détail/formulaire, admin.
3. **Messagerie** : API threads/messages, boîte et conversation, bouton « Postuler ».

Déploiement côté utilisateur : appliquer `worker/d1/pro.sql` sur la D1 de prod, puis `pnpm build:cloudflare && npx wrangler deploy`, puis build et déploiement du front sur `ftour-bab-rayan-v3-3`.

## Hors périmètre

CV/candidatures structurées, réseau de contacts, notifications email/push, groupes, recommandations, recherche de membres, messages vocaux/pièces jointes, signalement de messages privés.
