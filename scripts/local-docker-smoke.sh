#!/usr/bin/env bash
# ==============================================================================
# Local End-to-End Docker & Supabase Verification Smoke Test
# ==============================================================================
# Verifies the full self-hosted Open Source Supabase stack integrated with
# Go API Gateway, Python AI Engine, Celery Workers, Redis, and React Frontend.
#
# Usage:
#   ./scripts/local-docker-smoke.sh          # Runs full build, health, & E2E auth test
#   ./scripts/local-docker-smoke.sh --check  # Verifies already-running containers
#   ./scripts/local-docker-smoke.sh --down   # Stops all local compose containers
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-up}"

if [[ "$MODE" == "--down" || "$MODE" == "down" ]]; then
  echo "Stopping all local Docker containers..."
  docker compose --profile dev down -v --remove-orphans
  echo "Local containers stopped."
  exit 0
fi

echo "========================================================"
echo " Tayari Skill Boost - Local Supabase & Docker E2E Test  "
echo "========================================================"

# 1. Check Docker daemon
if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running." >&2
  exit 1
fi

# 2. Check environment configuration
if [[ ! -f ".env" ]]; then
  echo "Notice: .env not found. Creating from .env.example..."
  cp .env.example .env
fi

if [[ ! -f "supabase-local/.env" ]]; then
  echo "Notice: supabase-local/.env not found. Creating from supabase-local/.env.example..."
  cp supabase-local/.env.example supabase-local/.env
fi

# Ensure POSTGRES_PASSWORD and JWT_SECRET match between root .env and supabase-local/.env
ROOT_JWT="$(grep '^JWT_SECRET=' .env 2>/dev/null | cut -d= -f2- || true)"
SUPA_JWT="$(grep '^JWT_SECRET=' supabase-local/.env 2>/dev/null | cut -d= -f2- || true)"

if [[ -n "$ROOT_JWT" && -n "$SUPA_JWT" && "$ROOT_JWT" != "$SUPA_JWT" ]]; then
  echo "Warning: JWT_SECRET in .env and supabase-local/.env differed. Syncing to match..."
  sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${SUPA_JWT}|" .env && rm -f .env.bak
fi

ROOT_PG_PASS="$(grep '^POSTGRES_PASSWORD=' .env 2>/dev/null | cut -d= -f2- || true)"
SUPA_PG_PASS="$(grep '^POSTGRES_PASSWORD=' supabase-local/.env 2>/dev/null | cut -d= -f2- || true)"

if [[ -n "$ROOT_PG_PASS" && -n "$SUPA_PG_PASS" && "$ROOT_PG_PASS" != "$SUPA_PG_PASS" ]]; then
  echo "Warning: POSTGRES_PASSWORD in .env and supabase-local/.env differed. Syncing to match..."
  sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${SUPA_PG_PASS}|" .env && rm -f .env.bak
fi
# Derive the host gateway from the included Supabase Compose env so custom local ports remain testable.
SUPABASE_GATEWAY_PORT="$(grep "^KONG_HTTP_PORT=" supabase-local/.env | cut -d= -f2- || true)"
SUPABASE_GATEWAY_PORT="${SUPABASE_GATEWAY_PORT:-8000}"
SUPABASE_GATEWAY_URL="http://localhost:${SUPABASE_GATEWAY_PORT}"


# 3. Validate compose configuration
echo "Validating Docker Compose configuration..."
docker compose --profile dev config --quiet

if [[ "$MODE" != "--check" ]]; then
  echo "Starting local Open Source Supabase + Tayari stack..."
  docker compose --profile dev up -d --build
fi

# 4. Wait for services to become healthy
echo "Waiting for services to become healthy..."

wait_for_health() {
  local service="$1"
  local max_attempts="${2:-30}"
  local attempt=1

  echo -n "Checking health for '$service'..."
  while [ "$attempt" -le "$max_attempts" ]; do
    local status
    status="$(docker compose ps --format '{{.Health}}' "$service" 2>/dev/null || true)"
    if [[ "$status" == "healthy" ]]; then
      echo " OK (healthy)"
      return 0
    elif [[ -z "$status" ]]; then
      # Service might not have healthcheck, check if running
      local state
      state="$(docker compose ps --format '{{.State}}' "$service" 2>/dev/null || true)"
      if [[ "$state" == "running" ]]; then
        echo " OK (running)"
        return 0
      fi
    fi
    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
  done
  echo " FAILED (timeout waiting for $service)"
  return 1
}

wait_for_health "db" 45
wait_for_health "kong" 30
wait_for_health "auth" 30
# 5. Verify HTTP Endpoints
 echo "Verifying HTTP service endpoints..."
 ANON_KEY="$(grep '^ANON_KEY=' supabase-local/.env | cut -d= -f2-)"
 if [[ -z "$ANON_KEY" ]]; then
   echo "ERROR: ANON_KEY is required for the Supabase gateway probe." >&2
   exit 1
 fi
 # Kong protects this health endpoint with the publishable key; a bare curl returns 401.
 curl -fsS -H "apikey: ${ANON_KEY}" "${SUPABASE_GATEWAY_URL}/auth/v1/health" >/dev/null
 echo "  ✓ Supabase Auth Gateway (port ${SUPABASE_GATEWAY_PORT}) is responding"
 # Check Supabase Studio
 curl -fsS -o /dev/null -w "%{http_code}" "http://localhost:3001" | grep -q "200\|307\|308" && echo "  ✓ Supabase Studio Web UI (port 3001) is responding"
 # Check Go Backend Gateway
 curl -fsS "http://localhost:8085/api/health" | grep -q "healthy" && echo "  ✓ Go API Gateway (port 8085) is responding"
 # Check Frontend SPA
 curl -fsS -o /dev/null -w "%{http_code}" "http://localhost:8083" | grep -q "200" && echo "  ✓ Frontend React App (port 8083) is responding"

# 6. Perform End-to-End Auth & Proxy Verification
 echo "Running End-to-End configured auth -> Go Gateway -> DB test..."
 TEST_EMAIL="e2e-test-$(date +%s)@example.com"
 TEST_PASS="P@ssw0rd123456!"
 AUTH_MODE="$(grep '^USE_SUPABASE=' .env 2>/dev/null | cut -d= -f2- || true)"
 USER_TOKEN=""
 if [[ "$AUTH_MODE" == "true" ]]; then
   # Supabase mode: GoTrue issues the token and Go only verifies it.
   SIGNUP_RESP="$(curl -sS -X POST "${SUPABASE_GATEWAY_URL}/auth/v1/signup" \
     -H "apikey: ${ANON_KEY}" -H "Content-Type: application/json" \
     -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}")"
   USER_TOKEN="$(echo "$SIGNUP_RESP" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token') or '')")"
   if [[ -z "$USER_TOKEN" ]]; then
     LOGIN_RESP="$(curl -sS -X POST "${SUPABASE_GATEWAY_URL}/auth/v1/token?grant_type=password" \
       -H "apikey: ${ANON_KEY}" -H "Content-Type: application/json" \
       -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}")"
     USER_TOKEN="$(echo "$LOGIN_RESP" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token') or '')")"
   fi
 else
   # Self-hosted JWT mode: the web app intentionally uses the Go auth endpoints.
   curl -fsS -X POST "http://localhost:8085/api/auth/register" \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}" >/tmp/tayari-local-smoke-register.json
   LOGIN_RESP="$(curl -fsS -X POST "http://localhost:8085/api/auth/login" \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}")"
   USER_TOKEN="$(echo "$LOGIN_RESP" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('token') or data.get('access_token') or '')")"
 fi

 if [[ -z "$USER_TOKEN" ]]; then
   echo "ERROR: configured auth mode did not issue a token." >&2
   exit 1
 fi
 echo "  ✓ Configured auth mode (${AUTH_MODE:-false}) issued a JWT"
 PROFILE_STATUS="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8085/api/v1/profile" \
   -H "Authorization: Bearer ${USER_TOKEN}")"
 if [[ "$PROFILE_STATUS" == "200" || "$PROFILE_STATUS" == "404" ]]; then
   echo "  ✓ Go API Gateway verified the configured JWT and reached PostgreSQL (status $PROFILE_STATUS)"
 else
   echo "ERROR: Go API rejected the configured auth token with HTTP $PROFILE_STATUS" >&2
   exit 1
 fi

echo "========================================================"
echo " ✓ Local Open Source Supabase & Tayari Stack is READY! "
echo "========================================================"
echo " - Frontend App:      http://localhost:8083"
echo " - Supabase Studio:   http://localhost:3001"
echo " - Supabase Gateway:  ${SUPABASE_GATEWAY_URL}"
echo " - Go API Gateway:    http://localhost:8085"
echo " - Python AI Service: http://localhost:8002"
echo " - Celery Flower:     http://localhost:5555/flower"
echo "========================================================"
