#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
ACTION="${2:-drain}"
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "Usage: scripts/drain-workers.sh <staging|production> <drain|resume>" >&2
  exit 2
fi
if [[ "$ACTION" != "drain" && "$ACTION" != "resume" ]]; then
  echo "Action must be drain or resume." >&2
  exit 2
fi

KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
NAMESPACE="tayari-$ENVIRONMENT"

if [[ "$ACTION" == "resume" ]]; then
  "$KUBECTL_BIN" -n "$NAMESPACE" scale deployment/tayari-worker --replicas=1
  "$KUBECTL_BIN" -n "$NAMESPACE" scale deployment/tayari-celery-beat --replicas=1
  "$KUBECTL_BIN" -n "$NAMESPACE" rollout status deployment/tayari-worker --timeout=5m
  "$KUBECTL_BIN" -n "$NAMESPACE" rollout status deployment/tayari-celery-beat --timeout=5m
  echo "Worker and scheduler service resumed. Review queue age and receipt/cancellation metrics before reopening traffic."
  exit 0
fi

: "${DRAIN_APPROVED:?Set DRAIN_APPROVED=true after reviewing the deployment change}"
if [[ "$DRAIN_APPROVED" != "true" ]]; then
  echo "DRAIN_APPROVED must be exactly true." >&2
  exit 1
fi

# Stop scheduler first so it cannot enqueue new scheduled work while active tasks are reviewed.
"$KUBECTL_BIN" -n "$NAMESPACE" scale deployment/tayari-celery-beat --replicas=0
"$KUBECTL_BIN" -n "$NAMESPACE" rollout status deployment/tayari-celery-beat --timeout=5m

WORKER_POD="$($KUBECTL_BIN -n "$NAMESPACE" get pods -l app.kubernetes.io/name=worker -o jsonpath='{.items[0].metadata.name}')"
if [[ -z "$WORKER_POD" ]]; then
  echo "No worker pod found after scheduler drain; inspect the queue and deployment state manually." >&2
  exit 1
fi

set +e
"$KUBECTL_BIN" -n "$NAMESPACE" exec "$WORKER_POD" -- celery -A app.celery_app:celery_app inspect active
ACTIVE_STATUS=$?
set -e
if [[ "$ACTIVE_STATUS" -ne 0 ]]; then
  echo "Unable to inspect active Celery work. Do not force-scale workers; inspect Redis, worker logs, and candidate run state manually." >&2
  exit 1
fi

cat <<'NOTICE'
Scheduler has been stopped and active task state was printed above.

Do not scale browser-capable workers down while a candidate-approved or external
submission task is still active. Confirm every active run is completed, cancelled,
or safely paused before continuing. This script never replays external actions.
NOTICE

: "${DRAIN_CONFIRMED:?After reviewing active tasks, set DRAIN_CONFIRMED=true to scale workers down}"
if [[ "$DRAIN_CONFIRMED" != "true" ]]; then
  echo "DRAIN_CONFIRMED must be exactly true." >&2
  exit 1
fi

"$KUBECTL_BIN" -n "$NAMESPACE" scale deployment/tayari-worker --replicas=0
echo "Workers are scaled to zero. Resume only with scripts/drain-workers.sh $ENVIRONMENT resume."
