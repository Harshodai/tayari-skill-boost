#!/usr/bin/env bash
# go_green_subset.sh — Run the DB-free GREEN subset of the Go gateway tests.
#
# `go test ./...` is EXPECTED-RED as of 2026-07-08: 16 tests in
# tayari-backend/internal/api panic with a nil-pointer deref in
# database/sql.(*DB).QueryContext. Root cause: the global tenantMiddleware runs
# on EVERY route and calls s.DB.Conn.QueryRowContext(...); the Hermes/social-auth
# route tests build the server with &database.DB{Conn: nil}, so the middleware
# nil-derefs before the handler runs. See tayari-failure-archaeology.
#
# The smoke + route-parity tests build the server with a NON-nil fake DB, so they
# survive. That subset is the honest "gateway wiring is intact" signal:
#   go test ./internal/api -run 'TestSmoke|TestRouteParity'   -> 19 passed (verified 2026-07-08).
#
# Exit 0 = subset green. Exit nonzero = the wiring/parity signal itself broke —
# investigate, do NOT dismiss it as "the known nil-DB panic".
#
# Usage:
#   ./go_green_subset.sh              # locates repo root relative to this script
#   REPO_ROOT=/path/to/repo ./go_green_subset.sh
set -euo pipefail

# Resolve the repo root: this script lives at
#   <repo>/.claude/skills/tayari-diagnostics-and-tooling/scripts/go_green_subset.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../../.." && pwd)}"
GO_DIR="$REPO_ROOT/backend/go"

if [ ! -f "$GO_DIR/go.mod" ]; then
  echo "ERROR: $GO_DIR/go.mod not found. Set REPO_ROOT to the repo root." >&2
  exit 2
fi

echo "Running Go green subset in $GO_DIR ..."
echo "  go test ./internal/api -run 'TestSmoke|TestRouteParity'"
echo

set +e
( cd "$GO_DIR" && go test ./internal/api -run 'TestSmoke|TestRouteParity' )
rc=$?
set -e

echo
if [ "$rc" -eq 0 ]; then
  echo "GREEN: smoke + route-parity subset passed (expected 19 tests)."
  echo "  Note: full 'go test ./...' is EXPECTED-RED (16 nil-DB panics) as of 2026-07-08 —"
  echo "  that is a known-open test-harness bug, not a gateway regression."
else
  echo "RED: the green subset FAILED (exit $rc). This is NOT the known nil-DB panic —"
  echo "  smoke/parity use a non-nil fake DB. A real regression in wiring or route parity."
  echo "  Route parity: every /api/... route needs a /api/v1/... alias (see tayari-change-control)."
fi
exit "$rc"
