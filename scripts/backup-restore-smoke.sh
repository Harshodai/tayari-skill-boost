#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required for the source database}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required and must point to a disposable restore database}"
BACKUP_FILE="${BACKUP_FILE:-$(mktemp -t tayari-backup.XXXXXX.dump)}"
KEEP_BACKUP="${KEEP_BACKUP:-false}"

if [[ "$DATABASE_URL" == "$RESTORE_DATABASE_URL" ]]; then
  echo "Refusing to restore over the source database; use a separate disposable target." >&2
  exit 2
fi

cleanup() {
  if [[ "$KEEP_BACKUP" != "true" ]]; then
    rm -f "$BACKUP_FILE"
  fi
}
trap cleanup EXIT

command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump is required" >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "pg_restore is required" >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "psql is required" >&2; exit 1; }

pg_dump --format=custom --no-owner --no-privileges --file "$BACKUP_FILE" "$DATABASE_URL"
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname "$RESTORE_DATABASE_URL" "$BACKUP_FILE"

psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc '
  SELECT CASE WHEN COUNT(*) = 13 THEN $$schema-ok$$ ELSE $$schema-incomplete$$ END
    FROM information_schema.tables
   WHERE table_schema = $$public$$
     AND table_name = ANY (ARRAY[
       $$application_approvals$$, $$submission_receipts$$, $$agent_questions$$,
       $$agent_runs$$, $$run_events$$, $$run_controls$$, $$delivery_ledger$$,
       $$tenants$$, $$cohorts$$, $$memberships$$, $$push_subscriptions$$,
       $$agent_tasks$$, $$agent_router_events$$
     ]);' | grep -qx schema-ok

echo "backup/restore smoke: PASS"
