# Espace bénévole (mini réseau social) — design

Date : 2026-10-09 · Statut : à relire

## Objectif

Un espace privé pour les bénévoles inscrits : annonces officielles épinglées en tête, fil libre dessous (publications, photos, likes, commentaires), profils, modération par l'admin.

Succès : un bénévole confirmé se connecte par lien magique, publie, like, commente ; un admin publie une annonce, masque un contenu et suspend un membre ; les photos ne sont visibles que par les membres actifs.

## Hypothèses

- Accès réservé aux bénévoles dont `volunteers.status` est confirmé (la valeur exacte est à lire dans le code au moment du plan).
- Mobile d'abord, FR d'abord (EN/AR ensuite).
- Pas de chat temps réel, pas de messages privés, pas de groupes, pas de notifications, pas de mentions, pas d'édition après publication.
- L'authentification pourra être remplacée plus tard : le module n'en dépend que par `hub_sessions`.

## Approche retenue

Module D1 écrit à la main (comme `gallery-d1.ts` / `blog-d1.ts`), identité propre au Worker : lien magique envoyé via Resend, jeton de session signé. Indépendant de Supabase Auth. Photos dans R2 sous un préfixe privé.

Écartées : lien magique Supabase Auth (deux systèmes d'identité), tout dans Supabase (contraire à la migration D1/R2).

## Identité et accès

- `POST /hub/login {email}` : cherche une ligne `volunteers` confirmée pour cet email. Si trouvée, envoie un lien à usage unique valable 15 min. Réponse identique dans tous les cas (pas d'énumération).
- `GET /hub/verify?token=` : échange le jeton contre un cookie `hub_session` (HttpOnly, Secure, SameSite=Lax, 30 jours). Session stockée en D1, révocable.
- Jetons de lien et de session stockés hachés (SHA-256), jamais en clair.
- Première connexion : création de `hub_members` (une ligne par email, même si plusieurs lignes `volunteers` existent, une par jour).
- Suspension d'un membre : toutes ses sessions deviennent invalides, accès refusé.
- Rôles dans l'espace : `member`, `moderator`. Les annonces sont réservées aux admins (rôle Supabase existant).

## Modèle de données (`worker/d1/hub.sql`, préfixe `hub_`)

| Table | Colonnes principales |
|---|---|
| `hub_members` | id, email (unique), display_name, avatar_key, bio, role, status (active/suspended), created_at |
| `hub_login_tokens` | token_hash, email, expires_at, used_at |
| `hub_sessions` | token_hash, member_id, expires_at, revoked_at |
| `hub_posts` | id, member_id, body (≤ 2000), kind (post/announcement), pinned, status (visible/hidden), created_at |
| `hub_post_media` | post_id, r2_key, position (≤ 4 par publication) |
| `hub_comments` | id, post_id, member_id, body (≤ 500), status, created_at |
| `hub_likes` | post_id, member_id (clé primaire composée) |
| `hub_reports` | id, target_type, target_id, member_id, reason, created_at |

Idempotent (`CREATE TABLE IF NOT EXISTS`), appliqué par l'utilisateur sur la D1 de prod comme les autres schémas.

## API (Worker, routes `/hub/*`, hors tRPC)

- Session : `POST /hub/login`, `GET /hub/verify`, `POST /hub/logout`, `GET /hub/me`, `PATCH /hub/me`.
- Fil : `GET /hub/feed?cursor=` (20 par page, annonces épinglées d'abord, compteurs de likes et de commentaires, état « liké »), `POST /hub/posts`, `DELETE /hub/posts/:id`.
- Interactions : `POST /hub/posts/:id/like`, `POST /hub/posts/:id/comments`, `DELETE /hub/comments/:id`, `POST /hub/report`.
- Médias : `POST /hub/media` renvoie une URL signée d'envoi (images, 8 Mo, réutilise `/media-upload`), clés sous `hub/<member_id>/`.
- Admin (rôle Supabase existant) : `GET /hub/admin/reports`, `POST /hub/admin/posts` (annonce, épinglée ou non), `POST /hub/admin/hide`, `POST /hub/admin/members/:id/status`.

## Photos privées

Le préfixe `hub/` suit le schéma des buckets non publics : jamais servi par `/media`, uniquement par `/media-signed` avec une URL signée courte, émise à un membre actif. À vérifier au plan : le bucket `images` est public, donc le préfixe `hub/` doit être explicitement exclu de `/media`.

## Sécurité

- Contrôle de propriété côté serveur à chaque écriture ; modérateur et admin peuvent masquer.
- Limites de débit par membre : 10 publications/h, 30 commentaires/h.
- Texte rendu échappé, aucun HTML accepté.
- Aucun secret en clair ; `JWT_SECRET` pour la signature, Resend pour l'envoi.

## Interface (`client/src/features/hub/`)

- `/:lang/benevole/espace` : connexion, puis fil (zone de publication, cartes, likes, commentaires dépliables, annonces épinglées en tête).
- `/:lang/benevole/espace/profil` : nom, bio, photo.
- Admin `/admin/hub` : signalements, annonces, membres (suspension), entrée dans le menu admin.
- Liens d'entrée : bouton « Espace bénévole » sur `/benevole` et dans l'email de confirmation d'inscription.

## Tests (vitest, hors ligne)

`worker/hub-d1.test.ts` sur SQLite en mémoire, comme les autres modules D1 : usage unique et expiration des jetons, suspension, fil et pagination, propriété, limites de débit, signalement et masquage, exclusion de `hub/` dans `/media`. Pas d'appel réseau.

## Livraison par étapes

1. Connexion + profil + fil (publier, liker, commenter).
2. Photos privées.
3. Annonces et modération admin.

Chaque étape est déployable seule. Déploiement du Worker et du front à lancer par l'utilisateur (projet Pages `ftour-bab-rayan-v3-3`).

## Hors périmètre

Chat temps réel, messages privés, groupes, notifications, mentions, édition après publication, migration vers un login par mot de passe (à voir plus tard).

## Écarts décidés au plan (2026-10-09)

Constatés en lisant le code ; ils remplacent les passages correspondants ci-dessus.

- **Session : en-tête `Authorization: Bearer`, pas de cookie.** Le site (`www.ftourbabrayan.ma`) et le Worker (`*.workers.dev`) sont sur des origines différentes : un cookie `SameSite=Lax` ne serait pas envoyé, et un cookie tiers est bloqué par Safari. Le jeton est gardé dans `localStorage` côté client.
- **Lien magique : validé par `POST /hub/verify`**, pas `GET`, pour qu'un scanner d'emails ne consomme pas le lien. Le lien pointe vers `/fr/benevole/espace?token=…`.
- **Éligibilité :** `volunteers.status IN ('confirmed','present')` (valeurs réelles du schéma : `registered, confirmed, present, absent, cancelled`).
- **PUT au lieu de PATCH :** le CORS du Worker n'autorise pas PATCH.
- **Annonces :** texte seul, publiées par un membre système « Équipe Ftour » (`equipe@hub.ftourbabrayan.ma`, non connectable). Rôles admin autorisés : `super_admin`, `admin`, `admin_ops`.
- **Suppression = masquage** (`status = 'hidden'`) pour les publications et commentaires, par le propriétaire ou un modérateur.
- **Tables ajoutées :** `hub_uploads` (limite 20 demandes d'upload/h) ; `hub_login_tokens.created_at` (limite 3 liens/h par email).
- **Livraison :** un seul jalon membre (connexion, fil, photos, profil, commentaires, signalement) puis l'admin ; le plan est dans `docs/superpowers/plans/2026-10-09-volunteer-hub.md`.
- **Hors plan :** lien « Espace bénévole » dans l'email de confirmation d'inscription ; nettoyage des photos orphelines.
