#!/usr/bin/env bash
set -euo pipefail

ROOT_JWT=$(grep -E '^JWT_SECRET=' .env | cut -d= -f2 | tr -d ' ')
SUPPABASE_JWT=$(grep -E '^JWT_SECRET=' supabase-local/.env | cut -d= -f2 | tr -d ' ')

if [ "$ROOT_JWT" != "$SUPPABASE_JWT" ]; then
  echo "ERROR: JWT_SECRET mismatch!"
  echo "  .env:      $ROOT_JWT"
  echo "  supabase-local/.env: $SUPPABASE_JWT"
  exit 1
fi

echo "OK: JWT_SECRET values match: $ROOT_JWT"
exit 0