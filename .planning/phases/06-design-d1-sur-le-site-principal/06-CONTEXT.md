# Phase 6: Design d1 sur le site principal — Context

**Gathered:** 2026-10-10
**Source:** User request (chat) + read-only analysis of https://ftour-bab-rayan-d1.pages.dev (deployed CSS) and `scripts/build-palette-variants.mjs`. No discuss-phase run; the browser extension was unavailable so no screenshots were taken.

<domain>
## Phase Boundary

"Le design d1" is NOT a new layout. It is **palette variant d1 "Sunset Mauve 7644C"** from `scripts/build-palette-variants.mjs`: the deployed d1 bundle is the same app (same JS/CSS structure, same fonts Aref Ruqaa / Caveat / Cormorant Garamond / Inter, same `theme-color #111827`) with the five **olive** hex values remapped to mauve at build time. Cream (`#F2E9D3`, `#E6DCC3`) and sand (`#CDBB8A`) are unchanged.

This phase makes that palette the **source of truth in the main site** (all public pages, admin "admin-v2" theme, CMS page, transactional emails) instead of a build-time post-process. No layout, copy, routing or data change. Must not break any existing public/MVP flow.
</domain>

<decisions>
## Locked decisions

- **Palette = d1 exactly (hue-wise)**, mapping from the variants script:

| Slot (olive → d1) | Current source hex | New hex |
|---|---|---|
| base (`--bg-olive`, `--primary` on light) | `#5E5B34` | `#A85A6B` |
| dark (`--bg-olive-dark`, cards, headers) | `#4A4829` | `#8A4656` |
| soft (`--bg-olive-soft`, muted/accent) | `#6F6C3F` | `#BB7585` |
| darkest (`--olive-deep`, admin-v2) | `#3D3B22` | `#6E3744` |
| softer (`--chart-5`) | `#8A8555` | `#C48C99` |

- Scope = whole site: every occurrence in `client/`, `server/`, `worker/`, `client/public/cms/index.html` (≈25 files, ≈250 occurrences, see Specifics). Admin-v2 theme (`[data-theme=admin-v2]`) included — d1 remaps it too.
- CSS token *names* (`--bg-olive`, `.bg-olive`, `--olive`) are NOT renamed in this phase (rename = churn with no user value). Add a one-line comment that "olive" is a legacy name for the brand base colour.
- `theme-color` meta / manifest stay `#111827` (d1 does not change them).
- Images, logo SVG and uploaded media are NOT recoloured (d1 does not recolour them either).
- Project rules apply: tests hermetic, `pnpm check` must not get worse, no skipped tests, French/English/Arabic(RTL) unaffected.
- Edition-13 bump already done (commit b10423f); not part of this phase.

## Claude's Discretion

- **Accessibility fix-ups (required, user rule "never cut accessibility").** Measured WCAG contrast with the pure d1 hexes:
  - cream `#F2E9D3` on base `#A85A6B` = **4.00:1** (olive was 5.75) — fails AA for normal text, passes for large text/UI only
  - cream on dark `#8A4656` = 5.62:1 (OK)
  - cream on soft `#BB7585` = **2.90:1** (FAIL); cream-soft `#E6DCC3` on soft = **2.57:1** (FAIL); sand `#CDBB8A` on base = **2.55:1** (FAIL)
  - mauve base on cream (light theme text/links/buttons) = 4.00:1
  The planner must decide the minimal adjustment (e.g. use `dark` instead of `base`/`soft` wherever small cream text sits on a mauve surface, or nudge `base`/`soft` slightly darker) and add a **script-checkable contrast assertion** (a small test or script computing ratios for the token pairs used by `--background/--foreground`, `--primary`, `--muted`, `--accent`, `--card`, admin-v2). Keep hues recognisably d1. Whatever deviates from the literal hex table above must be listed explicitly in the plan and in the phase summary.
- Mechanism: simplest thing that works. Preferred: a mechanical, reviewable hex replacement in source (same five-slot mapping the script uses) + token comment; only introduce new tokens where a hardcoded hex sits in a place that needs different values per theme. No new dependency.
- `scripts/build-palette-variants.mjs` keys on the old olive hexes (`MAP`), so after the swap variant d1 becomes a no-op and d2–d5 would no longer remap anything. Decide: re-key `MAP` on the new d1 values (keeps d2–d5 working) or retire the script. Do not leave it silently broken.
- Where a hardcoded olive appears inside emails (`worker/email.ts`, `server/feedback-router.ts`), keep email-safe inline hex.
- Also check non-hex olive derivatives (e.g. `rgba(94,91,52,…)`, `rgba(74,72,41,…)`, shadows, Recharts series colours, `chart-*` tokens, hero overlays) so nothing olive remains visible.
</decisions>

<canonical_refs>
## Canonical References

- `scripts/build-palette-variants.mjs` — VARIANTS.d1 and MAP (source of truth for the colour mapping)
- `client/src/index.css` — all tokens: `:root` (lines ~62-135), light theme (~141-160), `[data-theme=admin-v2]` (~180-230), `.bg-olive*` utilities (~400+), `@theme` colour aliases (~45-50)
- Deployed reference: https://ftour-bab-rayan-d1.pages.dev (CSS: `/assets/index-VaPAyVb1.css`; token block shows `--bg-olive:#A85A6B; --bg-olive-dark:#8A4656; --bg-olive-soft:#BB7585; [data-theme=admin-v2] --olive-deep:#6E3744; --chart-5:#C48C99`)
- `CLAUDE.md` (project): tests hermetic, TS 5.9/pnpm 10/React 19, no breaking of public flows
</canonical_refs>

<specifics>
## Specifics

Files containing the five olive hexes (`grep -rIil "#5E5B34\|#4A4829\|#6F6C3F\|#3D3B22\|#8A8555" client server worker shared content`):

```
client/public/cms/index.html
client/src/index.css
client/src/components/{Footer,GoodiesConfirmation,Navbar,PaymentMethodSelector}.tsx
client/src/components/admin/Sparkline.tsx
client/src/features/boutique/pages/{BoutiqueProductTypePage,BoutiqueSolidaire,CommerceSolidaire}.tsx
client/src/features/election/admin/AdminElections.tsx
client/src/features/election/pages/{ElectionManagers,ManagersHistory}.tsx
client/src/features/feedback/admin/AdminEventFeedback.tsx
client/src/features/feedback/pages/{EventFeedbackForm,FeedbackPage,SiteFeedbackPage}.tsx
client/src/features/goodies/pages/Goodies.tsx
client/src/features/ops/admin/_shell/AdminFrame.tsx
client/src/features/public/pages/{Contact,DevenirPartenaire,Home}.tsx
client/src/features/restaurant/admin/AdminReservationsCalendar.tsx
server/feedback-router.ts
worker/email.ts
```
Counts: `#5E5B34` 117 occurrences/20 files, `#4A4829` 119/21, `#6F6C3F` 10/4, `#3D3B22` 1 (`index.css` `--olive-deep`), `#8A8555` 1 (`index.css` `--chart-5`).

Repo state: working branch is `feat/marketplace` (other uncommitted Hub/marketplace work exists in the tree). Commits for this phase must stage only their own files. Baseline: `pnpm test` = 27 failing / 210 passing, `pnpm check` already fails on unrelated files — this phase must not add failures; Phase 1 owns fixing the baseline.

Verification available offline: grep that no old olive hex remains; contrast script; `pnpm build` (vite) succeeds. Visual check needs a browser (extension was not connected) — list it as a manual UAT step comparing against the d1 site, per page group (home, restaurant, volunteer space, hub, boutique, admin).
</specifics>

<deferred>
## Deferred Ideas

- Renaming `olive` tokens to neutral brand names.
- Recolouring logo/images; offering d2–d5 as runtime-selectable themes.
- Fixing the pre-existing 27 test failures / typecheck errors (Phase 1–3).
</deferred>
