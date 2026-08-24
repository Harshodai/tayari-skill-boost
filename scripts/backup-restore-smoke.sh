#!/usr/bin/env bash
set -euo pipefail

if [[ "${DRY_RUN:-false}" == "true" ]]; then
  echo "backup/restore plan: pg_dump source -> custom-format backup -> pg_restore disposable target"
  echo "backup/restore plan: source and restore endpoints must be distinct"
  echo "backup/restore plan: schema verification includes stripe_webhook_events"
  echo "backup/restore plan: no database mutation performed"
  exit 0
fi

: "${DATABASE_URL:?DATABASE_URL is required for the source database}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required and must point to a disposable restore database}"
BACKUP_FILE="${BACKUP_FILE:-$(mktemp -t tayari-backup.XXXXXX.dump)}"
RESTORE_LIST="${BACKUP_FILE}.list"
KEEP_BACKUP="${KEEP_BACKUP:-false}"

if [[ "$DATABASE_URL" == "$RESTORE_DATABASE_URL" ]]; then
  echo "Refusing to restore over the source database; use a separate disposable target." >&2
  exit 2
fi

cleanup() {
  if [[ "$KEEP_BACKUP" != "true" ]]; then
    rm -f "$BACKUP_FILE" "$RESTORE_LIST"
  fi
}
trap cleanup EXIT

command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump is required" >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "pg_restore is required" >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "psql is required" >&2; exit 1; }

# ---------------------------------------------------------------------------
# SCOPE DECLARATION
# This drill covers the public schema only. For the full recovery domain
# inventory (auth, storage, secrets, Redis, OAuth, release artifacts),
# see docs/recovery-inventory.md.
# ---------------------------------------------------------------------------
echo "SCOPE: This drill covers public schema only. See docs/recovery-inventory.md for full recovery domain inventory."

# ---------------------------------------------------------------------------
# KNOWN GAPS (domains intentionally outside this drill)
# These echo statements appear in the output so CI logs record the explicit
# acknowledgement that the PASS below is partial, not complete-service proof.
# ---------------------------------------------------------------------------
echo "KNOWN GAP: auth.users not in portable dump — Supabase managed (auth.* schemas excluded by --schema=public)"
echo "KNOWN GAP: auth.sessions / auth.refresh_tokens / auth.identities not in portable dump — Supabase managed"
echo "KNOWN GAP: storage.objects (uploaded resumes/files) not in portable dump — object storage is not a SQL schema"
echo "KNOWN GAP: Redis/Celery queue state not in portable dump — not a PostgreSQL domain"
echo "KNOWN GAP: Secrets/env config not verified — must be re-injected from operator secret store after restore"
echo "KNOWN GAP: OAuth client registrations not verified — provider config lives outside this database"
echo "KNOWN GAP: Stripe webhook endpoint config not verified — Stripe-side configuration not in dump"

# Back up only the application schema. Supabase-managed schemas such as
# realtime/auth/storage contain extension-owned functions that are not portable
# into a disposable restore database under the application database owner.
pg_dump --format=custom --schema=public --no-owner --no-privileges --file "$BACKUP_FILE" "$DATABASE_URL"
# Public application tables reference Supabase Auth. The restore target must
# already contain that managed dependency; this drill must not fabricate it.
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc \
  "SELECT CASE WHEN to_regclass('auth.users') IS NOT NULL THEN 'auth-ok' ELSE 'auth-missing' END" \
  | grep -qx auth-ok

# Restore targets must provide the same application-level types/functions as
# the source. Fail closed if the target image does not ship these extensions.
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto' -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm' -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"' -c 'CREATE EXTENSION IF NOT EXISTS vector'

# The restore target is explicitly disposable. Avoid --clean here: pg_restore
# emits DROP POLICY ... ON table statements before recreating the table, and
# PostgreSQL rejects those statements when the fresh target does not have the
# relation yet. Recreate the disposable database instead of restoring over it.
pg_restore --list "$BACKUP_FILE" \
  | sed -E '/SCHEMA - public /d; /COMMENT - SCHEMA public/d' > "$RESTORE_LIST"
pg_restore --use-list="$RESTORE_LIST" --no-owner --no-privileges --exit-on-error \
  --dbname "$RESTORE_DATABASE_URL" "$BACKUP_FILE"

psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc '
  SELECT CASE WHEN COUNT(*) = 14 THEN $$schema-ok$$ ELSE $$schema-incomplete$$ END
    FROM information_schema.tables
   WHERE table_schema = $$public$$
     AND table_name = ANY (ARRAY[
       $$application_approvals$$, $$submission_receipts$$, $$agent_questions$$,
       $$agent_runs$$, $$run_events$$, $$run_controls$$, $$delivery_ledger$$,
       $$tenants$$, $$cohorts$$, $$memberships$$, $$push_subscriptions$$,
       $$agent_tasks$$, $$agent_router_events$$, $$stripe_webhook_events$$
     ]);' | grep -qx schema-ok

# RLS verification: confirm that Row Level Security policies were restored.
# A fresh restore of the public schema must include all RLS policies that were
# present in the source; a count of zero indicates the dump was missing policy
# definitions or pg_restore failed to replay them.
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc \
  "SELECT CASE WHEN COUNT(*) > 0 THEN 'rls-ok' ELSE 'rls-missing' END FROM pg_policies WHERE schemaname = 'public'" \
  | grep -qx rls-ok

echo "backup/restore smoke: PASS"
