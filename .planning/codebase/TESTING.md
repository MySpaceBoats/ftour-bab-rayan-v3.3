# Testing Patterns

**Analysis Date:** 2026-08-08

## Test Framework

**Runner:**
- Vitest 2.1 (`vitest.config.ts` at root); `environment: "node"`
- Include globs: `server/**/*.test.ts`, `server/**/*.spec.ts`, `worker/**/*.test.ts` — **no client tests configured**

**Assertion:**
- Vitest built-in `expect` (with `vi` mocks)
- Run: `pnpm test` (`vitest run`), `pnpm test -- --watch`
- Path alias support via `resolve.alias` in `vitest.config.ts` (`@` → `client/src`, `@shared` → `shared`)

## Test File Organization

**Location:** Colocated `*.test.ts` next to the file under test (`server/scanner-router.test.ts`, `worker/member-cards.test.ts`)

**Naming:** `<module>.test.ts`

**Structure:**
```
server/
  scanner-router.test.ts      → scanner-router.ts (router level, mocks Supabase)
  reservation-services.test.ts → service-layer tests
  email.test.ts / email.restaurant.test.ts
  supabase-services.test.ts / supabase.test.ts
  qrcode.test.ts, donations.test.ts, volunteers.test.ts, inventory,. etc.
worker/
  email.group.test.ts
  member-cards.test.ts
```

## Test Structure

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('moduleName', () => {
  let mockSupabase: MockedSupabase;

  beforeEach(() => { /* reassign mocks */ });
  afterEach(() => { vi.restoreAllMocks(); });

  it('should …(success)', async () => { … });
  it('should throw … when …', async () => { await expect(fn).rejects.toThrow(...); });
});
```

**Patterns:**
- `beforeEach` / `afterEach` to reset mocks
- Mock harnesses defined per-file (e.g. `mockSupabase`, `mockDrizzle`)
- Tests typically assert via `vi.mocked(...)` returns, not real DB; some use fake timers
- Deep domain tests for booking/scheduling (`booking-allocation-engine` logic, member-card transitions, restaurant reservation payment token)

## Mocking

**Framework:** Vitest `vi`

**What's mocked:**
- Supabase client (`supabase-services.test.ts`, `supabase.test.ts`, many routers) — a dedicated `vi.mock('@supabase/supabase-js')` factory returning anonymous/admin with flush
- `email` senders (`vi.mock('./email', ...)`) so tests inspect recipient lists / subject
- `qrcode` generation in `qrcode.test.ts`
- Time: `vi.useFakeTimers()` in reservation / token tests

**What's NOT mocked:** pure/utils (e.g., `room` range helpers); `zod` schemas tested directly with mock inputs

**Fixtures/Factories:**
- Small inline object factories per test (e.g. `createMockDay({ with })`)
- No central fixtures/ dir

## Coverage

- No enforced coverage threshold; `vitest run` default config
- `pnpm check` (`tsc --noEmit`) is the main type-safety gate, not tests
- Coverage gaps exist solidly domain-wide (see CONCERNS.md)

## Test Types

- **Unit/integration** only (colocated). Level often service-or-router level with mocks.
- **E2E:** none; Safari manual scan campaigns remain manual

## Common Patterns

```typescript
// Mock Supabase module
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => mockSupabase) }));

// Assert thrown tRPC error
await expect(proc(ctx)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
```

**Async/error:** standard `await expect(...).rejects.toThrow(...)`.

**Snapshot testing:** not used.

---

*Testing analysis: 2026-08-08*
*Update when test patterns change*