#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/render-manifests.sh <development|staging|production> <output-file> [--allow-placeholders]

Required for deployable output:
  FRONTEND_IMAGE       Immutable frontend image reference, preferably @sha256 digest
  GATEWAY_IMAGE        Immutable Go gateway image reference, preferably @sha256 digest
  PYTHON_API_IMAGE     Immutable Python API image reference, preferably @sha256 digest
  WORKER_IMAGE         Immutable Celery/browser worker image reference, preferably @sha256 digest

Use --allow-placeholders only for local structural validation. Placeholder images
must never be applied to a cluster.
USAGE
}

ENVIRONMENT="${1:-}"
OUTPUT_FILE="${2:-}"
ALLOW_PLACEHOLDERS="${3:-}"

if [[ "$ENVIRONMENT" != "development" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  usage >&2
  exit 2
fi
if [[ -z "$OUTPUT_FILE" ]]; then
  usage >&2
  exit 2
fi
if [[ -n "$ALLOW_PLACEHOLDERS" && "$ALLOW_PLACEHOLDERS" != "--allow-placeholders" ]]; then
  usage >&2
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUSTOMIZE_BIN="${KUSTOMIZE_BIN:-kustomize}"

if ! command -v "$KUSTOMIZE_BIN" >/dev/null 2>&1; then
  echo "kustomize is required. Install Kustomize v5+ or set KUSTOMIZE_BIN." >&2
  exit 1
fi

if [[ -z "$ALLOW_PLACEHOLDERS" ]]; then
  : "${FRONTEND_IMAGE:?FRONTEND_IMAGE is required}"
  : "${GATEWAY_IMAGE:?GATEWAY_IMAGE is required}"
  : "${PYTHON_API_IMAGE:?PYTHON_API_IMAGE is required}"
  : "${WORKER_IMAGE:?WORKER_IMAGE is required}"
fi

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

cp -R "$ROOT_DIR/infra/k8s" "$TMP_DIR/k8s"
pushd "$TMP_DIR/k8s/overlays/$ENVIRONMENT" >/dev/null

if [[ -z "$ALLOW_PLACEHOLDERS" ]]; then
  "$KUSTOMIZE_BIN" edit set image \
    "ghcr.io/job-tayari/tayari-frontend:replace-me=$FRONTEND_IMAGE" \
    "ghcr.io/job-tayari/tayari-gateway:replace-me=$GATEWAY_IMAGE" \
    "ghcr.io/job-tayari/tayari-python-ai:replace-me=$PYTHON_API_IMAGE" \
    "ghcr.io/job-tayari/tayari-worker:replace-me=$WORKER_IMAGE"
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"
"$KUSTOMIZE_BIN" build . > "$OUTPUT_FILE"
popd >/dev/null

if grep -q 'replace-me' "$OUTPUT_FILE" && [[ -z "$ALLOW_PLACEHOLDERS" ]]; then
  echo "Rendered manifest contains placeholder images; refusing deployable output." >&2
  exit 1
fi

echo "Rendered $ENVIRONMENT manifests to $OUTPUT_FILE"
