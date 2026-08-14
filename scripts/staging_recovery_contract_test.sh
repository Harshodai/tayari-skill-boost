#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

expect_status() {
  local expected="$1"
  shift
  local output status
  set +e
  output="$($@ 2>&1)"
  status=$?
  set -e
  if [[ "$status" -ne "$expected" ]]; then
    echo "expected exit $expected, got $status: $*" >&2
    echo "$output" >&2
    exit 1
  fi
}

# Restore is never allowed without an explicit throwaway-drill mode gate.
expect_status 2 bash scripts/restore-drill.sh

# A drill target sharing the configured production host+port is rejected before
# prompting or invoking pg_restore. The file is synthetic and never executed.
BACKUP_FILE="$(mktemp -t tayari-recovery-contract.XXXXXX)"
trap 'rm -f "$BACKUP_FILE"' EXIT
printf 'synthetic-not-a-database-dump\n' > "$BACKUP_FILE"
expect_status 2 env \
  BACKUP_DRILL_MODE=true \
  BACKUP_FILE="$BACKUP_FILE" \
  SUPABASE_DB_DRILL_HOST=localhost \
  SUPABASE_DB_DRILL_PORT=54329 \
  SUPABASE_DB_DRILL_USER=drill \
  SUPABASE_DB_DRILL_PASSWORD=synthetic \
  SUPABASE_DB_DRILL_NAME=throwaway \
  SUPABASE_DB_HOST=localhost \
  SUPABASE_DB_PORT=54329 \
  SUPABASE_DB_NAME=postgres \
  bash scripts/restore-drill.sh

# The source and restore databases must be different before pg_dump starts.
expect_status 2 env \
  DATABASE_URL=postgresql://source.example/db \
  RESTORE_DATABASE_URL=postgresql://source.example/db \
  bash scripts/backup-restore-smoke.sh

# Rollback requires explicit approval before any kubectl command can run.
expect_status 1 env ROLLBACK_APPROVED=false bash scripts/rollback.sh staging

# Promotion rejects mutable image references before contacting a cluster.
expect_status 1 env \
  DEPLOY_APPROVED=true \
  FRONTEND_IMAGE=registry.example/tayari-frontend:latest \
  GATEWAY_IMAGE=registry.example/tayari-gateway:latest \
  PYTHON_API_IMAGE=registry.example/tayari-python:latest \
  WORKER_IMAGE=registry.example/tayari-worker:latest \
  bash scripts/deploy-environment.sh staging

grep -q -- '--dry-run=server' scripts/deploy-environment.sh
grep -q 'RELEASE_ATTESTATION_VERIFIED' scripts/deploy-environment.sh
grep -q 'BACKUP_DRILL_MODE' scripts/restore-drill.sh
grep -q 'ROLLBACK_APPROVED' scripts/rollback.sh

echo "staging/recovery contract: PASS"
