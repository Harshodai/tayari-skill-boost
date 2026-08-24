#!/usr/bin/env bash
# Capture a repository readiness baseline without provisioning or mutating services.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
OUTPUT="${1:-/tmp/tayari-baseline-$(date -u +%Y%m%dT%H%M%SZ).log}"
mkdir -p "$(dirname "$OUTPUT")"
: > "$OUTPUT"

run_check() {
  local label="$1"
  shift
  {
    echo "=== $label ==="
    echo "command: $*"
    set +e
    "$@"
    local rc=$?
    set -e
    echo "exit_code: $rc"
    echo
    return 0
  } >> "$OUTPUT" 2>&1
}

{
  echo "JobTayari repository baseline"
  echo "captured_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "branch: $(git branch --show-current)"
  echo "commit: $(git rev-parse HEAD)"
  echo "remote_main: $(git rev-parse origin/main 2>/dev/null || echo unavailable)"
  echo "worktree_status:"
  git status --short
  echo
  echo "configuration_presence (names only):"
  for name in TARGET_BASE_URL PYTHON_BASE_URL BASE_URL DATABASE_URL REDIS_URL SUPABASE_URL SUPABASE_ANON_KEY LLM_PROVIDER METRICS_TOKEN SENTRY_DSN; do
    if [[ -n "${!name:-}" ]]; then echo "$name=set"; else echo "$name=unset"; fi
done
  echo
} >> "$OUTPUT"

run_check "staging_gate_plan" ./scripts/staging_integration_gate.sh --plan
run_check "staging_gate_contract" bash ./scripts/staging_integration_gate_contract_test.sh
run_check "frontend_lint" pnpm run lint
run_check "frontend_tests" pnpm run test
run_check "frontend_build" pnpm run build
run_check "go_tests" bash -c 'cd backend/go && go test ./...'
run_check "go_vet" bash -c 'cd backend/go && go vet ./...'
run_check "python_feature_tests" env PYTHONPATH=backend/python python3 -m pytest -q backend/python/app/tests backend/python/tests
run_check "security_production" env SECURITY_BASELINE_ENFORCE=true node scripts/security_scan.mjs
run_check "promotion_gate" pnpm run promotion:gate

if command -v docker >/dev/null 2>&1; then
  {
    echo "=== docker_info_no_mutation ==="
    echo "command: docker info"
    if docker info; then echo "status: available"; else echo "status: daemon_unavailable"; fi
    echo
  } >> "$OUTPUT" 2>&1
else
  {
    echo "=== docker_info_no_mutation ==="
    echo "status: docker_cli_unavailable"
    echo
  } >> "$OUTPUT"
fi

if grep -Eq '^exit_code: [1-9][0-9]*$' "$OUTPUT"; then
  echo "BASELINE_FAIL output=$OUTPUT"
  exit 1
fi

echo "BASELINE_PASS output=$OUTPUT"
