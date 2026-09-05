#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:?Set BASE_URL to an approved development or staging URL}"
: "${RUN_ID:?Set RUN_ID to a unique synthetic run identifier}"

case "$BASE_URL" in
  https://staging.*|http://127.0.0.1:*|http://localhost:*) ;;
  *)
    echo "Refusing synthetic run against an unapproved BASE_URL: $BASE_URL" >&2
    echo "Only staging hosts or loopback development endpoints are allowed." >&2
    exit 2
    ;;
esac

if [[ "${ALLOW_SYNTHETIC_RUN:-}" != "true" ]]; then
  echo "Set ALLOW_SYNTHETIC_RUN=true after confirming the target is non-production." >&2
  exit 2
fi

export K6_TAGS="run_id=${RUN_ID},environment=${ENVIRONMENT:-staging},cohort=health-ghost,release_sha=${RELEASE_SHA:-unknown}"

SCRIPT_PATH="tests/perf/k6/synthetic.js"
if [[ ! -f "$SCRIPT_PATH" ]]; then
  SCRIPT_PATH="perf/k6/synthetic.js"
fi

exec k6 run \
  --tag run_id="$RUN_ID" \
  --tag environment="${ENVIRONMENT:-staging}" \
  --tag cohort=health-ghost \
  --env BASE_URL="$BASE_URL" \
  --env RAMP_VUS="${RAMP_VUS:-2}" \
  --env HOLD_SECONDS="${HOLD_SECONDS:-30}" \
  --env RAMP_SECONDS="${RAMP_SECONDS:-15}" \
  --env REQUIRE_REQUEST_ID="${REQUIRE_REQUEST_ID:-true}" \
  "$SCRIPT_PATH"
