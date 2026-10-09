#!/bin/sh
# Cuts a wave of tables over from Supabase to Cloudflare D1, fail-fast. Run from the repo root:
#   scripts/cutover.sh B     # inventory, feedback, testimonials, partners
#   scripts/cutover.sh C     # calendar, volunteers, restaurants, reservations   (Ramadan-critical)
# Rollback (no code change, reads go back to Supabase):  wrangler deploy --var D1_TABLES:none
# NOTE: rows written to D1 after the cutover are NOT in Supabase; rolling back loses them unless copied back.
set -eu
DB=ftour-bab-rayan-prod-db
case "${1:-}" in
  B) TABLES=inventory_products,inventory_locations,inventory_events,inventory_stock_balances,inventory_movements,feedback_responses,testimonials,partners ;;
  # volunteers BEFORE ramadan_days: the volunteer trigger bumps registered_count, the last copy of ramadan_days then restores Supabase's exact value
  C) TABLES=restaurants,restaurant_reservations,reservations,reservation_payment_tokens,reservation_payment_proofs,reservation_checkins,reservation_events,volunteers,volunteer_group_requests,checkins,ramadan_config,ramadan_daily_stats,ramadan_days ;;
  *) echo "usage: scripts/cutover.sh <B|C>"; exit 1 ;;
esac
ENV="node --env-file=.env.local"

echo "== 1/7 baseline of public endpoints";           scripts/smoke-endpoints.sh before
echo "== 2/7 schema (idempotent)";                     wrangler d1 execute $DB --remote --file worker/d1/schema.generated.sql >/dev/null
echo "== 3/7 copy Supabase -> D1";                     $ENV scripts/copy-supabase-to-d1.mjs prod "$TABLES"
echo "== 4/7 parity (keys) + contents";                $ENV scripts/copy-supabase-to-d1.mjs prod "$TABLES" --check
                                                       $ENV scripts/compare-supabase-d1.mjs prod "$TABLES"
echo "== 5/7 triggers (idempotent)";                   wrangler d1 execute $DB --remote --file worker/d1/logic.sql >/dev/null
echo "== 6/7 enable tables in worker/d1-tables.ts, test, build, deploy"
node -e '
const fs=require("fs"),p="worker/d1-tables.ts";let s=fs.readFileSync(p,"utf8");
const add=process.argv[1].split(",").filter(t=>!s.includes(`"${t}"`));
if(add.length)s=s.replace(/(export const D1_TABLES: string\[\] = \[[\s\S]*?)\n\];/,`$1\n  // wave '"$1"'\n  ${add.map(t=>`"${t}"`).join(", ")},\n];`);
fs.writeFileSync(p,s)' "$TABLES"
npx vitest run worker/d1-postgrest.test.ts worker/inventory-d1.test.ts
pnpm build:cloudflare >/dev/null
wrangler deploy
echo "== 7/7 endpoints after (all must be SAME)";      scripts/smoke-endpoints.sh after
git add worker/d1-tables.ts && git commit -q -m "feat(worker): serve wave $1 tables from D1" && echo "committed d1-tables.ts"
