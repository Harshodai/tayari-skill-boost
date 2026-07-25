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

# 2. Start local stack with Docker
docker compose --profile eval up -d

# 3. Run verification tests
bun run test
cd backend/go && go test ./...
cd ../python && python3 -m pytest tests/
```

## Pull Request Guidelines
1. Ensure all tests pass in both Go and Python service directories.
2. Keep code changes modular and well-documented.
3. Do not add unapproved cloud dependencies.
