#!/usr/bin/env bash
# Tayari Hosted-Path Backup (self-hosted Supabase Postgres)
#
# Wraps pg_dump for the self-hosted Supabase Postgres instance used by the
# hosted path. Produces a portable, custom-format dump in backups/ and
# prunes dumps older than BACKUP_RETENTION_DAYS (default 14).
#
# Connection details are read from env (NEVER hardcoded):
#   SUPABASE_DB_HOST     (default: localhost)
#   SUPABASE_DB_PORT     (default: 54329 — supabase-local host port mapping)
#   SUPABASE_DB_USER     (default: postgres)
#   SUPABASE_DB_PASSWORD (REQUIRED — no default, no secrets in this file)
#   SUPABASE_DB_NAME     (default: postgres)
#   BACKUP_RETENTION_DAYS (default: 14)
#
# See docs/operations/backup-and-recovery.md for RPO/RTO and the restore drill.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "${BACKUP_DIR}"

DB_HOST="${SUPABASE_DB_HOST:-localhost}"
DB_PORT="${SUPABASE_DB_PORT:-54329}"
DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

# REQUIRED — fail fast if the password is not supplied rather than hanging on
# a PGPASSWORD prompt or silently using an empty password.
: "${SUPABASE_DB_PASSWORD:?Set SUPABASE_DB_PASSWORD (see supabase-local/.env POSTGRES_PASSWORD)}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DUMP_FILE="${BACKUP_DIR}/tayari_hosted_${TIMESTAMP}.dump"

START_EPOCH=$(date +%s)
echo "[backup-hosted] START $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "[backup-hosted] target: ${DB_HOST}:${DB_PORT}/${DB_NAME} user=${DB_USER}"
echo "[backup-hosted] dump file: ${DUMP_FILE}"
echo "[backup-hosted] retention: ${RETENTION_DAYS} days"

if ! command -v pg_dump >/dev/null 2>&1; then
    echo "[backup-hosted] ERROR: pg_dump not found on PATH. Install postgresql-client or run inside the db container." >&2
    exit 2
fi

export PGPASSWORD="${SUPABASE_DB_PASSWORD}"

# --format=custom   : pg_restore-friendly binary dump (parallel-restore capable)
# --no-owner --no-acl: portable across environments (no role/OID dependencies)
if ! pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
        --format=custom --no-owner --no-acl \
        --file "${DUMP_FILE}" "${DB_NAME}"; then
    echo "[backup-hosted] ERROR: pg_dump failed." >&2
    rm -f "${DUMP_FILE}"
    unset PGPASSWORD
    exit 1
fi
unset PGPASSWORD

END_EPOCH=$(date +%s)
DUMP_SIZE=$(stat -f -z %z "${DUMP_FILE}" 2>/dev/null || stat -c %s "${DUMP_FILE}" 2>/dev/null || echo 0)
DUMP_SIZE_MB=$(( DUMP_SIZE / 1024 / 1024 ))
ELAPSED=$(( END_EPOCH - START_EPOCH ))

echo "[backup-hosted] END   $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "[backup-hosted] dump size: ${DUMP_SIZE_MB} MB (${DUMP_SIZE} bytes)"
echo "[backup-hosted] elapsed: ${ELAPSED}s"

# Prune dumps older than RETENTION_DAYS (only our custom-format files; leave
# scripts/backup.sh's .sql.gz files untouched).
echo "[backup-hosted] pruning tayari_hosted_*.dump older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -maxdepth 1 -type f -name "tayari_hosted_*.dump" -mtime "+${RETENTION_DAYS}" -delete

echo "[backup-hosted] OK"
exit 0