# Marketplace de l'espace bénévole — design

Date : 2026-10-10 · Statut : à relire · Prérequis : espace bénévole en prod (`2026-10-09-volunteer-hub-design.md`)

## Objectif

Un onglet « Marketplace » dans l'espace bénévole : les membres publient des annonces pour vendre des objets (photos, prix, description) ; les autres membres les consultent et contactent le vendeur de trois façons complémentaires : téléphone/WhatsApp (choix du vendeur), commentaires publics, messagerie interne privée.

Succès : un membre publie une annonce avec photos ; un autre membre la trouve (filtre, recherche), pose une question en commentaire, appelle ou écrit sur WhatsApp, ou ouvre une discussion privée ; le vendeur marque l'objet vendu ; un admin masque une annonce signalée.

## Hypothèses

- Réservé aux membres de l'espace bénévole (même identité, même session `Authorization: Bearer`, même contrôle d'éligibilité que le hub).
- Pas de paiement en ligne, pas de notifications par email, pas d'expiration automatique des annonces.
- Catégories fixes : `maison, mode, high-tech, enfants, livres, vehicules, autre`. États : `neuf, bon, correct`.
- Prix en dirhams (MAD), entier ≥ 0 ; `0` s'affiche « Gratuit ».
- FR d'abord (comme le hub).

## Réutilisé du hub (inchangé)

Membres et sessions (`hub-d1.ts`: `getSession`, `MemberRow`, `HubError`, `iso`, `isOwnPath`, `randomToken`), upload de photos (`POST /hub/media` → URL signée vers `private/hub/<memberId>/<uuid>.<ext>`, limite 20/h, `recordUpload`), signature des URLs de lecture (1 h), garde admin (`admin()`: Supabase bearer + rôle ∈ {super_admin, admin, admin_ops}, **demo refusé**), validation `str()`/`id()`, enveloppe d'erreurs JSON, garde client « réponse non JSON = erreur ».

## Données (`worker/d1/marketplace.sql`, préfixe `mk_`, idempotent)

| Table | Colonnes principales |
|---|---|
| `mk_listings` | id, member_id, title (1–80), description (1–2000), price (entier 0–9 999 999), category, condition, city (≤ 60), status (`active`/`sold`/`hidden`), contact_phone (nullable), contact_whatsapp (0/1), created_at, updated_at |
| `mk_listing_media` | listing_id, r2_key (chemin dans le bucket logique `hub`), position (0–3) ; PK (listing_id, position) |
| `mk_comments` | id, listing_id, member_id, body (1–500), status (`visible`/`hidden`), created_at |
| `mk_threads` | id, listing_id, buyer_id, seller_id, created_at, last_message_at ; UNIQUE (listing_id, buyer_id) ; CHECK buyer_id <> seller_id |
| `mk_messages` | id, thread_id, sender_id, body (1–1000), created_at, read_at (nullable) |
| `mk_reports` | id, target_type (`listing`/`comment`), target_id, member_id, reason (1–300), created_at ; UNIQUE (target_type, target_id, member_id) |
| `mk_uploads` | non nécessaire : les photos passent par `POST /hub/media` (limite partagée) |

Clés étrangères en cascade vers `hub_members`. Index : `mk_listings(status, id DESC)`, `mk_listings(category, status, id DESC)`, `mk_listings(member_id)`, `mk_comments(listing_id, id)`, `mk_threads(buyer_id)`, `mk_threads(seller_id)`, `mk_messages(thread_id, id)`.

## Règles métier

- **Téléphone :** facultatif ; normalisé (espaces, points, tirets retirés ; `+` initial conservé) puis validé `^\+?\d{8,15}$`. Renvoyé **seulement** aux membres connectés et seulement si le vendeur l'a renseigné. `contact_whatsapp = 1` fait afficher « WhatsApp » (lien `https://wa.me/<chiffres>`) en plus de « Appeler » (`tel:`).
- **Annonce :** titre/description/ville nettoyés (`trim`), catégorie et état dans les listes fermées, ≤ 4 photos appartenant au vendeur (`isOwnPath`), 5 créations par 24 h par membre. Seul le propriétaire modifie (`PUT`) ou change le statut `active ⇄ sold` ; propriétaire ou modérateur masque ; l'admin masque (`hidden`) sans contrôle de propriété.
- **Visibilité :** la liste et le détail n'affichent que `active` et `sold` ; `hidden` → 404 pour tous (sauf liste admin). Les annonces d'un membre **suspendu** (ou dont le bénévole n'est plus éligible) disparaissent de la liste.
- **Commentaires :** publics sous l'annonce, 30/h par membre, soft delete par l'auteur ou un modérateur ; impossible sur une annonce masquée.
- **Messagerie :** `POST /hub/market/listings/:id/thread` crée ou retrouve la discussion de l'acheteur (refus si l'acheteur est le vendeur, si l'annonce est masquée, ou **vendue pour une nouvelle discussion** ; une discussion existante continue). Messages ≤ 1000 caractères, 30/h par membre, 20 nouvelles discussions/h. Seuls les deux participants lisent et écrivent ; **les admins ne lisent pas les messages**. `read_at` est posé pour les messages reçus quand le destinataire ouvre la discussion. Boîte de réception : discussions du membre, autre participant, titre et vignette de l'annonce, dernier message tronqué, compteur de non-lus ; tri par `last_message_at`.
- **Signalement :** annonces et commentaires (pas les messages privés).

## API (Worker, sous `/hub/market/*`, branchée dans `handleHubRequest`)

- Annonces : `GET market/listings?cursor=&category=&q=&mine=1` (20/page, curseur numérique), `POST market/listings`, `GET market/listings/:id`, `PUT market/listings/:id`, `POST market/listings/:id/status` `{status:"active"|"sold"}`, `DELETE market/listings/:id` (masque).
- Commentaires : `GET|POST market/listings/:id/comments`, `DELETE market/comments/:id`.
- Messagerie : `POST market/listings/:id/thread`, `GET market/threads`, `GET market/threads/:id/messages?cursor=`, `POST market/threads/:id/messages`, `POST market/threads/:id/read`.
- Signalement : `POST market/report` `{type:"listing"|"comment", id, reason}`.
- Admin : `GET market/admin/listings`, `GET market/admin/reports`, `POST market/admin/hide` `{type, id}`, `POST market/admin/reports/:id/dismiss`.
- Recherche `q` : `LIKE` sur titre et description, échappée, ≤ 50 caractères (limite D1 des motifs LIKE).
- Pas de `PATCH` (CORS) ; erreurs `{error, message}` 400/401/403/404/429 ; Cache-Control no-store ; photos renvoyées en URLs signées 1 h (annonces, vignettes de la boîte de réception, avatars).

## Code

- `worker/market-d1.ts` (couche données, comme `hub-d1.ts`) + `worker/market.ts` (routes ; reçoit du hub un petit contexte: `d`, `member()`, `admin()`, `sign()`, `json()`, `now`, `request`, `path`) ; `worker/hub.ts` délègue tout chemin `market/…`. Tests `node:sqlite` en mémoire, hermétiques.
- Client : `client/src/features/hub/market/` (`market-api.ts`, pages Liste / Détail / Formulaire / Boîte de réception / Conversation, composants carte d'annonce et galerie), routes `/:lang/benevole/espace/marketplace`, `…/marketplace/nouveau`, `…/marketplace/:id`, `…/marketplace/:id/modifier`, `…/marketplace/messages`, `…/marketplace/messages/:threadId` (les plus spécifiques d'abord). Entrée « Marketplace » dans `HubShell` (navigation latérale + 4ᵉ onglet mobile). Page admin : section « Marketplace » dans `/admin/hub` (annonces, signalements, masquer).

## Sécurité

Propriété vérifiée côté serveur à chaque écriture ; chemins de photos limités à `<memberId>/…` sans `..` ; IDs entiers sûrs ; corps strictement `string` ; téléphone jamais envoyé aux non-connectés ; messages invisibles pour les tiers (test explicite) ; limites de débit par membre ; aucune réponse JSON ne contient d'email ; texte rendu échappé ; demo/admin sans jeton → 403.

## Tests (vitest, hors ligne)

Couche données : validation (prix, catégorie, état, téléphone, photos), propriété, statut `sold`/`hidden`, filtre/recherche (`q` avec `%`, `_` et 50+ caractères), pagination par curseur, membre suspendu masquant ses annonces, commentaires, discussion unique par (annonce, acheteur), refus de discuter avec soi-même, accès tiers refusé, non-lus, limites horaires, signalements. Handler : routes, auth 401/403, demo refusé, URLs signées, absence de `contact_phone` dans la liste si non renseigné, absence d'email.

## Livraison (deux jalons déployables seuls)

1. **Annonces** : schéma, API annonces/commentaires/signalements/admin, écrans liste-détail-formulaire, contact téléphone/WhatsApp.
2. **Messagerie** : API threads/messages, boîte de réception et conversation.

Déploiement côté utilisateur : appliquer `worker/d1/marketplace.sql` sur la D1 de prod, puis `pnpm build:cloudflare && npx wrangler deploy` (le Worker déploie `dist/worker.js` : toujours reconstruire), puis build et déploiement du front sur `ftour-bab-rayan-v3-3`.

## Hors périmètre

Paiement, notifications email/push, expiration automatique, favoris, messages vocaux/images, signalement de messages privés, avis sur les vendeurs, négociation de prix structurée.
