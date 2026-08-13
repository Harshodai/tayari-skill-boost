#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
TARGET_REVISION="${2:-}"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "Usage: scripts/rollback.sh <staging|production> [revision]" >&2
  exit 2
fi

: "${ROLLBACK_APPROVED:?Set ROLLBACK_APPROVED=true after incident/change-owner approval}"
if [[ "$ROLLBACK_APPROVED" != "true" ]]; then
  echo "ROLLBACK_APPROVED must be exactly true." >&2
  exit 1
fi
if [[ "$ENVIRONMENT" == "production" ]]; then
  : "${PRODUCTION_CHANGE_APPROVED:?Set PRODUCTION_CHANGE_APPROVED=true for production rollback}"
  if [[ "$PRODUCTION_CHANGE_APPROVED" != "true" ]]; then
    echo "PRODUCTION_CHANGE_APPROVED must be exactly true." >&2
    exit 1
  fi
fi

KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
NAMESPACE="tayari-$ENVIRONMENT"
DEPLOYMENTS=(tayari-frontend tayari-go-gateway tayari-python-api)

for deployment in "${DEPLOYMENTS[@]}"; do
  if [[ -n "$TARGET_REVISION" ]]; then
    "$KUBECTL_BIN" -n "$NAMESPACE" rollout undo "deployment/$deployment" --to-revision="$TARGET_REVISION"
  else
    "$KUBECTL_BIN" -n "$NAMESPACE" rollout undo "deployment/$deployment"
  fi
  "$KUBECTL_BIN" -n "$NAMESPACE" rollout status "deployment/$deployment" --timeout=5m
done

cat <<'NOTICE'
Rollback completed for frontend, Go gateway, and Python API workloads.

This script intentionally does not roll back database migrations, Celery beat,
or browser workers. Database restoration requires the approved recovery runbook.
Browser tasks are not replayed automatically because external actions can be
non-idempotent and candidate approval/cancellation state must be inspected first.
NOTICE
