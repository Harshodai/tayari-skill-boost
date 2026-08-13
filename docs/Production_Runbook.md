# Job Tayari Production Release Runbook

## Release principle

A production release is a **recorded decision**, not a `kubectl apply` event. The release owner must be able to identify the source commit, immutable image digests, rendered manifest, validation evidence, risk owner, rollback plan, and customer-communication posture before traffic is exposed.

## Preflight

| Gate | Evidence required | Owner |
|---|---|---|
| Source quality | Frontend, Go, Python, Playwright, and deployment-package CI jobs pass for the release commit. | Engineering owner |
| Image integrity | Four image digests, SBOM/provenance, vulnerability-scan result, and approved exception record for any non-blocking finding. | Release owner |
| Runtime secrets | Environment-specific `tayari-runtime-secrets` exists; values are not shared with lower environments and do not appear in logs/CI. | Platform/security owner |
| Data services | Managed PostgreSQL and Redis are private, monitored, backed up, and have a tested restore procedure. | Data/platform owner |
| Network boundary | Ingress TLS/WAF/rate limits and egress allowlist are tested in the actual cloud; no unrestricted browser-worker egress is accepted. | Platform/security owner |
| Product gate | Candidate review, stop/cancel, receipt, and authenticated basic flow are verified in staging. | Product and QA owner |
| Billing gate | Checkout remains disabled unless pricing/entitlement/webhook test-mode acceptance is attached. | Product and commercial owner |
| Customer communication | Status page route, support escalation owner, and incident template are available. | Support/operations owner |

Do not promote a release when any P0 gate is unknown. Record the unknown as a blocker, not as an implicit risk acceptance.

## Staging release

The environment owner first resolves immutable image references. Tags such as `latest` are not deployable release identifiers.

```bash
export KUBE_CONTEXT='approved-staging-context'
export DEPLOY_APPROVED=true
export FRONTEND_IMAGE='registry.example/tayari-frontend@sha256:...'
export GATEWAY_IMAGE='registry.example/tayari-gateway@sha256:...'
export PYTHON_API_IMAGE='registry.example/tayari-python-ai@sha256:...'
export WORKER_IMAGE='registry.example/tayari-worker@sha256:...'

scripts/deploy-environment.sh staging
scripts/smoke-test.sh staging
```

The staging sign-off must include the rendered manifest, image digests, in-cluster smoke result, application test result, synthetic candidate-review/cancellation/receipt result, and an error/log review that confirms no sensitive candidate data was emitted.

## Production canary

The current package uses a safe rolling-release baseline. Before enabling broad production traffic, the environment owner should configure a provider-specific traffic mechanism—such as weighted ingress, service mesh, or managed load-balancer policy—if true traffic canaries are required. Do not call a rolling update a canary without a measured traffic split.

1. Confirm staging sign-off and all preflight gates.
2. Capture current production deployment revisions and image digests.
3. Announce the change window internally and prepare the customer-status update path.
4. Apply the production release using explicit approvals.
5. Observe HTTP error rate, p95 latency, pod restarts, CPU/memory saturation, queue age, worker failures, candidate cancellation outcomes, and receipt outcomes for the agreed observation window.
6. If a guardrail breaches, pause promotion, communicate impact, and run the rollback procedure. Do not force replay browser tasks.

```bash
export KUBE_CONTEXT='approved-production-context'
export DEPLOY_APPROVED=true
export PRODUCTION_CHANGE_APPROVED=true
# Export immutable image references as in staging.
scripts/deploy-environment.sh production
scripts/smoke-test.sh production
```

## Worker maintenance

Worker changes and incident maintenance must protect candidate-controlled external actions. The drain operation stops Celery beat, prints active work, and requires a second confirmation before scaling the worker down.

```bash
export DRAIN_APPROVED=true
export DRAIN_CONFIRMED=true
scripts/drain-workers.sh production drain

# After maintenance, queue inspection, and receipt/cancellation verification:
scripts/drain-workers.sh production resume
```

A failed worker should not cause automatic replay of an external job-site submission. Review candidate approval state, external idempotency key availability, receipts, and worker logs before deciding whether a new candidate-approved action is necessary.

## Rollback

```bash
export ROLLBACK_APPROVED=true
export PRODUCTION_CHANGE_APPROVED=true
scripts/rollback.sh production
scripts/smoke-test.sh production
```

The rollback script applies only to the frontend, Go gateway, and Python API. It does not undo schema changes, reset database state, replay browser work, or restart Celery beat/worker processes. Those actions have different consistency and customer-consent consequences and must use the recovery or worker-maintenance procedures.

## Incident communication minimum

| Moment | Required communication |
|---|---|
| Detection | Record time, affected component, customer impact hypothesis, release correlation, incident owner, and next update time. |
| Confirmation | State what is known, what customers should do, whether candidate actions are paused, and when the next update will be posted. |
| Mitigation | State the mitigation or rollback, residual effects, and whether customer action is required. |
| Closure | State recovery time, customer-data/action impact, any follow-up required, and the post-incident review timeline. |

Avoid asserting that no customer data was affected until logs, audit events, and data-service evidence have been reviewed.
