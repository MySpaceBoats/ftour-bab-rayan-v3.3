# Codebase Concerns

**Analysis Date:** 2026-08-08

## Tech Debt

**Duplicated tRPC surface between `server/` and `worker/`:**
- The same router data/router logic is re-implemented for Node (Express) and edge (Workers). `server/routers.ts` is a 7300+ line monolith; `worker/routers.ts` duplicates procedures with Supabase calls. Any API change must be mirrored in both — a recurring bug source.
- Impact: drift between runtimes, double maintenance.
- Fix approach: extract shared procedure definitions / a common `trpc` layer, keep only transport-specific adapters.

**Huge monolith routers:**
- `server/routers.ts` (~7,300 lines) interleaves auth, donations, gallery, goodies, restaurant, reservations, member cards, scanner, audit, team, event-photos, blog in one file.
- Impact: hard to review, test-gated, and price-secure.
- Fix: split into per-domain router modules + service layer (partial pattern already exists; extend it).

**Mixed environment vars / secrets:**
- `.env.production` (committed) contains `RESEND_API_KEY` as plaintext value — credential hygiene risk.
- Impact: real key exposure via git history (file currently untracked at root but was likely committed earlier).
- Fix: rotate key, move to vault (CF secret), strip from repo.
- Security-blocking item — see SECURITY_CHECK_REPORT_2026-02-24.md.

**Legacy Drizzle/MySQL vs Supabase:**
- Both `drizzle/schema.ts` (MySQL, 47 tables) and `supabase/schema.sql` (Postgres, RLS) coexist; unclear which is canonical. Migrations duplicated.
- Impact: schema drift, failed migrations in prod (bugs in SUPABASE setting sync).
- Fix: pick one canonical schema + auto-migration scripts; reconcile and archive the other.

**Demo-mode SPA pages wholesale copied (`features/demo`, 22 files):**
- Duplicated read-only versions of dashboards.
- Fix: if demo is needed, wrap real components with a demo guard instead of full page duplication.

## Known Bugs

**Audit rotation missing:**
- `cleanup-audit-logs.ts` exists only manually; no scheduled cron for audit table pruning (`audit_mutation` grows unbounded).

**Gallery validation migration patched in, not canonical:**
- `scripts/apply-gallery-validation-migration.mjs` is a manual one-off; the entity migration is not in `drizzle/`/`supabase/migrations/`.

**Email templates in-code duplication:**
- `server/email-templates.ts`, `server/email.ts` and worker's `member-card-emails.ts` each hand-roll HTML; CSS and copy duplicated across three files.

**Restaurant allocation edge cases:**
- allocation engine `booking-allocation-engine.ts` is complex, underscore-tested (only partial tests exist) — capacity/overbooking edge risk during peak Ramadan.

## Security Considerations

- **Service-role Supabase key** used server-side; any leak = full DB bypass. Must be CF secret, worker-only.
- **No rate limiting check on public mutations** except gallery (`gallery-rate-limiter.ts`); public upload and contact/feedback procedures are attack surface.
- **Client role checks** (`RequireRole`) are UX-only; the server `protectedProcedure` gating is authoritative — audit that every sensitive mutation has server-side role/guard check.
- **Payment tokens** (reservation proof, order-proof HMAC) must be validated server-side with expiry TTL — verify current implementation covers ALL routes.
- **Demo mode write-blocking** implemented in worker `protectedProcedure`; confirm Node path blocks demo writes too.

## Performance Bottlenecks

- **`server/routers.ts` monolith** — slow to build/index, and any schema drop amid a single `tRPC` procedures without caching causes repeated DB round trips.
- **No caching layer** — every public page hit (HOME, Programme) recomputes Supabase queries; consider edge cache (KV) for public reads with `cache-control`.
- **Gallery signed URLs** — prior signed-URL refactor removed some unnecessary overhead, but photo list still runs per-item storage calls in views.
- **Email sending sequential in loops** — batch group email dispatch has concurrency limit (`runWithConcurrencyLimit`), can be slow for large groups.

## Fragile Areas

- **Supabase unauth user resolution** — `server/_core/context.ts` and `worker/context.ts` both resolve sessions; divergent cookie/JWT handling breaks auth behavior between runtimes.
- **`server/storage.ts`** Forge proxy: fails hard if `BUILT_IN_FORGE_API_URL` unset (throws). Safer: allow missing → fallback to Supabase storage.
- **Booking/allocation engine** — high-risk, few tests, Ramadan-day critical兴.
- **MVP date-range config** (`RAMADAN_DATE_RANGES`) hardcodes years up to 2029 — must be updated or made configurable.

## Scaling Limits

- **Supabase free/pro tier** — grows with media storage; computation; in-batch uploads capped; at load, rate 429s.
- **Worker bundle size** — `dist/worker.js` single-file bundle incl. xlsx + qrcode grows large (cold-start cost at edge).

## Dependencies at Risk

- `wouter@3.7.1` has a local pnpm patch (`patches/wouter@3.7.1.patch`) — future wouter upgrades break routing silently until patched to match.
- `mysql2` + Drizzle legacy — dependency drift vs deprecation of the secondary DB path.
- `xlsx` 0.18 — unmaintained; known prototype-pollution CVEs patched to each new cert; consider bumping.

## Missing Critical Features

- **Canonical single migration pipeline** — no one command to migrate prod for both DBs.
- **Structured observability** — no error tracking (no Sentry), no metrics; only local console + audit logs.
- **Security rate limiting** beyond gallery — login/volunteer POST endpoints unthrottled.
- **E2E tests** — zero; manual scan/testing only.

## Test Coverage Gaps

- Admin dashboard (BFF `admin-dashboard-bff.ts`) has no direct unit tests.
- Booking allocation engine partial.
- Content/CMS (`content.ts`, CMS handler) — untested.
- Authentication flow (login/session/PW-Reset) — only logout tested.
- S3/storage — untested.

---

*Concerns audit: 2026-08-08*
*Update as issues are fixed or new ones discovered*