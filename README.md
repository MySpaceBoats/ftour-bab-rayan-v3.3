# Ftour Bab Rayan

A full-stack web application built with React, Express, and Cloudflare Workers.

## Tech Stack

- **Frontend:** React 19, Vite, TailwindCSS, Radix UI
- **Backend:** tRPC API on Cloudflare Workers
- **Database:** MySQL with Drizzle ORM
- **Deployment:** Cloudflare Workers (with static assets)

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type checking
pnpm check
```

## Building

```bash
# Build for production
pnpm build

# Build for Cloudflare Pages only (frontend + worker)
pnpm build:cloudflare
```

## Deployment

### Cloudflare Workers Configuration

This project is deployed to **Cloudflare Workers** with static assets.

#### Build & Deploy Commands

The deployment uses `wrangler versions upload` which requires:

- **Build command:** `pnpm run build`
- **Worker code:** `dist/worker.js` (API handler)
- **Static assets:** `dist/public/` (frontend)

The `wrangler.toml` is configured with:

```toml
main = "dist/worker.js"         # Worker entry point
[assets]
directory = "dist/public"       # Static assets
```

### Manual Deployment

```bash
# Build and deploy to Cloudflare Workers
pnpm run build
wrangler versions upload

# Or for legacy Cloudflare Pages deployment
pnpm run deploy:cloudflare
```

## Project Structure

```
.
├── client/              # React frontend
├── server/              # Express backend (for Node.js hosting)
├── worker/              # Cloudflare Workers API (tRPC)
├── dist/
│   ├── worker.js        # Built Worker (API handler)
│   ├── public/          # Built frontend (static assets)
│   └── index.js         # Built Express server (for Node.js)
└── wrangler.toml        # Cloudflare Workers configuration
```

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build everything (frontend, backend, worker)
- `pnpm build:cloudflare` - Build for Cloudflare Pages only
- `pnpm deploy:cloudflare` - Build and deploy to Cloudflare Pages
- `pnpm start` - Run production Express server
- `pnpm check` - TypeScript type checking
- `pnpm format` - Format code with Prettier
- `pnpm test` - Run tests

## Troubleshooting

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions and troubleshooting.

## Module Galerie photo

### Migration DB

- Exécuter `supabase/migrations/add_gallery_module.sql` dans Supabase SQL Editor.
- Cette migration crée:
  - `gallery_albums`
  - `gallery_photos`
  - index + trigger `updated_at`
  - seed minimal de 2 albums.

### Storage

- Bucket utilisé: `images` (même bucket que les autres uploads).
- Préfixes de fichiers galerie:
  - originaux: `gallery/original/...`
  - miniatures: `gallery/thumb/...`

### Limites d'upload

- Formats autorisés: `image/jpeg`, `image/png`, `image/webp`
- SVG interdit
- Taille max: 8 MB / fichier
- Batch max: 20 fichiers

### Endpoints/Procédures tRPC

Admin (auth admin obligatoire):

- `gallery.listPhotos`
- `gallery.getPhoto`
- `gallery.uploadPhotos`
- `gallery.updatePhoto`
- `gallery.deletePhoto`
- `gallery.publish`
- `gallery.unpublish`
- `gallery.reorder`
- `gallery.listAlbums`
- `gallery.createAlbum`

Public:

- `public.galleryPhotos`
- `public.galleryAlbums`

### Routes Front

- Admin:
  - `/admin/galerie`
  - `/admin/galerie/nouveau`
  - `/admin/galerie/:id`
- Public:
  - `/:lang/galerie`
  - `/galerie` (redirect)

## QR unique – flux espèces

Nouveau flux "Menu Solidaire" via QR unique:

- Route publique: `/menu` (alias `/shop`)
- Checkout espèces uniquement (pas de paiement en ligne)
- Création d'une commande `PENDING_CASH` via `POST /api/orders`
- Preuve client: `/proof/:reference?t=<proofToken>`
- API catalogue unifié: `GET /api/catalog` (Goodies + Pâtisseries + Produits du terroir + Dons, synchronisés avec les catalogues existants)
- Staff: `/admin/orders-cash` pour rechercher par référence et marquer `FULFILLED`

### Variables d'environnement Worker

- `ORDER_PROOF_SECRET` (recommandé): secret HMAC pour proof token
- `PUBLIC_APP_URL` (recommandé): URL publique utilisée dans les emails
- `CASH_ORDER_ADMIN_CC_EMAIL` (optionnel): copie email admin
- `SUPABASE_URL` (obligatoire): URL projet Supabase
- `SUPABASE_SERVICE_ROLE_KEY` (obligatoire côté Worker): clé service role pour opérations admin/tokens/storage
- `EMAIL_PROVIDER_KEY` ou `RESEND_API_KEY` (obligatoire pour emails): clé fournisseur email
- `BASE_URL` ou `PUBLIC_APP_URL` (obligatoire): URL publique pour construire les liens signés

## Carte Membre Bab Rayan

Système complet de gestion de cartes membres avec workflow email en 2 étapes (commande → paiement), upload de preuve de virement et tableau de bord admin.

### Fichiers clés

| Fichier | Rôle |
|---------|------|
| `supabase/migrations/add_member_cards.sql` | Schéma PostgreSQL + triggers + RLS + bucket storage |
| `worker/member-cards.ts` | Routes Cloudflare Worker (API publique + admin) |
| `worker/member-card-emails.ts` | Templates HTML emails (commande + paiement) |
| `worker/member-cards.test.ts` | Tests unitaires (transitions, tokens, idempotence, upload) |
| `client/src/features/ops/admin/AdminMemberCards.tsx` | Dashboard admin React (`/admin/cards`) |

### Configuration des variables d'environnement

#### Cloudflare Worker (production)

Configurer dans le dashboard Cloudflare Workers → Settings → Variables, ou via `wrangler secret put <NOM>` :

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `SUPABASE_URL` | ✅ | URL du projet Supabase (ex. `https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Clé service role Supabase (**côté Worker uniquement — ne jamais exposer côté client**) |
| `SUPABASE_ANON_KEY` | ✅ | Clé publique Supabase (validation JWT admin) |
| `RESEND_API_KEY` | ✅ | Clé API [Resend](https://resend.com) pour l'envoi d'emails |
| `EMAIL_PROVIDER_KEY` | Optionnel | Alias de `RESEND_API_KEY` (compatibilité de configuration) |
| `PUBLIC_APP_URL` | ✅ | URL publique du site (ex. `https://www.ftourbabrayan.ma`) — utilisée dans les liens emails |
| `JWT_SECRET` | ✅ | Secret JWT pour la validation des sessions |
| `ORDER_PROOF_SECRET` | Recommandé | Secret HMAC pour les tokens de preuve (autres fonctionnalités) |
| `CASH_ORDER_ADMIN_CC_EMAIL` | Optionnel | Email copie admin pour les commandes espèces |

#### Développement local

Créer un fichier `.dev.vars` à la racine (ignoré par git) pour `wrangler dev` :

```ini
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
RESEND_API_KEY=re_...
PUBLIC_APP_URL=http://localhost:5173
JWT_SECRET=local-dev-secret
```

### Déploiement de la migration SQL

Exécuter dans Supabase SQL Editor (rôle `postgres` ou `service_role`) :

```sql
-- Copier-coller le contenu de :
-- supabase/migrations/add_member_cards.sql
```

La migration crée :
- Tables : `members`, `member_card_orders`, `member_card_events`, `member_card_tokens`
- Trigger `updated_at` sur `member_card_orders`
- Trigger anti-régression de statut via `enforce_member_card_status_transition()`
- Fonction `transition_member_card_status(old, new)` → `boolean`
- RLS activé (accès service role uniquement)
- Bucket storage privé `member-card-proofs` (max 10 Mo, PDF/JPG/PNG)

### Workflow des statuts

```
INSCRIT
  └─→ MAIL_COMMANDE_ENVOYE  (admin: send-order-email)
        └─→ CARTE_DEMANDEE       (membre: clic lien email)
              └─→ MAIL_PAIEMENT_ENVOYE (automatique)
                    ├─→ PAIEMENT_RECU  (membre: sur place  OU  admin: mark-paid)
                    └─→ A_IMPRIMER     (membre: virement + preuve)
                          └─→ IMPRIMEE  (admin: mark-printed)
                                └─→ LIVREE (admin: mark-delivered)
```

Les régressions sont bloquées au niveau DB (trigger) **et** Worker (`canAdvance`).

### API Worker — endpoints

#### Admin (JWT Supabase obligatoire)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/admin/card/send-order-email` | `{member_id}` → email commande avec lien signé |
| `POST` | `/api/admin/card/resend-payment-email` | `{order_id}` → renvoie email paiement |
| `POST` | `/api/admin/card/mark-paid` | `{order_id}` → `PAIEMENT_RECU` (sur place) |
| `POST` | `/api/admin/card/mark-printed` | `{order_id}` → `IMPRIMEE` |
| `POST` | `/api/admin/card/mark-delivered` | `{order_id}` → `LIVREE` |
| `GET` | `/api/admin/cards` | `?status=&search=&page=` → liste paginée |
| `GET` | `/api/admin/cards/:id/events` | Timeline d'une order |
| `GET` | `/api/admin/card/proof-url` | `?order_id=` → signed URL 10 min |

#### Publics (token opaque uniquement)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/card/confirm-order?token=` | Confirme la demande, envoie email paiement |
| `GET` | `/card/payment?token=` | Formulaire de paiement (méthode + preuve) |
| `POST` | `/api/card/confirm-payment` | `multipart {token, payment_method, file?}` |

### Sécurité

- Endpoints admin : JWT Supabase + rôle dans `users.role` (admin/super_admin/admin_ops…)
- Endpoints publics : token opaque SHA-256 hashé en DB, expiration 72h, usage unique
- Upload : validation MIME + extension + taille côté Worker (service role Supabase)
- Signed URLs téléchargement : TTL 10 min, générées à la demande
- Audit complet dans `member_card_events`

### Tests

```bash
pnpm test
```

Couvre (`worker/member-cards.test.ts`) :
- Transitions de statut (autorisées + bloquées + idempotence)
- Expiration de tokens
- Validation upload (MIME, extension, taille, limite exacte)

### E2E rapide

1. Ouvrir `/menu`, ajouter des items goodies/pâtisseries/produits du terroir/dons.
2. Aller sur `/menu/checkout`, saisir identité, cocher acceptation, valider.
3. Vérifier l'affichage de `/proof/<reference>?t=...` avec référence + QR.
4. Vérifier la réception email Resend (si clé configurée).
5. Côté staff, ouvrir `/admin/orders-cash`, chercher la référence et cliquer "Marquer remis".

Note: en cas de nouvelle tentative de publication PR, vérifier que le commit de suivi est bien poussé avant création de PR.

### Dépannage création de PR

Si la création de PR échoue dans l’automatisation:

1. Vérifier qu’un commit de suivi existe localement (`git log -n 3`).
2. Relancer la création de PR avec un titre distinct.
3. Confirmer que le corps PR référence bien le dernier commit.

## Espace Profil Bénévole

### Migrations SQL

Exécuter la migration suivante dans Supabase SQL Editor:

- `supabase/migrations/add_volunteer_profiles_space.sql`

Cette migration ajoute:

- `volunteer_role` (enum: blue/orange/yellow/red)
- `user_roles` (admin/staff)
- `volunteer_profiles` lié à `auth.users`
- `volunteer_attendance_view` (vue basée sur les inscriptions bénévoles existantes)
- RLS + policies + fonctions `is_admin_user` et `ensure_volunteer_profile`

### Test local rapide

1. Se connecter avec un compte (route `/:lang/connexion`).
2. Ouvrir `/:lang/profil-benevole`.
3. Vérifier:
   - chargement du profil,
   - sauvegarde des champs `first_name`, `last_name`, `phone`,
   - lecture de l'historique de participation.

### Vérifier les règles RLS

Dans Supabase SQL Editor (ou psql), simuler 2 utilisateurs authentifiés différents:

- `userA` ne doit lire que sa ligne `volunteer_profiles`
- `userA` peut modifier `phone`, mais pas `role`, `points_total`, `level`
- seules les sessions admin (`user_roles.role='admin'`) peuvent modifier tous les champs et gérer l'historique

Exemples de vérification:

- `select * from volunteer_profiles where id = auth.uid();`
- `update volunteer_profiles set phone='0600000000' where id=auth.uid();`
- `update volunteer_profiles set role='red' where id=auth.uid();` (doit échouer hors admin)
