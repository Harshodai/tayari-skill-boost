# Tayari Skill Boost

**End-to-end job-search pipeline.** Resume optimization, ATS scoring, cover letter generation, interview prep, and offer negotiation — wired together as one observable pipeline with a self-hosted LLM option for full data privacy.

Tayari Skill Boost is an event-driven career operations platform. Microservices architecture: resume processing, async job-scraping pipelines, ATS parsing, LLM-powered optimization, and a social outcome-sharing graph.

## Key differentiators

1. **Reflective resume optimization** (`app/services/optimizer.py`) — iterates optimization against its own scoring gate before emitting, not a single GPT pass.
2. **Tiered Hermes multi-board scraping** (`app/services/hermes/`) — Tier A keyless ATS JSON (Greenhouse/Lever/Ashby/Workday) → Tier B Firecrawl+SerpApi → Tier C Apify → Tier D Crawl4AI+Playwright, with per-provider circuit breakers. Works with zero API keys; upgrades gracefully.
3. **Hybrid ranking (reciprocal rank fusion)** — three independent rankers fused via RRF, lexical + semantic, instead of a single black-box score.
4. **Knowledge graph extraction** (`app/services/knowledge_graph.py`) — auto-extracts achievements, skills, and timeline; surfaces skill gaps and links them to a career roadmap.
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
| Database | PostgreSQL 16 | `backend/db/` |
| LLM | OpenRouter / Ollama / any OpenAI-compatible | env-driven |
| Browser Agent | browser-use + Playwright | `backend/python/` |

---

## Ports (host)

| Service | Host port |
|---------|-----------|
| Frontend | 8083 |
| Go API | 8085 |
| Python AI | 8002 |
| Postgres | 5433 |
| Redis | 6380 |
| Ollama | 11435 |
| Caddy | 8090 / 8443 |
| Celery Flower | 5555 |

---

## End-to-end Docker setup

Prerequisites: Docker + Compose v2.

```bash
# 1. Clone and enter
git clone <repo-url> && cd tayari-skill-boost

# 2. Create .env with required JWT secret
cp .env.example .env
# Edit .env — set JWT_SECRET (required), LLM keys if using OpenRouter

# 3. Build and start ALL services
docker compose --profile dev up -d --build

# 4. Wait for health checks (30-60s first time)
curl http://localhost:8085/api/health     # Go gateway
curl http://localhost:8002/health          # Python AI engine

# 5. Open frontend
open http://localhost:8083

# 6. Register a test user
curl -X POST http://localhost:8085/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!!"}'
```

**Important:** All services use `profiles: ["dev", "prod"]`. Bare `docker compose up -d` starts **zero** services. Always pass `--profile dev` or `--profile prod`.

### Quick commands

```bash
# Start everything
docker compose --profile dev up -d --build

# See logs
docker compose logs -f go-backend    # Go gateway
docker compose logs -f python-ai     # Python AI
docker compose logs -f postgres      # Database

# Stop everything (preserves DB data)
docker compose down

# Full reset (wipes DB — destroys all data)
docker compose down -v && docker compose --profile dev up -d --build

# Check DB tables (51 total after a fresh init)
docker compose exec postgres psql -U tayari -d tayari -c "\dt"
```

### What happens on fresh start

Postgres runs `backend/db/init.sh` on first boot. This script:
1. Runs `init.sql` (base schema)
2. Runs `mvp_additions.sql`  
3. Runs **all 14 migration files** from `backend/db/migrations/` in sorted order
4. Inserts default tenant rows

The `migrations/` directory is **not** auto-processed by the Postgres entrypoint — `init.sh` handles it explicitly. If you add a new migration, just drop it in `backend/db/migrations/` — it runs on the next fresh init.

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
Tailwind + shadcn/ui, React Router with protected routes. Auth via Supabase or self-hosted JWT (`VITE_USE_SELF_HOSTED=true`).

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
