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

Implémentation livrée:

- Migration SQL: `supabase/migrations/add_member_cards.sql`
  - Tables: `members`, `member_card_orders`, `member_card_events`, `member_card_tokens`
  - Fonction serveur: `transition_member_card_status(old_status, new_status)` + trigger anti-régression
  - RLS activé sur les tables cartes membres
  - Bucket storage privé `member-card-proofs` (10MB, pdf/jpg/png)
- Worker API: `worker/member-cards.ts`
  - `POST /api/admin/card/send-order-email`
  - `GET /card/confirm-order?token=...`
  - `GET /card/payment?token=...`
  - `POST /api/card/confirm-payment` (multipart, upload preuve serveur)
  - `POST /api/admin/card/mark-printed`
  - `POST /api/admin/card/mark-delivered`
  - + utilitaires admin: renvoi email paiement, marquer payé, signed URL preuve
- Templates emails: `worker/member-card-emails.ts`
  - Email commande + CTA confirmation
  - Email paiement + infos paiement + CTA validation
- Dashboard admin: `client/src/features/ops/admin/AdminMemberCards.tsx`
  - Route `/admin/cards`
  - Liste, recherche, filtre statut, actions workflow
  - Téléchargement preuve via signed URL
  - Timeline des événements

Notes sécurité:

- Endpoints admin protégés via JWT Supabase + rôle admin (`users.role`).
- Endpoints publics limités au token opaque hashé en DB + expiration.
- Toutes les actions écrivent dans `member_card_events`.

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
