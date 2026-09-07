# PRODUCTION RUNBOOK

> Commands below are the documented path from the repository. The Docker sequence was **not executed in the 2026-09-07 audit environment** (no Docker available); treat it as documented-not-verified until a clean-start run is recorded.

## Local / self-hosted start

```bash
cp .env.example .env
cp supabase-local/.env.example supabase-local/.env
# POSTGRES_PASSWORD and JWT_SECRET MUST be identical in both files
docker compose --profile dev up -d --build
```

Ports: frontend 8083, Go 8085, Python 8002, Supabase Kong 8000, Studio 3001, Postgres 54329.
`--profile` is mandatory; a bare `docker compose up -d` starts nothing.

## Health verification

```bash
curl 127.0.0.1:8085/api/health
curl 127.0.0.1:8002/health          # check active_engine to confirm a real LLM is wired
```

`FLOWER_USER` / `FLOWER_PASSWORD` must be set or `celery-flower` refuses to start.
`ENABLE_EMAIL_AUTOCONFIRM=true` must stay set in `supabase-local/.env` (no SMTP in the minimal stack).

## Frontend-only

```bash
bun run dev      # :8080 — set VITE_API_URL to http://localhost:8085/api or API calls hit the SPA fallback
bun run build
bun run lint
bun run test     # vitest, 57 files
bun run test:e2e # Playwright
```

## Migrations

`backend/db/migrations/` is the source of truth. Adding a file there does **not** apply it to the self-hosted stack — also copy it into `supabase-local/volumes/db/init/` with the next `NN-` prefix and add the individual-file mount in `supabase-local/docker-compose.yml`. Directory mounts are silently ignored by the image's non-recursive glob.

Hosted (Lovable Cloud) schema changes go through the migration tool, never by hand.

## Common failures

| Symptom | Cause | Action |
|---|---|---|
| Every login looks like an invalid token | `JWT_SECRET` differs between `.env` and `supabase-local/.env` | Make them identical, restart |
| AI endpoints return 503 `ai_service_unavailable` | No LLM configured | Set `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`; verify `active_engine` |
| Zero tables after fresh init | Migration mounted as a directory | Mount individual `NN-*.sql` files |
| Frontend API calls 404/500 in hosted preview | Go/Python not deployed there | Expected; use self-hosted for those features |

## Rollback / recovery

- Rollback: redeploy the previous reviewed image digests (`scripts/rollback.sh`).
- Backup/restore: `scripts/backup.sh`, `scripts/restore.sh`, `scripts/backup-restore-smoke.sh`. PostgreSQL/Supabase is the system of record; Redis is recoverable queue state.
- Never `rm -rf supabase-local/volumes/db/data` without confirmation — `docker compose down -v` alone does not wipe it (bind mount).
