# Backend Services

This directory contains the backend microservices for Tayari Skill Boost.

## Architecture

```
backend/
├── db/          # Database schema and migrations
├── go/          # Go API Gateway (Auth, Core API)
└── python/      # Python AI Engine (Resume parsing, ML)
```

## Quick Start

```bash
# Start all services (--profile is required, see root CLAUDE.md)
docker compose --profile dev up -d --build

# View logs
docker compose logs -f go-backend
docker compose logs -f python-ai
```

## Services

| Service | Host port | Description |
|---------|------|-------------|
| `go-backend` | 8085 | API Gateway, Authentication, Core Logic |
| `python-ai` | 8002 | AI/ML workloads (Resume analysis) |
| `db` (Supabase, self-hosted stack in `supabase-local/`) | 54329 | PostgreSQL Database — see `supabase-local/README.md` |

## Environment Variables

See `.env` in project root for all required variables.

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Email/password login
- `GET /api/auth/{provider}` - Social login (google/github/linkedin)
- `GET /api/auth/{provider}/callback` - OAuth callback

### Protected (Requires Bearer token)
- `GET /api/me` - Get current user
