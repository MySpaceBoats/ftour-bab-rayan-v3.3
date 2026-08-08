# Phase 1: Test Harness (Hermetic Suite) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-08
**Phase:** 1-Test Harness (Hermetic Suite)
**Areas discussed:** Env-config test policy, Mocking strategy, Phase-boundary (drift), Hermeticity proof

---

## Env-config test policy

| Option | Description | Selected |
|--------|-------------|----------|
| stubEnv behavioral | Keep config tests, make them conditional via vi.stubEnv (assert behavior when keys absent/present) | |
| Env-gated | Gate with describe.skipIf/describe.runIf — run only when keys present | |
| Delete config tests | Remove pure env-presence assertions; keep only behavioral tests of getXClient | |

**User's choice:** Initially "Env-gated (recommended)".
**Notes:** When asked how to reconcile "env-gated" with PROJECT.md's "NO skipped tests" constraint, user refined the choice to **Always-on mocks** — env-presence assertions become behavioral, fake client creation tested; missing-config path asserts defined behavior. No skips. This keeps the suite green offline while honoring hermeticity.

---

## Mocking strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Module-boundary | vi.mock('@supabase/supabase-js') with createClient→fake returning per-test rows; consistent with vitest practice; member-cards.test.ts precedent | ✓ |
| Service-layer mock | Mock server/supabase.ts exports (getSupabaseAdminClient etc.) so routers get fake clients | |
| Per-file pragmatic | Some files mock module, others mock services | |

**User's choice:** Module-boundary (recommended).
**Notes:** Confirmed green precedent: worker/member-cards.test.ts tests pure functions — no module mocking needed there.

---

## Phase-boundary (drift)

| Option | Description | Selected |
|--------|-------------|----------|
| Fix drift here | Missing procedures (donations.getStats, orders.getStats) are drift bugs with tests already asserting them; tiny fixes; required for suite-green; full parity audit stays Phase 3 | ✓ |
| Defer to Phase 3 | Test stays red until Phase 3; violates GATE-01 | |
| Adjust roadmap bar | Accept Phase 1 = harness+env+mock only; suite-green = end of Phase 2 | |

**User's choice:** Fix drift here (recommended).

---

## Hermeticity proof

| Option | Description | Selected |
|--------|-------------|----------|
| Default run is the proof | `pnpm test` (vitest run) IS the hermetic gate — default run loads no secrets, env-dependent tests always-on-mocked | ✓ |
| Explicit dry-run script | Add `pnpm test:hermetic` = env -u SUPABASE_URL ... vitest run | |
| CI-enforced | Rely on GitHub Action running env-free | |

**User's choice:** Default run is the proof.

---

## Scope guards

- No new features, no new dashboards — audit correctness only.
- Secret hygiene (`.env.production` with RESEND_API_KEY) deferred to Phase 5 (HYG-01) — not touched in Phase 1.
- Full worker/server parity audit deferred to Phase 3 (PAR-01); Phase 1 only unblocks tested procedures.

---

*Phase: 01-test-harness-hermetic-suite*
*Discussion log: 2026-08-08*