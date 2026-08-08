# Stack Research — Ftour Bab Rayan Audit

**Domain:** QA / audit of a brownfield monorepo (React SPA + Express + Cloudflare Worker + Supabase)
**Researched:** 2026-08-08
**Confidence:** HIGH

## Recommended Stack (verbatim from repo)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19 | Client SPA | Already installed; v19 concurrent features |
| Vite | 7 | Bundler/dev server | Already installed; fast HMR for SPA |
| TypeScript | ~5.x | Type safety | `tsc --noEmit` is audit gate |
| tRPC | 11 | Typed API surface | Dual runtime (Express + Worker) |
| Express | 4 | HTTP server runtime | Auth, admin, donation APIs |
| Cloudflare Workers | wrangler | Edge runtime | Worker router, edge APIs |
| Supabase | supabase-js | Postgres + Auth + RLS | Meta/themes/analytics source of truth |
| Drizzle | (MySQL legacy) | ORM | Older schema — audit only, do not extend |
| Vitest | 3.x | Test runner | All unit tests run through it |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @clorfly/vitest-pool-workers | latest | workerd test runtime | Only if we need real edinet worker tests — NOT for audit default |
| Resend SDK | 4.x | Transactional email | Email sends — always mock in unit tests |
| @supabase/supabase-js | 2.x | Client/Admin client | Mock via `vi.mock` at module boundary |
| zod | 3.x | Input validation | Audit that validation is consistent |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `pnpm test` | Run vitest | Default gate — must be green without live creds |
| `pnpm typecheck` (`tsc --noEmit`) | Type safety gate | Separate from test |
| `pnpm build` | Bundler gate | Verify vite/esbuild/wrangler all bundle |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vitest | Jest | Already vitest; Jest adds no value |
| Node-run vitest for worker unit tests | @cloudflare/vitest-pool-workers | Only if CF globals tested — not this audit |
| Supabase vi.mock | Mock Service Worker (msw) | If testing network layer directly — overkill here |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Socket.io realtime (unused) | Creates scope/state complexity | REST/tRPC mutations only |
| Live Supabase in unit tests | Requires secrets, non-hermetic, flaky | vi.mock supabase-js createClient |
| Live Resend in unit tests | Requires RESEND_API_KEY | Mock email service |
| MySQL migration of legacy tables | Noise — black box left over | Supabase is source of truth |

## Sources

- vitest.dev/guide/mocking
- developers.cloudflare.com/workers/testing
- supabase.com/docs/guides/database/testing
- Repo root package.json (actual versions pinned there)

---
*Stack research for: audit of ftour-bab-rayan v3.3*
*Researched: 2026-08-08*