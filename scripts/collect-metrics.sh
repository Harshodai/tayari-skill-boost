#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:?Set BASE_URL to an approved development or staging URL}"
: "${METRICS_TOKEN:?Set METRICS_TOKEN from the environment; never put it in a file or command history}"
: "${OUTPUT:?Set OUTPUT to the snapshot path}"

case "$BASE_URL" in
  https://staging.*|http://127.0.0.1:*|http://localhost:*) ;;
  *)
    echo "Refusing metrics collection against an unapproved BASE_URL: $BASE_URL" >&2
    exit 2
    ;;
esac

mkdir -p "$(dirname "$OUTPUT")"

curl --fail --silent --show-error \
  --connect-timeout 5 \
  --max-time 15 \
  -H "X-Internal-Token: ${METRICS_TOKEN}" \
  -H 'Cache-Control: no-store' \
  "${BASE_URL%/}/metrics" \
  | jq --arg captured_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       --arg environment "${ENVIRONMENT:-staging}" \
       --arg run_id "${RUN_ID:-manual-metrics-snapshot}" \
       '. + {captured_at: $captured_at, environment: $environment, run_id: $run_id}' \
  > "$OUTPUT"

chmod 600 "$OUTPUT"
printf 'Metrics snapshot written to %s\n' "$OUTPUT"
