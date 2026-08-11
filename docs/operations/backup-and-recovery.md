# Backup & Recovery — Job Tayari

This runbook documents the backup/DR posture for the hosted path (self-hosted
Supabase Postgres under `supabase-local/`). For the self-host path, the same
mechanism applies; the existing `scripts/backup.sh` is the legacy rotation
script and remains for backward compatibility.

## RPO / RTO Targets

| Target | Value | Mechanism | Status |
| --- | --- | --- | --- |
| **RPO** (how much data we can lose) | 24 hours | Daily `pg_dump` via `scripts/backup-hosted.sh` | Configured |
| **RPO** (stretch, not yet wired) | < 1 hour | Supabase managed PITR / `pg_repack`-style WAL replay | **Not configured** — see "Open work" below |
| **RTO** (how long to restore) | 2 hours | `pg_restore` + verification drill | Documented below |

The 24h RPO reflects reality: one daily logical dump. Managed PITR would give
sub-hour RPO but is not currently enabled on the hosted Supabase stack — see
the pre-launch checklist.

## Backup Mechanism

- **Script:** `scripts/backup-hosted.sh`
- **Format:** `pg_dump --format=custom --no-owner --no-acl` → portable binary
  dump (`.dump`), restorable via `pg_restore`.
- **Frequency:** daily (cron / scheduled CI — not yet wired into compose; run
  from the host or a scheduled job).
- **Retention:** 14 days (`BACKUP_RETENTION_DAYS` env, default 14).
- **Location:** `backups/` (gitignored — real user data, never committed).
- **Credentials:** read from env (`SUPABASE_DB_*`), never hardcoded. The
  password comes from `supabase-local/.env`'s `POSTGRES_PASSWORD`.

### Running a backup

```bash
# From the repo root, with supabase-local/.env sourced or env vars exported:
export SUPABASE_DB_PASSWORD='...'   # = supabase-local/.env POSTGRES_PASSWORD
./scripts/backup-hosted.sh
```

Defaults: `SUPABASE_DB_HOST=localhost`, `SUPABASE_DB_PORT=54329`
(the host port `supabase-local/docker-compose.yml` maps the `db` service's
5432 to — see `SUPABASE_DB_PORT` in `supabase-local/.env`), `SUPABASE_DB_USER=postgres`,
`SUPABASE_DB_NAME=postgres`.

## Restore Procedure

### Drill (against a THROWAWAY database)

The drill restores the latest backup into a throwaway DB and verifies the key
tables (`profiles`, `resumes`, `saved_jobs`, `submission_receipts`) are present
and queryable.

The drill **requires a dedicated throwaway endpoint** via the
`SUPABASE_DB_DRILL_*` env namespace (host/port/user/password/name). The generic
`SUPABASE_DB_*` vars are production config — the script only uses them to
reject a drill target that matches the production endpoint (`host:port`), and
it refuses to run if the `SUPABASE_DB_DRILL_*` vars are missing.

```bash
# 1. Stand up a throwaway Postgres (NOT the production db). e.g. a fresh
#    docker container on a different host port:
#    docker run --rm -d --name tayari-drill-db \
#      -e POSTGRES_PASSWORD=drillpw -p 54330:5432 postgres:15
#    export SUPABASE_DB_DRILL_HOST=localhost SUPABASE_DB_DRILL_PORT=54330 \
#      SUPABASE_DB_DRILL_USER=postgres SUPABASE_DB_DRILL_PASSWORD=drillpw \
#      SUPABASE_DB_DRILL_NAME=postgres

# 2. Run the drill (the safety gates refuse without this env):
BACKUP_DRILL_MODE=true ./scripts/restore-drill.sh
```

The script:
1. Refuses unless `BACKUP_DRILL_MODE=true`.
2. Requires the `SUPABASE_DB_DRILL_*` throwaway endpoint — exits with an error
   listing them if any are missing (never falls back to `SUPABASE_DB_*`).
3. Rejects a drill target matching the configured production endpoint
   (`SUPABASE_DB_HOST`/`SUPABASE_DB_PORT`, defaults `localhost`/`54329`) before
   the prompt or any restore — exits 2 with a REFUSING message.
4. Prompts the operator to type the target DB name — a last-line defense
   against pointing at production.
5. `pg_restore --clean --if-exists --no-owner --no-acl` against the target.
6. Counts rows in each key table. A query error (table missing/unreadable)
   returns `-1` and fails the drill.
7. Exits 0 only if every key table is queryable (count >= 0).

### Real restore (against production)

> Only after a drill has passed on the same backup file.

1. **Stop the app** so no writes race the restore:
   `docker compose stop frontend go-api python-ai celery-worker celery-beat`
   (keep the `db` service running).
2. **Drop and recreate** the production database (or restore into a fresh DB
   and repoint the app):
   ```bash
   psql -h localhost -p 54329 -U postgres -d postgres -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   ```
3. **Restore** the chosen `.dump`:
   ```bash
   pg_restore --clean --if-exists --no-owner --no-acl \
     -h localhost -p 54329 -U postgres -d postgres backups/tayari_hosted_YYYYMMDD_HHMMSS.dump
   ```
4. **Verify** with the same key-table counts:
   ```bash
   for t in profiles resumes saved_jobs submission_receipts; do
     psql -h localhost -p 54329 -U postgres -d postgres -t -A -c "SELECT COUNT(*) FROM public.${t};"
   done
   ```
5. **Restart the app**: `docker compose --profile dev up -d`.

## Pre-launch checklist

- [ ] **Run one live restore drill before launch.** Document the result here:
      - `____-__-__` — `__________________________` (drill result + who ran it)
- [ ] Wire `scripts/backup-hosted.sh` into a daily cron / scheduled CI job.
- [ ] Decide whether managed PITR is required for launch (sub-hour RPO) or if
      the 24h RPO is acceptable for the first 90 days.
- [ ] Copy the latest `.dump` off-host (S3 / cold storage) — the current
      `backups/` dir is on the same host as the DB; a host loss loses both.

## Open work (not blocking launch, but tracked)

- Managed PITR for sub-hour RPO (Supabase Pro has PITR; self-hosted needs WAL
  archiving to object storage — not configured).
- Off-host backup copy (object storage, encrypted).
- Automated daily schedule for `scripts/backup-hosted.sh` (cron / CI cron).

## Escalation — when a restore fails

1. **Do not retry blind.** Capture the exact `pg_restore` stderr and the
   failing key-table query, and stop.
2. **On-call engineer** (see team contact list — populate before launch):
   - Primary: `__________________________`
   - Secondary: `__________________________`
3. **If the backup file itself is suspect** (the backup is a `pg_restore` custom archive, not gzip — `pg_restore --list backups/tayari_hosted_YYYYMMDD_HHMMSS.dump` is only a fast custom-archive *format precheck*, not an integrity check: a successful `--list` confirms the file is a readable custom archive but does NOT prove the dump restores cleanly). Before selecting the candidate dump for production, run a **full restore drill of that exact dump** into the throwaway endpoint (`BACKUP_DRILL_MODE=true ./scripts/restore-drill.sh <candidate.dump>`) and require it to PASS the key-table verification. If the candidate dump fails the drill, fall back to the previous day's dump and apply the **same full-drill validation** to it before selecting it. If both candidates fail their drills, escalate to the DB owner and page the primary on-call.
4. **If the drill passes but production restore fails**, the difference is
   almost always a role/ownership mismatch on the production DB — re-run
   `pg_restore` with `--no-owner --no-acl` (already in the script) and check
   that the connecting user owns the `public` schema.