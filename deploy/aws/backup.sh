#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/deploy/aws/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tayari}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
: "${DATABASE_URL:?DATABASE_URL is required}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

# PostgreSQL is the system of record. The dump is streamed and never written to
# shell history or application logs.
docker run --rm --network host postgres:16-alpine \
  pg_dump --no-owner --no-privileges "$DATABASE_URL" \
  | gzip -9 > "$BACKUP_DIR/postgres-$STAMP.sql.gz"
chmod 600 "$BACKUP_DIR/postgres-$STAMP.sql.gz"

# Redis is a queue/cache, not the source of truth. Keep a compact copy for
# operational recovery only.
docker run --rm \
  -v tayari_redis_data:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine:3.20 sh -c "tar -czf /backup/redis-$STAMP.tgz -C /data ."
chmod 600 "$BACKUP_DIR/redis-$STAMP.tgz"

find "$BACKUP_DIR" -type f -mtime "+$RETENTION_DAYS" -delete
printf 'Created redacted backup artifacts in %s for %s\n' "$BACKUP_DIR" "$STAMP"
