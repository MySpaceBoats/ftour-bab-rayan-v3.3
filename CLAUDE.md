<!-- GSD:project-start source:PROJECT.md -->

## Project

**Ftour Bab Rayan — Module Audit & Hardening**

A brownfield audit-and-harden cycle on the existing **Ftour Bab Rayan** platform — a Moroccan charity Iftar web app (React 19 SPA + tRPC + Cloudflare Workers + Supabase). The outward product already exists and ships: reservations (individual/company/group), volunteer signup with QR check-in, goodies/pastries/terroir storefronts, donations, restaurant flows, member cards, gallery with moderation, and a large admin dashboard ("EventOS"). This milestone does **not** build new features; it verifies every existing module works correctly and hardens what doesn't, with the verified bar being `tests pass + typecheck clean`.

**Core Value:** The app is a charity trust surface — every reservation, donation, volunteer signup, and order **must** round-trip correctly (form → DB → email → admin → scanner/checkout) without silent failure. If a broken module mutates data or drops emails, donations and seats are lost in real time during Ramadan.

### Constraints

- **Tests must be hermetic**: unit tests cannot require live Supabase/Resend S3/network credentials to pass; CI/local `pnpm test` must run offline
- **No skipped tests**: each failure is fixed, not `.skip/only`-bypassed
- **Compatibility**: maintain TS 5.9/pnpm 10/React 19 — no major dependency bumps unless required by a failing test
- **Client behavior**: do not ship a change that breaks an existing public/MVP flow

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.9 — All application code (client, server, worker, shared)
- JavaScript — Legacy `.mjs` scripts (`scripts/recover-admin-access.mjs`, `create-admin.mjs`, `delete-goodies.mjs`, `fix-goodies.mjs`, `insert-admin.mjs`, `send-scanner-qr-email.mjs`, `test-email.mjs`, `test-resend.mjs`)
- SQL — Drizzle migrations (`drizzle/`), Supabase schema (`supabase/schema.sql`, `supabase/migrations/`)
- Markdown/JSON — Content/CMS source (`content/`)

## Runtime

- Node.js 22 (via nvm; `"type": "module"`, ESM throughout)
- Dual deployment runtimes:
- pnpm 10.4.1 (`packageManager` pinned; `pnpm-lock.yaml` present; lockfile + `package-lock.json` both exist)
- Patched dep: `wouter@3.7.1` (`patches/wouter@3.7.1.patch`)

## Frameworks

- React 19.2 + React DOM — SPA UI (`client/`)
- Vite 7 — build tool (`vite.config.ts`, root = `client/`, outDir = `dist/public`)
- Tailwind CSS 4 — styling (`@tailwindcss/vite`, `client/src/index.css`)
- wouter 3.3 — routing (SPA, `@/features/*/pages`)
- Radix UI + shadcn-style components (`client/src/components/ui/`, `components.json`, CVA + tailwind-merge + clsx)
- TanStack React Query 5 + tRPC 11 — data layer
- framer-motion 12, embla-carousel 8, recharts 2, sonner 2 (toasts), react-hook-form + zod, vaul, cmdk, next-themes, lucide-react
- Express 4.21 — Node host HTTP server (`server/`)
- tRPC 11 — typed RPC API layer (both Express middleware and Workers fetch adapter)
- Drizzle ORM 0.44 + drizzle-kit 0.31 — MySQL schema/migrations (`drizzle/`)
- mysql2 3 — MySQL driver (legacy; Supabase is primary DB path)
- esbuild — bundles `server/_core/index.ts` and `worker/index.ts` (`build` script)
- wrangler 4 — CF Pages/Workers deploy (`pnpm deploy:cloudflare`, `wrangler versions upload` fallback)

## Key Dependencies

- `@supabase/supabase-js` 2.91 — primary data/API backend (Postgres + Auth + Storage for server, worker, shared)
- `@trpc/server` 11.6 — tRPC routers (`server/routers.ts`, `worker/routers.ts`)
- `drizzle-orm` 0.44 — MySQL schema abstraction + Drizzle Studio tooling
- `zod` 3.24 — input validation (tRPC procedures)
- `superjson` — tRPC transformer for Date/Map serialization
- `@aws-sdk/client-s3` + `s3-request-presigner` — S3 signed/PUT uploads (gallery, proofs)
- `xlsx` 0.18 — spreadsheet CSV/group volunteer import
- `html5-qrcode`, `jsqr`, `qrcode` — QR generation + scanning
- `jose` — JWT/session tokens (server-side session handling)
- `express` — HTTP server

## Configuration

- `server/_core/env.ts` — central `ENV` mapping (appId, cookieSecret, databaseUrl, oAuthServerUrl, ownerOpenId, forgeApiUrl/Key)
- `worker/index.ts` — `Env` interface: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY/EMAIL_PROVIDER_KEY, JWT_SECRET, VITE_APP_ID, NODE_ENV, GITHUB_APP_* (CMS), ORDER_PROOF_SECRET, PUBLIC_APP_URL, CASH_ORDER_ADMIN_CC_EMAIL, RESERVATION_* vars, POSTGRES/worker-side
- `.env.production` (tracked) exposes: VITE_API_URL, RESEND_API_KEY — actual secrets live in CF dashboard secrets + supabase env
- Dev: `.env` files not committed (`.env.local`, `.env.production.local` gitignored)
- `vite.config.ts` — React plugin, Tailwind, JSX-Loc, Manus runtime plugins, aliases (`@` → `client/src`, `@shared` → `shared`, `@assets`), dev-server collection of browser logs (`.manus-logs`)
- `tsconfig.json` — strict TS, bundler moduleResolution
- `vitest.config.ts` — Vitest + path aliases, node env, `server/**/*.test.ts` + `worker/**/*.test.ts`
- `esbuild` two stage for server + worker bundles on `build`

## Platform Requirements

- macOS/Linux/Windows any; Node >= 20 suggested; pnpm 10.x
- Cloudflare account + wrangler login for edge deploy
- Cloudflare Workers (edge) + `dist/public` static assets (primary: `deploy.cloudflare` / `wrangler versions upload`)
- Node host backend (secondary) — `server/_core/index.ts` requires S3, Redis, PostgreSQL/Supabase conn
- Supabase: Postgres + Storage + Auth + email via Resend
- DB: Supabase `schema.sql` + migrations (Postgres); `drizzle/` optionally used for local MySQL emulation (legacy)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- `kebab-case.ts` / `kebab-case.tsx` for modules and React components (`admin-dashboard-bff.ts`, `gallery-services.ts`)
- `PascalCase.tsx` for component files (e.g. `AdminMemberCards.tsx`, `RequireRole.tsx`)
- `*.test.ts` colocated next to source (e.g. `server/scanner-router.test.ts`, `worker/member-cards.test.ts`)
- `*-router.ts` for tRPC routers, `*-services.ts` for business services
- Feature folders: `client/src/features/<domain>/pages/`, `client/src/features/<domain>/components/`
- camelCase (`sendEmail`, `generateGroupRegistrationEmail`)
- tRPC procedures: camelCase on `query`/`mutation` keys built inline in routers
- `handle*` prefix for Express/route handlers (`handleCMSRequest`, `handleCashOrderRequest`)
- camelCase; `OPEN_`/UPPER_SNAKE_CASE for exported domain constants (`DONATION_SUGGESTED_AMOUNTS_MAD`, `COOKIE_NAME`)
- PascalCase type names, no `I` prefix (`User`, `InsertUser`, `WorkerContext`, `WorkerUser`, `TrpcContext`)
- `mysqlEnum` for column enums; tables inferred via `typeof ...$inferSelect`

## Code Style

- Prettier (`.prettierrc` + `.prettierignore`), 4-space indent in most files (no Prettier override), double quotes, semicolons
- `pnpm format` runs `prettier --write .`
- No ESLint configured; type checked via `pnpm check` (`tsc --noEmit`)
- Zod for runtime input validation in all tRPC procedures

## Import Organization

## Error Handling

- tRPC procedures throw `new TRPCError({ code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST" | "INTERNAL_SERVER_ERROR", message: <msg>, cause })`
- Constants for shared error messages in `shared/const.ts`: `UNAUTHED_ERR_MSG`, `NOT_ADMIN_ERR_MSG`
- Service functions validate inputs with `zod` schemas before DB/Supabase calls
- `auditUtils` in `_core/trpc.ts` wrappers log failures
- Client-facing pages use `TRPCClientError` user-safe toasts (sonner)
- Worker throws TRPCError for read-only demo (`enabled` write). Lshort codes `(10001)` / `(10002)` appended to messages for support tracing
- `console.log` / `console.warn` scattered (server boot + data checks)
- `auditLogger` (audit-script route) for mutations
- Dev-browser logs captured via `.manus-logs/` Vite plugin

## Comments

- `// === SECTION ===` banners for major groups in router files and schema
- URLs/remarks at top of worker handlers
- French when present — mixed FR/EN across codebase (business comments often translate in FR)
- No strict JSDoc; inline comments only

## Function Design

- Routers exported via `router = { ... }` (defines query/mutation procedures)
- Service functions named `getX`, `validateX`, `listX`; services return full typed objects or throw
- Auth: `getXFromToken`, `sign(Object)` endpoints
- Async functions use explicit `Promise` / `async/await` (no callbacks)

## Module Design

- Named exports within router files; small local helpers mangled, domain-logic exported from `services`
- Router objects composed in `server/routers.ts` via `router({})`; `appRouterUpdated` exported; `AppRouter` type
- Worker duplicates the same surface (reads Supabase RLS authJWT) — keep shared camelCase

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

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

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
