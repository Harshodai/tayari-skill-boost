# Job Tayari Disaster Recovery and Data Recovery Runbook

## Scope

This runbook covers the cloud service plane. It does not claim that a recovery procedure has been executed; the selected cloud provider, managed PostgreSQL/Supabase-compatible service, Redis service, object storage, and identity platform must each be configured and tested before production launch.

The most important safety condition is that application recovery must not silently create a second external browser action. Browser work is candidate-controlled and may interact with third-party job systems. Restore actions therefore require audit and receipt review, not blind queue replay.

## Recovery objectives to set before launch

| Service/data class | Proposed initial objective | Final owner decision required |
|---|---|---|
| Customer-facing frontend and Go gateway | Recovery within 60 minutes of a regional/workload incident. | Confirm against support commitment and managed-platform architecture. |
| Python AI API and general async worker | Recovery within 60 minutes; queued work resumes only after dependency and audit checks. | Confirm workload capacity and provider SLA. |
| Browser automation worker | Recovery within 4 hours; no automatic replay of in-flight external actions. | Confirm candidate-impact policy and support staffing. |
| PostgreSQL/Supabase-compatible customer data | Point-in-time recovery objective of 15 minutes, recovery time of 4 hours. | Confirm provider capability, backup cost, encryption, and restore drills. |
| Redis task/queue state | Treat as reconstructable only where task idempotency is demonstrated. | Confirm queue durability, persistence, and replay policy. |
| Object and receipt artifacts | Versioned, encrypted storage with recovery time matching data tier. | Confirm retention, lifecycle, export, and deletion policy. |

These are planning targets, not contractual uptime or recovery commitments. The customer-facing terms must use only objectives that have been tested and approved.

## Backup design

| Data store | Required control | Evidence retained |
|---|---|---|
| Managed PostgreSQL | Automated backups, point-in-time recovery where available, encrypted backups, restore to isolated environment. | Backup policy, last successful backup, restore job ID, data-validation record. |
| Redis | Persistence mode and backup strategy matched to the task-idempotency policy. | Redis configuration, queue-loss scenario test, replay decision log. |
| Object storage | Versioning, encryption, lifecycle rules, restricted access, and restore test. | Bucket policy, restore evidence, artifact retention matrix. |
| Kubernetes configuration | Git-backed manifests, immutable image digests, rendered release artifact, and release log. | Commit SHA, artifact, image digests, deployment revision, approver. |
| Secrets | Managed-secret version history and break-glass rotation procedure. | Rotation record, access review, post-incident rotation evidence. |

## Recovery decision flow

1. **Stabilize.** Pause promotion, disable new scheduled enqueueing if worker integrity is uncertain, and preserve logs, deployment revisions, and audit events.
2. **Assess customer action risk.** Determine whether any in-flight browser or submission action could be duplicated. If yes, keep workers paused and inspect candidate approvals, receipts, idempotency keys, and external outcomes.
3. **Recover stateless capacity.** Restore frontend, gateway, and Python API from the last known-good immutable images. Use the rollback script only for workloads it supports.
4. **Recover data in isolation.** Restore managed PostgreSQL/objects into an isolated recovery target first. Validate schema version, tenant scope, record counts, audit events, and most recent receipt state before any cutover.
5. **Reconcile queues.** Do not automatically replay Redis/Celery tasks. Classify each task as safely idempotent, safely abandoned, or requiring candidate/support review.
6. **Resume in stages.** Restore scheduler and worker capacity only when service dependencies, receipts, cancellation state, and support readiness are verified.
7. **Communicate and learn.** Issue customer updates based on confirmed impact, complete a post-incident review, rotate exposed credentials, and record remediation owners and dates.

## Restore drill acceptance criteria

A quarterly restoration drill should be considered successful only when the team can demonstrate all of the following without production data leakage:

| Category | Acceptance criterion |
|---|---|
| Infrastructure | A clean environment recreates the application layer from versioned manifests and immutable images. |
| Data | A selected backup restores to an isolated target and passes schema, application-read, and audit-receipt consistency checks. |
| Security | Secrets are newly materialized from the managed secret store; old credentials are not copied into drill artifacts. |
| Workflow | Candidate review, cancellation, and receipt retrieval work against synthetic test data. |
| Operations | Detection, escalation, customer-update template, rollback path, and recovery decisions have timestamps and owners. |
| Evidence | The drill report states actual elapsed time, data point recovered, deviations from target, and follow-up actions. |

## Prohibited shortcuts

- Do not restore production data into a developer namespace or a shared staging environment.
- Do not clear Redis or replay Celery tasks without reviewing candidate approval and external-action idempotency.
- Do not announce a completed recovery until service, data, receipt, and authentication checks have passed.
- Do not treat the presence of a backup as proof of recoverability; only a recorded restore drill is proof.
