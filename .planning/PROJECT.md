# Ftour Bab Rayan — Module Audit & Hardening

## What This Is

A brownfield audit-and-harden cycle on the existing **Ftour Bab Rayan** platform — a Moroccan charity Iftar web app (React 19 SPA + tRPC + Cloudflare Workers + Supabase). The outward product already exists and ships: reservations (individual/company/group), volunteer signup with QR check-in, goodies/pastries/terroir storefronts, donations, restaurant flows, member cards, gallery with moderation, and a large admin dashboard ("EventOS"). This milestone does **not** build new features; it verifies every existing module works correctly and hardens what doesn't, with the verified bar being `tests pass + typecheck clean`.

## Core Value

The app is a charity trust surface — every reservation, donation, volunteer signup, and order **must** round-trip correctly (form → DB → email → admin → scanner/checkout) without silent failure. If a broken module mutates data or drops emails, donations and seats are lost in real time during Ramadan.

## Business Context

- **Customer**: Volunteers, donors, and restaurant/company customers of Association Al Amal; admin operators (multi-role RBAC).
- **Revenue model**: Donations (promised → received) + goodies/pastry/terroir orders; cash + online.
- **Success metric**: 132 automated tests pass, `tsc --noEmit` clean, `pnpm build` green.
- **Strategy notes**: existing `AUDIT_SUMMARY.md`, `QA.md`, `BUGFIX_*.md`, `SECURITY_CHECK_REPORT_2026-02-24.md` serve as the audit baseline.

## Requirements

### Validated (existing — ship to validate)

- Public site pages (Home/Programme/Bénévole/Événement/Association/Contact/FAQ/…) route and render (existing code, 25+ public routes)
- tRPC API surface on both Express and Cloudflare Worker (18 routers + `worker/routers.ts`)
- Reservation flows (particuliers/entreprises/groupes) with status workflows + emails
- Volunteer QR token generation, check-in, scan history
- Donations with status lifecycle (promised/pending/received/handed/checked_in)
- Goodies/pâtisserie/terroir catalog + orders + variants + payments
- Member cards (2-step: order → payment + proof upload)
- Gallery public + admin moderation (upload validation, moderation)
- Restaurant reservation allocation engine
- RBAC role system on client and server; demo read-only mode

### Active (this milestone)

- [ ] VERIFY-01: Full test suite green — 132 tests, 27 currently failing; fix each failure
- [ ] VERIFY-02: `pnpm check` (`tsc --noEmit`) passes with no source errors
- [ ] VERIFY-03: `pnpm build` produces deployable artifacts without error
- [ ] VERIFY-04: Env-dependent tests (Supabase/Resend) are testable without live keys (or correctly skip)
- [ ] VERIFY-05: Real bugs found in failures fixed — `restaurant-reservations.test.ts`, `donations.test.ts`, `volunteers.test.ts`, `qrcode.test.ts`, `supabase.test.ts`, `email.test.ts`, `worker/email.group.test.ts`
- [ ] VERIFY-06: Duplicate runtime drift between `server/routers.ts` and `worker/routers.ts` audited/tested
- [ ] VERIFY-07: 21 admin modules (KEEP list) still wireable end-to-end: front form → admin → emails → scanner
- [ ] No regressions to existing public/user flows during fixes

### Out of Scope

- New product features not already implemented (out of the audit scope)
- New dashboards/CRUD for empty admin modules (restaurants, unified-dashboard) — that was the Feb-12 audit's deferred V2 backlog, not this milestone
- DB schema migration rewrites (MySQL→Postgres) unless needed to fix a failing test
- Removing legacy modules (company-bookings, etc.) — already cleaned previously

## Context

The audit baseline (all docs in repo root):
- Tests currently fail: 27/132 across 7 files
- Root causes: env keys absent (Supabase/Resend never set in CI dev env), a few genuine code bugs (`vi not imported`, token-validation contract mismatch, email subject drift)
- Two similar tRPC surfaces (`server/`, `worker/`) must be kept in sync — drift risk
- Secrets in `.env.production` tracked (`RESEND_API_KEY`) — hygiene

## Constraints

- **Tests must be hermetic**: unit tests cannot require live Supabase/Resend S3/network credentials to pass; CI/local `pnpm test` must run offline
- **No skipped tests**: each failure is fixed, not `.skip/only`-bypassed
- **Compatibility**: maintain TS 5.9/pnpm 10/React 19 — no major dependency bumps unless required by a failing test
- **Client behavior**: do not ship a change that breaks an existing public/MVP flow

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|--------|
| Fix tests first, then `tsc`, then build | Green base is the dependency for all other quality gates | — Pending |
| Treat test/env failures as real bugs to fix, not skips | Difficulty must never be hidden | — Pending |
| Honor existing baseline docs (AUDIT_SUMMARY, QA, SECURITY) | Avoids re-doing what's already recorded | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-08 after initialization (audit milestone).*