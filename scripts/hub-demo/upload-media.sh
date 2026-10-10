#!/usr/bin/env bash
# Uploads every demo image (scripts/hub-demo/media/*.jpg|png|webp) to the PRODUCTION R2 bucket as private/hub/demo/<name>.
# Idempotent (overwrites). Usage: bash scripts/hub-demo/upload-media.sh
# Remove them later: bash scripts/hub-demo/upload-media.sh --delete
set -euo pipefail
cd "$(dirname "$0")/../.."
BUCKET="ftour-bab-rayan-prod-media"
mode="put"; [ "${1:-}" = "--delete" ] && mode="delete"
shopt -s nullglob
n=0
for f in scripts/hub-demo/media/*.jpg scripts/hub-demo/media/*.jpeg scripts/hub-demo/media/*.png scripts/hub-demo/media/*.webp; do
  name="$(basename "$f")"
  case "$name" in *.jpg|*.jpeg) ct="image/jpeg" ;; *.png) ct="image/png" ;; *) ct="image/webp" ;; esac
  if [ "$mode" = "put" ]; then
    npx wrangler r2 object put "$BUCKET/private/hub/demo/$name" --file "$f" --content-type "$ct" --remote >/dev/null
  else
    npx wrangler r2 object delete "$BUCKET/private/hub/demo/$name" --remote >/dev/null
  fi
  n=$((n+1)); echo "$mode $name"
done
echo "$n image(s) $mode done"
