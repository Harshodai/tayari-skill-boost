#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.aws.yml"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/deploy/aws/.env}"
ACTION="${1:-up}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy deploy/aws/.env.example and populate it outside Git." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ "${AUTONOMOUS_SUBMIT_ENABLED:-false}" != "false" ]]; then
  echo "Refusing deployment unless AUTONOMOUS_SUBMIT_ENABLED=false. The AWS canary is manual-submit only." >&2
  exit 1
fi

required=(PUBLIC_DOMAIN PUBLIC_ORIGIN CADDY_EMAIL DATABASE_URL SUPABASE_URL SUPABASE_ANON_KEY JWT_SECRET AI_INTERNAL_TOKEN APPROVAL_SIGNING_KEY TAYARI_API_KEY TRUSTED_PROXY_CIDRS LLM_PROVIDER LLM_MODEL_FAST LLM_MODEL_SMART REDIS_IMAGE PYTHON_API_IMAGE WORKER_IMAGE GATEWAY_IMAGE FRONTEND_IMAGE CADDY_IMAGE)
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" || "${!key}" == replace-me* ]]; then
    echo "$key must be set in $ENV_FILE" >&2
    exit 1
  fi
done

if [[ "${PUBLIC_ORIGIN}" != https://* || "${PUBLIC_ORIGIN}" == *localhost* || "${PUBLIC_ORIGIN}" == *127.0.0.1* ]]; then
  echo "PUBLIC_ORIGIN must be an HTTPS public origin, not localhost or loopback." >&2
  exit 1
fi
if [[ "${PUBLIC_DOMAIN}" == *localhost* || "${PUBLIC_DOMAIN}" == *127.0.0.1* || "${PUBLIC_DOMAIN}" == *example.invalid* ]]; then
  echo "PUBLIC_DOMAIN must be a real deployment hostname." >&2
  exit 1
fi
if [[ "${TRUSTED_PROXY_CIDRS}" == '*' || "${TRUSTED_PROXY_CIDRS}" == *0.0.0.0/0* || "${TRUSTED_PROXY_CIDRS}" == *::/0* ]]; then
  echo "TRUSTED_PROXY_CIDRS must not be an unrestricted wildcard or default route." >&2
  exit 1
fi
for image in REDIS_IMAGE PYTHON_API_IMAGE WORKER_IMAGE GATEWAY_IMAGE FRONTEND_IMAGE CADDY_IMAGE; do
  if [[ ! "${!image}" =~ @sha256:[0-9a-fA-F]{64}$ ]]; then
    echo "$image must end with an immutable @sha256 digest." >&2
    exit 1
  fi
done

command -v docker >/dev/null || { echo 'Docker is required.' >&2; exit 1; }
command -v curl >/dev/null || { echo 'curl is required for health verification.' >&2; exit 1; }

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
cd "$ROOT_DIR"

case "$ACTION" in
  config)
    "${compose[@]}" config >/dev/null
    echo "Compose configuration is valid."
    ;;
  up)
    "${compose[@]}" config >/dev/null
    "${compose[@]}" pull
    "${compose[@]}" up -d --remove-orphans
    ;;
  down)
    "${compose[@]}" down
    ;;
  logs)
    "${compose[@]}" logs --tail="${TAIL:-200}" "${SERVICE:-}"
    ;;
  status)
    "${compose[@]}" ps
    ;;
  canary|blue-green)
    echo "Initiating zero-downtime rolling canary update with automated rollback..."
    "${compose[@]}" config >/dev/null
    "${compose[@]}" pull

    declare -A PREV_IMAGES=()
    UPDATED_SERVICES=()

    rollback_services() {
      echo "TRIGGERING AUTOMATED ROLLBACK..." >&2
      for (( idx=${#UPDATED_SERVICES[@]}-1 ; idx>=0 ; idx-- )); do
        local r_svc="${UPDATED_SERVICES[idx]}"
        local prev_img="${PREV_IMAGES[$r_svc]:-}"
        if [[ -n "$prev_img" ]]; then
          echo "Rolling back service '$r_svc' to previous image: $prev_img" >&2
          # Force container recreation using previous image digest
          local current_var=""
          case "$r_svc" in
            python-ai) current_var="PYTHON_API_IMAGE" ;;
            celery-worker) current_var="WORKER_IMAGE" ;;
            go-backend) current_var="GATEWAY_IMAGE" ;;
            frontend) current_var="FRONTEND_IMAGE" ;;
            caddy) current_var="CADDY_IMAGE" ;;
          esac
          if [[ -n "$current_var" ]]; then
            env "$current_var=$prev_img" "${compose[@]}" up -d --no-deps "$r_svc" || true
          else
            "${compose[@]}" up -d --no-deps "$r_svc" || true
          fi
        fi
      done
      echo "Rollback completed. Exiting with failure." >&2
      exit 1
    }

    # Record current running images before updating
    ROLLING_SERVICES=(python-ai celery-worker go-backend frontend caddy)
    for svc in "${ROLLING_SERVICES[@]}"; do
      cid=$("${compose[@]}" ps -q "$svc" 2>/dev/null || true)
      if [[ -n "$cid" ]]; then
        PREV_IMAGES["$svc"]=$(docker inspect --format='{{.Config.Image}}' "$cid" 2>/dev/null || true)
      fi
    done

    # Rolling update: update backend services with health verification
    for svc in "${ROLLING_SERVICES[@]}"; do
      echo "Rolling update for service: $svc"
      UPDATED_SERVICES+=("$svc")
      if ! "${compose[@]}" up -d --no-deps "$svc"; then
        echo "Failed to start $svc during rollout." >&2
        rollback_services
      fi
      sleep 3
      new_cid=$("${compose[@]}" ps -q "$svc" 2>/dev/null || true)
      if [[ -z "$new_cid" ]] || ! docker inspect --format='{{.State.Running}}' "$new_cid" 2>/dev/null | grep -q "true"; then
        echo "Container for service '$svc' crashed or failed to start." >&2
        rollback_services
      fi
    done

    # Verify public health endpoint with automated rollback on timeout
    echo "Verifying deployment health at ${PUBLIC_ORIGIN%/}/health..."
    HEALTHY=false
    for attempt in {1..30}; do
      if curl --fail --silent --show-error --max-time 8 "${PUBLIC_ORIGIN%/}/health" >/dev/null; then
        echo "Job Tayari is responding at ${PUBLIC_ORIGIN}."
        HEALTHY=true
        break
      fi
      sleep 5
    done

    if [[ "$HEALTHY" != "true" ]]; then
      echo "Deployment started but health verification failed after 30 attempts." >&2
      rollback_services
    fi
    exit 0
    ;;
  *)
    echo "Usage: $0 {config|up|canary|blue-green|down|logs|status}" >&2
    exit 2
    ;;
esac

if [[ "$ACTION" == "up" ]]; then
  for attempt in {1..30}; do
    if curl --fail --silent --show-error --max-time 8 "${PUBLIC_ORIGIN%/}/health" >/dev/null; then
      echo "Job Tayari is responding at ${PUBLIC_ORIGIN}."
      exit 0
    fi
    sleep 5
  done
  echo "Deployment started but health verification failed; inspect: $0 logs" >&2
  exit 1
fi
