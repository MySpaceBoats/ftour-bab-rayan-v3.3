#!/bin/sh
# Usage: scripts/smoke-endpoints.sh <before|after>  — stores public tRPC responses in $TMPDIR/snap, prints diff when run with "after"
U=${WORKER_URL:-https://ftour-bab-rayan-v2.reda-sebbani-43b.workers.dev}
D=${TMPDIR:-/tmp}/snap; mkdir -p "$D"
for ep in public.goodies goodies.list pastries.list terroirModule.listProducts public.stats; do
  curl -s "$U/api/trpc/$ep" > "$D/$1-$ep.json"
  if [ "$1" = after ]; then cmp -s "$D/before-$ep.json" "$D/after-$ep.json" && echo "SAME $ep" || echo "DIFF $ep: $(head -c 200 "$D/after-$ep.json")"; fi
done
