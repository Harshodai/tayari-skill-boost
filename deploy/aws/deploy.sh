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
if [[ "${AUTONOMOUS_SUBMIT_ENABLED:-false}" == "true" ]]; then
  echo "Refusing deployment while AUTONOMOUS_SUBMIT_ENABLED=true. The AWS canary is manual-submit only." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required=(PUBLIC_DOMAIN PUBLIC_ORIGIN CADDY_EMAIL DATABASE_URL SUPABASE_URL SUPABASE_ANON_KEY JWT_SECRET AI_INTERNAL_TOKEN APPROVAL_SIGNING_KEY TAYARI_API_KEY)
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" || "${!key}" == replace-me* ]]; then
    echo "$key must be set in $ENV_FILE" >&2
    exit 1
  fi
done

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
cd "$ROOT_DIR"

case "$ACTION" in
  config)
    "${compose[@]}" config >/dev/null
    echo "Compose configuration is valid."
    ;;
  up)
    "${compose[@]}" config >/dev/null
    "${compose[@]}" build --pull python-ai celery-worker go-backend frontend
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
