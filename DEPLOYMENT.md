# Tayari Deployment Guide

## Local Development (Docker Compose)

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your API keys

# 2. Start all services (--profile is required — every service declares one;
#    a bare `docker compose up -d` starts zero containers, silently)
docker compose --profile dev up -d --build

# 3. Check health (host ports, not the containers' internal ports)
curl http://localhost:8085/api/health
curl http://localhost:8002/health

# 4. Open frontend
open http://localhost:8083
```

## Production Deployment (Railway / Render / Fly.io)

### Backend (Go + Python + Postgres)

**Railway:**
1. Create new project
2. Add PostgreSQL service
3. Add Python AI service (Dockerfile.ai)
4. Add Go service (Dockerfile.backend)
5. Set environment variables from .env

**Render:**
1. Create Web Service for Python AI (Dockerfile.ai)
2. Create Web Service for Go backend (Dockerfile.backend)
3. Create PostgreSQL database
4. Set environment variables

**Fly.io:**
```bash
fly launch --dockerfile Dockerfile.backend
fly launch --dockerfile Dockerfile.ai
fly postgres create
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
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Random 256-bit string for auth |
| `LLM_PROVIDER` | No | `openrouter` \| `nvidia_nim` \| `ollama` \| (auto-detect) |
| `LLM_API_KEY` | If LLM_PROVIDER set | Generic API key fallback |
| `OPENROUTER_API_KEY` | If using OpenRouter | OpenRouter-specific key |
| `NVIDIA_NIM_API_KEY` | If using NIM | NVIDIA NIM-specific key |
| `LLM_BASE_URL` | If self-hosted LLM | Ollama or vLLM base URL |
| `AI_SERVICE_URL` | Yes | Python AI backend URL (e.g. `http://python-ai:8002`) |
| `STRIPE_SECRET_KEY` | If billing enabled | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | If billing enabled | Stripe webhook signing secret |
| `BILLING_ENABLED` | No | `true` to enable Stripe billing (default: `false`) |
| `FLOWER_USER` | Recommended | Celery Flower dashboard username (default: `admin`) |
| `FLOWER_PASSWORD` | Recommended | Celery Flower dashboard password — **change from default** |
| `PORT` | No | Server port (default 8085) |

> **Note:** `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are NOT used by the application directly.
> Configure `LLM_PROVIDER` + the matching key instead (see `.env.example`).

## Database — Backups & Point-in-Time Recovery (PITR)

### Supabase Managed (Cloud)

Supabase Pro and above includes PITR by default:

1. **Verify PITR is enabled**: Dashboard → Settings → Database → Point in Time Recovery
2. **Retention window**: Supabase Pro = 7 days; Team/Enterprise = up to 30 days
3. **Restore procedure**:
   ```
   Dashboard → Settings → Database → Restore Database → pick timestamp
   ```
   Restoration spins up a new DB; update `DATABASE_URL` in your env accordingly.
4. **Test restores quarterly** — a backup never tested is not a backup.

### Self-Hosted Postgres (Docker / Fly.io / on-prem)

Enable WAL archiving for PITR:

```sql
-- postgresql.conf (or run as superuser)
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET archive_mode = 'on';
ALTER SYSTEM SET archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f';
SELECT pg_reload_conf();
```

Or use **pgBackRest** (recommended for production):

```bash
# Install pgBackRest and configure /etc/pgbackrest.conf
pgbackrest --stanza=tayari stanza-create
pgbackrest --stanza=tayari backup --type=full

# PITR restore to a specific time
pgbackrest --stanza=tayari restore \
  --target="2026-07-31 09:00:00" \
  --target-action=promote
```

Minimum recommended schedule:
- **Daily full backup** via pgBackRest or `pg_dump`
- **Continuous WAL archiving** (enables arbitrary PITR within retention window)
- **30-day retention** (adjust for your compliance requirements)

### Manual pg_dump (development / simple deployments)

```bash
# Dump
docker compose exec postgres pg_dump -U tayari tayari | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup-20260731.sql.gz | docker compose exec -T postgres psql -U tayari tayari
```

### GDPR: Account Deletion

The API provides a GDPR-compliant hard-delete endpoint:

```
DELETE /api/v1/account   (authenticated)
```

This cascades through all tables in a single transaction in this order:
`autopilot_runs → autopilot_schedules → applications → resume_versions → resumes →
job_descriptions → saved_jobs → user_skill_analyses → conversations →
user_preferences → profiles → auth.users`

Users can also export their data as a ZIP before deletion:

```
GET /api/v1/account/export   (authenticated)
```

## Celery Flower Dashboard (Dev Only)

> **Security**: Flower is intentionally excluded from the `prod` Docker profile.
> Never expose port 5555 publicly. Always set `FLOWER_USER` and `FLOWER_PASSWORD`
> in `.env`. The default password `changeme` is **not acceptable** for any
> internet-facing deployment.

```bash
# Start Flower in dev mode only
docker compose --profile dev up -d celery-flower
open http://localhost:5555/flower
```

## SSL / HTTPS

For production, always use HTTPS. The frontend should be served with SSL (Vercel/Netlify/Cloudflare handles this automatically).

The Go backend should run behind a reverse proxy (nginx, Caddy, or Cloudflare) with SSL termination.
