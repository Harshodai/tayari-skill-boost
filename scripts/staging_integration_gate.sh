#!/usr/bin/env bash
# Run the non-production staging integration suite against active services.
# This script never supplies defaults for staging credentials or target URLs.
# It refuses to run unless the operator explicitly attests that the target is staging.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EVIDENCE_DIR="${STAGING_EVIDENCE_DIR:-$ROOT_DIR/test-results/staging-live}"
mkdir -p "$EVIDENCE_DIR"

if [[ "${STAGING_ENVIRONMENT:-}" != "staging" ]]; then
  echo "ERROR: STAGING_ENVIRONMENT=staging is required; refusing to run against an unclassified target." >&2
  exit 78
fi

if [[ "${STAGING_CONFIRM:-}" != "I_UNDERSTAND_STAGING_ONLY" ]]; then
  echo "ERROR: set STAGING_CONFIRM=I_UNDERSTAND_STAGING_ONLY; this suite is for disposable non-production data only." >&2
  exit 78
fi

required=(
  TARGET_BASE_URL
  PYTHON_BASE_URL
  BASE_URL
  DATABASE_URL
  REDIS_URL
  SUPABASE_URL
  SUPABASE_ANON_KEY
)
missing=()
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done
if (( ${#missing[@]} > 0 )); then
  printf 'ERROR: missing staging configuration: %s\n' "${missing[*]}" >&2
  exit 78
fi

case "$TARGET_BASE_URL" in
  https://*|http://localhost*|http://127.0.0.1*|http://[::1]*) ;;
  *) echo "ERROR: TARGET_BASE_URL must be HTTPS or loopback HTTP." >&2; exit 78 ;;
esac
case "$PYTHON_BASE_URL" in
  https://*|http://localhost*|http://127.0.0.1*|http://[::1]*) ;;
  *) echo "ERROR: PYTHON_BASE_URL must be HTTPS or loopback HTTP." >&2; exit 78 ;;
esac

run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
summary="$EVIDENCE_DIR/summary-${run_id}.txt"
provider_json="$EVIDENCE_DIR/provider-readiness-${run_id}.json"
backend_log="$EVIDENCE_DIR/backend-integration-${run_id}.log"
hostile_log="$EVIDENCE_DIR/hostile-staging-${run_id}.log"

{
  echo "staging_run_id=$run_id"
  echo "target_base_url=$TARGET_BASE_URL"
  echo "python_base_url=$PYTHON_BASE_URL"
  echo "started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$summary"

set +e
python3 scripts/live_provider_verify.py \
  --environment staging \
  --require-live \
  --output "$provider_json" >> "$summary" 2>&1
provider_rc=$?
set -e
printf 'provider_readiness_rc=%s\n' "$provider_rc" >> "$summary"
if (( provider_rc != 0 )); then
  echo "ERROR: strict provider readiness failed; integration suite will not run." >&2
  cat "$summary" >&2
  exit "$provider_rc"
fi

set +e
BASE_URL="$BASE_URL" python3 tests/integration/backend_test.py > "$backend_log" 2>&1
backend_rc=$?
set -e
printf 'backend_integration_rc=%s\n' "$backend_rc" >> "$summary"

if [[ "${RUN_HOSTILE_STAGING:-false}" == "true" ]]; then
  set +e
  TARGET_BASE_URL="$TARGET_BASE_URL" PYTHON_BASE_URL="$PYTHON_BASE_URL" \
    python3 scripts/run_staging_hostile_suite.py > "$hostile_log" 2>&1
  hostile_rc=$?
  set -e
  printf 'hostile_staging_rc=%s\n' "$hostile_rc" >> "$summary"
else
  hostile_rc=0
  echo "hostile_staging_rc=not_requested" >> "$summary"
fi

printf 'finished_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$summary"

if (( backend_rc != 0 || hostile_rc != 0 )); then
  echo "ERROR: staging integration failed; see evidence under $EVIDENCE_DIR" >&2
  exit 1
fi

echo "PASS: staging integration gate completed; evidence written to $EVIDENCE_DIR"
