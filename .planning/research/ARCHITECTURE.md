# Architecture Research — Ftour Bab Rayan Audit Milestone

**Domain:** QA of an existing dual-runtime monorepo
**Researched:** 2026-08-08
**Confidence:** HIGH

## Standard Architecture (as Found)

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Client SPA (React 19 + Vite)            │
│  23 feature folders + hooks + wouter routes + i18n (4)      │
└────────────────────────────┬────────────────────────────────┘
                             │ tRPC (browser httpLink / fetcher)
┌────────────────────────────┴────────────────────────────────┐
│               Server (Express 4)  server/                   │
│   router.ts (7300-line tRPC monolith) + _core/trpc.ts       │
│   middleware: auth + rbac + zod schema + error handling     │
└────────────────────────────┬────────────────────────────────┘
                             │ supabase-js admin client
                             │ resend SDK  │ storage upload
                             │ forge proxy │ qr lib
┌────────────────────────────┴────────────────────────────────┐
│              Worker (Cloudflare, wrangler)  worker/          │
│   mirrors server router subset: reservations, member-cards,  │
│   email(group), scan, qrcode, integrations, cms              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│            Supabase (Postgres, RLS) — primary truth          │
│        + legacy MySQL Drizzle (read-only, audit only)        │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `client/` | UI features, i18n, auth flows | React hooks + wouter; tRPC client |
| `server/routers.ts` | All Express tRPC procedures | 7300-line monolith, duplicated in worker |
| `server/_core/trpc.ts` | createTRPCContext, auth middleware, audit mutations | core applier |
| `worker/routers.ts` | Worker edge procedures (subset of server) | duplicated router — parity risk |
| Supabase | Postgres, RLS, auth users | source of truth |

## Recommended Structure for Tests (Audit Target)

```
server/__tests__/  (or colocated .test.ts)
   ├── use vi.mock('@supabase/supabase-js')  # mock createClient
   ├── use vi.mock('resend')                 # mock email
   ├── mockResolvedValue per test, no .env required
worker/ (unit tests node-runtime, pure functions + mocks)
   ├── member-cards.test.ts  (already green — pattern to follow)
```

### Structure Rationale

- **Colocated `.test.ts` files** are fine; standard vitest convention. Keep colocation.
- **Root `vitest.config.ts`** must exclude nothing that matters; set `environment: 'node'` and let mocks do the isolation.
- **Do not add `@cloudflare/vitest-pool-workers`** for this audit — worker unit tests use node runtime + mocks, as the existing green `member-cards.test.ts` does.

## Architectural Patterns (Fix Strategies)

### Pattern 1: Module-Boundary Mocking (for supabase/resend)

**What:** `vi.mock` the third-party module's factory at test file top.
**When to use:** every server test that would otherwise hit live service.
**Trade-offs:** fast, hermetic; but tests assert contract, not real network.

```typescript
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn(() => ({ select: vi.fn(), insert: vi.fn(), ... })) })),
}));
```

### Pattern 2: Contract Consistency (qrcode + email)

**What:** one source of truth for validation errors and email subject/template.
**When to use:** wherever tests vs implementation drift (qrcode.test.ts, worker/email.group.test.ts).
**Trade-offs:** small refactor, kills whole class of stale-test bugs.
**Example:** centralize `VALIDATION_ERROR` strings and `SUBJECTS` constants; tests import from source instead of hardcoding.

## Data Flow (Request Paths Being Audited)

```
Admin/Restaurant flow:
  SPA → tRPC server router → supabase from() → row
      ← typed response
QR scan flow (worker):
  SPA → worker router → token parse → supabase upsert
      ← validity + member info
Donation flow:
  SPA → server router → supabase insert → Resend invoice (mocked in tests)
```

## Anti-Patterns (Found in Repo)

### Anti-Pattern 1: Test imports `vi` but never imports it (restaurant-reservations.test.ts)

**What people do:** use `vi.fn()` with only `import { describe, it, expect }` (or `beforeAll`).
**Why it's wrong:** ReferenceError at runtime; whole file red even if logic correct.
**Do this instead:** `import { describe, it, expect, vi } from 'vitest'` or global config.

### Anti-Pattern 2: Tests depend on `.env` keys to pass

**What people do:** assert env validation in unit tests.
**Why it's wrong:** no key in CI → red; false signal.
**Do this instead:** mock the client; assert the *behavior* (what happens when config missing) via a dedicated test with a stubbed env, not by requiring the real key.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase | admin client via env SERVICE_ROLE_KEY | mock; verify real key only in prod/deploy |
| Resend | SDK with RESEND_API_KEY | mock |
| GitHub CMS | octokit repo contents | read-only; rarely hit |
| Storage (S3/supabase) | upload presigned | mock in tests |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| client ↔ server router | tRPC | typed |
| client ↔ worker router | tRPC (edge) | typed, subset |
| server router ↔ worker router | duplicated code | parity risk — prefer shared util extraction if bugfix |

---
*Architecture research for: audit of ftour-bab-rayan v3.3*
*Researched: 2026-08-08*