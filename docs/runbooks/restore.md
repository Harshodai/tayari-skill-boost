# Runbook: Database Backup & Restore Procedures

## Overview
This runbook documents the automated database backup, validation, and disaster recovery procedures for Tayari Skill Boost PostgreSQL instances — Supabase's Postgres (self-hosted stack in `supabase-local/`, compose service `db`, container `supabase-db`), reached at `localhost:${SUPABASE_DB_PORT:-54329}` as user/database `postgres`. `scripts/backup.sh`/`scripts/restore.sh` fall back to `docker compose exec -T db` if `pg_dump`/`psql` aren't installed locally.

---

## 1. Automated Nightly Backups

Backups are executed via `scripts/backup.sh` and stored in `./backups/`:
- `daily/`: Kept for 7 days.
- `weekly/`: Snapshot taken every Sunday, kept for 28 days (4 weeks).

### Running a Manual Backup
```bash
bash scripts/backup.sh
```

---

## 2. Restoration Procedure

> [!CAUTION]
> Restoring a backup overwrites the target database state. Follow all prerequisite checks before running a destructive restore in production.

### Operator Variable Definition
Set the target backup archive path once for use in all subsequent commands:
```bash
BACKUP_FILE="./backups/daily/<TARGET_BACKUP_FILE>.sql.gz"
```

### Prerequisite Checks (Mandatory Before Destructive Restore)
1. **Write Quiescence**: Stop backend API write traffic AND Supabase's own write-capable
   services — a DB restore is not safe with GoTrue still writing to `auth.users` on every
   login/signup, or PostgREST/Storage still accepting authenticated writes:
   ```bash
   docker compose stop go-backend python-ai celery-worker celery-beat auth rest storage
   ```
2. **Fresh Pre-Restore Backup**: Take an immediate safety snapshot before importing:
   ```bash
   bash scripts/backup.sh
   ```
3. **Backup Checksum & Integrity Validation**:
   ```bash
   gzip -t "${BACKUP_FILE}"
   ```
4. **Database Version Compatibility Check**: Record the backup's source PostgreSQL major version and compare it with the target server's major version obtained via `psql -c "SELECT version();"` to ensure major version compatibility before import; use `pg_isready` only for server readiness checks.

### Dry-Run Verification
`scripts/restore.sh --dry-run` automatically validates backup file existence, gzip integrity, and database connectivity:
```bash
bash scripts/restore.sh "${BACKUP_FILE}" --dry-run
```

### Full Database Restore
`scripts/restore.sh` executes the import inside a PostgreSQL single transaction (`--single-transaction`) to prevent partial restores, and prompts for explicit interactive confirmation (or `--force`):
```bash
bash scripts/restore.sh "${BACKUP_FILE}"
```

---

## 3. Rollback Procedure
If the restored database fails application validation or contains corrupted state:
1. Quiesce application AND Supabase write-capable services (`docker compose stop go-backend python-ai celery-worker celery-beat auth rest storage`).
2. Locate the pre-restore safety backup created in Prerequisite Step 2 under `./backups/daily/`:
   ```bash
   SAFETY_BACKUP="./backups/daily/<PRE_RESTORE_SAFETY_SNAPSHOT>.sql.gz"
   ```
3. Restore the pre-restore safety snapshot in single-transaction mode:
   ```bash
   bash scripts/restore.sh "${SAFETY_BACKUP}" --force
   ```
4. Restart application AND Supabase write-capable services (`docker compose start go-backend python-ai celery-worker celery-beat auth rest storage`).
5. Verify health endpoints (`curl http://localhost:${GO_BACKEND_PORT:-8085}/api/health` — substitute your configured port if you overrode `GO_BACKEND_PORT` in `.env`).

---

## 4. Disaster Recovery & Emergency Contacts
- **Sentry Alerts**: Check Sentry dashboard if DB connection errors spike post-restore.
- **Support Contact**: Escalation path via internal infrastructure team.
