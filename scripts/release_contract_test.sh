#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# No release workflow may bake developer-only loopback URLs into a published image.
if grep -RInE 'VITE_(API_URL|SUPABASE_URL)=http://(localhost|127\.0\.0\.1)' .github/workflows/build.yml; then
  echo "release workflow contains a loopback frontend URL" >&2
  exit 1
fi

# Every action reference must be a full immutable commit SHA.
if grep -RIn 'uses:' .github/workflows --include='*.yml' | grep -vE '@[0-9a-f]{40}( |$)'; then
  echo "workflow action is not pinned to a 40-character commit SHA" >&2
  exit 1
fi

# Auth configuration must fail closed in both published frontend build paths.
grep -q 'VITE_SUPABASE_URL is required for release builds' Dockerfile
grep -q 'VITE_SUPABASE_PUBLISHABLE_KEY is required for release builds' Dockerfile
grep -q 'VITE_SUPABASE_URL is required for release builds' infra/containers/frontend.Dockerfile
grep -q 'VITE_SUPABASE_PUBLISHABLE_KEY is required for release builds' infra/containers/frontend.Dockerfile

grep -q 'VITE_SUPABASE_URL:?Set VITE_SUPABASE_URL' scripts/build-images.sh
grep -q 'VITE_SUPABASE_PUBLISHABLE_KEY:?Set VITE_SUPABASE_PUBLISHABLE_KEY' scripts/build-images.sh

grep -q '@sha256:\[0-9a-fA-F\]{64}' scripts/deploy-environment.sh
grep -q 'RELEASE_ATTESTATION_VERIFIED' scripts/deploy-environment.sh
grep -q 'KUBE_CONTEXT must be explicitly set' scripts/deploy-environment.sh
grep -q 'OUTPUT_FILE="$ROOT_DIR/$OUTPUT_FILE"' scripts/render-manifests.sh

# Dependency installation is deterministic and security scanning is blocking.
grep -q 'pip-audit --requirement requirements.txt.*--requirement ../../integrations/jobtheory_mcp/requirements.txt.*--strict' .github/workflows/ci.yml
grep -q 'pip install -r ../../integrations/jobtheory_mcp/requirements.txt' .github/workflows/ci.yml
grep -q 'mcp>=1.28.1' integrations/jobtheory_mcp/requirements.txt
grep -q 'MCP URL and tool contract' .github/workflows/ci.yml
test -f scripts/mcp_contract_test.py
grep -q 'bun install --frozen-lockfile' .github/workflows/ci.yml
# CI coverage and environment contracts must match the reproducible local gates.
grep -q 'GO_COVERAGE_MIN=20 bash ../../scripts/check_go_coverage.sh' .github/workflows/ci.yml
test -x scripts/check_go_coverage.sh
grep -q -- '--cov-fail-under=60' .github/workflows/ci.yml
grep -q -- '--cov-fail-under=60' .github/workflows/deploy.yml
grep -q 'PYTHONPATH:.*backend/python' .github/workflows/ci.yml
grep -q 'PYTHONPATH:.*backend/python' .github/workflows/deploy.yml
grep -q "pytest-asyncio==1.4.0" .github/workflows/ci.yml
grep -q "pytest-asyncio==1.4.0" .github/workflows/deploy.yml
grep -q -- '--select E4,E7,E9,F' .github/workflows/ci.yml
grep -q 'E2E_TEST_PASSWORD' .github/workflows/ci.yml
grep -q 'PLAYWRIGHT_REUSE_EXISTING_SERVER' .github/workflows/ci.yml
grep -q 'PLAYWRIGHT_REUSE_EXISTING_SERVER' playwright.config.ts
grep -q '"@vitest/coverage-v8"' package.json
grep -q 'bun run test -- --coverage' .github/workflows/deploy.yml
grep -q 'cp .env.example .env' .github/workflows/deploy.yml
grep -q 'cp supabase-local/.env.example supabase-local/.env' .github/workflows/deploy.yml
grep -q 'CADDY_HTTPS_PORT=18443' .github/workflows/ci.yml
grep -q 'image: supabase/supavisor:2.9.5' supabase-local/docker-compose.yml
grep -q 'start_period: 30s' supabase-local/docker-compose.yml
grep -q 'POSTGRES_HOST: ${POSTGRES_HOST}' supabase-local/docker-compose.yml
grep -q 'RLIMIT_NOFILE: ${RLIMIT_NOFILE:-100000}' supabase-local/docker-compose.yml
grep -q 'RLIMIT_NOFILE=10000' .github/workflows/ci.yml
grep -q 'CI_JWT_SECRET=' .github/workflows/ci.yml
grep -q 'openssl dgst -sha256 -hmac' .github/workflows/ci.yml
grep -q 'jwt_for_role anon' .github/workflows/ci.yml
grep -q 'jwt_for_role service_role' .github/workflows/ci.yml
test "$(grep -c 'npm install --global --no-audit --no-fund bun@1.3.14' .github/workflows/ci.yml)" -eq 4
grep -q 'npm install --global --no-audit --no-fund bun@1.3.14' .github/workflows/deploy.yml
! grep -RIn 'oven-sh/setup-bun' .github/workflows
! grep -RInE 'yarn (install|build|lint)|bun install --no-save|bun.lockb' .github/workflows Dockerfile* scripts --exclude='*.md'
! grep -q '"lint": "eslint \."' package.json

# Production Compose is image-only and must not carry local development services.
! grep -q '^ *build:' docker-compose.production.yml
! grep -q '^ *profiles:' docker-compose.production.yml
! grep -q 'ollama' docker-compose.production.yml
! grep -q 'supabase-local' docker-compose.production.yml
! grep -qE '^ *- \./' docker-compose.production.yml
while read -r image; do
  [[ "$image" =~ @sha256:[0-9a-fA-F]{64}$ ]]
done < <(grep -E '^    image:' docker-compose.production.yml | sed -E 's/^    image: //; s/\$\{[^:}]+:\?[^}]+\}/example@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/g')

bash scripts/mac_release_contract_test.sh
node scripts/website_release_contract.mjs
bash scripts/staging_recovery_contract_test.sh

# Observability is a release contract: both services must expose protected
# telemetry, and the alert thresholds must remain versioned in the repository.
grep -q 'METRICS_TOKEN' .env.example
test -f infra/endpoint-exposure.yml
grep -q 'default_policy: authenticated' infra/endpoint-exposure.yml
grep -q 's.Router.Get("/metrics"' backend/go/internal/api/router.go
grep -q 'X-Internal-Token' backend/go/internal/observability/metrics.go
grep -q 'RequestTelemetryMiddleware' backend/python/app/main.py
grep -q '"/metrics"' backend/python/app/middleware/internal_gateway.py
grep -q 'llm_errors_total' backend/python/app/tests/test_observability.py
test -f infra/observability/alerts.yml
grep -q 'TayariQueueAgeHigh' infra/observability/alerts.yml
grep -q 'TayariProviderErrors' infra/observability/alerts.yml
grep -q 'TayariBudgetRejections' infra/observability/alerts.yml

echo "release contract: PASS"
