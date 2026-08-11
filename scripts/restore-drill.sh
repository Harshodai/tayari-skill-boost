#!/usr/bin/env bash
# Tayari Restore Drill — verify a backup actually restores.
#
# Restores the latest (or a specified) backup into a THROWAWAY database and
# verifies the key tables are present and queryable. NEVER run against
# production.
#
# Safety gate: refuses to run unless BACKUP_DRILL_MODE=true is exported.
# Also prompts the operator to confirm the target DB is a throwaway.
#
# Env:
#   BACKUP_DRILL_MODE           (REQUIRED = true — the safety gate)
#   SUPABASE_DB_HOST            (default: localhost)
#   SUPABASE_DB_PORT            (default: 54329 — point at a THROWAWAY DB)
#   SUPABASE_DB_USER            (default: postgres)
#   SUPABASE_DB_PASSWORD        (REQUIRED)
#   SUPABASE_DB_NAME            (default: postgres — point at a THROWAWAY DB)
#   BACKUP_DIR                  (default: ./backups)
#   BACKUP_FILE                 (optional: explicit .dump path; default = latest)
#
# Usage: BACKUP_DRILL_MODE=true ./scripts/restore-drill.sh [path/to/backup.dump]
#
# See docs/operations/backup-and-recovery.md for the full drill procedure.

set -euo pipefail

if [ "${BACKUP_DRILL_MODE:-}" != "true" ]; then
    echo "[restore-drill] REFUSING: BACKUP_DRILL_MODE is not 'true'." >&2
    echo "[restore-drill] This script restores a backup into a database and MUST NOT run against production." >&2
    echo "[restore-drill] Re-run with BACKUP_DRILL_MODE=true and point SUPABASE_DB_* at a THROWAWAY database." >&2
    exit 2
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_HOST="${SUPABASE_DB_HOST:-localhost}"
DB_PORT="${SUPABASE_DB_PORT:-54329}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
: "${SUPABASE_DB_PASSWORD:?Set SUPABASE_DB_PASSWORD (see supabase-local/.env POSTGRES_PASSWORD)}"

# Resolve target backup file: explicit arg > BACKUP_FILE env > latest in BACKUP_DIR.
BACKUP_FILE=""
for arg in "$@"; do
    case "$arg" in
        --*) ;;
        *) [ -z "${BACKUP_FILE}" ] && BACKUP_FILE="$arg" ;;
    esac
done
if [ -z "${BACKUP_FILE}" ]; then
    BACKUP_FILE="${BACKUP_FILE:-}"
    if [ -z "${BACKUP_FILE}" ]; then
        BACKUP_FILE=$(ls -1t "${BACKUP_DIR}"/tayari_hosted_*.dump 2>/dev/null | head -n1 || true)
    fi
fi

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
    echo "[restore-drill] ERROR: no backup file found." >&2
    echo "[restore-drill]        pass one as the first arg, or set BACKUP_FILE, or have a tayari_hosted_*.dump in ${BACKUP_DIR}/" >&2
    exit 1
fi

echo "[restore-drill] ==========================================================="
echo "[restore-drill] RESTORE DRILL — THROWAWAY DATABASE ONLY"
echo "[restore-drill] ==========================================================="
echo "[restore-drill] backup file: ${BACKUP_FILE}"
echo "[restore-drill] target DB  : ${DB_HOST}:${DB_PORT}/${DB_NAME} (user=${DB_USER})"
echo "[restore-drill]"
echo "[restore-drill] DANGER CHECK: the target database MUST be a throwaway."
echo "[restore-drill]   - It must NOT be the production database."
echo "[restore-drill]   - The restore will DROP and recreate tables (--clean --if-exists)."
echo "[restore-drill]"
printf "[restore-drill] Type the target DB name to confirm it is throwaway: "
read -r CONFIRM_NAME
if [ "${CONFIRM_NAME}" != "${DB_NAME}" ]; then
    echo "[restore-drill] REFUSING: confirmation did not match DB name '${DB_NAME}'." >&2
    exit 2
fi
echo "[restore-drill] Confirmed target is '${DB_NAME}'. Proceeding."
echo "[restore-drill]"

if ! command -v pg_restore >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
    echo "[restore-drill] ERROR: pg_restore and psql must both be on PATH." >&2
    exit 2
fi

START_EPOCH=$(date +%s)
echo "[restore-drill] START $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

export PGPASSWORD="${SUPABASE_DB_PASSWORD}"

# --clean --if-exists: drop existing objects before recreating (idempotent on a throwaway)
# --no-owner --no-acl : portable, no role/OID dependencies
if ! pg_restore --clean --if-exists --no-owner --no-acl \
        -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
        -d "${DB_NAME}" "${BACKUP_FILE}"; then
    echo "[restore-drill] ERROR: pg_restore failed." >&2
    unset PGPASSWORD
    exit 1
fi
echo "[restore-drill] pg_restore completed."

# Verification: count rows in the key tables. A query error returns "-1" and is
# treated as a failure (not a passing zero).
echo "[restore-drill] verifying key tables..."
KEY_TABLES=(profiles resumes saved_jobs submission_receipts)
FAIL=0
for t in "${KEY_TABLES[@]}"; do
    ROWS=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
        -t -A -c "SELECT COUNT(*) FROM public.${t};" 2>/dev/null || echo "-1")
    if [ "${ROWS}" = "-1" ]; then
        echo "[restore-drill]   FAIL  ${t}: query error (table missing or unreadable)"
        FAIL=1
    else
        echo "[restore-drill]   OK    ${t}: ${ROWS} rows"
    fi
done

unset PGPASSWORD

END_EPOCH=$(date +%s)
echo "[restore-drill] END   $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "[restore-drill] elapsed: $(( END_EPOCH - START_EPOCH ))s"

if [ "${FAIL}" -ne 0 ]; then
    echo "[restore-drill] RESULT: FAIL — one or more key tables did not restore cleanly." >&2
    exit 1
fi

echo "[restore-drill] RESULT: PASS — all key tables present and queryable."
exit 0