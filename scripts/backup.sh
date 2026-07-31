#!/usr/bin/env bash
# Tayari Postgres Nightly Backup & Rotation Script
# Rotates 7 daily backups + 4 weekly backups.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DAY_OF_WEEK=$(date +"%u") # 1..7 (Monday..Sunday)
DAILY_FILE="${BACKUP_DIR}/daily/tayari_backup_${TIMESTAMP}.sql.gz"

# Database is Supabase's Postgres (supabase-local/, service "db", container
# "supabase-db") -- not a standalone "postgres" service/container, and not
# "tayari"/"tayari_dev". User/database are always "postgres" (Supabase's own
# fixed convention); DB_PORT is the host port supabase-local/docker-compose.yml
# maps db's 5432 to (SUPABASE_DB_PORT in supabase-local/.env, default 54329).
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-54329}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

echo "[backup] Starting pg_dump for database ${DB_NAME} on ${DB_HOST}:${DB_PORT}..."

if command -v pg_dump >/dev/null 2>&1; then
    PGPASSWORD="${PGPASSWORD:?Set PGPASSWORD to the db POSTGRES_PASSWORD (see supabase-local/.env)}" pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -F p "${DB_NAME}" | gzip > "${DAILY_FILE}"
else
    echo "[backup] pg_dump not found locally. Running pg_dump inside the Supabase db container..."
    docker exec supabase-db pg_dump -U "${DB_USER}" "${DB_NAME}" 2>/dev/null | gzip > "${DAILY_FILE}" || \
    docker compose exec -T db pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${DAILY_FILE}"
fi

echo "[backup] Daily backup created: ${DAILY_FILE}"

# Sunday weekly backup snapshot
if [ "${DAY_OF_WEEK}" -eq 7 ]; then
    WEEKLY_FILE="${BACKUP_DIR}/weekly/tayari_weekly_${TIMESTAMP}.sql.gz"
    cp "${DAILY_FILE}" "${WEEKLY_FILE}"
    echo "[backup] Weekly snapshot created: ${WEEKLY_FILE}"
fi

# Prune daily backups older than 7 days
echo "[backup] Pruning daily backups older than 7 days..."
find "${BACKUP_DIR}/daily" -type f -name "tayari_backup_*.sql.gz" -mtime +7 -delete

# Prune weekly backups older than 28 days (4 weeks)
echo "[backup] Pruning weekly backups older than 28 days..."
find "${BACKUP_DIR}/weekly" -type f -name "tayari_weekly_*.sql.gz" -mtime +28 -delete

echo "[backup] Backup and retention cycle completed successfully."
