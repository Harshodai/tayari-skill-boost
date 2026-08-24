#!/usr/bin/env bash
# Run the non-production staging integration suite against active services.
# This script never supplies defaults for staging credentials or target URLs.
# It refuses to run unless the operator explicitly attests that the target is staging.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage: scripts/staging_integration_gate.sh [--plan|--dry-run]

Without an option, run the live non-production staging gate. The live path
requires explicit staging attestation and service configuration and writes
redacted evidence files under test-results/staging-live/.

--plan, --dry-run  Print required configuration, validation rules, execution
                   steps, and evidence outputs without contacting services or
                   creating files. This mode always exits successfully.
USAGE
}

required=(
  STAGING_ENVIRONMENT
  STAGING_CONFIRM
  TARGET_BASE_URL
  PYTHON_BASE_URL
  BASE_URL
  DATABASE_URL
  REDIS_URL
  SUPABASE_URL
  SUPABASE_ANON_KEY
)
optional=(
  STAGING_EVIDENCE_DIR
  RUN_HOSTILE_STAGING
  LLM_PROVIDER
  OPENROUTER_API_KEY
  OPENROUTER_MODEL
  ANTHROPIC_API_KEY
  OPENAI_API_KEY
  STRIPE_SECRET_KEY
  FIRECRAWL_API_KEY
  APIFY_API_TOKEN
  SENTRY_DSN
  METRICS_TOKEN
)

print_plan() {
  cat <<'PLAN'
STAGING INTEGRATION GATE PLAN
=============================
mode: dry-run
mutates_external_state: false
creates_files: false
contacts_services: false

Required variables (values are never printed):
  STAGING_ENVIRONMENT=staging
  STAGING_CONFIRM=I_UNDERSTAND_STAGING_ONLY
  TARGET_BASE_URL=<https URL or loopback HTTP URL>
  PYTHON_BASE_URL=<https URL or loopback HTTP URL>
  BASE_URL=<gateway URL used by backend integration tests>
  DATABASE_URL=<staging-managed PostgreSQL/Supabase connection>
  REDIS_URL=<staging Redis connection>
  SUPABASE_URL=<staging Supabase URL>
  SUPABASE_ANON_KEY=<staging Supabase publishable/anon key>

Optional variables:
  STAGING_EVIDENCE_DIR=<default: test-results/staging-live>
  RUN_HOSTILE_STAGING=true|false (default: false)
  LLM_PROVIDER, OPENROUTER_API_KEY, OPENROUTER_MODEL, ANTHROPIC_API_KEY,
  OPENAI_API_KEY, STRIPE_SECRET_KEY, FIRECRAWL_API_KEY, APIFY_API_TOKEN,
  SENTRY_DSN, METRICS_TOKEN (only for explicitly enabled staging providers)

Validation rules:
  - Live mode requires both staging attestation variables exactly as shown.
  - TARGET_BASE_URL and PYTHON_BASE_URL must be HTTPS or loopback HTTP.
  - No production URL, credential, or default is inferred.
  - Missing configuration exits 78 before any service call.
  - Provider readiness must pass before backend integration begins.
  - External-action capabilities remain disabled unless their separate gates pass.

Execution sequence after configuration passes:
  1. scripts/live_provider_verify.py --environment staging --require-live
  2. tests/integration/backend_test.py with BASE_URL
  3. scripts/run_staging_hostile_suite.py when RUN_HOSTILE_STAGING=true
  4. Write redacted summary, provider JSON, integration log, and hostile log

Expected evidence files (live mode only):
  test-results/staging-live/summary-<run-id>.txt
  test-results/staging-live/provider-readiness-<run-id>.json
  test-results/staging-live/backend-integration-<run-id>.log
  test-results/staging-live/hostile-staging-<run-id>.log (when requested)

Safe exit codes:
  0  plan completed, or live gate passed
  1  configured live integration or hostile suite failed
  78 configuration/attestation/target validation blocked execution
PLAN
}

mode="run"
case "${1:-}" in
  "") ;;
  --plan|--dry-run)
    mode="plan"
    ;;
  --help|-h)
    usage
    exit 0
    ;;
  *)
    echo "ERROR: unknown option: $1" >&2
    usage >&2
    exit 64
    ;;
esac

if [[ "$mode" == "plan" ]]; then
  print_plan
  exit 0
fi

if [[ "${STAGING_ENVIRONMENT:-}" != "staging" ]]; then
  echo "ERROR: STAGING_ENVIRONMENT=staging is required; refusing to run against an unclassified target." >&2
  exit 78
fi

if [[ "${STAGING_CONFIRM:-}" != "I_UNDERSTAND_STAGING_ONLY" ]]; then
  echo "ERROR: set STAGING_CONFIRM=I_UNDERSTAND_STAGING_ONLY; this suite is for disposable non-production data only." >&2
  exit 78
fi

missing=()
for name in "${required[@]:2}"; do
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

EVIDENCE_DIR="${STAGING_EVIDENCE_DIR:-$ROOT_DIR/test-results/staging-live}"
mkdir -p "$EVIDENCE_DIR"
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
