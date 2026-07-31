# Contributing to Tayari

Thank you for your interest in contributing to Tayari!

## Architecture Overview
- **Frontend**: React + TypeScript + Vite + Tailwind CSS (`src/`)
- **Backend Routing & Gateway**: Go (`backend/go/`)
- **AI & Async Workers**: Python + Celery + FastAPI (`backend/python/`)

## Local Development Quickstart

```bash
# 1. Clone repo
git clone https://github.com/tayari-ai/tayari-skill-boost.git
cd tayari-skill-boost

# 2. Set up environment (required — see .env.example for the COMPOSE_PROFILES note)
cp .env.example .env

# 3. Start the full local stack with Docker (frontend + Go + Python + DB + Redis/Celery)
docker compose --profile dev up -d --build

# 4. Run verification tests
bun run test
cd backend/go && go test ./...
cd ../python && python3 -m pytest tests/
```

Note: `--profile eval` (used by CI) starts `python-ai` + `go-backend` — no
frontend, no Redis/Celery. The self-hosted Supabase stack (`db`, `auth`,
`kong`, etc. in `supabase-local/`) always comes up regardless of which
profile you pick, since go-backend/python-ai need a real database either
way. Use `--profile dev` for actual local development.

## Pull Request Guidelines
1. Ensure all tests pass in both Go and Python service directories.
2. Keep code changes modular and well-documented.
3. Do not add unapproved cloud dependencies.
