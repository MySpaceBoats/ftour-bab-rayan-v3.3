# External Integrations

**Analysis Date:** 2026-08-08

## APIs & External Services

**Email (transactional):**
- Resend — transactional email sending (confirmations, member-card emails, group registrations, gallery upload validation)
  - SDK/Client: `resend` npm package + custom `sendEmail` wrappers (`server/email.ts`, `worker/email.ts`, `worker/member-cards.ts`)
  - Auth: `RESEND_API_KEY` env (server/worker); `EMAIL_PROVIDER_KEY` as compatibility alias
  - Templates: HTML templates in-code (`server/email-templates.ts`, `worker/member-card-emails.ts`, `worker/email.ts`)

**Storage / File uploads:**
- Supabase Storage — image/attachment uploads (gallery original/thumb, restaurant proofs, member-card proofs)
  - Buckets: `images` (gallery, `.env`), restaurant/member-card proof buckets
  - SDK/Client: `@supabase/supabase-js` with service_role key (server-side)
  - Access: signed URLs (gallery) + public bucket URLs
- AWS S3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) — presigned uploads/downloads via S3-compatible API
  - Preconfigured storage proxy (`BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY`) in `server/storage.ts`

**CMS / Content:**
- GitHub content-backed CMS — content lives in the `content/` directory
  - GitHub App (worker) — `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`, `CMS_ALLOWED_ORIGINS`
  - Handler: `worker/cms-handlers.ts` (content router)

**QR / check-in:**
- QR code generation (`qrcode` lib) + scan flows (html5-qrcode, jsqr in client) — volunteer check-in, restaurant reservations, member cards

**Spreadsheets:**
- `xlsx` client — group volunteer spreadsheets (parsing/CSV)

## Data Storage

**Databases:**
- **Supabase (PostgreSQL)** — primary production store (`supabase/schema.sql` + `supabase/migrations/`)
  - Tables: users, ramadanDays, volunteers, scanHistory, goodies, orders, orderItems, donations, contactMessages, siteSettings, partners, testimonials, mediaGallery, faqItems, payments, qrTokens/qrScans, companyBookings/Tickets/Scans, restaurantSlots/Reservations/Allocations, terroir*, spaces, bookingHolds, feedback*, eventFeedback*, ftourTeamMembers, eventPhotos, member_cards, etc.
  - Auth: supabase auth (email/password + OAuth/other `loginMethod`), JWT sessions
  - Admin client uses service_role (bypasses RLS); public client uses anon key with RLS
- **MySQL (Drizzle)** — legacy/secondary path (`drizzle/schema.ts`, `drizzle/relations.ts`, migrations in `drizzle/*.sql`), mysql2 driver. Used by `server/` services (some via `db.ts`), some endpoints fall back to PostgreSQL/Supabase.
  - Connection: `DATABASE_URL` in `server/_core/env.ts`

**File Storage:**
- Supabase Storage (galleries, images, proofs), plus S3/Forge proxy for `server_storage.ts`

## Authentication & Identity

**Auth Provider:**
- Supabase Auth — email/password, OAuth (`loginMethod` incl. Google), session management
  - Implementation: server `supabase-auth.ts` (sign in/up, refresh, password reset), worker `worker/supabase.ts`
  - Token storage: JWT in client, httpOnly/secure cookies (`COOKIE_NAME = "app_session_id"`), session refresh handling in `client/src/_core/authSession`
  - Session persist: client `main.tsx` refresh flow, `RequireRole` / role-gated UI
- **RBAC roles:** `user`, `admin`, `super_admin`, `admin_ops`, `admin_boutique`, `admin_dons`, `scanner`, `admin_restaurant`, `vue_restaurant`, `manager_restaurant`, `admin_patisserie`, `admin_terroir`, `admin_contenu`, `admin_messages`

- **Demo access:** `demoAccess` module — demo user with read-only mode

**OAuth:**
- Google OAuth (server `server/_core/oauth.ts`) via `registerOAuthRoutes`, REST token/password endpoints
- `OWNER_OPEN_ID` as owner/admin identifier

## Monitoring & Observability

**Logs / Debug:**
- Vite dev server agent collector: Manus debug-collector plugin writes browser logs to `.manus-logs/` (browserConsole, networkRequests, sessionReplay)
- Worker/Express: standard `console` output; CF observability (logs disabled in wrangler.toml, invocation logs on)
- Audit middleware — `server/middleware/auditMiddleware.ts` writes audit log records (auditMutation) for tRPC mutations

## CI/CD & Deployment

**Hosting:**
- Cloudflare Workers (edge) — `dist/worker.js`
- Cloudflare Pages assets — `dist/public`
- Preconfigured S3/Forge proxy storage

**Deployment:**
- `wrangler versions upload` / `deploy:cloudflare`
- GitHub-based repo, deploy flows via Git pushes
- Script deps: `scripts/` (recoveradmin, run-migration, apply-gallery-validation-migration, cleanup-audit-logs, preview-restaurant-emails)

## Environment Configuration

**Development:**
- Required env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`/`EMAIL_PROVIDER_KEY`, `PUBLIC_APP_URL`, optional `BUILT_IN_FORGE_API_URL`/`BUILT_IN_FORGE_API_KEY`, `VITE_APP_ID`
- `.env.production` tracked (VITE_API_URL, RESEND_API_KEY) — real secrets in CF dashboard + Supabase

**Production:**
- Secrets in CF Workers dashboard + secrets/settings; SMTP via Resend; S3/Forge proxy in prod

## Webhooks & Callbacks

**Incoming:**
- GitHub App webhook → CMS (content sync) — via `worker/cms-handlers.ts`

**Outgoing:**
- Email sends (Resend) for member cards, group registrations, donations, gallery upload validation, scanner QR emails (script)

---

*Integration audit: 2026-08-08*
*Update when adding/removing external services*