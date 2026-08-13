#!/usr/bin/env bash
set -euo pipefail

: "${REGISTRY:?Set REGISTRY, for example ghcr.io/<owner>/<repository>}"
: "${IMAGE_TAG:?Set IMAGE_TAG to an immutable release identifier, preferably a commit SHA}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUSH="${PUSH:-false}"
PLATFORMS="${PLATFORMS:-linux/amd64}"
BUILDER="${BUILDER:-tayari-release-builder}"

if [[ "$PUSH" != "true" && "$PUSH" != "false" ]]; then
  echo "PUSH must be true or false." >&2
  exit 2
fi

if ! docker buildx inspect "$BUILDER" >/dev/null 2>&1; then
  docker buildx create --name "$BUILDER" --use
else
  docker buildx use "$BUILDER"
fi

docker buildx inspect --bootstrap >/dev/null

OUTPUT_ARGS=(--load)
if [[ "$PUSH" == "true" ]]; then
  OUTPUT_ARGS=(--push)
fi

build_image() {
  local name="$1"
  local dockerfile="$2"
  shift 2
  local image="$REGISTRY/$name:$IMAGE_TAG"

  echo "Building $image"
  docker buildx build "$ROOT_DIR" \
    --file "$ROOT_DIR/$dockerfile" \
    --tag "$image" \
    --platform "$PLATFORMS" \
    --provenance=true \
    --sbom=true \
    "${OUTPUT_ARGS[@]}" \
    "$@"
  echo "$image"
}

build_image tayari-frontend infra/containers/frontend.Dockerfile \
  --build-arg VITE_API_URL="${VITE_API_URL:-/api}" \
  --build-arg VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-}" \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}" \
  --build-arg VITE_USE_SELF_HOSTED="${VITE_USE_SELF_HOSTED:-false}" \
  --build-arg VITE_SUPABASE_PROJECT_ID="${VITE_SUPABASE_PROJECT_ID:-}" \
  --build-arg VITE_SENTRY_DSN="${VITE_SENTRY_DSN:-}" \
  --build-arg VITE_SENTRY_ENVIRONMENT="${VITE_SENTRY_ENVIRONMENT:-production}"
build_image tayari-gateway infra/containers/go-gateway.Dockerfile
build_image tayari-python-ai infra/containers/python-api.Dockerfile
build_image tayari-worker infra/containers/worker.Dockerfile

echo "Images were built with tag $IMAGE_TAG. Resolve registry digests and use the @sha256 form in deployment variables before promotion."
