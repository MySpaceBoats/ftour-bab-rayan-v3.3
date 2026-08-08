# Architecture

**Analysis Date:** 2026-08-08

## System Overview

**Description:**
Ftour Bab Rayan is a charity / community Iftar app (Morocco, Ramadan-focused). It manages daily Ramadan days (capacity, dates), volunteer check-in via QR codes, donations, goodies/pastries, restaurant group reservations, community catering (boutique), inventory (goodies/patisserie/terroir), gallery, member cards, event feedback, and an admin dashboard ("EventOS").

**Primary runtime:** Cloudflare Workers edge API + static SPA frontend.
**Secondary runtime:** Node/Express host (`server/`) able to run the entire API with Supabase/Postgres + S3/Forge storage.

## Layers

### Client  (`client/`)
- SPA React 19 + Vite + Tailwind
- Routing: wouter (`App.tsx` catches routes by `wouter` `Route`/`Switch`)
- Data: tRPC + React Query
- Features organized per domain (`features/`) then page components
- i18n: `fr`, `en`, `ar` (LTR/RTL), `Amazigh` stub (`amz.ts`)
- Demo mode pages (`features/demo`), admin CMS (`features/ops`), admin-focused features per domain
- Auth: client `main.tsx` session refresh; `RequireRole` gate; RBAC `client/src/shared/rbac/permissions.ts`

### Shared  (`shared/`)
- `shared/const.ts` — cookie name, error messages, donation suggestion amounts
- `shared/ramadan.ts` + `shared/config/ramadanDates.ts` — Ramadan date ranges, timezone/date helpers (`Africa/Casablanca`)
- `shared/types.ts` — re-export DB types (schema) + core errors (`_core/errors.ts`)

### Server  (`server/`) — Node/Express host (also drives dev)
- `server/_core/index.ts` — Express bootstrap: health checks, tRPC Express middleware, `registerOAuthRoutes`, static/setupVite, DB schema ensure (Supabase tables like `volunteerSlots`, `pastries`, `team`, `eventFeedback`), boot scripts
- `server/_core/trpc.ts` — tRPC procedures (public, protected), audit middleware
- `server/routers.ts` (7,271 lines) — the main tRPC router `appRouterUpdated`, aggregating sub-routers:
  - `inventoryRouter`, `companyBookingsRouter`, `restaurantReservationsRouter`, `contentRouter`, `scannerRouter`, `ftourRouter`, `electionRouter`, `feedbackRouter`, `eventFeedbackRouter`, `auditRouter`, `catalogProductsRouter`, `teamRouter`, `eventPhotosRouter`, `blogRouter`, plus inline routers for: auth, donations, gallery, goodies, messages, members (member cards), reservation/deposit & payment-proof, voluthan group spreadsheet import
  - `protectedProcedure` requires session; role gates apply per procedure
- Sub-routers by service: `inventory-router.ts`, `catalog-products-router.ts`, `feedback-router.ts`, `event-feedback-router.ts`, `event-photos-router.ts`, `restaurant-reservation-routers.ts`, `company-booking-routers.ts`, `content-router.ts`, `scanner-router.ts`, `team-router.ts`, `blog-router.ts`, `election-router.ts`, `audit-router.ts`, `ftour-router.ts`, `pastry-routers.ts`
- Services: `inventory-services.ts`, `reservation-services.ts`, `restaurant-reservation-services.ts`, `company-booking-services.ts`, `gallery-services.ts`, `supabase-services.ts`, `admin-dashboard-bff.ts`, `booking-allocation-engine.ts`, `email.ts`, `email-templates.ts`, `qr-services.ts`, `volunteer-group-service.ts`, `volunteer-profile-services.ts`, `storage.ts`, `db.ts`
- Auth + Supabase helpers: `supabase.ts`, `supabase-auth.ts`, `middleware/auditMiddleware.ts`
- `_core/context.ts`, `_core/systemRouter.ts`, `_core/oauth.ts`, `_core/cookies.ts`, `_core/env.ts`, `_core/llm.ts` (LLM-based features), `_core/imageGeneration.ts`, `_core/map.ts`, `_core/notification.ts`, `_core/vite.ts`

### Worker  (`worker/`) — Cloudflare edge API
- `worker/index.ts` — Fetch handler: tRPC Check adapter (`appRouter`), CMS handlers, cash-orders, member-cards, email
- `worker/routers.ts` — tRPC router with public + protected procedures (demo-write blocked)
- `worker/context.ts` — user resolution from Supabase token; `supabase.ts` — admin client; `email.ts` — Resend
- Modules: `cms-handlers.ts`, `cash-orders.ts`, `member-cards.ts` (2-step workflow), `member-card-emails.ts`, `email.ts`, `github-app.ts`, `context.ts`
- `worker/` tests: `email.group.test.ts`, `member-cards.test.ts`

### Admin / CMS
- `admin-dashboard-bff.ts` — admin dashboard BFF
- CMS content in `content/` (articles, faq, pages, media, settings) via GitHub App
- Admin frontend: `client/src/features/ops/admin/*` (admin Gallery, AdminCards, orders/checkouts), `features/admin` & `features/ops`

## Data Flow

1. **Client** (SPA) → tRPC procedures (React Query on server) via JSON (`httpBatchLink`; wrapped in `@/lib/trpc.ts`)
2. **Worker (edge)** receives `/api/*` (Fetch → `main.ts` context), invokes tRPC router, calls Supabase (Postgres), S3 bucket, GitHub App (CMS), Resend (email)
3. **Server (Node)** dev mode uses same routers via Express hit. In production the Node host (if used) is behind reverse proxy
4. **Volunteer check-in/scan flows:** QR token in volunteer row → `/checkin/{token}` → scanner router; merchant scanner set for cash orders; flow proof
5. **Database:** Supabase Postgres (production) — schema also at `supabase/schema.sql` (tables with PKs, RLS). Legacy MySQL via Drizzle
6. **Reservations/orders:** Company bookings + restaurant reservations allocation engine (`booking-allocation-engine.ts`), deposit deadlines
7. **Email flows:** Resend sends (individual or batch dispatch, group volunteer spreadsheet)

## Entry Points

- **Client:** `client/src/main.tsx` → `App.tsx` (route switch)
- **Server (dev):** `server/_core/index.ts` (`pnpm dev`)
- **Worker (prod edge):** `worker/index.ts` (`dist/worker.js`)
- **Admin/CMS:** `client/src/features/ops` / `features/admin` — `App.tsx` routes `/admin/*`

## Key Abstractions

- **tRPC router composition:** main router aggregating 12+ feature routers and 30+ inline routers
- **Procedure factory:** `publicProcedure` / `protectedProcedure` (+ RBAC gate in server `_core/trpc.ts`)
- **RBAC/permissions:** `client/src/shared/rbac/permissions.ts` — role lists
- **Session handling:** cookie-based (`app_session_id`) + client `_core/authSession` + refresh
- **S3/storage proxy:** `server/storage.ts`
- **Booking allocation engine:** `server/booking-allocation-engine.ts`

## Suggested Build Order (roadmap-relevant)

1. Stable core infra (setup/Supabase + CIFF) — Phase 1 dependencies
2. Performance baseline (authenticated routes, role gates, request validation) — Phase 2
3. Inventory/booking/CMS core flows — Phase 3
4. Domain surfaces (gallery, goodies, reservations, feedback, event-photos) — Phase 4
5. Secondary flows (scanner, cash-orders, member cards, group import) — Phase 5
6. Monitoring/DR/security — Phase 6

*(This reflects the general dependency shape of the existing codebase, not a committed GSD roadmap.)*