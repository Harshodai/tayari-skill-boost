# Tayari Deployment Guide

## Local Development (Docker Compose)

```bash
# 1. Set up environment — TWO .env files, one per compose project merged
#    via `include:`. POSTGRES_PASSWORD and JWT_SECRET must be IDENTICAL
#    across both (see the header comment in .env.example for why).
cp .env.example .env
cp supabase-local/.env.example supabase-local/.env
# Edit both with matching secrets, plus your API keys in the root .env

# 2. Start all services (--profile is required — every service declares one;
#    a bare `docker compose up -d` starts zero containers, silently). This
#    also brings up the full self-hosted Supabase stack (Postgres, Auth,
#    PostgREST, Kong, Realtime, Storage, Studio) from supabase-local/.
docker compose --profile dev up -d --build

# 3. Check health (host ports, not the containers' internal ports)
curl http://localhost:8085/api/health
curl http://localhost:8002/health

# 4. Open frontend
open http://localhost:8083
```

## Production Deployment (Railway / Render / Fly.io)

### Database: pick one

- **Supabase Cloud (recommended for prod)** — create a project at
  supabase.com, get its `DATABASE_URL`/`JWT_SECRET`/anon key from Settings →
  API, run the schema from `backend/db/` against it (`init.sql` with the
  `auth` schema block removed — Supabase already provides real
  `auth.users`/`auth.uid()` — then `mvp_additions.sql`, then every file in
  `backend/db/migrations/` in order; `supabase-local/volumes/db/init/`
  already has this pre-assembled if you'd rather copy from there). Set
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_URL`/
  `SUPABASE_ANON_KEY`/`JWT_SECRET` to the real project's values. Managed
  backups/PITR — see the section below.
- **Self-hosted Supabase (`supabase-local/`)** — deploy the whole stack
  (Postgres, GoTrue, PostgREST, Kong, Realtime, Storage, Studio) as a unit.
  This is 9 extra services beyond Go/Python/frontend — heavier than most
  PaaS free/hobby tiers comfortably run; a VM or Kubernetes cluster running
  `docker compose -f docker-compose.yml -f supabase-local/docker-compose.yml`
  (or Railway/Render's Docker Compose support, where available) is the
  realistic path, not a from-scratch service-by-service PaaS setup.

Either way, `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`, and
`SUPABASE_ANON_KEY` must all point at the *same* Postgres/Supabase instance.

### Backend (Go + Python)

**Railway:**
1. Create new project
2. Point `DATABASE_URL` at your chosen Postgres (above)
3. Add Python AI service (Dockerfile.ai)
4. Add Go service (Dockerfile.backend)
5. Set environment variables from .env

**Render:**
1. Create Web Service for Python AI (Dockerfile.ai)
2. Create Web Service for Go backend (Dockerfile.backend)
3. Point `DATABASE_URL` at your chosen Postgres (above)
4. Set environment variables

**Fly.io:**
```bash
fly launch --dockerfile Dockerfile.backend
fly launch --dockerfile Dockerfile.ai
# Use a Supabase Cloud project, or `fly postgres create` + self-host GoTrue/
# PostgREST/Kong separately if you need the full Supabase feature set on Fly.
```

### Frontend (Vercel / Netlify / Cloudflare Pages)

```bash
# Build locally
bun run build

# Deploy to Vercel
vercel --prod

# Or Netlify
netlify deploy --prod --dir=dist
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase's Postgres — self-hosted `supabase-local/` or Supabase Cloud) |
| `JWT_SECRET` | Yes | Must exactly match the Supabase/GoTrue instance's JWT secret — a mismatch makes every login look like an invalid token, not an obviously-wrong-secret error |
| `LLM_PROVIDER` | No | `openrouter` \| `nvidia_nim` \| `ollama` \| (auto-detect) |
| `LLM_API_KEY` | If LLM_PROVIDER set | Generic API key fallback |
| `OPENROUTER_API_KEY` | If using OpenRouter | OpenRouter-specific key |
| `NVIDIA_NIM_API_KEY` | If using NIM | NVIDIA NIM-specific key |
| `LLM_BASE_URL` | If self-hosted LLM | Ollama or vLLM base URL |
| `AI_SERVICE_URL` | Yes | Python AI backend URL (e.g. `http://python-ai:8000` — the Docker-internal port; 8002 is only the host-mapped port) |
| `STRIPE_SECRET_KEY` | If billing enabled | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | If billing enabled | Stripe webhook signing secret |
| `BILLING_ENABLED` | No | `true` to enable Stripe billing (default: `false`) |
| `FLOWER_USER` | Required to run celery-flower | Celery Flower dashboard username — no default, compose fails closed if unset |
| `FLOWER_PASSWORD` | Required to run celery-flower | Celery Flower dashboard password — no default, compose fails closed if unset |
| `PORT` | No | Server port (default 8085) |

> **Note:** `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are NOT used by the application directly.
> Configure `LLM_PROVIDER` + the matching key instead (see `.env.example`).

## Database — Backups & Point-in-Time Recovery (PITR)

### Supabase Managed (Cloud)

Don't confuse the two — they're separate features with separate retention:

- **Daily backups** (whole-DB snapshot, restores to the backup's timestamp
  only): included by default with no extra configuration —
  **Free: none** (use the CLI to export manually) · **Pro: last 7 days** ·
  **Team: last 14 days** · **Enterprise: up to 30 days**.
- **Point-in-Time Recovery (PITR)**: **off by default on every plan**,
  including Pro/Team/Enterprise — it's a separate paid add-on (also requires
  at least a Small compute add-on) that turns on continuous WAL archiving so
  you can restore to an arbitrary timestamp, not just a backup's snapshot
  time. Choose a 7/14/28-day retention window when enabling it. Once PITR is
  on, Supabase stops running daily backups in parallel (PITR is a strict
  superset).

1. **Enable and verify PITR**: Dashboard → Settings → Database → Point in
   Time Recovery — confirm it's turned on and set its retention window
   *before* relying on timestamp-based recovery. If it's off, only the daily
   backups above are available, and those restore to the backup time, not an
   arbitrary timestamp.
2. **Restore procedure (in-place)**: Dashboard → Settings → Database →
   Restore Database → pick timestamp. This restores **the existing project
   in place** — same project ref, same `DATABASE_URL`, no env changes needed.
3. **Restore to a new project** (optional, e.g. to inspect a past state
   without touching production): Supabase also offers "Restore to a new
   project" from the same dashboard. That path *does* need reconfiguration
   afterward — update `DATABASE_URL` and any Supabase project ref / anon key
   / service role key in every service's env to point at the new project.
4. **Test restores quarterly** — a backup never tested is not a backup.

### Self-Hosted Supabase Postgres (Docker / Fly.io / on-prem)

This is `supabase-local/`'s `db` service (container `supabase-db`), not a
standalone `postgres` service — commands below target it by its compose
service name `db`.

`wal_level` and `archive_mode` are both `postmaster`-context settings — a
`pg_reload_conf()` alone does **not** apply them, only a full server
restart does. Skipping the restart leaves WAL archiving silently off even
though `ALTER SYSTEM` "succeeded".

```sql
-- postgresql.conf (or run as superuser)
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET archive_mode = 'on';
-- Idempotent archive_command: refuses to overwrite an existing WAL file
-- instead of silently clobbering it on a retried/duplicate archive call.
ALTER SYSTEM SET archive_command = 'test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f';
```

```bash
# Controlled restart to apply wal_level / archive_mode (docker-compose example)
docker compose restart db
```

Verify archiving actually came up before trusting it for PITR:

```sql
SHOW wal_level;        -- expect: replica (or logical)
SHOW archive_mode;     -- expect: on
SHOW archive_command;  -- expect the cp/test command above
SELECT archived_count, failed_count, last_archived_time, last_failed_time
FROM pg_stat_archiver;  -- failed_count should stay 0; archived_count should climb
```

The `cp`-based `archive_command` above is a minimal, self-contained option —
it stores archives on local disk only (not durable against host loss) and
each server independently decides success/failure from `cp`'s exit code.
Use **pgBackRest** below for anything internet-facing or production: it
verifies each archived WAL, refuses to overwrite existing files, and can
push to durable/off-host storage (S3-compatible, GCS, Azure).

Or use **pgBackRest** (recommended for production):

```bash
# Install pgBackRest and configure /etc/pgbackrest.conf
pgbackrest --stanza=tayari stanza-create
pgbackrest --stanza=tayari backup --type=full

# PITR restore to a specific time — --type=time makes the --target a
# timestamp (pgBackRest also accepts name/xid/lsn targets, which parse
# --target completely differently); always include a timezone offset so
# the target isn't ambiguously interpreted in server-local time.
pgbackrest --stanza=tayari restore \
  --type=time \
  --target="2026-07-31 09:00:00+00" \
  --target-action=promote
```

Minimum recommended schedule:
- **Daily physical base backup** via pgBackRest or `pg_basebackup` — this is
  what continuous WAL archiving replays forward from, so PITR requires one
  of these, not just WAL archiving alone.
- **Continuous WAL archiving** (enables arbitrary PITR within retention window)
- **30-day retention** (adjust for your compliance requirements)
- Optionally, **also** run a daily `pg_dump` (below) as a separate logical
  export — useful for spot-restoring a single table or migrating to a
  different Postgres major version, but `pg_dump` on its own does **not**
  support WAL-based PITR and is not a substitute for the physical backup above.

### Manual pg_dump (development / simple deployments)

`scripts/backup.sh` and `scripts/restore.sh` wrap the commands below with
rotation, dry-run validation, and `--single-transaction` restores — see
`docs/runbooks/restore.md` for the full procedure. Manual equivalent:

```bash
# Dump — timestamp includes time (not just date) so a second dump the same
# day doesn't silently overwrite the first. User/database are always
# "postgres" — Supabase's fixed convention, not configurable.
docker compose exec db pg_dump -U postgres postgres | gzip > backup-$(date +%Y%m%d_%H%M%S).sql.gz

# Restore — into a fresh/explicitly-cleaned target, never the live DB in
# place: a partial failure mid-restore would otherwise leave `postgres` with
# a silent mix of old and restored rows. ON_ERROR_STOP=1 makes psql exit
# nonzero on the first SQL error instead of plowing through the rest of the
# dump and reporting success.
docker compose exec db createdb -U postgres postgres_restore
gunzip -c backup-20260731_143000.sql.gz | docker compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 postgres_restore
```

### GDPR: Account Deletion

The API implements a hard-delete cascade across every known user-linked
table, supporting GDPR Article 17 (erasure) and Article 15 (access via
export below) — treat "GDPR-compliant" as scoped to those two rights over
the tables listed here, not a blanket compliance guarantee:

```
DELETE /api/v1/account   |   DELETE /api/account   (authenticated)
```

This cascades through all tables in a single transaction in this order:
`autopilot_runs → autopilot_schedules → application_outcomes → applications →
resume_versions → resumes → job_descriptions → saved_jobs →
user_skill_analyses → conversations → user_job_feedback → communications →
connections → question_upvotes → shared_interview_questions → memberships →
push_subscriptions → user_subscriptions → profiles → auth.users`

**Not deleted — `public.privacy_audit_log`** (GDPR Article 30 processing
records): rows are append-only by design and are never deleted on account
deletion, only ever created. If you need audit rows to stop referencing a
deleted user, anonymize (`UPDATE ... SET user_id = NULL` or similar) rather
than delete — deleting them would itself violate the audit-trail guarantee
Article 30 exists for.

**Backups and PITR retain deleted data for their retention window.** A hard
delete only removes rows from the live database — any daily backup or PITR
WAL history taken before the deletion still contains the user's data for as
long as that backup/PITR retention window lasts (up to 30 days on
Enterprise; see the PITR section above). Restoring the database from a
pre-deletion backup or PITR timestamp will resurrect that user's data.
Factor this into any compliance sign-off — the deletion is immediate in the
live DB but not immediately irrecoverable from backups.

Users can also export their data as a ZIP before deletion:

```
GET /api/v1/account/export   |   GET /api/account/export   (authenticated)
```

## Celery Flower Dashboard (Dev Only)

> **Security**: Flower is intentionally excluded from the `prod` Docker profile.
> Never expose port 5555 publicly. `FLOWER_USER` and `FLOWER_PASSWORD` have no
> default — `docker compose --profile dev up celery-flower` fails to start
> without both set in `.env`.

```bash
# Start Flower in dev mode only
docker compose --profile dev up -d celery-flower
open http://localhost:5555/flower
```

## SSL / HTTPS

For production, always use HTTPS. The frontend should be served with SSL (Vercel/Netlify/Cloudflare handles this automatically).

The Go backend should run behind a reverse proxy (nginx, Caddy, or Cloudflare) with SSL termination.
