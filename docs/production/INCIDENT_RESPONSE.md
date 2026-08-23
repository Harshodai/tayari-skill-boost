# Tayari Skill Boost — Incident Response

## Severity model

| Severity | Definition | Initial response | Required action |
|---|---|---:|---|
| SEV-0 | Confirmed cross-tenant access, unauthorized external submission, leaked secret, destructive data event, or active compromise | Immediate | Freeze affected capability, revoke credentials, preserve evidence, appoint incident commander, notify security/owner |
| SEV-1 | Major outage or critical workflow failure affecting many users | 15 minutes | Mitigate, communicate owner/status, use rollback or dependency isolation, start timeline |
| SEV-2 | Significant degradation, provider outage, queue backlog, or sustained SLO breach | 1 hour | Triage, mitigate, create incident record, monitor recovery |
| SEV-3 | Minor defect or localized degradation without material data/safety impact | Next business day | Ticket, prioritize, include regression test where applicable |

## First-response procedure

1. Confirm the alert against the release SHA, environment, request/trace ID, and bounded failure code.
2. Determine whether the issue is availability, data integrity, tenant isolation, external-action safety, provider failure, cost anomaly, or deployment failure.
3. Freeze the affected capability if there is any possibility of cross-tenant access, secret exposure, unauthorized external action, or destructive data behavior.
4. Preserve redacted logs, metrics, audit events, deployment metadata, and the exact configuration version. Never copy secrets or sensitive payloads into the incident channel.
5. Apply the smallest safe mitigation: rollback, disable a feature/provider, pause the queue, revoke credentials, or route to a manual handoff.
6. Verify recovery using the relevant readiness, workflow, data-integrity, and telemetry checks. Record what was measured, not what is assumed.
7. Open a follow-up issue with root cause, customer impact, technical impact, cost impact, fix owner, regression test, and evidence.

## Runbook index

| Incident | Primary checks | Safe mitigation | Recovery proof |
|---|---|---|---|
| Elevated 5xx/readiness loss | Release health, Go/Python readiness, dependency errors | Roll back or remove unhealthy canary; do not force readiness | Readiness and authenticated smoke pass |
| Database outage | Connection errors, pool, backup age, migration status | Pause durable workflows; never treat storage failure as empty queue | Restored dependency and state-integrity checks |
| Queue backlog | Queue age/depth, worker heartbeat, retries, lease/reclaim | Pause expensive producers; restart/drain worker if safe | Queue age returns below target and tasks complete |
| Provider outage | Provider status/latency/429/5xx, circuit breaker | Disable provider or route to approved fallback; surface degraded state | Side-effect-free provider probe and error-rate recovery |
| AI cost spike | Tokens, model, retries, budget rejections, per-user/feature spend | Enforce budgets, route to cheaper model, disable feature if necessary | Spend rate and token metrics return to envelope |
| Storage exhaustion | Disk/object-storage capacity, upload failures | Stop new uploads or retention-expensive work; preserve data | Capacity headroom and successful bounded upload |
| Auth incident | 401/403 rates, token-refresh failures, Auth logs | Revoke/rotate credentials; disable affected route if needed | New login and owner-scope negative checks |
| Suspected data leak | Audit events, telemetry redaction, access logs | Freeze capability, revoke keys, preserve evidence | Security review and no-reproduction authorization tests |
| Failed deployment | Admission/rollout/readiness events, image digest | Roll back exact previous digest; do not bypass gates | Old SHA readiness and smoke evidence |
| Migration failure | Migration logs, locks, schema version | Stop rollout; follow backward-compatible recovery path | Schema/runtime contract and restore check |

## Ownership and communication

The production owner must assign an incident commander, technical lead, communications owner, and security/data owner when applicable. The public status message must state impact, start time, current mitigation, and next update without exposing private data or implying success before verification.

## Post-incident standard

Every SEV-0 through SEV-2 requires a timeline, root cause, contributing conditions, missed detection, customer impact, data/security assessment, cost impact, remediation owner, and regression verification. The final action must be linked to the shared issue register and the evidence index.

## Current state

Repository runbook and alert contracts exist. Live notification delivery, on-call ownership, and production incident rehearsal are `NOT VERIFIED` and remain release conditions.

## References

- `docs/operations/production-deployment-observability-checklist.md` — severity and incident baseline.
- `docs/operations/backup-and-recovery.md` — data recovery path.
- `deploy/aws/README.md` — AWS canary recovery/cleanup.
- `PRODUCTION_ISSUES.md` — current blockers.
