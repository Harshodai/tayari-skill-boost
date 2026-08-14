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

# Dependency installation is deterministic and security scanning is blocking.
grep -q 'pip-audit --requirement requirements.txt.*--strict' .github/workflows/ci.yml
grep -q 'bun install --frozen-lockfile' .github/workflows/ci.yml
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

echo "release contract: PASS"
