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
# Start all services
docker-compose up --build -d

# View logs
docker logs -f tayari-backend-go
docker logs -f tayari-backend-ai
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| `backend-go` | 8080 | API Gateway, Authentication, Core Logic |
| `backend-ai` | 8000 | AI/ML workloads (Resume analysis) |
| `postgres` | 5432 | PostgreSQL Database |

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
