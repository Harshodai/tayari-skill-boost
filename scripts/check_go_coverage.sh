#!/usr/bin/env bash
set -euo pipefail

# The repository has several packages without tests. Running one aggregate
# `go test -coverprofile ./...` asks some CI Go distributions to invoke the
# optional covdata tool and fails before producing a usable profile. Collect
# package profiles independently instead, then calculate a weighted floor.
MIN_COVERAGE="${GO_COVERAGE_MIN:-20}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/backend/go"
WORK_DIR="$(mktemp -d -t tayari-go-coverage.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

PACKAGE_LIST="$WORK_DIR/packages.txt"
go list -f '{{if or .TestGoFiles .XTestGoFiles}}{{.ImportPath}}{{end}}' ./... | sed '/^$/d' > "$PACKAGE_LIST"
if [[ ! -s "$PACKAGE_LIST" ]]; then
  echo "No Go packages with tests were found" >&2
  exit 1
fi

TOTAL_STATEMENTS=0
TOTAL_COVERED=0
while IFS= read -r package; do
  profile="$WORK_DIR/$(printf '%s' "$package" | tr '/.' '__').out"
  go test -coverprofile="$profile" "$package"
  package_total="$(awk 'NR > 1 { total += $2; if ($3 > 0) covered += $2 } END { printf "%d", total }' "$profile")"
  package_covered="$(awk 'NR > 1 { if ($3 > 0) covered += $2 } END { printf "%d", covered }' "$profile")"
  if [[ "$package_total" -eq 0 ]]; then
    echo "Coverage profile for $package contains no statements" >&2
    exit 1
  fi
  package_pct="$(awk -v c="$package_covered" -v t="$package_total" 'BEGIN { printf "%.1f", (100*c)/t }')"
  echo "Go coverage: $package $package_pct%"
  TOTAL_STATEMENTS=$((TOTAL_STATEMENTS + package_total))
  TOTAL_COVERED=$((TOTAL_COVERED + package_covered))
done < "$PACKAGE_LIST"

TOTAL_PCT="$(awk -v c="$TOTAL_COVERED" -v t="$TOTAL_STATEMENTS" 'BEGIN { printf "%.1f", (100*c)/t }')"
echo "Go coverage total: $TOTAL_PCT% (minimum ${MIN_COVERAGE}%)"
if awk -v actual="$TOTAL_PCT" -v minimum="$MIN_COVERAGE" 'BEGIN { exit !(actual + 0 < minimum + 0) }'; then
  echo "Go coverage $TOTAL_PCT% is below ${MIN_COVERAGE}%" >&2
  exit 1
fi
