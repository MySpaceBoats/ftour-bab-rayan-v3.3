# Codebase Structure

**Analysis Date:** 2026-08-08

## Directory Layout

```
ftour-bab-rayan-v3.3/
├── client/                    # React 19 SPA frontend (Vite)
│   ├── index.html
│   ├── public/                # Static assets
│   └── src/
│       ├── App.tsx            # Central route map (wouter Route/Switch)
│       ├── main.tsx           # Entry; tRPC client, query client, session refresh loop
│       ├── index.css          # Tailwind v4 entry
│       ├── _core/             # authSession.ts, demoAccess.ts, and other client-side infra
│       ├── app/               # layout/ (DashboardLayout, DashboardLayoutSkeleton)
│       ├── components/        # Shared UI: Navbar, Footer, RequireRole, AIChatBox, Map, …; ui/ (Radix primitives), admin/
│       ├── contexts/          # ThemeContext, CartContext
│       ├── features/          # One folder per domain → pages/ + components/ + hooks/ (see table below)
│       ├── hooks/             # Shared hooks
│       ├── i18n/              # fr.ts, en.ts, ar.ts, amz.ts + index.tsx (I18nProvider)
│       ├── lib/               # trpc.ts (typed tRPC React client), utils.ts (cn)
│       └── shared/            # components/, constants/, rbac/permissions.ts
├── server/                    # Node/Express backend (dev + Node host)
│   ├── _core/                 # index.ts (bootstrap), trpc.ts, context.ts, env.ts, cookies.ts, oauth.ts, llm.ts, imageGeneration.ts, map.ts, notification.ts, sdk.ts, systemRouter.ts, vite.ts, dataApi.ts, voiceTranscription.ts
│   ├── middleware/            # auditMiddleware.ts
│   ├── services/              # auditLogger.ts
│   ├── db.ts                  # Drizzle (MySQL) client
│   ├── supabase.ts / supabase-auth.ts / supabase-services.ts
│   ├── storage.ts             # Forge storage proxy helpers
│   ├── email.ts / email-templates.ts
│   ├── routers.ts             # MAIN tRPC router (appRouterUpdated) — aggregates everything
│   ├── *_router.ts            # 18 feature routers (inventory, scanner, restaurant, …)
│   ├── *-services.ts          # domain service layer
│   └── *.test.ts              # Vitest tests colocated
├── worker/                    # Cloudflare Workers edge API
│   ├── index.ts               # Fetch handler; Env interface; handoff to routers/cms/cash/member
│   ├── routers.ts             # Edge tRPC router (public + protected, demo-readonly)
│   ├── context.ts / supabase.ts
│   ├── email.ts / github-app.ts
│   ├── cms-handlers.ts        # GitHub-backed CMS
│   ├── cash-orders.ts         # cash order (SOLIDAIRE) flow
│   ├── member-cards.ts        # member-card orders + payment proof
│   ├── member-card-emails.ts
│   └── *.test.ts
├── shared/                    # Shared by client/server/worker
│   ├── const.ts (auth/session/donations), types.ts (re-exports schema types)
│   ├── ramadan.ts, config/ramadanDates.ts
│   └── _core/errors.ts
├── drizzle/                   # MySQL schema.ts + relations.ts + migrations/*.sql
├── supabase/                  # Postgres schema.sql + migrations/
├── content/                   # CMS content: articles/, faq/, media/, pages/, settings/
├── docs/                      # CMS, restaurant, SEO docs
├── scripts/                   # Admin/recovery/migration scripts (.ts/.mjs)
├── patches/                   # pnpm patch (wouter)
├── previews/                  # design previews
├── dist/                      # build output (vite → public/, worker/index.js)
├── .manus-logs/               # dev-browser log captures (vite plugin)
├── wrangler.toml              # CF Workers config (cron trigger for Ramadan days)
├── vite.config.ts, vitest.config.ts, tsconfig.json, components.json, prettierrc
├── package.json, pnpm-lock.yaml, package-lock.json
```

## Feature Folders (`client/src/features/`)

| Feature | Pages | Admin | Purpose |
|---------|-------|-------|---------|
| auth | 4 | | Login/Signup/ForgotPassword/DemoAccess |
| public | 13 | | Public site pages (Home, Programme, Benevole, Evenement, …) |
| gallery | 8 | ✓ | Photo gallery public + moderation |
| goodies / patisserie / terroir | 7/4/8 | ✓ | Solidarity storefronts + variants/orders |
| boutique / catalogue | 3/1 | ✓ | Catalog unified merchandise |
| dons | 2 | ✓ | Donations (amount suggestions) |
| ftour | 2 | ✓ | Ramadan meal planning |
| volunteer | 5 | ✓ | Volunteer signup + group spreadsheets |
| scanner | 8 | ✓ | QR check-in scanner flows |
| restaurant | 23 | ✓ | Restaurant reservations (groups, tables) + dashboard |
| inventory | 7 | ✓ | Stock/pour inventory management |
| team | 2 | ✓ | ftourTeam members |
| election | 6 | ✓ | Association election |
| feedback | 6 | ✓ | Event feedback forms |
| messages | 1 | ✓ | Contact messages |
| demo | 22 | – | Read-only demo sandbox |
| blog | 4 | – | Blog/articles |
| contenu | 1 | ✓ | CMS content admin |
| closing | 2 | – | Ramadan closing page |
| menu | 4 | – | Solidarity menu ("Menu Solidaire") |

## Key File Locations

**Entry Points:**
- `server/_core/index.ts` — Express server bootstrap (`pnpm dev`)
- `worker/index.ts` — CF Worker entry (`dist/worker.js`)
- `client/src/main.tsx` — browser entry
- `client/src/App.tsx` — route registration

**Configuration:**
- `vite.config.ts` — build + aliases `@`→`client/src`, `@shared`→`shared`
- `wrangler.toml` — CF worker deploy + cron (createRamadanDay)
- `drizzle.config.ts` — Drizzle/MySQL
- `vitest.config.ts` — test paths

**Core Logic:**
- `server/routers.ts` — authoritative tRPC API surface (7300+ lines)
- `server/_core/trpc.ts` — procedure factories (public/protected) + audit
- `worker/routers.ts` — edge API duplicate/shared surface
- `drizzle/schema.ts` — MySQL schema (47 tables)
- `supabase/schema.sql` — Postgres schema (RLS)

**Testing:**
- Colocated `*.test.ts` in `server/` and `worker/` (Vitest)

**Documentation:**
- `README.md`, `docs/`, plus feature docs (`.md`) at repo root

## Naming Conventions

**Files:**
- `kebab-case.ts`/`.tsx` for source; `PascalCase.tsx` for React components (e.g. `AdminMemberCards.tsx`)
- `*-router.ts` for tRPC routers, `*-services.ts` for service layers
- `*.test.ts` alongside source (Vitest)
- Feature folders `kebab-case`

## Where to Add New Code

**New feature:** `client/src/features/<kebab>/pages|x/components|admin` + root path added in `client/src/App.tsx`; if backend: subrouter in `server/*-router.ts` + registration in `server/routers.ts` (+ mirror `worker/routers.ts` when edge is required).

**New DB feature:** `drizzle/schema.ts` + `drizzle/` migration + `supabase/schema.sql` migration.

**New admin dashboard:** `client/src/features/ops/admin/` or feature's own `admin/`.

**New tests:** colocated `*.test.ts`.

## Special Directories

**`dist/`** — build output: `dist/public` (SPA static), `dist/worker.js` (edge), `dist/index.js` (Node server). Gitignored.
**`.manages-logs/`** — dev-only browser console/network logs from Manus runtime plugin. Not committed.
**`patches/`** — pnpm `patchedDependencies` (wouter@3.7.1.patch).

---

*Structure analysis: 2026-08-08*
*Update when directory structure changes*