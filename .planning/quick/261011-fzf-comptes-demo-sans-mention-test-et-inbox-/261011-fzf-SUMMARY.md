---
phase: quick-261011-fzf
plan: 01
subsystem: hub-demo
tags: [hub, demo, seed, d1]
requires: [scripts/hub-demo]
provides: ["Discreet '· démo' marker on demo member names", "seed.sql without the long test prefix"]
affects: [scripts/hub-demo/build.ts, scripts/hub-demo/common.ts, scripts/hub-demo/meetup.ts, scripts/hub-demo/pro.ts, scripts/hub-demo/stay.ts, scripts/hub-demo/seed.sql, worker/hub-demo.test.ts]
key-files:
  modified:
    - scripts/hub-demo/common.ts
    - scripts/hub-demo/build.ts
    - scripts/hub-demo/meetup.ts
    - scripts/hub-demo/pro.ts
    - scripts/hub-demo/stay.ts
    - scripts/hub-demo/seed.sql
    - worker/hub-demo.test.ts
decisions:
  - "One marker per demo member: suffix ' · démo' on hub_members.display_name (e.g. 'Yasmine A. · démo'). Display name is the only field shown everywhere (feed, announcements, listings, meetups, stays, pro, messaging)."
  - "No text prefix anywhere: bios, posts, announcements, listings, meetups, stays, pro headlines and jobs are natural text. The 'profil fictif créé pour la démonstration' bio sentence is dropped too."
  - "Cleanup key unchanged: emails @demo.ftour.invalid (cleanup.sql byte-identical)."
status: complete
completed: 2026-10-11
---

# Quick 261011-fzf: discreet demo marking Summary

Demo members now carry one small "· démo" suffix on their display name instead of the long "🧪 Profil test — " prefix on every text.

## What changed

- `common.ts`: `DEMO_LABEL` / `demoText()` removed; `DEMO_MARK = "· démo"` and `demoName(p)` added.
- `build.ts`: display_name = `Prénom N. · démo`; bio = the plain persona bio; posts, announcements, listings unprefixed.
- `meetup.ts`, `pro.ts`, `stay.ts`: `demoText()` calls removed (descriptions, headlines, posts, jobs).
- `seed.sql` regenerated (`npx tsx scripts/hub-demo/generate.ts`); `cleanup.sql` unchanged.
- No client or worker runtime code displayed the old text (grep for "Profil test", "🧪", `DEMO_LABEL`, `demoText` over client/worker/server/shared/docs only hit scripts/hub-demo and worker/hub-demo.test.ts). The marker is pure seed data, derived from the demo domain at seed time, nothing sent by the client.

## Tests

`worker/hub-demo.test.ts`: marker ends every demo display_name exactly once (seed contains `· démo` exactly 10 times), name length <= 30, no `🧪` / "profil test" anywhere in seed output, bios/posts/listings/meetups/stays/pro headlines/jobs free of the old prefix. Real `--me` member still unmarked.

Results: hub-demo 22/22 pass. Full suite 27 failures (identical pre-existing set: supabase, volunteers, email.group, ...), none new. `tsc --noEmit` 21 errors (baseline, unchanged).

## Deviations from Plan

None. Execution done in a worktree of main (`../ftour-bab-rayan-cp`, node_modules symlink removed, worktree removed at the end).

## Re-apply to D1 (not run)

Seed is self-cleaning (it begins with DELETEs keyed on `%@demo.ftour.invalid`), media keys are unchanged so no media re-upload is needed. One statement per line (788 lines), so 100-line chunks are safe; apply in order:

```
mkdir -p /tmp/seed-chunks && split -l 100 -a 2 scripts/hub-demo/seed.sql /tmp/seed-chunks/seed-
for f in /tmp/seed-chunks/seed-*; do npx wrangler d1 execute ftour-bab-rayan-prod-db --remote --file "$f" || break; done
```

Use `--env staging` with `ftour-bab-rayan-staging-db` for staging first. Do not import the whole file at once: D1 may reset the import. Add `--me <email>` to generate.ts if conversations for a real member are wanted.

## Self-Check: PASSED
