# Tayari Skill Boost — Rollback

## Rollback principle

Rollback must restore a previously reviewed immutable release, not rebuild from a mutable tag or edit production containers in place. Keep the previous release SHA, image digests, configuration version, migration state, and deployment event available before promotion.

## AWS Compose canary

1. Stop new promotion and record the failing release SHA, health/readiness, logs, queue state, and provider failures.
2. Drain or pause workers safely; do not discard durable task state or treat a queue outage as an empty queue.
3. Restore the previous six image digests and approved configuration through `deploy/aws/deploy.sh`, keeping `AUTONOMOUS_SUBMIT_ENABLED=false`.
4. Re-run health, readiness, authenticated smoke, queue/worker, metrics-access, and public TLS checks.
5. If a migration is incompatible, follow its documented backward-compatible recovery path; do not drop/recreate production tables.
6. Record rollback duration, data impact, residual tasks, and operator approval.

## Kubernetes

Use the platform’s rollout undo or a reviewed previous digest set. Confirm worker drain/cancellation behavior, readiness through ingress, secret/config version, and migration compatibility. Do not bypass admission or force traffic to a process that is not dependency-ready. Retain the failed rollout events and the successful rollback evidence.

## Rollback acceptance

A rollback is verified only when the previous release serves authenticated traffic, the queue and durable state remain consistent, no unauthorized actions occurred, telemetry is visible, and the deployment owner confirms the user-visible behavior. Dry-run and approval-rejection contracts pass locally; a real production rollout/rollback remains `NOT VERIFIED`.

## References

- `scripts/rollback_contract_test.sh` — rollback contract.
- `docs/Deployment_Architecture.md` — rollout and worker-drain model.
- `deploy/aws/README.md` — AWS canary runbook.
- `PRODUCTION_ISSUES.md` — live rollback evidence gap.
