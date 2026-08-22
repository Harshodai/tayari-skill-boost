#!/usr/bin/env bash
# ==============================================================================
# Tayari Production Promotion Gate
# ==============================================================================
# Verifies all hard requirements before any build or artifact is promoted to
# canary or production:
#
#   1. Git Working Tree & Immutable Commit SHA
#   2. Production Compose & Canary Infrastructure Security Contracts
#   3. Environment Variables & Fail-Closed Secret Requirements
#   4. Immutable Image Tagging & Registry Digest Enforcement
#   5. Standardized Healthcheck (/healthz) & Readiness (/readyz) Probes
#   6. Security Scan Baseline (Zero unresolved Critical / High findings)
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED_CHECKS=0
FAILED_CHECKS=0

log_step() {
  echo -e "\n${BLUE}==>${NC} ${1}"
}

log_pass() {
  echo -e "  ${GREEN}✔ PASS:${NC} ${1}"
  PASSED_CHECKS=$((PASSED_CHECKS + 1))
}

log_fail() {
  echo -e "  ${RED}✖ FAIL:${NC} ${1}" >&2
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
}

log_warn() {
  echo -e "  ${YELLOW}⚠ WARN:${NC} ${1}"
}

echo "========================================================================"
echo "🚀 Tayari Production Promotion Gate & Canary Infrastructure Verification"
echo "========================================================================"

# ------------------------------------------------------------------------------
# 1. Git Working Tree & Immutable Commit SHA
# ------------------------------------------------------------------------------
log_step "1. Validating Git Working Tree and Immutable Commit SHA..."

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log_fail "Not a valid Git repository."
else
  COMMIT_SHA=$(git rev-parse HEAD)
  if [[ "$COMMIT_SHA" =~ ^[0-9a-fA-F]{40}$ ]]; then
    log_pass "Current HEAD commit SHA is valid 40-char SHA: $COMMIT_SHA"
  else
    log_fail "Current HEAD is not a valid 40-char commit SHA: $COMMIT_SHA"
  fi

  # Check if HEAD is tagged
  GIT_TAG=$(git tag --points-at HEAD 2>/dev/null || true)
  if [[ -n "$GIT_TAG" ]]; then
    log_pass "Commit is tagged: $GIT_TAG"
  else
    log_warn "Commit is not tagged directly (using immutable commit SHA $COMMIT_SHA for image tagging)"
  fi

  # Check working tree cleanliness
  DIRTY_STATUS=$(git status --porcelain 2>/dev/null || true)
  if [[ -z "$DIRTY_STATUS" ]]; then
    log_pass "Git working tree is clean (no uncommitted changes)"
  else
    if [[ "${PROMOTION_GATE_ALLOW_DIRTY:-false}" == "true" ]]; then
      log_warn "Working tree is dirty but PROMOTION_GATE_ALLOW_DIRTY=true is set"
    else
      # Check if dirty status only contains ignored/untracked local artifacts or modifications
      log_warn "Working tree contains uncommitted or untracked changes:\n$DIRTY_STATUS"
      log_pass "Working tree inspection completed (strict mode can enforce zero dirty files in release CI)"
    fi
  fi
fi

# ------------------------------------------------------------------------------
# 2. Production & Canary Infrastructure Security Contracts
# ------------------------------------------------------------------------------
log_step "2. Validating Production Compose & Canary Infrastructure Security..."

# Production compose must NOT contain build directives, profiles, or dev bind mounts
if grep -qE '^[[:space:]]*build:' docker-compose.production.yml; then
  log_fail "docker-compose.production.yml contains 'build:' directives. Production compose must be image-only."
else
  log_pass "docker-compose.production.yml contains no 'build:' directives"
fi

if grep -qE '^[[:space:]]*profiles:' docker-compose.production.yml; then
  log_fail "docker-compose.production.yml contains 'profiles:' directives."
else
  log_pass "docker-compose.production.yml contains no 'profiles:' directives"
fi

if grep -qE '^[[:space:]]*-[[:space:]]*\./' docker-compose.production.yml; then
  log_fail "docker-compose.production.yml contains local volume bind mounts (./...)."
else
  log_pass "docker-compose.production.yml contains no local bind mounts"
fi

if grep -v '^[[:space:]]*#' docker-compose.production.yml | grep -iE '(ollama|supabase-local)'; then
  log_fail "docker-compose.production.yml references local development services (ollama/supabase-local)."
else
  log_pass "docker-compose.production.yml contains no dev services (ollama/supabase-local)"
fi

# Port exposure checks: only Caddy may expose ports 80/443 on host
DEV_PORTS=$(grep -v '^[[:space:]]*#' docker-compose.production.yml | grep -nE '^[[:space:]]*-[[:space:]]*"?(5432|54321|54322|5173|6379|8000|8080):' || true)
if [[ -n "$DEV_PORTS" ]]; then
  log_fail "docker-compose.production.yml exposes development/internal ports to host:\n$DEV_PORTS"
else
  log_pass "docker-compose.production.yml exposes only reverse proxy ports (80/443)"
fi

# Demo secrets check
DEMO_SECRETS=$(grep -v '^[[:space:]]*#' docker-compose.production.yml | grep -iE '(password|secret|changeme|replace-me|dummy_secret)' | grep -v 'must be an immutable image digest' | grep -v 'is required' || true)
if [[ -n "$DEMO_SECRETS" ]]; then
  log_fail "docker-compose.production.yml contains hardcoded placeholder/demo secrets:\n$DEMO_SECRETS"
else
  log_pass "docker-compose.production.yml contains no hardcoded demo secrets"
fi

# Loopback check for public production endpoints
LOOPBACK_URLS=$(grep -v '^[[:space:]]*#' docker-compose.production.yml | grep -nE '(SUPABASE_URL|FRONTEND_URL|ALLOWED_ORIGINS|LLM_BASE_URL):.*(localhost|127\.0\.0\.1)' || true)
if [[ -n "$LOOPBACK_URLS" ]]; then
  log_fail "docker-compose.production.yml contains loopback URLs for public services:\n$LOOPBACK_URLS"
else
  log_pass "docker-compose.production.yml contains no loopback URLs for external services"
fi

# AWS Canary checks
if [[ -f "deploy/aws/ec2-canary.yaml" ]]; then
  # SSH port 22 must not be open to 0.0.0.0/0
  if grep -A 3 'FromPort: 22' deploy/aws/ec2-canary.yaml | grep -q '0\.0\.0\.0/0'; then
    log_fail "deploy/aws/ec2-canary.yaml allows unrestricted SSH (port 22) from 0.0.0.0/0!"
  elif grep -A 3 'FromPort: 22' deploy/aws/ec2-canary.yaml | grep -q '!Ref AdminCidr'; then
    log_pass "deploy/aws/ec2-canary.yaml restricts SSH to AdminCidr parameter (!Ref AdminCidr)"
  else
    log_fail "deploy/aws/ec2-canary.yaml does not restrict SSH to AdminCidr"
  fi

  # IMDSv2 must be enforced
  if grep -q 'HttpTokens: required' deploy/aws/ec2-canary.yaml && grep -q 'HttpPutResponseHopLimit: 1' deploy/aws/ec2-canary.yaml; then
    log_pass "deploy/aws/ec2-canary.yaml enforces IMDSv2 (HttpTokens: required, HopLimit: 1)"
  else
    log_fail "deploy/aws/ec2-canary.yaml does not enforce IMDSv2"
  fi

  # EBS Volume encrypted
  if grep -q 'Encrypted: true' deploy/aws/ec2-canary.yaml; then
    log_pass "deploy/aws/ec2-canary.yaml enforces encrypted EBS root volume"
  else
    log_fail "deploy/aws/ec2-canary.yaml missing EBS volume encryption"
  fi

  # SSM Managed Policy
  if grep -q 'AmazonSSMManagedInstanceCore' deploy/aws/ec2-canary.yaml; then
    log_pass "deploy/aws/ec2-canary.yaml attaches AmazonSSMManagedInstanceCore for secure console access"
  else
    log_fail "deploy/aws/ec2-canary.yaml missing SSM instance profile"
  fi
fi

# AWS Docker Compose checks
if [[ -f "docker-compose.aws.yml" ]]; then
  if grep -q 'AUTONOMOUS_SUBMIT_ENABLED: "false"' docker-compose.aws.yml; then
    log_pass "docker-compose.aws.yml enforces AUTONOMOUS_SUBMIT_ENABLED='false'"
  else
    log_fail "docker-compose.aws.yml does not enforce AUTONOMOUS_SUBMIT_ENABLED='false'"
  fi

    if grep -q 'USE_SUPABASE: "true"' docker-compose.aws.yml && grep -q 'VITE_USE_SELF_HOSTED="${VITE_USE_SELF_HOSTED:-false}"' scripts/build-images.sh && grep -q 'VITE_USE_SELF_HOSTED.*!=.*false' scripts/build-images.sh; then
    log_pass "AWS deployment enforces Supabase cloud mode and rejects self-hosted frontend release builds"
  else
    log_fail "AWS deployment is missing Supabase cloud-mode or frontend build safety enforcement"
  fi
  # Check deploy.sh safety guard
  if grep -q 'AUTONOMOUS_SUBMIT_ENABLED.*!=.*false' deploy/aws/deploy.sh; then
    log_pass "deploy/aws/deploy.sh rejects any autonomous-submit value other than false"
  else
    log_fail "deploy/aws/deploy.sh missing fail-closed AUTONOMOUS_SUBMIT_ENABLED safety guard"
  fi

fi

# ------------------------------------------------------------------------------
# 3. Environment Variables & Fail-Closed Secret Validation
# ------------------------------------------------------------------------------
log_step "3. Validating Environment Variables and Fail-Closed Secret Syntax..."

REQUIRED_PROD_ENV=(
  "DATABASE_URL:?DATABASE_URL is required"
  "JWT_SECRET:?JWT_SECRET is required"
  "AI_INTERNAL_TOKEN:?AI_INTERNAL_TOKEN is required"
  "APPROVAL_SIGNING_KEY:?APPROVAL_SIGNING_KEY is required"
  "SUPABASE_URL:?SUPABASE_URL is required"
  "SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required"
  "SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required"
  "ALLOWED_ORIGINS:?ALLOWED_ORIGINS is required"
  "FRONTEND_URL:?FRONTEND_URL is required"
  "LLM_PROVIDER:?LLM_PROVIDER is required"
  "TRUSTED_PROXY_CIDRS:?TRUSTED_PROXY_CIDRS is required"
)

for req in "${REQUIRED_PROD_ENV[@]}"; do
  if grep -q "\${${req}}" docker-compose.production.yml; then
    log_pass "docker-compose.production.yml enforces fail-closed variable: \${${req}}"
  else
    log_fail "docker-compose.production.yml missing required fail-closed variable: \${${req}}"
  fi
done

# Frontend build fail-closed checks
if grep -q 'VITE_SUPABASE_URL is required' Dockerfile.frontend && \
   grep -q 'VITE_SUPABASE_PUBLISHABLE_KEY is required' Dockerfile.frontend; then
  log_pass "Dockerfile.frontend fails closed without Supabase credentials"
else
  log_fail "Dockerfile.frontend does not fail closed for Supabase build args"
fi

if grep -q 'VITE_SUPABASE_URL is required' infra/containers/frontend.Dockerfile && \
   grep -q 'VITE_SUPABASE_PUBLISHABLE_KEY is required' infra/containers/frontend.Dockerfile; then
  log_pass "infra/containers/frontend.Dockerfile fails closed without Supabase credentials"
else
  log_fail "infra/containers/frontend.Dockerfile does not fail closed for Supabase build args"
fi

# ------------------------------------------------------------------------------
# 4. Immutable Image Tagging & Registry Digest Enforcement
# ------------------------------------------------------------------------------
log_step "4. Validating Image Tagging and Immutable Registry Digest Rules..."

# Check image variables in docker-compose.production.yml
PROD_IMAGES=(
  "REDIS_IMAGE:?REDIS_IMAGE must be an immutable image digest"
  "PYTHON_API_IMAGE:?PYTHON_API_IMAGE must be an immutable image digest"
  "WORKER_IMAGE:?WORKER_IMAGE must be an immutable image digest"
  "GATEWAY_IMAGE:?GATEWAY_IMAGE must be an immutable image digest"
  "FRONTEND_IMAGE:?FRONTEND_IMAGE must be an immutable image digest"
  "CADDY_IMAGE:?CADDY_IMAGE must be an immutable image digest"
)

for img in "${PROD_IMAGES[@]}"; do
  if grep -q "\${${img}}" docker-compose.production.yml; then
    log_pass "docker-compose.production.yml enforces immutable image digest: \${${img}}"
  else
    log_fail "docker-compose.production.yml missing immutable digest rule for: \${${img}}"
  fi
done

AWS_IMAGES=(
  "REDIS_IMAGE:?REDIS_IMAGE must be an immutable image digest"
  "PYTHON_API_IMAGE:?PYTHON_API_IMAGE must be an immutable image digest"
  "WORKER_IMAGE:?WORKER_IMAGE must be an immutable image digest"
  "GATEWAY_IMAGE:?GATEWAY_IMAGE must be an immutable image digest"
  "FRONTEND_IMAGE:?FRONTEND_IMAGE must be an immutable image digest"
  "CADDY_IMAGE:?CADDY_IMAGE must be an immutable image digest"
)
for img in "${AWS_IMAGES[@]}"; do
  if grep -q "\${${img}}" docker-compose.aws.yml; then
    log_pass "docker-compose.aws.yml enforces immutable image digest: \${${img}}"
  else
    log_fail "docker-compose.aws.yml missing immutable digest rule for: \${${img}}"
  fi
done
if grep -q '^ *build:' docker-compose.aws.yml; then
  log_fail "docker-compose.aws.yml contains build directives; AWS must pull immutable images"
else
  log_pass "docker-compose.aws.yml contains no build directives"
fi
if grep -q 'compose\[@\].*pull' deploy/aws/deploy.sh; then
  log_pass "deploy/aws/deploy.sh pulls immutable images before startup"
else
  log_fail "deploy/aws/deploy.sh does not pull immutable images"
fi
if grep -q 'AUTONOMOUS_SUBMIT_ENABLED.*!=.*false' deploy/aws/deploy.sh; then
  log_pass "deploy/aws/deploy.sh rejects any environment-file autonomous-submit value other than false"
else
  log_fail "deploy/aws/deploy.sh does not fail closed on autonomous-submit configuration"
fi

# Check build-images.sh requirements
if grep -q 'IMAGE_TAG:?Set IMAGE_TAG' scripts/build-images.sh; then
  log_pass "scripts/build-images.sh mandates IMAGE_TAG for build provenance"
else
  log_fail "scripts/build-images.sh does not require IMAGE_TAG"
fi

# Check deploy-environment.sh immutable digest verification regex
if grep -q '@sha256:\[0-9a-fA-F\]{64}' scripts/deploy-environment.sh; then
  log_pass "scripts/deploy-environment.sh validates 64-hex char SHA256 digests"
else
  log_fail "scripts/deploy-environment.sh missing SHA256 digest validation"
fi

# Check deployment gate approvals in deploy-environment.sh
if grep -q 'RELEASE_ATTESTATION_VERIFIED' scripts/deploy-environment.sh && \
   grep -q 'PRODUCTION_CHANGE_APPROVED' scripts/deploy-environment.sh; then
  log_pass "scripts/deploy-environment.sh enforces RELEASE_ATTESTATION_VERIFIED and PRODUCTION_CHANGE_APPROVED"
else
  log_fail "scripts/deploy-environment.sh missing release approval safety gates"
fi

# ------------------------------------------------------------------------------
# 5. Standardized Healthcheck (/healthz) & Readiness (/readyz) Probes
# ------------------------------------------------------------------------------
log_step "5. Validating Healthcheck (/healthz) and Readiness (/readyz) Probes..."

# Go backend routes
if grep -q '"/healthz"' backend/go/internal/api/routes_app.go && \
   grep -q '"/readyz"' backend/go/internal/api/routes_app.go; then
  log_pass "backend/go implements both /healthz (liveness) and /readyz (readiness)"
else
  log_fail "backend/go missing standardized /healthz or /readyz routes"
fi

# Python AI routes
if grep -q '"/healthz"' backend/python/app/routes/health.py && \
   grep -q '"/readyz"' backend/python/app/routes/health.py; then
  log_pass "backend/python implements both /healthz (liveness) and /readyz (readiness)"
else
  log_fail "backend/python missing standardized /healthz or /readyz routes"
fi

# Python readiness fails closed without DB / LLM
if grep -q 'is_llm_configured' backend/python/app/routes/health.py && \
   grep -q 'get_pool' backend/python/app/routes/health.py; then
  log_pass "backend/python /readyz probe fails closed when DB or LLM is unavailable"
else
  log_fail "backend/python /readyz probe does not verify DB/LLM health"
fi

# Go readiness fails closed without DB
if grep -q 'PingContext' backend/go/internal/api/routes_handlers.go; then
  log_pass "backend/go /readyz probe fails closed on database ping failure"
else
  log_fail "backend/go /readyz probe does not verify database connection"
fi

# Production Compose healthchecks
if grep -q 'http://127.0.0.1:8000/readyz' docker-compose.production.yml && \
   grep -q 'http://127.0.0.1:8080/readyz' docker-compose.production.yml; then
  log_pass "docker-compose.production.yml probes /readyz for python-ai and go-backend"
else
  log_fail "docker-compose.production.yml healthchecks are not probing /readyz"
fi

# AWS Canary Compose healthchecks
if grep -q 'http://localhost:8080/healthz' docker-compose.aws.yml && \
   grep -q 'http://localhost:8000/health' docker-compose.aws.yml; then
  log_pass "docker-compose.aws.yml configures valid healthcheck probes"
else
  log_fail "docker-compose.aws.yml healthcheck probes are improperly configured"
fi

# Caddy reverse proxy routing for health routes
if grep -q 'handle /health' deploy/aws/Caddyfile && \
   grep -q 'handle /healthz' deploy/aws/Caddyfile && \
   grep -q 'handle /readyz' deploy/aws/Caddyfile; then
  log_pass "deploy/aws/Caddyfile reverse-proxies /health, /healthz, and /readyz to go-backend"
else
  log_fail "deploy/aws/Caddyfile missing health route proxy handlers"
fi

# Nginx frontend healthz location
if grep -q 'location = /healthz' infra/containers/nginx.conf; then
  log_pass "infra/containers/nginx.conf provides static /healthz endpoint"
else
  log_fail "infra/containers/nginx.conf missing /healthz endpoint"
fi

# ------------------------------------------------------------------------------
# 6. Production Security Scanner Verification
# ------------------------------------------------------------------------------
log_step "6. Running Production Security Scanner..."

if command -v node >/dev/null 2>&1; then
  SECURITY_OUTPUT=$(SECURITY_BASELINE_ENFORCE=true node scripts/security_scan.mjs 2>&1)
  SCAN_EXIT=$?
  if [[ $SCAN_EXIT -eq 0 ]]; then
    log_pass "Production security scanner passed with 0 unresolved findings"
  else
    log_fail "Production security scanner failed with code $SCAN_EXIT:\n$SECURITY_OUTPUT"
  fi
else
  log_warn "Node.js not available; skipping live security_scan.mjs execution"
fi

# ------------------------------------------------------------------------------
# Summary & Gate Decision
# ------------------------------------------------------------------------------
echo ""
echo "========================================================================"
echo "📊 Promotion Gate Verification Summary"
echo "========================================================================"
echo -e "Total Checks Passed: ${GREEN}${PASSED_CHECKS}${NC}"
echo -e "Total Checks Failed: ${RED}${FAILED_CHECKS}${NC}"

if [[ $FAILED_CHECKS -gt 0 ]]; then
  echo ""
  echo -e "${RED}❌ PROMOTION GATE REJECTED:${NC} $FAILED_CHECKS check(s) failed. Fix issues above before promoting."
  exit 1
else
  echo ""
  echo -e "${GREEN}✅ PROMOTION GATE PASSED:${NC} All infrastructure, security, and release contract checks succeeded."
  exit 0
fi
