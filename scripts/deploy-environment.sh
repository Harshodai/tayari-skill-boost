#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/deploy-environment.sh <staging|production>

Required environment:
  FRONTEND_IMAGE, GATEWAY_IMAGE, PYTHON_API_IMAGE, WORKER_IMAGE
  DEPLOY_APPROVED=true

Production additionally requires:
  PRODUCTION_CHANGE_APPROVED=true

Optional:
  KUBE_CONTEXT=<expected kubectl context>
  KUBECTL_BIN=kubectl
  KUSTOMIZE_BIN=kustomize
USAGE
}

ENVIRONMENT="${1:-}"
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  usage >&2
  exit 2
fi

: "${DEPLOY_APPROVED:?Set DEPLOY_APPROVED=true after change review}"
if [[ "$DEPLOY_APPROVED" != "true" ]]; then
  echo "DEPLOY_APPROVED must be exactly true." >&2
  exit 1
fi
if [[ "$ENVIRONMENT" == "production" ]]; then
  : "${PRODUCTION_CHANGE_APPROVED:?Set PRODUCTION_CHANGE_APPROVED=true after formal production approval}"
  if [[ "$PRODUCTION_CHANGE_APPROVED" != "true" ]]; then
    echo "PRODUCTION_CHANGE_APPROVED must be exactly true." >&2
    exit 1
  fi
fi

: "${FRONTEND_IMAGE:?FRONTEND_IMAGE is required}"
: "${GATEWAY_IMAGE:?GATEWAY_IMAGE is required}"
: "${PYTHON_API_IMAGE:?PYTHON_API_IMAGE is required}"
: "${WORKER_IMAGE:?WORKER_IMAGE is required}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
RENDERED_MANIFEST="$(mktemp)"
trap 'rm -f "$RENDERED_MANIFEST"' EXIT

if ! command -v "$KUBECTL_BIN" >/dev/null 2>&1; then
  echo "kubectl is required." >&2
  exit 1
fi

CURRENT_CONTEXT="$($KUBECTL_BIN config current-context)"
if [[ -n "${KUBE_CONTEXT:-}" && "$CURRENT_CONTEXT" != "$KUBE_CONTEXT" ]]; then
  echo "Refusing deployment: current context '$CURRENT_CONTEXT' does not match KUBE_CONTEXT '$KUBE_CONTEXT'." >&2
  exit 1
fi

echo "Target context: $CURRENT_CONTEXT"
"$ROOT_DIR/scripts/render-manifests.sh" "$ENVIRONMENT" "$RENDERED_MANIFEST"

NAMESPACE="tayari-$ENVIRONMENT"

# Apply namespace only, then require the operator-managed secrets before any workload is created.
$KUBECTL_BIN apply --server-side --field-manager=tayari-release -f "$RENDERED_MANIFEST" --dry-run=server
$KUBECTL_BIN diff -f "$RENDERED_MANIFEST" || diff_status=$?
if [[ "${diff_status:-0}" -gt 1 ]]; then
  exit "$diff_status"
fi

if ! $KUBECTL_BIN get namespace "$NAMESPACE" >/dev/null 2>&1; then
  echo "Namespace '$NAMESPACE' does not exist. Create it and materialize 'tayari-runtime-secrets' via the approved secret manager before deploying." >&2
  exit 1
fi
if ! $KUBECTL_BIN -n "$NAMESPACE" get secret tayari-runtime-secrets >/dev/null 2>&1; then
  echo "Required secret '$NAMESPACE/tayari-runtime-secrets' is absent. See infra/k8s/SECRETS.md." >&2
  exit 1
fi

$KUBECTL_BIN apply --server-side --field-manager=tayari-release -f "$RENDERED_MANIFEST"

for deployment in tayari-frontend tayari-go-gateway tayari-python-api; do
  $KUBECTL_BIN -n "$NAMESPACE" rollout status "deployment/$deployment" --timeout=5m
done

echo "Deployment of $ENVIRONMENT completed. Run scripts/smoke-test.sh $ENVIRONMENT before traffic promotion."
