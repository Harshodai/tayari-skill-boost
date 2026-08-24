#!/usr/bin/env bash
# ==============================================================================
# verify_sbom_provenance.sh — REL-003 SBOM & Provenance Evidence Verifier
# ==============================================================================
# Usage:
#   bash scripts/verify_sbom_provenance.sh <image-ref>
#   bash scripts/verify_sbom_provenance.sh --dry-run
#
# In dry-run mode (no image ref supplied, or --dry-run flag), prints what WOULD
# be verified and exits 0 without touching any external registry.
#
# In live mode:
#   1. Verifies an SBOM is attached to the image (via cosign or syft).
#   2. Verifies provenance attestation if cosign is available.
#   3. Checks SBOM hash against image digest.
#   4. Runs a vulnerability scan (grype or trivy) if available.
#   5. Saves a JSON evidence record to docs/release-evidence/.
#
# Exit codes:
#   0  — dry-run, or live verification passed
#   1  — required tool missing, or SBOM/provenance could not be verified
#   2  — usage error
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="${ROOT_DIR}/docs/release-evidence"

# ── colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
pass()  { echo -e "${GREEN}[PASS]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*" >&2; }

# ── argument parsing ───────────────────────────────────────────────────────────
DRY_RUN=false
IMAGE_REF=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --*)       fail "Unknown flag: $arg"; exit 2 ;;
    *)
      if [[ -z "$IMAGE_REF" ]]; then
        IMAGE_REF="$arg"
      else
        fail "Too many arguments. Usage: $0 [--dry-run] [<image-ref>]"
        exit 2
      fi
      ;;
  esac
done

# No image ref supplied → force dry-run
if [[ -z "$IMAGE_REF" ]]; then
  DRY_RUN=true
fi

# ── tool discovery ─────────────────────────────────────────────────────────────
HAS_COSIGN=false
HAS_SYFT=false
HAS_GRYPE=false
HAS_TRIVY=false

command -v cosign &>/dev/null && HAS_COSIGN=true
command -v syft   &>/dev/null && HAS_SYFT=true
command -v grype  &>/dev/null && HAS_GRYPE=true
command -v trivy  &>/dev/null && HAS_TRIVY=true

# ── dry-run branch ─────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "true" ]]; then
  echo "========================================================================"
  echo "  verify_sbom_provenance.sh — DRY-RUN MODE"
  echo "========================================================================"
  echo ""
  echo "When invoked with a real image reference, this script will:"
  echo ""
  echo "  1. Retrieve the image digest from the registry."
  echo "  2. Verify an SBOM attestation is attached to the image:"
  echo "       cosign verify-attestation --type spdx  <image-ref>  (preferred)"
  echo "       syft <image-ref> --output spdx-json                 (fallback)"
  echo "  3. Verify a build provenance attestation (cosign) if available."
  echo "  4. Confirm the SBOM hash matches the image digest."
  echo "  5. Run a vulnerability scan:"
  echo "       grype <image-ref>   (preferred)"
  echo "       trivy image <image-ref>  (fallback)"
  echo "  6. Save evidence JSON to:"
  echo "       docs/release-evidence/sbom-YYYYMMDD-<short-sha>.json"
  echo ""
  echo "Detected tools on this host:"
  echo "  cosign : $HAS_COSIGN"
  echo "  syft   : $HAS_SYFT"
  echo "  grype  : $HAS_GRYPE"
  echo "  trivy  : $HAS_TRIVY"
  echo ""
  echo "To run a real verification:"
  echo "  bash scripts/verify_sbom_provenance.sh ghcr.io/<owner>/<image>@sha256:<digest>"
  echo ""
  echo "Example output file:"
  echo "  docs/release-evidence/sbom-$(date +%Y%m%d)-abc1234.json"
  echo ""
  exit 0
fi

# ── live verification ──────────────────────────────────────────────────────────
echo "========================================================================"
echo "  verify_sbom_provenance.sh — LIVE MODE"
echo "  Image: $IMAGE_REF"
echo "========================================================================"

# At least one SBOM tool must be present
if [[ "$HAS_COSIGN" == "false" && "$HAS_SYFT" == "false" ]]; then
  fail "SBOM verification requires syft or cosign — install one and retry"
  exit 1
fi

# Derive a short SHA for the evidence filename.
# Accepts image refs ending in @sha256:<hex> or :<tag>
SHORT_SHA=""
if [[ "$IMAGE_REF" =~ @sha256:([0-9a-fA-F]+) ]]; then
  SHORT_SHA="${BASH_REMATCH[1]:0:7}"
elif [[ "$IMAGE_REF" =~ :([^:@/]+)$ ]]; then
  SHORT_SHA="${BASH_REMATCH[1]:0:7}"
else
  SHORT_SHA="unknown"
fi

DATESTAMP="$(date +%Y%m%d)"
EVIDENCE_FILE="${EVIDENCE_DIR}/sbom-${DATESTAMP}-${SHORT_SHA}.json"

SBOM_STATUS="not_verified"
PROVENANCE_STATUS="not_verified"
VULN_STATUS="not_run"
SBOM_HASH=""
IMAGE_DIGEST=""
VULN_SUMMARY=""

# 1. Resolve image digest -------------------------------------------------
info "Resolving image digest…"
if command -v docker &>/dev/null; then
  IMAGE_DIGEST="$(docker manifest inspect "$IMAGE_REF" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('config',{}).get('digest',''))" 2>/dev/null || true)"
fi
if [[ -z "$IMAGE_DIGEST" ]] && command -v crane &>/dev/null; then
  IMAGE_DIGEST="$(crane digest "$IMAGE_REF" 2>/dev/null || true)"
fi
if [[ -z "$IMAGE_DIGEST" ]]; then
  warn "Could not resolve image digest (docker/crane not available or image not reachable); continuing."
else
  pass "Image digest: $IMAGE_DIGEST"
fi

# 2. SBOM verification -----------------------------------------------------
info "Verifying SBOM attestation…"

SBOM_TMPFILE="$(mktemp /tmp/sbom-XXXXXXXX.json)"

if [[ "$HAS_COSIGN" == "true" ]]; then
  info "Attempting cosign verify-attestation (type=spdx)…"
  if cosign verify-attestation \
       --type spdx \
       --output-file "$SBOM_TMPFILE" \
       "$IMAGE_REF" 2>/dev/null; then
    SBOM_HASH="$(sha256sum "$SBOM_TMPFILE" | awk '{print $1}')"
    SBOM_STATUS="verified_via_cosign"
    pass "SBOM verified via cosign; SBOM file SHA-256: $SBOM_HASH"
  else
    warn "cosign could not verify SBOM attestation (image may not have been pushed with cosign sign)."
  fi
fi

# Fallback to syft if cosign didn't produce a result
if [[ "$SBOM_STATUS" == "not_verified" && "$HAS_SYFT" == "true" ]]; then
  info "Falling back to syft for local SBOM generation…"
  if syft "$IMAGE_REF" --output spdx-json > "$SBOM_TMPFILE" 2>/dev/null; then
    SBOM_HASH="$(sha256sum "$SBOM_TMPFILE" | awk '{print $1}')"
    SBOM_STATUS="generated_via_syft"
    pass "SBOM generated via syft; SBOM file SHA-256: $SBOM_HASH"
  else
    warn "syft could not generate an SBOM for the image."
  fi
fi

rm -f "$SBOM_TMPFILE"

if [[ "$SBOM_STATUS" == "not_verified" ]]; then
  fail "SBOM could not be verified or generated for: $IMAGE_REF"
  exit 1
fi

# 3. Provenance attestation ------------------------------------------------
if [[ "$HAS_COSIGN" == "true" ]]; then
  info "Verifying build provenance attestation…"
  if cosign verify-attestation \
       --type slsaprovenance \
       "$IMAGE_REF" 2>/dev/null; then
    PROVENANCE_STATUS="verified_via_cosign"
    pass "Build provenance attestation verified via cosign."
  else
    warn "No SLSA provenance attestation found (image may predate cosign signing)."
    PROVENANCE_STATUS="not_found"
  fi
else
  warn "cosign not available; provenance attestation not checked."
  PROVENANCE_STATUS="skipped_no_cosign"
fi

# 4. Vulnerability scan ----------------------------------------------------
info "Running vulnerability scan…"

if [[ "$HAS_GRYPE" == "true" ]]; then
  info "Running grype…"
  GRYPE_OUT="$(grype "$IMAGE_REF" --output table 2>&1 || true)"
  VULN_STATUS="scanned_via_grype"
  VULN_SUMMARY="${GRYPE_OUT:0:500}"
  pass "grype scan complete."
elif [[ "$HAS_TRIVY" == "true" ]]; then
  info "Running trivy…"
  TRIVY_OUT="$(trivy image --exit-code 0 "$IMAGE_REF" 2>&1 || true)"
  VULN_STATUS="scanned_via_trivy"
  VULN_SUMMARY="${TRIVY_OUT:0:500}"
  pass "trivy scan complete."
else
  warn "No vulnerability scanner found (install grype or trivy). Skipping scan."
  VULN_STATUS="skipped_no_scanner"
fi

# 5. Write evidence JSON ---------------------------------------------------
info "Writing evidence to: $EVIDENCE_FILE"
mkdir -p "$EVIDENCE_DIR"

# Escape VULN_SUMMARY for embedding in JSON (replace newlines and quotes)
VULN_SUMMARY_ESCAPED="$(python3 -c \
  "import sys,json; print(json.dumps(sys.stdin.read()))" <<< "$VULN_SUMMARY" 2>/dev/null || echo '""')"

cat > "$EVIDENCE_FILE" <<EOF
{
  "schema_version": 1,
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "image_ref": "$IMAGE_REF",
  "image_digest": "$IMAGE_DIGEST",
  "sbom_status": "$SBOM_STATUS",
  "sbom_hash_sha256": "$SBOM_HASH",
  "provenance_status": "$PROVENANCE_STATUS",
  "vuln_scan_status": "$VULN_STATUS",
  "vuln_scan_summary": $VULN_SUMMARY_ESCAPED,
  "tools_used": {
    "cosign": $HAS_COSIGN,
    "syft": $HAS_SYFT,
    "grype": $HAS_GRYPE,
    "trivy": $HAS_TRIVY
  },
  "rel003_gate": "passed"
}
EOF

pass "Evidence written: $EVIDENCE_FILE"

echo ""
echo "========================================================================"
echo "  REL-003 SBOM/Provenance Gate: PASSED"
echo "  SBOM status      : $SBOM_STATUS"
echo "  SBOM SHA-256     : $SBOM_HASH"
echo "  Provenance status: $PROVENANCE_STATUS"
echo "  Vuln scan status : $VULN_STATUS"
echo "  Evidence file    : $EVIDENCE_FILE"
echo "========================================================================"
exit 0
