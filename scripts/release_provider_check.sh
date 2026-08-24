#!/usr/bin/env bash
# scripts/release_provider_check.sh
# ---------------------------------------------------------------------------
# Release evidence: live provider readiness gate (OPS-008)
#
# Usage:
#   bash scripts/release_provider_check.sh [--dry-run] [--environment ENV]
#
# Options:
#   --dry-run       Skip live HTTP calls (sets allow_live=false).  Providers
#                   that need network will appear as blocked_by_policy — that is
#                   expected and does NOT fail the gate in dry-run mode.
#   --environment   Override the environment label (default: local).
#
# Required env vars for a full live gate:
#   TARGET_BASE_URL            Go gateway base URL (e.g. https://api.tayari.ai)
#   PYTHON_BASE_URL            Python AI engine base URL
#   ALLOW_LIVE_PROVIDER_VERIFY=true
#
# REQUIRED providers (blocked/degraded → exit 1 in live mode):
#   go-gateway, python-ai, queue, supabase
#
# WARNING providers (blocked/degraded → warning only, not a gate failure):
#   llm, stripe, firecrawl, apify, gmail, google-calendar, google-drive,
#   observability
#
# Output: docs/release-evidence/provider-readiness-YYYYMMDD.json
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="${REPO_ROOT}/docs/release-evidence"
DATE="$(date +%Y%m%d)"
EVIDENCE_FILE="${EVIDENCE_DIR}/provider-readiness-${DATE}.json"
VERIFY_SCRIPT="${REPO_ROOT}/scripts/live_provider_verify.py"

# ---- Required providers: blocked/degraded here → gate failure (exit 1) ----
REQUIRED_PROVIDERS="go-gateway,python-ai,queue,supabase"

# ---- Parse CLI args --------------------------------------------------------
DRY_RUN=false
ENVIRONMENT="${VERIFY_ENVIRONMENT:-local}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)         DRY_RUN=true ;;
    --environment)     shift; ENVIRONMENT="$1" ;;
    --environment=*)   ENVIRONMENT="${1#--environment=}" ;;
    --help|-h)
      grep '^#' "${BASH_SOURCE[0]}" | sed 's/^# \?//' | head -30
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
  shift
done

# ---- Colour helpers --------------------------------------------------------
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*" >&2; }
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
error() { echo -e "${RED}[FAIL]${NC}  $*" >&2; }

# ---- Safety checks ---------------------------------------------------------
if [[ ! -f "${VERIFY_SCRIPT}" ]]; then
  error "Verifier script not found: ${VERIFY_SCRIPT}"
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  error "python3 is required but not found in PATH"
  exit 1
fi

# ---- Decide allow-live flag ------------------------------------------------
if [[ "${DRY_RUN}" == "true" ]]; then
  ALLOW_LIVE_FLAG=""
  warn "Dry-run mode: live HTTP calls are DISABLED."
  warn "Required providers will appear as blocked_by_policy — expected in dry-run."
else
  if [[ "${ALLOW_LIVE_PROVIDER_VERIFY:-true}" == "true" ]]; then
    ALLOW_LIVE_FLAG="--allow-live"
  else
    ALLOW_LIVE_FLAG=""
    warn "ALLOW_LIVE_PROVIDER_VERIFY is not 'true'; live calls disabled."
  fi
fi

# ---- Create output directory -----------------------------------------------
mkdir -p "${EVIDENCE_DIR}"

info "Running provider readiness verification..."
info "  Environment   : ${ENVIRONMENT}"
info "  Dry-run       : ${DRY_RUN}"
info "  Evidence file : ${EVIDENCE_FILE}"
info "  Required      : ${REQUIRED_PROVIDERS}"
echo ""

# ---- Run verifier ----------------------------------------------------------
VERIFY_EXIT=0
python3 "${VERIFY_SCRIPT}" \
  --environment "${ENVIRONMENT}" \
  --require-providers "${REQUIRED_PROVIDERS}" \
  --output "${EVIDENCE_FILE}" \
  ${ALLOW_LIVE_FLAG:-} || VERIFY_EXIT=$?

# ---- Print per-provider summary from the saved JSON ------------------------
export _EVIDENCE_FILE="${EVIDENCE_FILE}"
export _REQUIRED="${REQUIRED_PROVIDERS}"
python3 - <<'EOF'
import json, sys, os

evidence_file = os.environ.get("_EVIDENCE_FILE", "")
required_env  = os.environ.get("_REQUIRED", "")

try:
    data = json.loads(open(evidence_file).read())
except Exception as e:
    print(f"  [could not parse evidence file: {e}]")
    sys.exit(0)

required = {p.strip().lower() for p in required_env.split(",") if p.strip()}
WARN_STATUSES = {"degraded", "blocked_by_configuration", "blocked_by_policy"}
FAIL_STATUSES = {"fail"}

by_provider: dict = {}
for r in data.get("results", []):
    prov = r["provider"]
    status = r["status"]
    by_provider.setdefault(prov, []).append(status)

RED = "\033[0;31m"; YELLOW = "\033[1;33m"; GREEN = "\033[0;32m"; NC = "\033[0m"
print("Provider readiness summary:")
print(f"  {'Provider':<25} {'Worst Status':<35} Tier")
print(f"  {'-'*25} {'-'*35} {'-'*10}")
for prov, statuses in sorted(by_provider.items()):
    if any(s in FAIL_STATUSES for s in statuses):
        worst = "fail"
    elif any(s in WARN_STATUSES for s in statuses):
        worst = next(s for s in statuses if s in WARN_STATUSES)
    else:
        worst = "pass"

    tier = "REQUIRED" if prov.lower() in required else "WARNING"
    if worst == "pass":
        colour = GREEN
    elif tier == "REQUIRED" and worst in (WARN_STATUSES | FAIL_STATUSES):
        colour = RED
    elif worst in FAIL_STATUSES:
        colour = RED
    else:
        colour = YELLOW

    print(f"  {colour}{prov:<25}{NC} {colour}{worst:<35}{NC} {colour}{tier}{NC}")
print()
EOF

# ---- Interpret exit code ---------------------------------------------------
if [[ "${DRY_RUN}" == "true" ]]; then
  # In dry-run mode, blocked_by_policy on REQUIRED is expected — not a gate failure.
  # Only hard probe errors (exit 1) break the gate.
  if [[ "${VERIFY_EXIT}" -eq 1 ]]; then
    error "Gate FAILED (dry-run): hard probe failure (exit=1)."
    error "Evidence saved to: ${EVIDENCE_FILE}"
    exit 1
  fi
  info "Dry-run gate PASSED (exit=${VERIFY_EXIT}). blocked_by_policy is expected offline."
  info "Evidence saved to: ${EVIDENCE_FILE}"
  info ""
  info "NOTE: Run without --dry-run with ALLOW_LIVE_PROVIDER_VERIFY=true for"
  info "production-grade release evidence before promotion."
  exit 0
else
  if [[ "${VERIFY_EXIT}" -ne 0 ]]; then
    if [[ "${VERIFY_EXIT}" -eq 2 ]]; then
      error "Gate FAILED: one or more REQUIRED providers are blocked or degraded."
    else
      error "Gate FAILED: hard probe failure (exit=${VERIFY_EXIT})."
    fi
    error "Evidence saved to: ${EVIDENCE_FILE}"
    exit 1
  fi
  info "Gate PASSED. All required providers are ready."
  info "Evidence saved to: ${EVIDENCE_FILE}"
  exit 0
fi
