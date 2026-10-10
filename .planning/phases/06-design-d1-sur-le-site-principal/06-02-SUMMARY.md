---
phase: 06-design-d1-sur-le-site-principal
plan: 02
subsystem: ui
tags: [palette, design-tokens, email, admin, build-script]
requires:
  - phase: 06-design-d1-sur-le-site-principal
    provides: scripts/palette-d1.mjs (PALETTE, SLOTS, --apply, gate), mauve tokens and public pages (06-01)
provides:
  - Admin-v2 pages, server-built emails and committed email previews in d1 mauve
  - scripts/build-palette-variants.mjs re-keyed on SLOTS with stale-MAP guard
  - Repo-wide zero legacy olive (hex and rgba) in client/ server/ worker/ shared/ previews/
affects: []
tech-stack:
  added: []
  patterns: ["single palette source (SLOTS) shared by rewriter, gate and variants builder"]
key-files:
  created: []
  modified:
    - client/src/features/ops/admin/_shell/AdminFrame.tsx
    - server/email.ts
    - previews/restaurant/reservation-rejected.no-reason.html
    - previews/restaurant/reservation-rejected.with-reason.html
    - client/src/components/admin/Sparkline.tsx
    - client/src/features/election/admin/AdminElections.tsx
    - client/src/features/feedback/admin/AdminEventFeedback.tsx
    - client/src/features/feedback/admin/AdminFeedback.tsx
    - client/src/features/feedback/admin/AdminFeedbackCampagnes.tsx
    - client/src/features/restaurant/admin/AdminReservations.tsx
    - client/src/features/restaurant/admin/AdminReservationsCalendar.tsx
    - client/src/features/restaurant/admin/AdminRestaurantEntreprises.tsx
    - client/src/features/restaurant/admin/AdminRestaurantGroupes.tsx
    - client/src/features/restaurant/admin/AdminRestaurantParticuliers.tsx
    - client/src/features/restaurant/admin/AdminRestaurants.tsx
    - client/src/features/restaurant/admin/AdminScanReservation.tsx
    - client/src/features/restaurant/pages/AdminReservationValidation.tsx
    - client/src/features/restaurant/pages/AdminReservations.tsx
    - server/feedback-router.ts
    - server/routers.ts
    - scripts/build-palette-variants.mjs
key-decisions:
  - "Variants script re-keyed (not retired): MAP derived from SLOTS in palette-d1.mjs; throws 'MAP is stale' when a variant replaces nothing"
  - "Email colours stay inline hex (email-safe); only the colour literal changed"
requirements-completed: [DSG-01, DSG-02, DSG-03]
duration: ~15min
completed: 2026-10-10
status: complete
---

# Phase 6 Plan 02: Admin, emails, previews and variants script in d1 mauve Summary

**All remaining olive (admin-v2 pages, server transactional emails, committed email previews) converted to the luminance-matched d1 mauve; `build-palette-variants.mjs` re-keyed on the single SLOTS source with a stale-MAP guard; repo-wide residual olive grep is empty.**

## Accomplishments
- Tracer (Task 1): AdminFrame spinner (1) + server/email.ts (16) converted; both restaurant-rejection `.html` previews regenerated from source (`pnpm exec tsx scripts/preview-restaurant-reservation-rejected-email.ts`); `.txt` previews unchanged. Tracer re-verified end to end in auto mode (gate, build green, preview contains `#844653` x2 each) before expanding.
- Task 2: 16 files converted mechanically via `--apply` (no hand edits). Replacements: Sparkline 1, AdminElections 4, AdminEventFeedback 11, AdminFeedback 39, AdminFeedbackCampagnes 28, restaurant/admin/AdminReservations 44, AdminReservationsCalendar 28, AdminRestaurantEntreprises 1, AdminRestaurantGroupes 1, AdminRestaurantParticuliers 1, AdminRestaurants 27, AdminScanReservation 2, pages/AdminReservationValidation 3, pages/AdminReservations 6, server/feedback-router.ts 7, server/routers.ts 11.
- Task 3: `scripts/build-palette-variants.mjs` imports `SLOTS`, builds MAP from it, counts replacements per variant and throws `MAP is stale` on zero. Ran without `--deploy`; d1..d5 built to gitignored `dist/variants`.

## Verification (phase-wide)
| Check | Result |
|---|---|
| Repo-wide residual grep (13 olive hex + `rgba(74, 72, 41`) over client server worker shared previews | 0 files |
| Extra grep for `rgb(a)(94,91,52 / 74,72,41)` forms | 0 files |
| `node scripts/palette-d1.mjs` | `palette-d1: 58 checks, 0 failed` |
| `pnpm build` | exit 0 (after each task) |
| `pnpm test` | 27 failed / 305 passed (ceiling 27) |
| `pnpm check` `error TS` lines | 21 (ceiling 21) |
| AdminFeedback three dark layers `#261318` / `#412028` / `#592C37` | 1 / 25 / 13 occurrences (distinct) |
| `#864654` in server/feedback-router.ts | 7; `#844653` in server/routers.ts | 11; in server/email.ts | 16 |
| numstat added == removed per commit | exit 0 for all three commits |
| Files per commit | 4 / 16 / 1 as planned |
| Variants: d1 css has `a85a6b`, no `864654`; d5 css has `1558b0` | yes (1 / 0 / 1 files) |
| `git status --porcelain -- dist` | 0 (gitignored) |
| `client/index.html` `#111827` count | 1, unchanged |

## Task Commits
1. Task 1 (tracer): `0d890fc` - AdminFrame, server/email.ts, 2 regenerated previews
2. Task 2: `a0250f8` - 16 admin pages and server router/feedback emails
3. Task 3: `a99b631` - re-keyed palette variants script

## Variants script decision
Re-key, not retire. MAP = `{ shippedHex: slot }` from `SLOTS` (single source in `scripts/palette-d1.mjs`). The `d1` variant maps shipped mauve back to the raw (lighter) d1 preview hexes, so it reproduces the original d1 site for side-by-side comparison; d2-d5 still remap the five brand slots. The extra legacy shades (palette rows 6-13) only partly share the five slot hexes, so variants remap those five only (documented in the MAP comment). The stale guard was not exercised against a deliberately broken MAP (only against the real build, where each variant replaced > 0 colours).

## Deviations from Plan

### Palette deviations from literal d1 hexes (phase-level list, from 06-01)
Rows 1-5 keep the d1 hue but are a lightness step deeper than the CONTEXT literal hexes, to preserve WCAG contrast of every existing pairing:

| Slot | Legacy olive | CONTEXT literal d1 | Shipped |
|---|---|---|---|
| base | #5E5B34 | #A85A6B | #864654 |
| dark | #4A4829 | #8A4656 | #6B3643 |
| soft | #6F6C3F | #BB7585 | #A35063 |
| darkest | #3D3B22 | #6E3744 | #592C37 |
| softer | #8A8555 | #C48C99 | #B56F80 |

Rows 6-13 added (olive shades the d1 build never remapped): #5D5A3C->#844653, #6B6B4E->#A14F62, #4A4730->#6B3643, #4A4830->#6B3743, #3D3B1E->#592C37, #3A3820->#542A34, #2D2B15->#412028, #1A1910->#261318; `rgba(74, 72, 41, a)` -> `rgba(107, 54, 67, a)`. Max hue drift vs d1 slot: 1.6 degrees.

Variants script re-keyed (see above).

### Auto-fixed Issues
None - plan executed as written. Operational note: zsh does not word-split unquoted variables, so multi-file `--apply` / `grep` calls were run through `bash`; the rewriter's path guard refused the single-argument form and wrote nothing. One grep run in zsh earlier returned a false 0 and was repeated correctly.

Branch note: executed on `main` per orchestrator (plan text says feat/marketplace). Other sessions' uncommitted files (CLAUDE.md, App.tsx, hub/**, worker/hub.ts) were never staged.

## Known Stubs
None.

## Threat Flags
None. T-06-06..09 mitigations verified (in-place substitution numstat, explicit staging, no `--deploy`, gate green).

## Manual UAT pending
Not performed (no browser available to the executor). Run `pnpm dev` (or a Cloudflare preview deploy) next to https://ftour-bab-rayan-d1.pages.dev. Expected everywhere: d1 mauve hue, one value step deeper than d1 preview by design; cream/sand unchanged; no olive-green surface. Check in FR, EN, AR (RTL mirrored, nothing clipped), desktop and ~375 px:

1. Home `/fr`: navbar top strip vs main bar distinguishable, hero gradient, cards, footer, focus ring visible when tabbing the navbar, hover visible on navbar items and language dropdown.
2. Restaurant: `/fr/restaurant/particuliers`, `/fr/restaurant/groupes`, `/fr/reservation`, `/fr/company-booking` - tan CTA buttons readable, step indicators visible.
3. Volunteer space `/fr/benevole` and `/fr/benevole/espace/marketplace` (token-driven, Hub files untouched): mauve, layout unchanged.
4. Shop: `/fr/boutique`, `/fr/boutique/goodies`, `/fr/goodies`, `/fr/checkout/goodies` (payment selector selected state visible).
5. `/fr/contact`, `/fr/devenir-partenaire`, `/feedback`, `/feedback/evenement`, `/fr/election-managers`.
6. Admin `/admin`: admin-v2 shell (primary buttons, selected sidebar item, loading spinner), reservations calendar, restaurants, feedback admin dark pages (page / card / inner panel three distinct shades), elections admin button hover; destructive red buttons still distinguishable from mauve.
7. `/cms/index.html` loading screen colours.
8. Open `previews/restaurant/reservation-rejected.with-reason.html`: headings mauve and readable.

Result: **pending** - reply "approved" or list issues (page, element, screenshot).

## Self-Check: PASSED
- Commits 0d890fc, a0250f8, a99b631 present on main; scripts/build-palette-variants.mjs and both regenerated previews exist; gate 58/0; build exit 0; tests 27 failed; check 21.
