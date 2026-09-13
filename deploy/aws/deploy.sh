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
  *)
    echo "Usage: $0 {config|up|down|logs|status}" >&2
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
