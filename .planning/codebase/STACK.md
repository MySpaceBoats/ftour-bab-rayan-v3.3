# Technology Stack

**Analysis Date:** 2026-08-08

## Languages

**Primary:**
- TypeScript 5.9 — All application code (client, server, worker, shared)

**Secondary:**
- JavaScript — Legacy `.mjs` scripts (`scripts/recover-admin-access.mjs`, `create-admin.mjs`, `delete-goodies.mjs`, `fix-goodies.mjs`, `insert-admin.mjs`, `send-scanner-qr-email.mjs`, `test-email.mjs`, `test-resend.mjs`)
- SQL — Drizzle migrations (`drizzle/`), Supabase schema (`supabase/schema.sql`, `supabase/migrations/`)
- Markdown/JSON — Content/CMS source (`content/`)

## Runtime

**Environment:**
- Node.js 22 (via nvm; `"type": "module"`, ESM throughout)
- Dual deployment runtimes:
  - Node/Express for the legacy Node host: `server/_core/index.ts` → `dist/index.js`
  - Cloudflare Workers (edge) as primary production API: `worker/index.ts` → `dist/worker.js`

**Package Manager:**
- pnpm 10.4.1 (`packageManager` pinned; `pnpm-lock.yaml` present; lockfile + `package-lock.json` both exist)
- Patched dep: `wouter@3.7.1` (`patches/wouter@3.7.1.patch`)

## Frameworks

**Core (frontend):**
- React 19.2 + React DOM — SPA UI (`client/`)
- Vite 7 — build tool (`vite.config.ts`, root = `client/`, outDir = `dist/public`)
- Tailwind CSS 4 — styling (`@tailwindcss/vite`, `client/src/index.css`)
- wouter 3.3 — routing (SPA, `@/features/*/pages`)
- Radix UI + shadcn-style components (`client/src/components/ui/`, `components.json`, CVA + tailwind-merge + clsx)
- TanStack React Query 5 + tRPC 11 — data layer
- framer-motion 12, embla-carousel 8, recharts 2, sonner 2 (toasts), react-hook-form + zod, vaul, cmdk, next-themes, lucide-react

**Core (backend):**
- Express 4.21 — Node host HTTP server (`server/`)
- tRPC 11 — typed RPC API layer (both Express middleware and Workers fetch adapter)
- Drizzle ORM 0.44 + drizzle-kit 0.31 — MySQL schema/migrations (`drizzle/`)
- mysql2 3 — MySQL driver (legacy; Supabase is primary DB path)

**Workers runtime:**
- esbuild — bundles `server/_core/index.ts` and `worker/index.ts` (`build` script)
- wrangler 4 — CF Pages/Workers deploy (`pnpm deploy:cloudflare`, `wrangler versions upload` fallback)

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.91 — primary data/API backend (Postgres + Auth + Storage for server, worker, shared)
- `@trpc/server` 11.6 — tRPC routers (`server/routers.ts`, `worker/routers.ts`)
- `drizzle-orm` 0.44 — MySQL schema abstraction + Drizzle Studio tooling
- `zod` 3.24 — input validation (tRPC procedures)
- `superjson` — tRPC transformer for Date/Map serialization

**Infrastructure:**
- `@aws-sdk/client-s3` + `s3-request-presigner` — S3 signed/PUT uploads (gallery, proofs)
- `xlsx` 0.18 — spreadsheet CSV/group volunteer import
- `html5-qrcode`, `jsqr`, `qrcode` — QR generation + scanning
- `jose` — JWT/session tokens (server-side session handling)
- `express` — HTTP server

## Configuration

**Environment:**
- `server/_core/env.ts` — central `ENV` mapping (appId, cookieSecret, databaseUrl, oAuthServerUrl, ownerOpenId, forgeApiUrl/Key)
- `worker/index.ts` — `Env` interface: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY/EMAIL_PROVIDER_KEY, JWT_SECRET, VITE_APP_ID, NODE_ENV, GITHUB_APP_* (CMS), ORDER_PROOF_SECRET, PUBLIC_APP_URL, CASH_ORDER_ADMIN_CC_EMAIL, RESERVATION_* vars, POSTGRES/worker-side
- `.env.production` (tracked) exposes: VITE_API_URL, RESEND_API_KEY — actual secrets live in CF dashboard secrets + supabase env
- Dev: `.env` files not committed (`.env.local`, `.env.production.local` gitignored)

**Build:**
- `vite.config.ts` — React plugin, Tailwind, JSX-Loc, Manus runtime plugins, aliases (`@` → `client/src`, `@shared` → `shared`, `@assets`), dev-server collection of browser logs (`.manus-logs`)
- `tsconfig.json` — strict TS, bundler moduleResolution
- `vitest.config.ts` — Vitest + path aliases, node env, `server/**/*.test.ts` + `worker/**/*.test.ts`
- `esbuild` two stage for server + worker bundles on `build`

## Platform Requirements

**Development:**
- macOS/Linux/Windows any; Node >= 20 suggested; pnpm 10.x
- Cloudflare account + wrangler login for edge deploy

**Production:**
- Cloudflare Workers (edge) + `dist/public` static assets (primary: `deploy.cloudflare` / `wrangler versions upload`)
- Node host backend (secondary) — `server/_core/index.ts` requires S3, Redis, PostgreSQL/Supabase conn
- Supabase: Postgres + Storage + Auth + email via Resend
- DB: Supabase `schema.sql` + migrations (Postgres); `drizzle/` optionally used for local MySQL emulation (legacy)

---

*Stack analysis: 2026-08-08*
*Update after major dependency changes*