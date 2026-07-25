#!/usr/bin/env bash
# Tayari Postgres Nightly Backup & Rotation Script
# Rotates 7 daily backups + 4 weekly backups.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DAY_OF_WEEK=$(date +"%u") # 1..7 (Monday..Sunday)
DAILY_FILE="${BACKUP_DIR}/daily/tayari_backup_${TIMESTAMP}.sql.gz"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-tayari}"
DB_NAME="${DB_NAME:-tayari}"

echo "[backup] Starting pg_dump for database ${DB_NAME} on ${DB_HOST}:${DB_PORT}..."

if command -v pg_dump >/dev/null 2>&1; then
    PGPASSWORD="${PGPASSWORD:-tayari_dev}" pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -F p "${DB_NAME}" | gzip > "${DAILY_FILE}"
else
    echo "[backup] pg_dump not found locally. Running pg_dump inside postgres container..."
    docker exec tayari-postgres-1 pg_dump -U "${DB_USER}" "${DB_NAME}" 2>/dev/null | gzip > "${DAILY_FILE}" || \
    docker compose exec -T postgres pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${DAILY_FILE}"
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
