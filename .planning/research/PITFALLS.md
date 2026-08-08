# Pitfalls Research — Ftour Bab Rayan Audit Milestone

**Domain:** QA of a brownfield dual-runtime (Express + CF Worker) Supabase/Resend monorepo
**Researched:** 2026-08-08
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Suite red due to test-harness bugs, not app bugs

**What goes wrong:** `ReferenceError: vi is not defined` in `restaurant-reservations.test.ts` — test file imports `describe/it/expect/beforeAll` but not `vi`, then calls `vi.fn()`.
**Why it happens:** copy-pasted test scaffold; auto-import config drift.
**How to avoid:** audit every failing file's imports; add `vi` to import or set vitest `globals: true` deliberately and consistently.
**Warning signs:** file fails before reaching assertions; `ReferenceError` in one test of many.
**Phase to address:** Phase 1 — harness fix.

---

### Pitfall 2: Tests require live credentials

**What goes wrong:** `server/supabase.test.ts`, `server/email.test.ts`, `server/qrcode.test.ts`, `server/volunteers.test.ts`, `server/donations.test.ts` all fail when `SUPABASE_URL` / `ANON_KEY` / `SERVICE_ROLE_KEY` / `RESEND_API_KEY` are absent — because they assert on env-config validation instead of behavior.
**Why it happens:** tests written assuming a `.env` loaded with secrets.
**How to avoid:** mock the client (`vi.mock('@supabase/supabase-js')`, mock `resend`), assert behavior not "Supabase not configured" path (unless the test *intends* to verify missing-config handling — then stub env explicitly with `vi.stubEnv`).
**Warning signs:** CI red, local green; `Error: Supabase not configured` appears in test output.
**Phase to address:** Phase 1 — env isolation.

---

### Pitfall 3: Test↔implementation contract drift

**What goes wrong:** `worker/email.group.test.ts` asserts subject "Demande groupe reçue"; implementation now produces "Votre demande de groupe est en cours de traitement". `qrcode.test.ts` expects `rejects`/throw on invalid token; implementation returns `{valid:false}`.
**Why it happens:** template/content changes without test updates; or validation contract changed without deciding canonical shape.
**How to avoid:** pick canonical contract. For qrcode: make server error handling consistent (tRPC should throw `VALIDATION_ERROR` like other procedures — one path). For email: source-of-truth SUBJECT constants imported by both test and implementation; or update test to current template if template is intentional.
**Warning signs:** one assertion fails while code works; grep for duplicated string literals in tests.
**Phase to address:** Phase 2 — real bugs.

---

### Pitfall 4: "Fix" = deleting assertions to go green

**What goes wrong:** auditor removes the failing assertion instead of deciding which side is wrong.
**Why it happens:** fastest path to green.
**How to avoid:** require every deleted/fixed assertion be accompanied by a decision note (test stale vs impl bug) in commit message + PLAN.md.
**Warning signs:** diff removes `expect(...)` lines without code change.
**Phase to address:** all phases — verifier flag.

---

### Pitfall 5: Worker/server router parity drift

**What goes wrong:** `worker/routers.ts` and `server/routers.ts` duplicate procedures; a fix to one side not mirrored.
**Why it happens:** two runtimes, one conceptual router; no shared module for the duplicated logic.
**How to avoid:** when fixing a shared bug, apply to both + add test for each; if the diff is small, extract shared util (server `_core`) and import into worker.
**Warning signs:** `git grep` finds same procedure name in both files with different bodies.
**Phase to address:** Phase 3 — parity.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 7300-line duplicated tRPC monolith | fast shipping | parity bugs; slow typecheck | Keep for now — rewrite is out of scope |
| Hardcoded subject/template strings | quick | test drift (email.group bug) | Never once tests exist |
| `.env.production` committed with RESEND key | convenient | secret leak in git history | Never — rotate + scrub |
| Env-dependent tests | quick green locally | CI red | Never for default `pnpm test` |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase | use real client in unit tests | `vi.mock` factory returning `createClient: vi.fn(() => mock)` |
| Resend | import real `resend` and await send | mock `resend` export |
| Storage/S3 upload | hit network in test | mock presigned-upload |
| CF Worker | expect `fetch`/`Request` node globals | pure-function mocks like `member-cards.test.ts` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Importing real supabase in tests | slow cold start / network | mock at boundary | every CI run |
| Reusing same mock across files without `vi.resetModules` | false cross-test state | per-test `mockResolvedValue` | when a second test needs different rows |

## Security Mistakes (Repo)

| Mistake | Risk | Prevention |
|---------|------|------------|
| `.env.production` committed (RESEND_API_KEY plaintext) | key exposure; invoice abuse | rotate key, add `.env*` (except example) to `.gitignore`, remove from history |
| Service-role key in frontend bundle | full DB access | verify it's server-only (likely already; audit bundle) |
| Supabase RLS policies untested | auth bypass | don't loosen policies; verify per-route |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| i18n keys drift (fr 764/en 764/ar 764/am 723) | Arabic/Amharic users see missing translations | leave for separate task (out of audit scope unless asked) |
| Validation error language inconsistent (FR "Format de token invalide" vs EN elsewhere) | confusing | unify error strings (contract fix) |

## "Looks Done But Isn't" Checklist

- [ ] **All 132 tests green:** often green locally, red in CI when env keys absent — verify with `env -i` (no `.env`) run
- [ ] **Typecheck:** `pnpm tsc --noEmit` green separate from tests — run it
- [ ] **Build:** vite client + esbuild server + wrangler worker all bundle — run `pnpm build`
- [ ] **No skips:** grep for `test.skip` / `.skip` / `describe.skip` — ensure zero
- [ ] **Both runtimes:** fix in worker but not server (or vice versa) — grep procedure names across both

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Contract drift (qrcode/email) | LOW | pick canonical, update impl or test + add assertion |
| vi import error | LOW | add import; also check all files for same pattern |
| Secret committed | MEDIUM | rotate key, remove file, purge history if needed |
| Parity drift | MEDIUM | replicate fix both sides + tests each |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Harness bugs (vi import) | Phase 1 | green file, no ReferenceError |
| Env-dependent tests | Phase 1 | `env -i` run green |
| Contract drift (qrcode, email subject) | Phase 2 | both tests assert canonical string |
| Assertion deletion | All | verifier check on diff |
| Worker/server parity | Phase 3 | grep procedure parity; both test files pass |
| Secret in `.env.production` | Phase 4 (cleanup) | `git grep RESEND` clean |

## Sources

- Repo test failures (26 failing tests across 7 files — observed)
- vitest docs (mocking, stubEnv)
- Cloudflare Workers testing docs
- Supabase testing docs
- dev.to/kevinccbsg (vitest supabase mock)

---
*Pitfalls research for: audit of ftour-bab-rayan v3.3*
*Researched: 2026-08-08*