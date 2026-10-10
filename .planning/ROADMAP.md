# Roadmap: Ftour Bab Rayan — Audit Milestone

## Overview

An audit of the existing brownfield app (React 19 SPA, Express server, Cloudflare Worker, Supabase) to make every module work reliably. Start by fixing the test-harness so the suite can go green (27 failing tests today), then fix the real bugs the green suite reveals, then verify typecheck/build gates, runtime parity, admin wiring, and hygiene. No new features — only reliability.

## Phases

- [ ] **Phase 1: Test Foundation** - Hermetic harness; all harness bugs fixed; env-independent green suite
- [ ] **Phase 2: Bug Fixes** - Real logic bugs fixed with tests (qrcode, email, donations, volunteers, reservations)
- [ ] **Phase 3: Gates & Parity** - Build clean; worker/server router parity audited
- [ ] **Phase 4: Admin Wiring** - 21 admin modules verified end-to-end
- [ ] **Phase 5: Hygiene & Sign-off** - Secrets scrubbed, no skips, final gates, milestone summary

## Phase Details

### Phase 1: Test Harness (Hermetic Suite)

**Goal**: Every failing test file is fixed at the harness level so the suite can pass without live credentials
**Mode**: mvp
**Depends on**: Nothing (first phase)
**Requirements**: QA-01, QA-02, QA-03, QA-04, GATE-01, GATE-02
**Success Criteria** (what must be TRUE):

  1. All 7 failing test files pass; `pnpm test` is 132/132 green with no skips
  2. No test requires live `SUPABASE_URL`/`RESEND_API_KEY`; missing-config paths tested via `vi.stubEnv`
  3. `vi` import bug and all env-validation tests corrected (not deleted)
  4. `pnpm check` (`tsc --noEmit`) passes
  5. Clean-env run (`env -i`) is green, proving hermeticity

**Plans**: TBD

Plans:

- [ ] 01-01: Classify each of the 27 failures (harness vs env vs contract vs logic)
- [ ] 01-02: Fix harness + hermeticization (vi imports, vi.mock supabase/resend, stubEnv for missing-config tests)
- [ ] 01-03: Make all test files green; verify clean-env run

### Phase 2: Real Bug Fixes

**Goal**: Fix the genuine logic/contract bugs surfaced by the now-green suite, with tests asserting the canonical behavior
**Mode**: mvp
**Depends on**: Phase 1
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, GATE-03
**Success Criteria** (what must be TRUE):

  1. QR token validation throws consistently with tRPC error handling; test asserts it
  2. Email subject/template uses canonical constants imported by both impl and test
  3. Donations, volunteers, email, reservations logic bugs fixed and their tests pass
  4. No implementation fix removed an assertion without a decision note
  5. `pnpm build` produces deployable artifacts (vite + esbuild server + wrangler worker)

**Plans**: TBD plans

Plans:

- [ ] 02-01: Fix QR token validation contract (throw vs soft-fail decision, apply canonically)
- [ ] 02-02: Fix email subject drift (canonical constants) + donations/volunteers logic
- [ ] 02-03: Fix reservations logic; rerun full suite + full build

### Phase 3: Gates & Parity

**Goal**: Typecheck + build gates confirmed green; server↔worker router drift audited
**Mode**: mvp
**Depends on**: Phase 2
**Requirements**: GATE-02, GATE-03, PAR-01, PAR-02
**Success Criteria** (what must be TRUE):

  1. `tsc --noEmit` clean
  2. `pnpm build` green end-to-end
  3. `server/routers.ts` ↔ `worker/routers.ts` compared; drift enumerated; shared bugs fixed in both
  4. Shared logic extracted to a common module where fixes overlap (not duplicated further)

**Plans**: TBD plans

Plans:

- [ ] 03-01: Run and fix typecheck + build
- [ ] 03-02: Diff server vs worker procedures; fix double-run drift (test both)

### Phase 4: Admin Wiring

**Goal**: Verify the 21 admin modules wire end-to-end (front → admin → emails → scanner)
**Mode**: mvp
**Depends on**: Phase 3
**Requirements**: ADMIN-01, ADMIN-02
**Success Criteria** (what must be TRUE):

  1. Each keep-list admin module has a live front form, admin view, email/scanner side with tests passing
  2. Wiring matches `Admin-Front-DB-Matrix.md` — no broken links
  3. Any broken module found gets fixed (not just documented)

**Plans**: TBD plans

Plans:

- [ ] 04-01: Map admin modules against Admin-Front-DB-Matrix
- [ ] 04-02: Wire/fix any broken modules + tests

### Phase 5: Hygiene & Signoff

**Goal**: Clean up secrets, enforce no-skips, produce audit summary
**Mode**: mvp
**Depends on**: Phase 4
**Requirements**: HYG-01, HYG-02
**Success Criteria** (what must be TRUE):

  1. `RESEND_API_KEY` (and any secrets) no longer in git tracking; `.env*.example` committed, `.env*` ignored
  2. No `test.skip`/`.skip` anywhere
  3. Final audit summary documents each fix and its verification

**Plans**: TBD plans

Plans:

- [ ] 05-01: Remove `.env.production` from tracking, rotate keys, enforce gitignore
- [ ] 05-02: Final full run (test + check + build), no-skips scan, milestone summary

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Test Harness | 0/3 | Not started | - |
| 2. Real Bug Fixes | 0/3 | Not started | - |
| 3. Gates & Parity | 0/2 | Not started | - |
| 4. Admin Wiring | 0/2 | Not started | - |
| 5. Hygiene & Signoff | 0/2 | Not started | - |

### Phase 6: Design d1 sur le site principal

**Goal:** Le site principal reprend le design de https://ftour-bab-rayan-d1.pages.dev (tokens, typographie, composants, pages publiques), sans casser les flux existants; FR/EN/AR(RTL) et mobile vérifiés.
**Requirements**: DSG-01, DSG-02, DSG-03
**Depends on:** Phase 5
**Plans:** 1/2 plans executed

Plans:

- [x] 06-01-PLAN.md — Palette gate script + mauve tokens (tracer: index.css, Navbar/Footer, worker email) then public & restaurant pages
- [ ] 06-02-PLAN.md — Admin surfaces + server emails/previews, re-key palette-variants script, final gate + manual UAT

### Phase 7: Hébergement bénévoles façon Airbnb

**Goal:** L'espace bénévole propose un module d'hébergement façon Airbnb (annonces, recherche/filtres, fiches, demandes/réservations, espace hôte, covoiturage, emails), navigation simple et fluide, tests hermétiques.
**Requirements**: STAY-01 (annonces + photos + équipements), STAY-02 (recherche/filtres par dates), STAY-03 (demandes de séjour anti-chevauchement), STAY-04 (messagerie de demande + avis), STAY-05 (modération admin + tests hermétiques)
**Depends on:** Phase 6
**Plans:** 1 plan

Plans:

- [x] 07-01-PLAN.md — Module hébergement : schéma D1 `stay.sql`, data layer `stay-d1.ts`, routes REST `/hub/stay/*`, 5 pages espace bénévole, admin, 26 tests hermétiques
