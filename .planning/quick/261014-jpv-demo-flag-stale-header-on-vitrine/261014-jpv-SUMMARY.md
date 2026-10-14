---
status: complete
---
# 261014-jpv: stale demo flag breaks public vitrine

**Cause:** `localStorage.ftour_demo_access` is set by `/demo-access` and never cleared. `client/src/main.tsx` then sends `x-demo-access: 1` on every tRPC call; worker CORS only allows `Content-Type, Authorization` and the demo guard blocks real data, so the vitrine rendered empty in that browser (private window worked).

**Fix:** `isDemoAccessEnabled()` (client/src/_core/demoAccess.ts) is true only on `/demo*` and `/admin*` paths.

**Verified:** typecheck (21 errors) and tests (27 failed / 447 passed) identical to baseline without the change; no new errors. Pre-existing failures belong to the audit milestone.
