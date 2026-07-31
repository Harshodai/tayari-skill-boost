# Tayari Skill Boost

**End-to-end job-search pipeline.** Resume optimization, ATS scoring, cover letter generation, interview prep, and offer negotiation — wired together as one observable pipeline with a self-hosted LLM option for full data privacy.

Tayari Skill Boost is an event-driven career operations platform. Microservices architecture: resume processing, async job-scraping pipelines, ATS parsing, LLM-powered optimization, and a social outcome-sharing graph.

## Key differentiators

1. **Reflective resume optimization** (`app/services/optimizer.py`) — iterates optimization against its own scoring gate before emitting, not a single GPT pass.
2. **Tiered Hermes multi-board scraping** (`app/services/hermes/`) — Tier A keyless ATS JSON (Greenhouse/Lever/Ashby/Workday) → Tier B Firecrawl+SerpApi → Tier C Apify → Tier D Crawl4AI+Playwright, with per-provider circuit breakers. Works with zero API keys; upgrades gracefully.
3. **Hybrid ranking (reciprocal rank fusion)** — three independent rankers fused via RRF, lexical + semantic, instead of a single black-box score.
4. **Knowledge graph extraction** (`backend/python/app/services/knowledge_graph.py`) — auto-extracts achievements, skills, and timeline; surfaces skill gaps and links them to a career roadmap.
5. **One-Stop career suite** — 8 integrated AI tools: Typst ATS Exporter, Company Radar Sentinel, WebSockets Real-Time Voice Interview Coach, Salary Negotiation Copilot, Skill Gap Radar, AI Portfolio Generator, Recruiter Outreach Copilot, and Application Funnel Analytics.

Plus: pipeline **guardrails** (`app/guardrails/` — keyword-stuffing detector, PII redaction, truthfulness gate, `PipelineGate`) that run before every application is submitted, and a **durable Celery/Redis autopilot** with run state queryable in Postgres.

---

## Stack

| Layer | Technology | Dir |
|-------|-----------|-----|
| Frontend | React + TypeScript + Vite + Tailwind + shadcn/ui | `src/` |
| API Gateway | Go + Chi | `backend/go/` |
| AI Engine | Python + FastAPI | `backend/python/` |
| Job Queue | Celery + Redis | `backend/python/` |
| Database | Self-hosted Supabase (Postgres + GoTrue auth + PostgREST + Kong + Realtime + Storage + Studio) | `supabase-local/`, schema in `backend/db/` |
| LLM | OpenRouter / Ollama / any OpenAI-compatible | env-driven |
| Browser Agent | browser-use + Playwright | `backend/python/` |

---

## Ports (host)

| Service | Host port | Override var (root `.env` unless noted) |
|---------|-----------|-------|
| Frontend | 8083 | `FRONTEND_PORT` |
| Go API | 8085 | `GO_BACKEND_PORT` |
| Python AI | 8002 | `PYTHON_AI_PORT` |
| Redis | 6380 | `REDIS_PORT` |
| Ollama | 11435 | `OLLAMA_PORT` |
| Caddy | 8090 / 8443 | `CADDY_HTTP_PORT` / `CADDY_HTTPS_PORT` |
| Celery Flower | 5555 | `FLOWER_PORT` |
| Supabase Kong (API gateway / Auth) | 8000 | `KONG_HTTP_PORT` in `supabase-local/.env` |
| Supabase Studio | 3001 | `SUPABASE_STUDIO_PORT` in `supabase-local/.env` |
| Supabase Postgres | 54329 | `SUPABASE_DB_PORT` in `supabase-local/.env` |
| Supabase Pooler (Supavisor) | 6543 | `POOLER_PROXY_PORT_TRANSACTION` in `supabase-local/.env` |

Every host port above is a Compose `${VAR:-default}` — every row in this table is safe to override without touching tracked `docker-compose.yml` files. Ports collide with unrelated local projects fairly often (e.g. another Supabase CLI instance or a different Docker Compose stack squatting on 8000). If `docker compose --profile dev up` fails with "port is already allocated", set the colliding var in the relevant `.env` file (root for app services, `supabase-local/.env` for Supabase services) rather than stopping the other project. Overriding a port only moves the host-side mapping — anything else that assumes the old default (`ALLOWED_ORIGINS`, `FRONTEND_URL`, `VITE_SUPABASE_URL`, extension default config, OAuth callback URLs) needs updating by hand to match.

---

## End-to-end Docker setup

Prerequisites: Docker + Compose v2.

```bash
# 1. Clone and enter
git clone <repo-url> && cd tayari-skill-boost

# 2. Create both .env files — root AND supabase-local/ (two separate compose
#    projects merged via `include:`, each reads its own .env)
cp .env.example .env
cp supabase-local/.env.example supabase-local/.env
# Edit .env — POSTGRES_PASSWORD and JWT_SECRET MUST exactly match the
# same-named values in supabase-local/.env (see the comment block at the
# top of .env.example for why). LLM keys if using OpenRouter.

# 3. Build and start ALL services — Go + Python + frontend + Redis/Celery +
#    the full self-hosted Supabase stack (Postgres, GoTrue auth, PostgREST,
#    Kong, Realtime, Storage, Studio)
docker compose --profile dev up -d --build

# 4. Wait for health checks (30-60s first time)
curl http://localhost:8085/api/health     # Go gateway
curl http://localhost:8002/health          # Python AI engine

# 5. Open frontend and sign up through the real UI (Sign up -> Create
#    Account) — this goes straight to Supabase Auth (GoTrue) via Kong, not
#    through the Go backend, so there's no register curl example here
open http://localhost:8083
```

**Important:** All services in the root `docker-compose.yml` use `profiles: ["dev", "prod"]` (or similar). Bare `docker compose up -d` starts **zero** of them, silently. Always pass `--profile dev` or `--profile prod`. The included Supabase stack (`supabase-local/docker-compose.yml`) has no `profiles:` of its own, so it always comes up regardless of which profile you pick — go-backend/python-ai need a real database either way.

### Quick commands

```bash
# Start everything
docker compose --profile dev up -d --build

# See logs
docker compose logs -f go-backend    # Go gateway
docker compose logs -f python-ai     # Python AI
docker compose logs -f db            # Database (Supabase Postgres)
docker compose logs -f auth          # Supabase Auth (GoTrue)

# Stop everything (preserves DB data)
docker compose down

# Full reset (wipes DB — destroys all data)
docker compose down -v && rm -rf supabase-local/volumes/db/data && \
  docker compose --profile dev up -d --build

# Check DB tables (58 in the public schema after a fresh init — more if you
# count Supabase's own auth/storage/realtime schemas)
docker compose exec db psql -U postgres -d postgres -c "\dt public.*"
```

Note the reset command: `supabase-local/volumes/db/data` is a bind mount (not a named Docker volume), so `docker compose down -v` alone does **not** wipe it — you have to remove the directory yourself.

### What happens on fresh start

Supabase's `db` service (image `supabase/postgres`) runs its own bootstrap (`auth`/`storage`/`realtime` schemas, the `anon`/`authenticated`/`service_role` roles, etc.) via its baked-in `migrate.sh`, then runs every file individually mounted into `/docker-entrypoint-initdb.d/migrations/` — including our own schema, sourced from `backend/db/` and copied into `supabase-local/volumes/db/init/` as `00-init-schema.sql` (an `auth`-schema-stripped copy of `backend/db/init.sql` — real Supabase already provides `auth.users`/`auth.uid()`), `01-mvp-additions.sql`, then every file from `backend/db/migrations/` in sorted order, then a tenant-seed step. Each is mounted as an *individual file* (`zz-NN-name.sql`) in `supabase-local/docker-compose.yml`'s `db:` service — `migrate.sh` globs `migrations/*.sql` **non-recursively**, so a directory mount there is silently invisible to it (see `lessons.md`).

If you add a new file to `backend/db/migrations/`, copy it into `supabase-local/volumes/db/init/` with the next `NN-` prefix too, and add the matching mount line in `supabase-local/docker-compose.yml`'s `db:` service — the two directories are not automatically kept in sync.

---

## Architecture

### API Gateway (Go)
JWT validation, CRUD, reverse proxy AI calls to Python at `/api/v1/ai/...`.

### AI Engine (Python/FastAPI)
- Resume optimizer — PDF ingestion, OCR, LLM semantic matching vs job descriptions
- Hermes pipeline — job scraper, structures data, maps to user skill vectors  
- Browser Automation Agent — `browser-use` + Playwright for autonomous form submissions
- AutoPilot — cover letter generation, automated email drafting

### Async Queue (Celery + Redis)
Long-running LLM inference and batch scraping pushed to Redis, picked up by Celery workers, results written to Postgres. Monitor at `http://localhost:5555`.

### Frontend (React + Vite)
Tailwind + shadcn/ui, React Router with protected routes. Auth via Supabase (default — `VITE_USE_SELF_HOSTED=false`, talks to the local Supabase Auth stack directly) or self-hosted JWT (`VITE_USE_SELF_HOSTED=true`, Go issues/verifies its own tokens, no Supabase Auth involved).

---

## Feature flags

All flags in `src/config/features.ts`. Key ones:

| Flag | Status |
|------|--------|
| `resumeOptimizer`, `careerRoadmap`, `jobSearch`, `coverLetter` | Enabled |
| `interviewPrep`, `interviewAI`, `voiceCoach` | Disabled (coming soon) |
| `pricing`, `blog`, `careerOps`, `skillGapRadar`, `negotiationCopilot` | Enabled |

`settings.showComingSoonBadges: true` shows "Soon" badges on Mock Interview, Clash of Code, Practice Problems, and Browser Extension cards.

---

## Testing

```bash
# Frontend unit tests (only ResumeGraph* tests)
bun run test

# E2E (Playwright)
npx playwright test e2e/features.spec.ts

# Go tests (DB-free subset only — full suite panics without DB)
cd backend/go && go test ./internal/api -run 'TestSmoke|TestRouteParity'

# Python — fast sanity
cd backend/python && python -m py_compile app/**/*.py
```

Full `go test ./...` is **known-red** outside Docker (nil-DB panics). See `tayari-validation-and-qa`.

---

## Root cause fix (Sprint A, Jul 2026)

**Problem:** Postgres entrypoint only runs `.sql`/`.sh` files directly in `/docker-entrypoint-initdb.d/`, ignoring subdirectories. All 14 migration files in `backend/db/migrations/` were silently skipped on every fresh `docker compose down -v`.

**Fix:** Created `backend/db/init.sh` that runs base SQL + all migrations in order. Verified: 51 tables created vs 17 before the fix. No more 500 errors on resume creation due to missing `tenants` table.

Related: auth integrity fix (CustomEvent instead of hard redirect), pricing truth pass (monthly/annual toggle, removed vaporware features), and free ATS scan page at `/free-scan`.

---

## Coming soon

Mock Interview, Clash of Code, Practice Problems (ProductSection cards with "Soon" badges). Browser Extension (FeaturesSection card). Controlled by `available: false` in `ProductsSection.tsx` and `interviewPrep`/`interviewAI`/`voiceCoach` flags in `features.ts`.
