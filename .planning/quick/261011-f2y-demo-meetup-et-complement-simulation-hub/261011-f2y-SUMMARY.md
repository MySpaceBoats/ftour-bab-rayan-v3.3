---
phase: quick-261011-f2y
plan: 01
subsystem: hub-demo
tags: [hub, demo, seed, meetup, d1, media]
requires: [worker/d1/meetup.sql, scripts/hub-demo (build/stay/pro/common)]
provides: ["scripts/hub-demo/meetup.ts (meetupSeed/meetupCleanup)", "Meetup demo data in seed.sql/cleanup.sql", "16 generated demo images"]
affects: [scripts/hub-demo/build.ts, scripts/hub-demo/pro.ts, scripts/hub-demo/stay.ts, worker/hub-demo.test.ts]
key-files:
  created:
    - scripts/hub-demo/meetup.ts
    - scripts/hub-demo/media/meetup-*.jpg (10)
    - scripts/hub-demo/media/cartable-1.jpg
    - scripts/hub-demo/media/stay-*-2.jpg (4)
    - scripts/hub-demo/media/pro-atelier-stock.jpg
  modified:
    - scripts/hub-demo/build.ts
    - scripts/hub-demo/common.ts
    - scripts/hub-demo/pro.ts
    - scripts/hub-demo/stay.ts
    - scripts/hub-demo/seed.sql
    - scripts/hub-demo/cleanup.sql
    - scripts/hub-demo/media/generate-media.mjs
    - scripts/hub-demo/media/CREDITS.md
    - worker/hub-demo.test.ts
decisions:
  - "Meetup dates are SQL-relative (wall(days, hh:mm)), so past ones stay finished and upcoming ones stay upcoming whenever the seed is applied"
  - "Descriptions carry the test marker, titles stay clean (same as listings and jobs)"
  - "generate-media.mjs takes an optional comma-separated prefix so existing images are never rewritten"
metrics:
  tasks: 3
  commits: 3
status: complete
---

# Phase quick-261011-f2y Plan 01: Meetup demo and demo complement Summary

Meetup demo seed (12 meetups in 4 countries, every state of the tab) wired into the hub-demo generator, plus extra content and photos on Fil, Marketplace, Hébergement and Pro, all covered by the hermetic hub-demo test.

## Tasks

1. Meetup seed (`3c5ba10`): `scripts/hub-demo/meetup.ts`, hook in `build.ts` (cleanup first, seed last), 10 `meetup-*.jpg`, seed/cleanup regenerated.
2. Other tabs (`0318035`): Fil, Marketplace, Hébergement, Pro additions, 6 more images, pinned test counts updated.
3. Tests (`2d66880`): 4 new Meetup tests, cleanup test extended.

## Added per tab

- **Meetup (new)**: 12 meetups, 58 "going" + 3 waiting-list sign-ups. Categories: all 4. Countries: Maroc (Marrakech x2, Casablanca x2, Rabat x2, Fès), France (Paris, Lyon), Belgique (Bruxelles), Canada (Montréal). 3 finished (Ourika hike, Casablanca café, Rabat football), 7 upcoming, 1 full workshop (6/6 going, 3 on the waiting list, Marrakech), 1 cancelled (Rabat bike ride, with `cancelled_at`), 1 hidden (spam). 10 with a cover photo, 2 without (the hidden one and the Lyon brunch). With `--me`: the operator gets 1 waiting-list place (full workshop) + 1 seat (beach clean-up) + 1 past meetup.
- **Fil**: +4 posts (26 -> 30 visible), 3 with photos (photo posts 10 -> 13), +11 comments, +4 like counts.
- **Marketplace**: +2 listings (14 -> 16; tea set reusing `photo-the-menthe.jpg`, school bag with new `cartable-1.jpg`), +4 comments, +1 conversation (7 -> 8 threads, 4 messages, one unread).
- **Hébergement**: second photo on 4 listings (Maârif room, Guéliz house, Fès flat, Agdal studio).
- **Pro / Offre d'emploi**: +3 post photos (6 -> 9), +2 comments, +2 job offers (8 -> 10, open 6 -> 8), +1 application thread (5 -> 6, 4 messages, one unread).

## Images generated (16, all tiles via generate-media.mjs, no external source)

meetup-randonnee-ourika, meetup-cafe-casablanca, meetup-foot-rabat, meetup-petit-dej-paris, meetup-atelier-cuisine, meetup-plage-propre, meetup-jeux-bruxelles, meetup-medina-fes, meetup-diaspora-montreal, meetup-velo-corniche, cartable-1, stay-chambre-maarif-2, stay-maison-gueliz-2, stay-appart-fes-2, stay-studio-agdal-2, pro-atelier-stock. `upload-media.sh` globs the folder, no change needed (68 images total now to upload).

## Verification

- `npx vitest run worker/hub-demo.test.ts`: 22/22 pass (18 before).
- `pnpm test`: 27 failed / 439 passed, same 27 pre-existing failures, none in hub-demo.
- `pnpm check`: 21 `error TS`, same baseline.
- seed.sql/cleanup.sql regenerated with `npx tsx scripts/hub-demo/generate.ts` (the other session's uncommitted seed.sql diff was overwritten as expected).

## Deviations from Plan

None - plan executed as written. Branch note: work was committed on the checked-out branch `feat/friends-follow` (the plan said `main`).

## Known Stubs

None. (Generated tiles are labelled "Photo de démonstration" by design.)

## Self-Check: PASSED
