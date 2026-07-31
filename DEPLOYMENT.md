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
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `AI_SERVICE_URL` | Yes | Python AI backend URL |
| `PORT` | No | Server port (default 8080) |

## SSL / HTTPS

For production, always use HTTPS. The frontend should be served with SSL (Vercel/Netlify/Cloudflare handles this automatically).

The Go backend should run behind a reverse proxy (nginx, Caddy, or Cloudflare) with SSL termination.
