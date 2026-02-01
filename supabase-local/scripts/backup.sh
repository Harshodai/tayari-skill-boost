#!/bin/bash
# Backup script for Supabase Database
# Usage: ./backup.sh [output_filename]

set -e

# Load environment variables

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/../.env"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE=${1:-"backup_${TIMESTAMP}.sql"}
BACKUP_DIR="../backups"

mkdir -p $BACKUP_DIR

echo "Starting backup of Tayari Skill Boost database..."
echo "Target: $BACKUP_DIR/$OUTPUT_FILE"

# check if we are running the backend-go connected to postgres (standalone) or supabase-db
# We will target supabase-db as it relies on proper pg_dump
# We use docker exec to dump from the running container

CONTAINER_NAME="supabase-db"

if [ "$(docker ps -q -f name="$CONTAINER_NAME")" ]; then
    echo "Dumping from container $CONTAINER_NAME..."
    docker exec -T "$CONTAINER_NAME" pg_dumpall -c -U postgres > "$BACKUP_DIR/$OUTPUT_FILE"
    echo "Backup completed successfully!"
    ls -lh "$BACKUP_DIR/$OUTPUT_FILE"
else
    echo "Error: Container $CONTAINER_NAME is not running."
    exit 1
fi
