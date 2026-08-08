# Coding Conventions

**Analysis Date:** 2026-08-08

## Naming Patterns

**Files:**
- `kebab-case.ts` / `kebab-case.tsx` for modules and React components (`admin-dashboard-bff.ts`, `gallery-services.ts`)
- `PascalCase.tsx` for component files (e.g. `AdminMemberCards.tsx`, `RequireRole.tsx`)
- `*.test.ts` colocated next to source (e.g. `server/scanner-router.test.ts`, `worker/member-cards.test.ts`)
- `*-router.ts` for tRPC routers, `*-services.ts` for business services
- Feature folders: `client/src/features/<domain>/pages/`, `client/src/features/<domain>/components/`

**Functions:**
- camelCase (`sendEmail`, `generateGroupRegistrationEmail`)
- tRPC procedures: camelCase on `query`/`mutation` keys built inline in routers
- `handle*` prefix for Express/route handlers (`handleCMSRequest`, `handleCashOrderRequest`)

**Variables:**
- camelCase; `OPEN_`/UPPER_SNAKE_CASE for exported domain constants (`DONATION_SUGGESTED_AMOUNTS_MAD`, `COOKIE_NAME`)

**Types:**
- PascalCase type names, no `I` prefix (`User`, `InsertUser`, `WorkerContext`, `WorkerUser`, `TrpcContext`)
- `mysqlEnum` for column enums; tables inferred via `typeof ...$inferSelect`

## Code Style

**Formatting:**
- Prettier (`.prettierrc` + `.prettierignore`), 4-space indent in most files (no Prettier override), double quotes, semicolons
- `pnpm format` runs `prettier --write .`

**Linting:**
- No ESLint configured; type checked via `pnpm check` (`tsc --noEmit`)
- Zod for runtime input validation in all tRPC procedures

## Import Organization

**Order:** External packages (`react`), then project aliases (`@/`, `@shared/`), then relative (`../shared`, `./services`). Type-only imports via `import type`. Requests to avoid TS circular imports root re-export of schema types in `shared/types.ts`.

**Path Aliases:** `@` → `client/src`, `@shared` → `shared`, `@assets` → `attached_assets` (vite.config.ts + vitest.config.ts). tRPC client build through `client/src/lib/trpc.ts`.

## Error Handling

**Patterns:**
- tRPC procedures throw `new TRPCError({ code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST" | "INTERNAL_SERVER_ERROR", message: <msg>, cause })`
- Constants for shared error messages in `shared/const.ts`: `UNAUTHED_ERR_MSG`, `NOT_ADMIN_ERR_MSG`
- Service functions validate inputs with `zod` schemas before DB/Supabase calls
- `auditUtils` in `_core/trpc.ts` wrappers log failures

**Error Types:**
- Client-facing pages use `TRPCClientError` user-safe toasts (sonner)
- Worker throws TRPCError for read-only demo (`enabled` write). Lshort codes `(10001)` / `(10002)` appended to messages for support tracing

**Logging:**
- `console.log` / `console.warn` scattered (server boot + data checks)
- `auditLogger` (audit-script route) for mutations
- Dev-browser logs captured via `.manus-logs/` Vite plugin

## Comments

**When to Comment:**
- `// === SECTION ===` banners for major groups in router files and schema
- URLs/remarks at top of worker handlers
- French when present — mixed FR/EN across codebase (business comments often translate in FR)
- No strict JSDoc; inline comments only

**TODO:** rare; a few `// TODO` such as `// TODO: replace ...` in scripts

## Function Design

**Conventions:**
- Routers exported via `router = { ... }` (defines query/mutation procedures)
- Service functions named `getX`, `validateX`, `listX`; services return full typed objects or throw
- Auth: `getXFromToken`, `sign(Object)` endpoints
- Async functions use explicit `Promise` / `async/await` (no callbacks)

## Module Design

**Exports:**
- Named exports within router files; small local helpers mangled, domain-logic exported from `services`
- Router objects composed in `server/routers.ts` via `router({})`; `appRouterUpdated` exported; `AppRouter` type
- Worker duplicates the same surface (reads Supabase RLS authJWT) — keep shared camelCase

**Barrels:** `shared/exports.ts` re-exports schema types; avoids circular DB imports (`import type * as` re-export)

---

*Convention analysis: 2026-08-08*
*Update when patterns change*