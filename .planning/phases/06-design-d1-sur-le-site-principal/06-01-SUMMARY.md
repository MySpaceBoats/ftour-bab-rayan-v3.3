---
phase: 06-design-d1-sur-le-site-principal
plan: 01
subsystem: ui
tags: [palette, design-tokens, accessibility, wcag, tailwind, email]
requires: []
provides:
  - scripts/palette-d1.mjs (PALETTE table, --apply rewriter, contrast/parity gate)
  - Mauve brand tokens in client/src/index.css (:root, light, admin-v2)
  - Public + restaurant-booking pages, Navbar, Footer, CMS loader and worker email header in d1 mauve
affects: [06-02]
tech-stack:
  added: []
  patterns: ["luminance-matched hue swap (WCAG contrast preserved by construction)", "single PALETTE table + script-checkable gate"]
key-files:
  created: [scripts/palette-d1.mjs]
  modified:
    - client/src/index.css
    - client/src/components/Navbar.tsx
    - client/src/components/Footer.tsx
    - worker/email.ts
    - client/public/cms/index.html
    - client/src/components/FeedbackCta.tsx
    - client/src/components/GoodiesConfirmation.tsx
    - client/src/components/PaymentMethodSelector.tsx
    - client/src/components/ProductImageCarousel.tsx
    - client/src/features/boutique/pages/BoutiqueProductTypePage.tsx
    - client/src/features/boutique/pages/BoutiqueSolidaire.tsx
    - client/src/features/boutique/pages/CommerceSolidaire.tsx
    - client/src/features/election/pages/ElectionManagers.tsx
    - client/src/features/election/pages/ManagersHistory.tsx
    - client/src/features/feedback/pages/EventFeedbackForm.tsx
    - client/src/features/feedback/pages/FeedbackPage.tsx
    - client/src/features/feedback/pages/SiteFeedbackPage.tsx
    - client/src/features/goodies/pages/Checkout.tsx
    - client/src/features/goodies/pages/Goodies.tsx
    - client/src/features/public/pages/Contact.tsx
    - client/src/features/public/pages/DevenirPartenaire.tsx
    - client/src/features/public/pages/Home.tsx
    - client/src/features/restaurant/pages/CheckinReservation.tsx
    - client/src/features/restaurant/pages/CompanyBooking.tsx
    - client/src/features/restaurant/pages/CompanyBookingConfirmation.tsx
    - client/src/features/restaurant/pages/GroupReservationEmailConfirmation.tsx
    - client/src/features/restaurant/pages/Reservation.tsx
    - client/src/features/restaurant/pages/RestaurantGroupes.tsx
    - client/src/features/restaurant/pages/RestaurantParticuliers.tsx
key-decisions:
  - "Luminance-matched hue swap instead of literal d1 hexes: d1 hue + slot saturation, same WCAG luminance as the olive replaced (never lighter)"
  - "Olive shades not remapped by the d1 build script (rows 6-13) included so nothing olive stays visible"
  - "CSS token names unchanged; one-line legacy-name comment added to index.css"
requirements-completed: [DSG-01, DSG-02, DSG-03]
duration: ~20min
completed: 2026-10-10
status: complete
---

# Phase 6 Plan 01: Design d1 on the main site (tokens + public pages) Summary

**Luminance-matched d1 "Sunset Mauve 7644C" palette applied to the token layer, shared shell, worker email header and every public/restaurant-booking page, behind a 58-check offline accessibility gate (`scripts/palette-d1.mjs`).**

## Accomplishments
- `scripts/palette-d1.mjs`: 13-row PALETTE table + rgba row, `--apply` rewriter with path guard (rejects outside-repo, missing, or the script itself, validated before any write), and gate (13 parity + 6 slot + 39 token-pair checks = 58). Exports `PALETTE` and `SLOTS` with no import side effects (for Plan 06-02).
- `client/src/index.css`: `:root`, light theme and admin-v2 tokens are mauve; names unchanged; header banner updated; legacy-name comment added.
- 29 files converted in total (index.css + Navbar + Footer + worker/email.ts + 18 Task 2 files + 7 Task 3 files), all diffs in-place substitutions (numstat added == removed for every file).

## Baseline and results
| Measure | Baseline (this plan) | After Task 1 | After Task 2 | After Task 3 |
|---|---|---|---|---|
| `pnpm test` failed | 31 failed / 300 passed (see note) | n/a | 27 failed / 305 passed | 27 failed / 305 passed |
| `pnpm check` `error TS` | 21 | n/a | 21 | 21 |
| `pnpm build` | exit 0 | exit 0 | exit 0 | exit 0 |

Note: the first baseline run at plan start showed 31 failed. The working tree held another session's uncommitted edits (`worker/hub-demo.test.ts`, `worker/hub.ts`); later runs, with no change to those, measured 27 failed (the plan's documented baseline), so 27 is used as the ceiling. This plan touches no test file and no test asserts a palette hex.

## Gate: red before, green after
- Before apply (index.css still olive): `palette-d1: 58 checks, 6 failed` (exit 1) - only the six Check 2 slot-token lines failed; 13 parity + 39 pair lines passed.
- After apply: `palette-d1: 58 checks, 0 failed` (exit 0), 58 `PASS` lines.
- Shipped ratios: `:root` fg/bg 5.76, muted-fg/muted 3.96, accent 4.47, ring 3.67; light primary 5.76, muted-fg/bg 4.47; admin-v2 primary 6.15, accent 9.42.
- Built artifacts carry the new base colour: `dist/public/assets/*.css` contains `864654`, `dist/worker.js` contains `#864654`.
- Path guard: `--apply ../outside.txt` and `--apply scripts/palette-d1.mjs` both exit 1 with nothing written.

## Per-file replacement counts
Task 1: index.css 28 (plus 2 comment edits), Navbar.tsx 20, Footer.tsx 1, worker/email.ts 2.
Task 2: cms/index.html 3, FeedbackCta 1, GoodiesConfirmation 14, PaymentMethodSelector 4, ProductImageCarousel 1, BoutiqueProductTypePage 3, BoutiqueSolidaire 8, CommerceSolidaire 9, ElectionManagers 2, ManagersHistory 1, EventFeedbackForm 19, FeedbackPage 16, SiteFeedbackPage 3, Checkout 3, Goodies 32, Contact 25, DevenirPartenaire 21, Home 28.
Task 3: CheckinReservation 31, CompanyBooking 7, CompanyBookingConfirmation 2, GroupReservationEmailConfirmation 2, Reservation 18, RestaurantGroupes 12, RestaurantParticuliers 3.

## Task Commits
1. Task 1 (tracer): `79fea44` - gate script + mauve tokens, Navbar, Footer, worker email (tracer re-verified end-to-end in auto mode: gate, build, CSS and worker bundle grep all pass; expansion proceeded)
2. Task 2: `1a4cb81` - 18 public/shop/feedback/election/CMS files
3. Task 3: `6781957` - 7 restaurant booking-flow pages

## Deviations from Plan

### Deviations from 06-CONTEXT literal hexes (per the plan's documented palette decision; to be repeated in the phase summary)
Rows 1-5 keep the d1 hue but are a lightness step deeper than the literal d1 hexes, to keep WCAG contrast of every existing pairing (literal d1 would fail AA in 4 token pairs and regress about 600 hardcoded pairs):

| Slot | Legacy olive | CONTEXT literal d1 | Shipped |
|---|---|---|---|
| base | #5E5B34 | #A85A6B | #864654 |
| dark | #4A4829 | #8A4656 | #6B3643 |
| soft | #6F6C3F | #BB7585 | #A35063 |
| darkest | #3D3B22 | #6E3744 | #592C37 |
| softer | #8A8555 | #C48C99 | #B56F80 |

Rows 6-13 added (olive shades the d1 build script never remapped, still olive on the d1 preview): #5D5A3C->#844653, #6B6B4E->#A14F62, #4A4730->#6B3643, #4A4830->#6B3743, #3D3B1E->#592C37, #3A3820->#542A34, #2D2B15->#412028, #1A1910->#261318; plus rgba(74, 72, 41, a) -> rgba(107, 54, 67, a). Max hue drift vs the d1 slot: 1.6 degrees.

### Auto-fixed Issues
None - plan executed as written. Operational note: the first Task 2 `--apply` invocation passed all paths as one argument (zsh does not word-split); the rewriter's path guard refused it and wrote nothing, then the run was repeated via bash.

Branch note: the plan text says feat/marketplace; execution happened on `main` as instructed by the orchestrator. HEAD did not change mid-run apart from this plan's own commits.

## Known Stubs
None.

## Threat Flags
None - no new network, auth or schema surface. T-06-01/02/03 mitigations verified (path guard, explicit per-task staging with `git show --name-only` checks, substitution-only numstat).

## Remaining for Plan 06-02
Admin surfaces, server emails, previews, re-keying `scripts/build-palette-variants.mjs`, manual visual UAT per page group. Not touched here: Hub files, App.tsx, admin pages in `features/restaurant/pages` (`Admin*`).

## Self-Check: PASSED
- scripts/palette-d1.mjs exists; commits 79fea44, 1a4cb81, 6781957 present on main; gate 58/0; build exit 0; tests 27 failed (ceiling 27); check 21 (ceiling 21).
