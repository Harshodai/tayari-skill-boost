#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "Usage: scripts/smoke-test.sh <staging|production>" >&2
  exit 2
fi

KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
NAMESPACE="tayari-$ENVIRONMENT"
RUN_NAME="tayari-smoke-$(date +%s)"

if ! command -v "$KUBECTL_BIN" >/dev/null 2>&1; then
  echo "kubectl is required." >&2
  exit 1
fi

cleanup() {
  "$KUBECTL_BIN" -n "$NAMESPACE" delete pod "$RUN_NAME" --ignore-not-found --wait=false >/dev/null 2>&1 || true
}
trap cleanup EXIT

for deployment in tayari-frontend tayari-go-gateway tayari-python-api; do
  "$KUBECTL_BIN" -n "$NAMESPACE" rollout status "deployment/$deployment" --timeout=5m
done

"$KUBECTL_BIN" -n "$NAMESPACE" run "$RUN_NAME" \
  --image=curlimages/curl:8.12.1 \
  --restart=Never \
  --labels="app.kubernetes.io/part-of=job-tayari,app.kubernetes.io/component=smoke-test" \
  --command -- sh -ceu '
    curl --fail --silent --show-error http://tayari-frontend/healthz >/dev/null
    curl --fail --silent --show-error http://tayari-go-gateway:8080/api/health >/dev/null
    curl --fail --silent --show-error http://tayari-python-api:8000/api/health >/dev/null
  '

"$KUBECTL_BIN" -n "$NAMESPACE" wait --for=condition=Ready "pod/$RUN_NAME" --timeout=90s || true
"$KUBECTL_BIN" -n "$NAMESPACE" wait --for=jsonpath='{.status.phase}'=Succeeded "pod/$RUN_NAME" --timeout=180s
"$KUBECTL_BIN" -n "$NAMESPACE" logs "$RUN_NAME"

echo "In-cluster smoke test passed for $ENVIRONMENT."
