---
name: tayari-run-and-operate
description: >-
  How to run, deploy, and operate the Tayari Skill Boost stack. Load when starting or
  stopping the stack, running a single service (Go gateway, Python engine, frontend, Celery
  worker, Flower), checking health, running Hermes open-source mode, or finding where output
  and artifacts land. Owns the docker-compose command anatomy (and the profile trap: bare
  `docker compose up -d` starts nothing), the health-check commands, per-service dev
  commands, and the data/artifact conventions. Facts verified 2026-07-08.
---

# Tayari Run and Operate

Operating the stack. This skill is about *running* things. To install toolchains and build
from scratch, use `tayari-build-and-env` (it owns the full port table). To measure/diagnose,
use `tayari-diagnostics-and-tooling`.

**Jargon defined once:**
- **Profile** — a Docker Compose tag. Every service here is tagged `["dev","prod"]`, so you
  must pass `--profile dev` (or `prod`) or nothing starts.
- **Host port vs container port** — you connect to host ports; services inside the compose
  network use container ports and service DNS names.

---

## 1. Full stack via Docker Compose — command anatomy

> **THE PROFILE TRAP (read this first).** All 9 services in `docker-compose.yml` are gated
> behind `profiles: ["dev","prod"]`. A bare `docker compose up -d` starts **ZERO** services
> and exits 0 — the next `curl` then connection-refuses and looks like a crash. The README and
> `DEPLOYMENT.md` say bare `up` — **they are wrong.** Always pass a profile.

```bash
# START the whole stack (dev profile)
docker compose --profile dev up -d --build

# or production profile
docker compose --profile prod up -d --build

# equivalent via env
COMPOSE_PROFILES=dev docker compose up -d --build

# STATUS / LOGS / STOP
docker compose --profile dev ps
docker compose --profile dev logs -f go-backend python-ai celery-worker
docker compose --profile dev down            # stop (keeps volumes)
```

> **Never** `docker compose down -v` (or drop the Postgres volume) without confirming — it
> wipes local DB data. (`CLAUDE.md` gotcha.)

Services started: `postgres`, `python-ai`, `redis`, `celery-worker`, `celery-flower`,
`go-backend`, `ollama`, `frontend`, `caddy`.

---

## 2. Health checks + host port essentials

```bash
curl http://localhost:8085/api/health     # Go gateway  -> {status:"ok", ...}
curl http://localhost:8002/health         # Python engine -> includes model_status
```

`model_status: "loaded"` = a real LLM is wired; `"llm_not_configured"` = mock (fake output).

| What | Host URL |
|---|---|
| Frontend | http://localhost:8083 |
| Go gateway | http://localhost:8085 |
| Python engine | http://localhost:8002 |
| Flower (Celery UI) | http://localhost:5555 (url-prefix `/flower`) |
| Ollama | http://localhost:11435 (container 11434) |
| Caddy | http://localhost:8090 / https 8443 |

Postgres `5433`, Redis `6380` are host-exposed but mainly internal. Full table +
container-internal DNS: `tayari-build-and-env`.

---

## 3. Running individual services (dev, no Docker)

```bash
# Go gateway (needs DATABASE_URL + JWT_SECRET in env)
cd backend/go && JWT_SECRET=dev-secret DATABASE_URL=postgres://... go run cmd/server/main.go

# Python engine (starts the Auto-Pilot scheduler as a lifespan background task)
cd backend/python && uvicorn app.main:app --reload --port 8000

# Frontend (Vite dev on :8080)
bun run dev
#   TRAP: Vite binds :8080 and the default VITE_API_URL is also :8080 with no proxy,
#   so /api calls hit the SPA fallback. Set VITE_API_URL first:
VITE_API_URL=http://localhost:8085/api bun run dev

# Celery worker (queue name is "tayari")
cd backend/python && celery -A app.celery_app:celery_app worker -Q tayari --loglevel=info

# Flower (queue monitor)
cd backend/python && celery -A app.celery_app:celery_app flower --port=5555
```

The worker and Flower need `REDIS_URL` + `DATABASE_URL`. The worker Docker image also installs
Playwright Chromium (for Crawl4AI). See `tayari-build-and-env`.

---

## 4. Hermes open-source scraping mode

```bash
docker compose -f docker-compose.yml -f docker-compose.hermes.yml --profile dev up -d
```

Adds an Ollama `hermes3:8b`-oriented config + worker env for the tiered scraper. The Hermes
scraper works with **zero API keys** (Tier A keyless ATS JSON + 3 always-on free job providers);
adding `FIRECRAWL_API_KEY`/`APIFY_API_TOKEN`/`SERPAPI_API_KEY` upgrades it gracefully. Config
details: `tayari-config-and-flags`. Architecture: `tayari-architecture-contract`.

---

## 5. Data and artifact conventions — what lands where

| Artifact | Location |
|---|---|
| DB schema init | `backend/db/*.sql` mounted read-only to `/docker-entrypoint-initdb.d` on first Postgres boot |
| DB migrations | `backend/db/migrations/YYYYMMDD_*.sql` (apply manually / via your migration flow) |
| Scraped jobs + agent runs | Postgres tables `scraped_jobs`, `agent_runs` (TTL-cached) |
| Voice uploads | `backend/uploads/voice/<uuid>.webm` (created by the engine at startup) |
| Perf benchmark output | `perf_time.txt` (written by `scripts/perf_check.sh` — a **simulated** placeholder, not a real run) |
| Redis persistence | `redis_data` volume (appendonly) |
| Ollama models | `ollama_data` volume |

**Async design note.** Heavy/long work goes to Celery, never a blocking loop in a request
handler (`.agents/AGENTS.md`). `POST /api/v1/autopilot/run` returns a `run_id` immediately and
runs in the background; poll `GET /api/v1/autopilot/status/{run_id}`. The engine also runs a
recurring Auto-Pilot scheduler as a FastAPI lifespan task (starts on boot, cancels on shutdown).

---

## 6. Production deploy (pointers, not a runbook)

- Docker images built/pushed by `.github/workflows/build.yml` on release (ghcr.io).
- A Helm chart exists under `helm/`; `JWT_SECRET` must be provided as a k8s secret
  (`kubectl create secret generic tayari-jwt --from-literal=jwtSecret=$JWT_SECRET`).
- `DEPLOYMENT.md` lists Railway/Render/Fly options but its port examples use container-internal
  ports — treat as illustrative, not host-accurate. Deploy changes route through
  `tayari-change-control`.

---

## When NOT to use this / use instead

| You want to… | Use |
|---|---|
| Install toolchains / build / the full port table | `tayari-build-and-env` |
| Configure env vars / LLM provider / flags | `tayari-config-and-flags` |
| Measure health / which engine / ATS score | `tayari-diagnostics-and-tooling` |
| Diagnose a failure (stack won't come up, etc.) | `tayari-debugging-playbook` |
| The gate for a deploy/ops change | `tayari-change-control` |

---

## Provenance and maintenance

Facts verified against the repo on **2026-07-08**. Re-verify:

```bash
grep -c 'profiles:' docker-compose.yml                       # 9 => bare `up` starts nothing
grep -nE '^\s{2}[a-z-]+:$' docker-compose.yml | head -20     # service list
grep -n 'ports:' -A1 docker-compose.yml | grep -E '8083|8085|8002|5555|11435'  # host ports
grep -n 'celery -A\|-Q ' backend/python/Dockerfile.worker    # worker queue command
grep -n 'uploads/voice\|_VOICE_UPLOAD_DIR' backend/python/app/main.py
ls docker-compose.hermes.yml Caddyfile helm 2>/dev/null
```

If a port mapping, profile, or service changes, update §1–§2 and bump the date.
