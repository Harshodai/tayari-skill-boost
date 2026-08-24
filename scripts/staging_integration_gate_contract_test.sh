#!/usr/bin/env bash
# Contract tests for the staging integration gate. No services or credentials are used.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
GATE="$ROOT_DIR/scripts/staging_integration_gate.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

plan_output="$TMP_DIR/plan.txt"
if ! "$GATE" --plan > "$plan_output"; then
  echo "FAIL: --plan must exit 0" >&2
  exit 1
fi
grep -Fq 'mutates_external_state: false' "$plan_output"
grep -Fq 'creates_files: false' "$plan_output"
grep -Fq 'contacts_services: false' "$plan_output"
grep -Fq 'TARGET_BASE_URL' "$plan_output"
grep -Fq 'SUPABASE_ANON_KEY' "$plan_output"
grep -Fq 'RUN_HOSTILE_STAGING' "$plan_output"

set +e
STAGING_ENVIRONMENT=staging \
STAGING_CONFIRM=I_UNDERSTAND_STAGING_ONLY \
  "$GATE" > "$TMP_DIR/missing.txt" 2>&1
missing_rc=$?
set -e
[[ "$missing_rc" -eq 78 ]]
grep -Fq 'TARGET_BASE_URL' "$TMP_DIR/missing.txt"
grep -Fq 'DATABASE_URL' "$TMP_DIR/missing.txt"
grep -Fq 'SUPABASE_ANON_KEY' "$TMP_DIR/missing.txt"

set +e
STAGING_ENVIRONMENT=staging \
STAGING_CONFIRM=I_UNDERSTAND_STAGING_ONLY \
TARGET_BASE_URL=http://example.invalid \
PYTHON_BASE_URL=https://staging.example.invalid \
BASE_URL=https://staging.example.invalid/api \
DATABASE_URL='postgresql://redacted' \
REDIS_URL='redis://redacted' \
SUPABASE_URL=https://staging.example.invalid \
SUPABASE_ANON_KEY=redacted \
  "$GATE" > "$TMP_DIR/target.txt" 2>&1
invalid_target_rc=$?
set -e
[[ "$invalid_target_rc" -eq 78 ]]
grep -Fq 'TARGET_BASE_URL must be HTTPS or loopback HTTP' "$TMP_DIR/target.txt"

echo "PASS: staging integration gate contract tests"
