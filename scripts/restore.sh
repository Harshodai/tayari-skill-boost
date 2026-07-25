#!/usr/bin/env bash
# Tayari Postgres Database Restore Script
# Usage: ./scripts/restore.sh <path_to_backup.sql.gz> [--dry-run] [--force]

set -euo pipefail

DRY_RUN=false
FORCE=false
BACKUP_FILE=""

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            ;;
        --force)
            FORCE=true
            ;;
        *)
            if [ -z "${BACKUP_FILE}" ] && [[ "$arg" != --* ]]; then
                BACKUP_FILE="$arg"
            fi
            ;;
    esac
done

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-tayari}"
DB_NAME="${DB_NAME:-tayari}"

if [ "${DRY_RUN}" = "true" ]; then
    echo "[restore] DRY-RUN MODE: Verifying script syntax and backup restoration prerequisites."
    TARGET_FILE="${BACKUP_FILE:-latest_backup.sql.gz}"
    echo "[restore] Backup file target: ${TARGET_FILE}"
    echo "[restore] Target DB host: ${DB_HOST}:${DB_PORT}, database: ${DB_NAME}"

    if [ ! -f "${TARGET_FILE}" ]; then
        echo "[restore] ERROR: Backup file '${TARGET_FILE}' does not exist." >&2
        exit 1
    fi

    if ! gzip -t "${TARGET_FILE}" 2>/dev/null; then
        echo "[restore] ERROR: Backup file '${TARGET_FILE}' is not a valid gzip archive." >&2
        exit 1
    fi

    echo "[restore] Checking database connectivity..."
    if command -v psql >/dev/null 2>&1; then
        if ! PGPASSWORD="${PGPASSWORD:-tayari_dev}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" >/dev/null 2>&1; then
            echo "[restore] ERROR: Target database is not reachable at ${DB_HOST}:${DB_PORT}." >&2
            exit 1
        fi
    else
        echo "[restore] psql not found locally. Checking connectivity via docker compose exec..."
        if ! docker compose exec -T postgres psql -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" >/dev/null 2>&1; then
            echo "[restore] ERROR: Target database is not reachable via docker compose container postgres." >&2
            exit 1
        fi
    fi

    echo "[restore] Dry-run check PASSED. Restore command would execute: gunzip -c ${TARGET_FILE} | psql --single-transaction -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME}"
    exit 0
fi

if [ -z "${BACKUP_FILE}" ]; then
    echo "Error: Backup file path required." >&2
    echo "Usage: $0 <path_to_backup.sql.gz> [--dry-run] [--force]" >&2
    exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file '${BACKUP_FILE}' does not exist." >&2
    exit 1
fi

if ! gzip -t "${BACKUP_FILE}" 2>/dev/null; then
    echo "Error: Backup file '${BACKUP_FILE}' is not a valid gzip archive." >&2
    exit 1
fi

if [ "${FORCE}" != "true" ]; then
    echo "WARNING: Restoring database '${DB_NAME}' from '${BACKUP_FILE}' will overwrite existing data."
    confirm=""
    read -r -p "Type 'yes' to proceed: " confirm || confirm=""
    if [ "${confirm}" != "yes" ]; then
        echo "Restore cancelled by user."
        exit 1
    fi
fi

echo "[restore] CAUTION: Restoring database ${DB_NAME} from ${BACKUP_FILE} in single-transaction mode..."

if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="${PGPASSWORD:-tayari_dev}" gunzip -c "${BACKUP_FILE}" | psql --single-transaction -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"
else
    echo "[restore] psql not found locally. Importing via docker compose..."
    gunzip -c "${BACKUP_FILE}" | docker compose exec -T postgres psql --single-transaction -U "${DB_USER}" -d "${DB_NAME}"
fi

echo "[restore] Database restore completed successfully."
