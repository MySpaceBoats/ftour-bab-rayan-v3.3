# Requirements: Ftour Bab Rayan — Audit Milestone

**Defined:** 2026-08-08
**Core Value:** All existing modules (client, server API, worker edge, shared/infra) work reliably — green test suite, clean typecheck, working build, real bugs fixed.

## v1 Requirements

### Test Suite (QA-01..04)

- [ ] **QA-01**: Full test suite passes — 132/132 tests, no skips, no live credentials required
- [ ] **QA-02**: Env-dependent tests (Supabase/Resend/Storage) are hermetic — mock at module boundary; missing-config behavior tested via `vi.stubEnv`, not real keys
- [ ] **QA-03**: All test-harness bugs fixed (e.g., `vi is not defined` in `restaurant-reservations.test.ts`)
- [ ] **QA-04**: Green must be achievable in a clean env (`env -i` run with no `.env` loaded)

### Verification Gates (GATE-01..03)

- [ ] **GATE-01**: `pnpm test` green
- [ ] **GATE-02**: `pnpm check` (`tsc --noEmit`) clean
- [ ] **GATE-03**: `pnpm build` produces deployable artifacts (vite client + esbuild server + wrangler worker)

### Bug Fixes (BUG-01..05)

- [ ] **BUG-01**: QR token validation contract fixed — canonical error behavior (throw vs soft-fail) consistent with tRPC error handling (`server/qrcode.test.ts`)
- [ ] **BUG-02**: Email subject/template drift reconciled — canonical subject constants imported by both impl and tests (`worker/email.group.test.ts`)
- [ ] **BUG-03**: Donations/volunteers/email failures fixed and their tests pass (`server/donations.test.ts`, `server/volunteers.test.ts`, `server/email.test.ts`, `server/supabase.test.ts`)
- [ ] **BUG-04**: Reservation flow fixed and `restaurant-reservations.test.ts` green
- [ ] **BUG-05**: No test fixed by deleting assertions; each fix has a decision note (test stale vs impl bug)

### Runtime Parity (PAR-01..02)

- [ ] **PAR-01**: `server/routers.ts` ↔ `worker/routers.ts` drift audited; shared bugs fixed in both runtimes
- [ ] **PAR-02**: Any shared logic extracted to a common module rather than duplicated further

### Admin Wiring (ADMIN-01..02)

- [ ] **ADMIN-01**: 21 admin modules (KEEP list) still wireable end-to-end: front form → admin → emails → scanner
- [ ] **ADMIN-02**: Admin→route→DB mapping verified against `Admin-Front-DB-Matrix.md`

### Hygiene (HYG-01..02)

- [ ] **HYG-01**: No secret in git — `.env.production` with RESEND_API_KEY removed from tracking / gitignore enforced
- [ ] **HYG-02**: No `test.skip` / `.skip` markers left behind

## v2 Requirements

Deferred to future work (not part of this audit milestone unless requested).

- **DB-01**: Drizzle MySQL legacy schema consolidation to Supabase
- **DB-02**: Full schema migration audit
- **I18N-01**: Amharic key parity (am 723 vs others 764)
- **FEAT-01**: New dashboards / CRUD for restaurants

## Out of Scope

| Feature | Reason |
|---------|--------|
| New features / new dashboards | User scope: "audit all modules, be sure they work" — no feature work |
| Rewrite of 7300-line tRPC monolith | High risk; out of scope. Targeted refactor only where a bug is fixed (PAR-02) |
| DB migration rewrites (MySQL→Supabase) | v2, not required for "make it work" |
| Legacy app removal | Not requested |
| Full i18n key parity | Separate concern; not a correctness bug |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| QA-01 | Phase 1 | Pending |
| QA-02 | Phase 1 | Pending |
| QA-03 | Phase 1 | Pending |
| QA-04 | Phase 1 | Pending |
| GATE-01 | Phase 1 | Pending |
| GATE-02 | Phase 1 | Pending |
| GATE-03 | Phase 2 | Pending |
| BUG-01 | Phase 2 | Pending |
| BUG-02 | Phase 2 | Pending |
| BUG-03 | Phase 2 | Pending |
| BUG-04 | Phase 2 | Pending |
| BUG-05 | All | Pending |
| PAR-01 | Phase 3 | Pending |
| PAR-02 | Phase 3 | Pending |
| ADMIN-01 | Phase 4 | Pending |
| ADMIN-02 | Phase 4 | Pending |
| HYG-01 | Phase 5 | Pending |
| HYG-02 | All | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-08*
*Last updated: 2026-08-08 after initial definition*
