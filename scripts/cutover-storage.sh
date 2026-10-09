#!/bin/sh
# Moves Supabase Storage to R2, fail-fast. Run from the repo root.
# Rollback (new uploads go back to Supabase; already-rewritten /media URLs keep working):  wrangler deploy --var R2_BUCKETS:none
set -eu
ENV="node --env-file=.env.local"
echo "== 1/6 copy objects Supabase -> R2";           $ENV scripts/migrate-storage-to-r2.mjs prod
echo "== 2/6 deploy routes (buckets still on Supabase)"; pnpm build:cloudflare >/dev/null; wrangler deploy
echo "== 3/6 every object reachable via /media";     $ENV scripts/check-media-urls.mjs
echo "== 4/6 rewrite stored URLs in D1";             $ENV scripts/rewrite-storage-urls.mjs prod --apply
echo "== 5/6 serve uploads from R2";
node -e '
const fs=require("fs"),p="worker/d1-tables.ts";let s=fs.readFileSync(p,"utf8");
s=s.replace(/export const R2_BUCKETS: string\[\] = \[[^\]]*\];/,"export const R2_BUCKETS: string[] = [\"images\", \"manager-candidates\", \"product-images\", \"reservation-payment-proofs\", \"member-card-proofs\"];");
fs.writeFileSync(p,s)'
npx vitest run worker/media-r2.test.ts
pnpm build:cloudflare >/dev/null; wrangler deploy
echo "== 6/6 re-check after deploy";                 $ENV scripts/check-media-urls.mjs
git add worker/d1-tables.ts && git commit -q -m "feat(storage): serve uploads from R2" && echo "committed d1-tables.ts"
