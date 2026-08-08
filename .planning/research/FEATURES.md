# Feature Research — Ftour Bab Rayan Audit Milestone

**Domain:** audit of existing implementation scope (no new features requested)
**Researched:** 2026-08-08
**Confidence:** HIGH

## Feature Landscape (Existing Scope — Audit Only)

### Table Stakes (Existing — Must Keep Working)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Restaurant reservations | Core product flow | HIGH | Preserve existing API + UI; fix bugs not redesign |
| Donation/checkout (CHF + service fee) | Business revenue flow | HIGH | Sends invoice emails — mock in tests |
| Volunteer signup + QR code | Core program | MEDIUM | QR validation contract mismatch in tests |
| Member card / access | Program reward | MEDIUM | worker module |
| Email receipts (Resend) | Transactional comms | MEDIUM | Unit tests mock Resend |
| Quran/reading feature | Content | MEDIUM | Client + rule-based (blacklisted) |
| Themes, meta (Supabase) | Admin content | MEDIUM | Public routes + admin |
| i18n fr/en/ar/am | required breadth | MEDIUM | 4 locales |

### Differentiators (Existing)

| Feature | Value Proposition | Notes |
|---------|-------------------|-------|
| Dual-head API (Express + Worker) | Shared router duplicated across runtimes | Audit parity, don't redesign |
| GitHub-backed CMS | Low-friction content | Keep |
| Forge proxy + scan worker | Edge integration | Audit only |

### Anti-Features (NOT to build)

| Feature | Why Expected | Why Problematic | Alternative |
|---------|--------------|-----------------|-------------|
| New dashboards/CRUD for restaurants | "audit might need it" | Scope creep — audit is about fixing | Verify existing admin CRUD wiring |
| Full rewrite of tRPC monolith | "too big" | 7300 lines duplicated; rewrite is high-risk | Phase work: targeted refactors only if buggy |
| Real-time notifications | "modern" | Adds infra, no requirement | Poll API |

## Feature Dependencies

```
[Reservations API] ──requires──> [rbac/roles in trpc middleware]
                                                    └── requires ──> [Supabase auth]
[Email sends] ──requires──> [Resend] (mock in tests)
[QR token] ──requires──> [validation contract]  (BUG: contract mismatch)
```

## MVP Definition (for This Milestone)

### Launch With (Sync 1 — the bar user named)

- [x] Full test suite passes 132/132 (no skips)
- [ ] `pnpm typecheck` clean
- [ ] `pnpm build` green (vite client + esbuild server + wrangler worker)
- [ ] Hermetic tests: no live Supabase/Resend/Storage keys needed

### Add After Validation (optional follow-ups)

- [ ] Worker⇄server router parity check
- [ ] Admin module→route→DB wiring verification (21 admin feature modules)

### Future Consideration (out of scope unless explicitly requested)

- [ ] Schema consolidation MySQL→Supabase
- [ ] Real-time / new dashboards

## Feature Prioritization Matrix (for Roadmap)

| Task | Value | Effort | Priority |
|------|-------|--------|----------|
| Fix test suite 132 green | CRITICAL | MEDIUM | P0 |
| Typecheck clean + db builds | CRITICAL | LOW | P0 |
| Fix real bugs the tests reveal (qrcode contract, email subject, vi import) | HIGH | MEDIUM | P1 |
| Worker/server parity | PREVENTIVE | MEDIUM | P1 |
| Admin wiring verification (21 modules) | MEDIUM (consistency) | MEDIUM | P2 |
| .env committed secret hygiene | SECURITY | LOW | P1 (do with file cleanup) |

---
*Feature research for: audit milestone*
*Researched: 2026-08-08*