# Phase 1: Test Harness (Hermetic Suite) - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the test suite hermetic and green. Today `pnpm test` = 7 files / 27 tests failing of 132. Every failure must be fixed — none skipped — so the default `vitest run` passes without live credentials. This phase fixes the test harness (imports, env dependencies, mocks, contract tests) and the minimal router-drift bugs the suite surfaces; it does NOT add new features.

</domain>

<decisions>
## Implementation Decisions

### Env-config test policy
- **D-01:** Env-config tests are **always-on mocks**, not skipped, not env-gated. `supabase.test.ts` and `email.test.ts` must not require real `SUPABASE_*` / `RESEND_API_KEY` to pass.
- **D-02:** Config-presence assertions (`expect(process.env.SUPABASE_URL).toBeDefined()` etc.) become **behavioral**: `getSupabasePublicClient()` / `getSupabaseAdminClient()` return a working fake client; the missing-config path asserts a *defined behavior* (e.g., throws TRPCError "not configured" or returns null-handled 503), whichever the code actually does — the test documents it rather than requiring a real key.
- **D-03:** Honor PROJECT.md's "No skipped tests" constraint — NO `test.skip`, `describe.skip`, `.skip`, or `xdescribe`. Hermeticity is achieved via mocks, never via skipping.

### Mocking strategy
- **D-04:** Mock at the **module boundary** with `vi.mock('@supabase/supabase-js')` (factory returning `createClient: vi.fn(() => mockClient)`), plus a Resend mock for email. This matches vitest practice and keeps router tests (donations, qrcode, email, volunteers, reservations) deterministic.
- **D-05:** Per-test rows via `mockResolvedValue` on the fake client's `from(...).select/insert/update` chains. Avoid cross-test state (reset mocks in `beforeEach`).
- **D-06:** Pure-function tests (like `worker/member-cards.test.ts`) need no module mocking at all — keep them as-is. Precedent confirmed green.

### Phase-boundary (drift)
- **D-07:** The missing procedures surfaced by the suite — `donations.getStats`, `orders.getStats` ("No procedure found on path") — are **fixed in Phase 1** because they block suite-green (GATE-01). Fix is minimal: ensure the procedures the tests call exist with the expected shape.
- **D-08:** The **full** server↔worker parity audit remains Phase 3 (PAR-01). Phase 1 only unblocks the tests that already assert these procedures.

### Hermeticity proof
- **D-09:** The **default `pnpm test` run IS the hermeticity proof** (QA-04). No additional `test:hermetic` script and no CI-only enforcement: the ordinary local command passes with whatever `.env` state exists (including none). If the repo currently loads `.env` during tests, tests must not depend on those values.

</decisions>

<specifics>
## Specific Ideas

- "Be sure that they all work very well" — the audit's bar: no skipped tests, each failure fixed at the root, verifiable offline.
- Failing baseline to fix: `server/restaurant-reservations.test.ts` (vi import), `server/donations.test.ts`, `server/email.test.ts`, `server/qrcode.test.ts`, `server/supabase.test.ts`, `server/volunteers.test.ts`, `worker/email.group.test.ts`.
- Contract fixes to reconcile in tests or impl (whichever is canonical): qrcode throw-vs-soft-fail (`{valid:false}` vs "Format de token invalide"), email subject drift ("Demande groupe reçue" vs "Votre demande de groupe est en cours de traitement").

</specs>

<canonical_refs>
## Canonical References

### Project / requirements
- `.planning/PROJECT.md` — Core value + constraints (NO skipped tests, hermetic, no major dep bumps, don't break public flows)
- `.planning/REQUIREMENTS.md` — QA-01..04, GATE-01..02 for this phase

### Code maps
- `.planning/codebase/TESTING.md` — repo test tooling conventions
- `.planning/codebase/ARCHITECTURE.md` — server router monolith shape + worker parity context
- `.planning/research/PITFALLS.md` — Pitfalls 1-5 map directly to this phase's fixes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `worker/member-cards.test.ts`: green precedent for pure-function tests (no mocks needed).
- `vitest.config.ts`: `environment: node`, aliases (@, @shared, @assets), includes `server/**/*.test.ts` + `worker/**/*.test.ts`.

### Established Patterns
- Tests colocated `*.test.ts` next to source; French comments; vitest + superjson-free direct calls to `appRouter.createCaller`.
- `server/_core/trpc.ts` provides context factory used by router tests.

### Integration Points
- Router tests call `appRouter` (server) / `appRouter` (worker) directly with a fabricated `TrpcContext` (public vs scanner/admin roles).
- `.env.production` currently committed with RESEND_API_KEY (HYG-01 is Phase 5 — do NOT touch secrets here unless a test reads it).

</code_context>

<deferred>
## Deferred Ideas

- Full worker/server parity audit — Phase 3 (PAR-01).
- `RESEND_API_KEY` secret hygiene / removal from git — Phase 5 (HYG-01).
- i18n Amharic parity — out of scope.
- New feature work — out of scope.

</deferred>

---

*Phase: 01-test-harness-hermetic-suite*
*Context gathered: 2026-08-08*