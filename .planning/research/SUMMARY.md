# Project Research Summary — Ftour Bab Rayan Audit Milestone

**Date:** 2026-08-08

## Key Findings

1. **Hermetic tests are the audit's foundation.** Best practice (Vitest docs, Cloudflare Workers docs, Supabase docs) is to mock the runtime boundary — never require live credentials (Supabase URL/keys, Resend key, S3) for the default `pnpm test` run. The current suite fails 27 tests because several assert on env config (`.env` values) instead of behavior.
2. **Supabase is mockable at the module boundary.** `vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => mockClient) }))` is the established pattern (already partially used in `server/*.test.ts`). Real connectivity should be a separate opt-in integration suite, not part of unit tests.
3. **Worker tests and Node tests should not share assumptions.** Worker code (`worker/*.ts`) runs in edge runtime (workerd). Cloudflare recommends `@cloudflare/vitest-pool-workers` for faithful runtime behavior, but for this audit the pragmatic path is: keep worker unit tests as pure-function tests with mocked supabase/email (as `worker/member-cards.test.ts` already does), OR split projects. Avoid invoking CF-specific globals in Node tests.
4. **`tsc --noEmit` and `pnpm build` are independent gates.** Test pass ≠ typecheck clean. The audit must run all three. `vite build && esbuild server && esbuild worker` also validate bundler config (e.g., worker externals).
5. **Test-file quality bugs are real bugs.** In this repo: `restaurant-reservations.test.ts` uses `vi` without importing it (ReferenceError) — a genuine test bug that makes the suite red even when code is correct. Fix the test harness, then distinguish real logic bugs from harness bugs.
6. **Email subject drift** (`worker/email.group.test.ts` expects old subject "Demande groupe reçue", code now produces "Votre demande de groupe est en cours de traitement") — either the template changed (test stale) or the test asserts an outdated contract. Audit must reconcile test↔implementation truth.
7. **Validation contract mismatch** (`qrcode.test.ts` expects reject/throw on invalid token; code returns `{valid:false}`) — this is a behavioral contract decision: make the implementation throw consistently with the rest of tRPC error handling, or update tests to the "soft-fail" contract. Consistency wins.

## Implications for Roadmap

- Phase structure should follow: (1) test-harness + env isolation fixes, (2) real bug fixes found by green suite, (3) typecheck + build gates, (4) admin module wiring verification, (5) worker/server parity, (6) security/hygiene follow-ups.
- Each phase needs an explicit verification gate (`pnpm test`, `pnpm check`, `pnpm build`).
- The 27 failures are the acceptance-criteria seed: milestone = "all green, tsc clean, build green, no skipped tests."

## Sources

- vitest.dev/guide/mocking
- developers.cloudflare.com/workers/testing/ (+ vitest-integration)
- supabase.com/docs/guides/database/testing
- stackoverflow.com/questions/78427333 (Supabase mock in Vitest)
- dev.to/kevinccbsg (testing supabase services with vitest)
