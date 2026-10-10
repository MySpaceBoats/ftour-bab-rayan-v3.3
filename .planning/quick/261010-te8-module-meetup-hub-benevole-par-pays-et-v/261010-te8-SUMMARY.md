---
phase: quick-261010-te8
plan: 01
subsystem: hub-meetup
tags: [hub, meetup, d1, cloudflare-worker, zod, waitlist]
requires: [hub.sql (hub_members), stay-d1 HOST_OK/isIsoDate/nightsBetween]
provides: ["/hub/meetup/* REST routes", "mt_meetups and mt_participants D1 schema", "Meetup tab and 4 hub pages", "admin Meetup section"]
affects: [worker/hub.ts, client/src/App.tsx, HubShell nav, AdminHub]
tech-stack:
  added: []
  patterns: ["atomic INSERT OR IGNORE ... SELECT seat decision", "shared fill-free-seats SQL in one d1.batch", "wall-clock text dates compared with the Casablanca clock", "zod schema with French messages at the API boundary"]
key-files:
  created:
    - worker/d1/meetup.sql
    - worker/meetup-d1.ts
    - worker/meetup.ts
    - worker/meetup-d1.test.ts
    - worker/meetup.test.ts
    - client/src/features/hub/meetup/meetup-api.ts
    - client/src/features/hub/meetup/format.ts
    - client/src/features/hub/meetup/pages/MeetupPage.tsx
    - client/src/features/hub/meetup/pages/MeetupDetailPage.tsx
    - client/src/features/hub/meetup/pages/MeetupFormPage.tsx
    - client/src/features/hub/meetup/pages/MeetupMinePage.tsx
    - client/src/features/hub/admin/MeetupAdmin.tsx
    - docs/hub-meetup.md
  modified:
    - worker/hub.ts
    - client/src/App.tsx
    - client/src/features/hub/components/HubShell.tsx
    - client/src/features/hub/admin/AdminHub.tsx
key-decisions:
  - "Seat decision (going vs waitlist) is one INSERT OR IGNORE ... SELECT comparing the live going count to capacity: concurrent joins cannot overbook"
  - "Waitlist promotion (leave, capacity raise) is one shared SQL statement run in the same d1.batch as the delete/update"
  - "starts_at/ends_at stored as venue-local wall-clock text without timezone, compared with Casablanca now"
  - "Places dropdowns grouped with an ASCII-only lowercase to match SQLite lower() used by the filters"
duration: ~1h
completed: 2026-10-10
status: complete
---

# Phase quick-261010-te8 Plan 01: Module Meetup du hub bénévole Summary

Meetup module for the volunteer hub: volunteers organise sorties / événements / rencontres, browse them by pays, ville, catégorie and dates, join with an atomic waiting list and automatic promotion, and admins hide or delete. Mirrors the Hébergement module layer for layer (D1 + R2, Worker-only).

## Commits

| Task | Commit | Files |
| --- | --- | --- |
| 1 Tracer (schema, create/list, tab) | 364509f | meetup.sql, meetup-d1.ts, meetup.ts, hub.ts, meetup.test.ts, meetup-api.ts, format.ts, MeetupPage.tsx, HubShell.tsx, App.tsx |
| 2 Complete API + tests + admin | 4c2861e | meetup-d1.ts, meetup.ts, meetup-d1.test.ts, meetup.test.ts, meetup-api.ts, MeetupAdmin.tsx, AdminHub.tsx |
| 3 Pages, routes, docs | 499c41c | MeetupPage/Detail/Form/Mine pages, format.ts, App.tsx, docs/hub-meetup.md |

## Verification

- `npx vitest run worker/meetup-d1.test.ts worker/meetup.test.ts`: 28 tests pass (21 data layer, 7 HTTP), hermetic (node:sqlite in memory).
- `pnpm check`: 21 `error TS` lines (baseline held after every task; one transient 23 from `[...new Set()]` spreads fixed before commit).
- `npx tsc --noEmit -p worker/tsconfig.json`: no error line mentions a meetup file.
- `pnpm test`: 27 failed (the pre-existing set: email, supabase, donations, volunteers, qrcode, restaurant-reservations, email.group), 391 passed; no failure in worker/meetup*.test.ts.
- `pnpm build:worker`: OK.
- Mutation spot-check: breaking the fill-seats LIMIT and the capacity comparison makes 5 tests fail, so the waitlist tests do discriminate.

## Deviations from Plan

1. **[Process] Tests written after implementation for Task 2** (plan marked it tdd). The tests were validated afterwards by mutation (see above) rather than via a RED commit. Per-task commits contain tests and code together, as the plan specified one commit per task.
2. **[Rule 3 - Blocking] Test schema loading uses `new URL(...).pathname`** instead of `new URL(...)` passed straight to `readFileSync`: the direct form adds a worker tsc error (DOM/node URL type clash) that 23 other worker tests already have.
3. **[Rule 1 - Bug] `Set` spread replaced with `Array.from`** in MeetupPage and MeetupFormPage (TS2802 under the client tsconfig target).
4. **listMeetups client signature** is `(cursor, filters)` rather than a single object, so the Task 1 MeetupPage kept compiling at the Task 2 commit.
5. **Admin "demo" 403 not tested over HTTP**: the shared harness (`test-hub.ts`, which the plan forbids editing) has no demo header, so the admin test covers no header, `member`, and `user` roles for 403 and `admin_ops` / `admin` / `super_admin` for 200. The demo branch lives in `admin()` in hub.ts, already covered by existing hub tests.
6. **graphify update** run once; its `graphify-out/` output is untracked and not staged.

Otherwise the plan was executed as written. Precondition checks on the shared files (hub.ts, App.tsx, HubShell.tsx, AdminHub.tsx) were clean before each edit.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. Mitigations applied: owner checks on PUT/cancel (403), `isOwnPath` on photo, atomic seat SQL, rate limits (5 meetups/day, 30 joins/h), no email/phone in any payload (tests assert), `admin()` on every admin route, bound parameters only.

## Manual steps for the requester

1. **Apply the D1 migration** (not run by this task): `wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/meetup.sql`, and for staging `wrangler d1 execute ftour-bab-rayan-staging-db --remote --env staging --file worker/d1/meetup.sql`. Idempotent; until applied the Meetup tab shows an error panel.
2. **Check the mobile bar at 375 px**: the bottom nav now has seven columns (`grid-cols-7`, `text-[11px]`); eyeball that "Messages" and "Logement" labels do not wrap or clip.
3. Deploy the Worker and the SPA as usual (no remote command was run here).

## Self-Check: PASSED

Created files exist (all 13 listed in key-files) and commits 364509f, 4c2861e, 499c41c are in `git log`.
