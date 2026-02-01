#!/bin/bash
# Restore script for Supabase Database
# Usage: ./restore.sh <backup_filename>

set -e

if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup_filename>"
    exit 1
fi

# Resolve script directory and backups directory
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BACKUPS_DIR=$(realpath "$SCRIPT_DIR/../backups")

# Resolve candidate file path
BACKUP_CANDIDATE="$BACKUPS_DIR/$1"
# Check if file exists first (realpath might fail on non-existent files depending on impl)
if [ ! -f "$BACKUP_CANDIDATE" ]; then
    echo "Error: Backup file not found: $1"
    exit 1
fi

# Canonicalize path to check for traversal
RESOLVED_BACKUP=$(realpath "$BACKUP_CANDIDATE")

# Verify the resolved path starts with the trusted backups directory
# Use strict trailing slash comparison to prevent sibling directory bypass
BACKUPS_DIR_STRICT="${BACKUPS_DIR%/}/"
if [[ "$RESOLVED_BACKUP" != "$BACKUPS_DIR_STRICT"* ]]; then
    echo "Error: Access denied. File must be in backups directory."
    exit 1
fi

BACKUP_FILE="$RESOLVED_BACKUP"

CONTAINER_NAME="supabase-db"

echo "WARNING: This will overwrite the current database!"
read -p "Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo "Restoring from $BACKUP_FILE..."
cat "$BACKUP_FILE" | docker exec -i $CONTAINER_NAME psql -U postgres

echo "Restore completed successfully!"
