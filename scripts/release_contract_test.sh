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
python3 scripts/mcp_write_governance_test.py >/dev/null
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
grep -q 'ANON_KEY=${ANON_KEY}' .github/workflows/ci.yml
grep -q 'SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}' .github/workflows/ci.yml
test "$(grep -c 'npm install --global --no-audit --no-fund bun@1.3.14' .github/workflows/ci.yml)" -eq 4
grep -q 'npm install --global --no-audit --no-fund bun@1.3.14' .github/workflows/deploy.yml
! grep -RIn 'oven-sh/setup-bun' .github/workflows
! grep -RInE 'yarn (install|build|lint)|bun install --no-save|bun.lockb' .github/workflows Dockerfile* scripts --exclude='*.md' --exclude='release_contract_test.sh'
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
bash scripts/production_promotion_gate.sh

# Observability is a release contract: both services must expose protected
# telemetry, and the alert thresholds must remain versioned in the repository.
grep -q 'METRICS_TOKEN' .env.example
test -f infra/endpoint-exposure.yml
grep -q 'default_policy: authenticated' infra/endpoint-exposure.yml
grep -q 's.Router.Get("/metrics"' backend/go/internal/api/router.go
grep -q 'X-Internal-Token' backend/go/internal/observability/metrics.go
grep -q 'RequestTelemetryMiddleware' backend/python/app/main.py
grep -q 'OperationBudgetMiddleware' backend/python/app/main.py
grep -q 'SlowAPIMiddleware' backend/python/app/main.py
grep -q 'publicRateLimiter: newRateLimiter' backend/go/internal/api/router.go
grep -q 'loginRateLimiter.Middleware' backend/go/internal/api/routes_app.go
grep -q 'authRateLimiter.Middleware' backend/go/internal/api/routes_app.go
grep -q 'type rateLimiter struct' backend/go/internal/api/middleware.go
grep -q '"/metrics"' backend/python/app/middleware/internal_gateway.py
grep -q 'llm_errors_total' backend/python/app/tests/test_observability.py
test -f infra/observability/alerts.yml
grep -q 'TayariQueueAgeHigh' infra/observability/alerts.yml
grep -q 'TayariProviderErrors' infra/observability/alerts.yml
grep -q 'TayariBudgetRejections' infra/observability/alerts.yml
# Live verification and external side-effect safety are release contracts.
test -x scripts/live_provider_verify.py
# The GitHub workflow is an optional operator-deployment artifact. When present,
# validate it; when absent, live verification remains an explicit external
# blocker rather than silently being treated as passed.
if [[ -f .github/workflows/live-provider-verify.yml ]]; then
  grep -q 'permissions:' .github/workflows/live-provider-verify.yml
  grep -q 'contents: read' .github/workflows/live-provider-verify.yml
  grep -q -- '--require-providers' .github/workflows/live-provider-verify.yml
  grep -q 'ALLOW_LIVE_PROVIDER_VERIFY: "true"' .github/workflows/live-provider-verify.yml
fi
grep -q 'SMTP_HOST: ${SMTP_HOST:-}' docker-compose.production.yml
grep -q 'SMTP_HOST: ${SMTP_HOST:-}' docker-compose.aws.yml
grep -q 'SMTP provider is not configured for production notification delivery' backend/python/app/services/notifications.py
grep -q 'post-persistence billing debit failed' backend/python/app/services/submission_receipt.py
grep -q 'LLM_PROVIDER=openrouter requires OPENROUTER_API_KEY' backend/python/app/services/llm_service.py
test -f backend/python/app/tests/test_llm_provider_configuration.py
grep -q 'billing database unavailable' backend/go/internal/billing/billing.go
grep -q 'TestBilling_ProductionRequiresDurableStorage' backend/go/internal/billing/billing_test.go
test -x scripts/verify_rls_contract.py
python3 scripts/verify_rls_contract.py >/dev/null
test -x scripts/verify_observability_contract.py
python3 scripts/verify_observability_contract.py >/dev/null
grep -q 'stripe_webhook_events' backend/db/migrations/20260817_stripe_webhook_events.sql
test -f supabase-local/volumes/db/init/35-20260817_stripe_webhook_events.sql
grep -q 'stripe_webhook_events' supabase-local/volumes/db/init/35-20260817_stripe_webhook_events.sql
grep -q 'zz-35-20260817_stripe_webhook_events.sql' supabase-local/docker-compose.yml
grep -q 'stripe_webhook_events' scripts/backup-restore-smoke.sh
test -x scripts/verify_self_hosted_migrations.py
python3 scripts/verify_self_hosted_migrations.py >/dev/null
grep -q 'autopilot_runs(run_id)' backend/db/migrations/0002_tayari_core_architecture.sql
grep -q 'autopilot_runs(run_id)' supabase-local/volumes/db/init/25-0002_tayari_core_architecture.sql
test -f docs/launch/2026-workspace-scope.yml
grep -q 'autonomous.ats_submit' docs/launch/2026-workspace-scope.yml
grep -q 'AutonomousBrowser' backend/go/internal/capabilities/capabilities.go
grep -q 'disabled_by_launch_scope' backend/go/internal/api/router.go
grep -q 'AUTONOMOUS_BROWSER' backend/python/app/services/capabilities.py
grep -q 'WORKSPACE_EXTERNAL_RESEARCH' backend/python/app/services/capabilities.py
grep -q 'WORKSPACE_EXTERNAL_RESEARCH_FIRECRAWL' backend/python/app/services/capabilities.py
grep -q 'WORKSPACE_EXTERNAL_RESEARCH_APIFY' backend/python/app/services/capabilities.py
grep -q 'CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH_FIRECRAWL' scripts/verify_external_provider_config.py
grep -q 'CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH_APIFY' scripts/verify_external_provider_config.py
grep -q 'INTEGRATION_A2A_FEDERATION' backend/python/app/services/capabilities.py
test -f backend/python/app/services/external_research.py
test -f backend/python/app/api/external_research_routes.py
test -f backend/python/app/a2a/federation.py
test -f backend/python/app/tests/test_external_research.py
test -f backend/python/app/tests/test_a2a_federation.py
test -f docs/integrations/a2a-mcp-provider-adapters.md
test -x scripts/verify_external_provider_config.py
test -f docs/operations/staging-external-integrations.md
# P0/P1 agent-surface governance: mutating MCP tools are fail-closed, the
# legacy Python registry is not public, and durable automation runs have leases.
test -f docs/governance/mcp-tool-governance.md
grep -q 'requireMcpWriteTool' supabase/functions/mcp/index.ts
grep -q 'CAPABILITY_MCP_WRITE_TOOLS' supabase/functions/mcp/index.ts
grep -q 'disabled_by_launch_scope' supabase/functions/mcp/index.ts
grep -q 'legacy_registry_public.*False' backend/python/app/routes/agent.py
grep -q 'def list_public_tools' backend/python/app/agent/mcp_manager.py
test -f backend/db/migrations/20260820_01_automation_lease_recovery.sql
grep -q 'lease_owner' backend/db/migrations/20260820_01_automation_lease_recovery.sql
grep -q 'automation.run.reclaimed' backend/python/app/tasks/agent_automation.py
grep -q 'def _heartbeat_run' backend/python/app/tasks/agent_automation.py
grep -q 'token_hash' backend/db/migrations/20260817_password_reset_token_hash.sql
test -f supabase-local/volumes/db/init/36-20260817_password_reset_token_hash.sql
test -x scripts/verify_route_authorization_contract.py
python3 scripts/verify_route_authorization_contract.py >/dev/null
grep -q 'except LLMNotConfiguredError' backend/python/app/routes/health.py
grep -q '_pool_loop' backend/python/app/services/db.py
test -f backend/python/tests/test_health.py
test -x scripts/rollback.sh
test -x scripts/backup-restore-smoke.sh
test -x scripts/restore-drill.sh
grep -q 'DRY_RUN' scripts/rollback.sh
grep -q 'DRY_RUN' scripts/backup-restore-smoke.sh
grep -q 'DRY_RUN' scripts/restore-drill.sh
# Local no-database fallbacks are intentional test/development behavior, never
# an implicit production persistence mode.
test -f docs/production-readiness.md
grep -q 'Intentional no-database behavior' docs/production-readiness.md
grep -q 'configured but the pool unavailable' docs/production-readiness.md
grep -q 'must never be enabled for a production deployment' docs/production-readiness.md
# Performance evidence must be target-gated; a simulated sleep cannot certify production latency.
test -x scripts/perf_check.sh
! grep -q 'simulated' scripts/perf_check.sh
 grep -q -- '--plan' scripts/perf_check.sh
python3 scripts/run_staging_hostile_suite.py --plan >/dev/null
# Production truth is a release contract: demo fixtures and disabled routes must
# never report live success or bypass the declared launch scope.
test -x scripts/verify_production_truth_contract.py
python3 scripts/verify_production_truth_contract.py >/dev/null
# Staging promotion evidence is schema-checked; live calls remain explicit and
# require operator authorization plus real staging endpoints.
test -x scripts/verify_staging_evidence_bundle.py
python3 scripts/verify_staging_evidence_bundle.py --plan >/dev/null
test -x scripts/verify_ai_system_inventory.py
python3 scripts/verify_ai_system_inventory.py >/dev/null
test -x scripts/verify_recovery_evidence.py
python3 scripts/verify_recovery_evidence.py --plan >/dev/null

# The registry is only useful if it is compared with the mounted gateway. Keep
# this generated check in the release gate so new anonymous routes cannot be
# introduced without an explicit exposure decision.
ROUTE_INVENTORY="$(mktemp -t tayari-route-inventory.XXXXXX.json)"
LIVE_PROVIDER_CONTRACT="$(mktemp -t tayari-live-provider-contract.XXXXXX.json)"
trap 'rm -f "$ROUTE_INVENTORY" "$LIVE_PROVIDER_CONTRACT"' EXIT
(cd backend/go && go run ./cmd/route_inventory -o "$ROUTE_INVENTORY") >/dev/null
python3 scripts/verify_endpoint_exposure.py "$ROUTE_INVENTORY"
test -x scripts/live_provider_verify.py
python3 -m pytest -q scripts/test_live_provider_verify.py
python3 scripts/live_provider_verify.py --environment release --output "$LIVE_PROVIDER_CONTRACT" >/dev/null

echo "release contract: PASS"
# AWS canary uses Supabase GoTrue in the gateway, so the frontend must use the
# Supabase client path rather than the legacy Go-issued self-hosted JWT path.
grep -q 'USE_SUPABASE: "true"' docker-compose.aws.yml
grep -q 'VITE_USE_SELF_HOSTED: "false"' docker-compose.aws.yml
