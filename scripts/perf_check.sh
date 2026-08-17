#!/usr/bin/env bash
set -euo pipefail

OUTPUT_FILE="${PERF_OUTPUT_FILE:-perf_time.txt}"
TARGET_URL="${PERF_TARGET_URL:-}"
ENDPOINT_PATH="${PERF_ENDPOINT_PATH:-/api/v1/autopilot/run}"
REQUEST_BODY="${PERF_REQUEST_BODY:-{\"config\":\"minimal\"}}"
EXPECTED_STATUS="${PERF_EXPECTED_STATUS:-202}"

if [[ "${1:-}" == "--plan" || "${1:-}" == "--dry-run" ]]; then
  cat <<'JSON'
{
  "mode": "plan",
  "mutates_external_state": true,
  "requires": [
    "PERF_TARGET_URL",
    "PERF_INTERNAL_TOKEN or an explicitly configured disposable auth header",
    "a disposable staging account and endpoint",
    "PERF_EXPECTED_STATUS matching the deployed API contract"
  ],
  "default_endpoint": "/api/v1/autopilot/run",
  "default_expected_status": 202
}
JSON
  printf '%s\n' "blocked: performance target is not configured" > "$OUTPUT_FILE"
  exit 0
fi

if [[ -z "$TARGET_URL" ]]; then
  echo "PERF_TARGET_URL is required; refusing to simulate an autopilot benchmark." >&2
  exit 2
fi

if [[ -z "${PERF_INTERNAL_TOKEN:-}" && -z "${PERF_AUTHORIZATION:-}" ]]; then
  echo "PERF_INTERNAL_TOKEN or PERF_AUTHORIZATION is required for a disposable benchmark." >&2
  exit 2
fi

headers=(-H "Content-Type: application/json")
if [[ -n "${PERF_INTERNAL_TOKEN:-}" ]]; then
  headers+=(-H "X-Internal-Token: ${PERF_INTERNAL_TOKEN}")
fi
if [[ -n "${PERF_AUTHORIZATION:-}" ]]; then
  headers+=(-H "Authorization: ${PERF_AUTHORIZATION}")
fi

start_ns=$(date +%s%N)
status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --request POST "${TARGET_URL%/}${ENDPOINT_PATH}" \
  "${headers[@]}" \
  --data "$REQUEST_BODY")
end_ns=$(date +%s%N)

elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))
printf '%s\n' "$elapsed_ms" > "$OUTPUT_FILE"
echo "Autopilot benchmark status=${status} duration_ms=${elapsed_ms}"

if [[ "$status" != "$EXPECTED_STATUS" ]]; then
  echo "Performance benchmark failed: expected HTTP ${EXPECTED_STATUS}, got ${status}." >&2
  exit 1
fi
if (( elapsed_ms > ${PERF_MAX_MS:-30000} )); then
  echo "Performance benchmark failed: ${elapsed_ms}ms exceeds ${PERF_MAX_MS:-30000}ms." >&2
  exit 1
fi
