# Tayari Skill Boost — Operator Runbooks

This index turns the repository’s existing operations guidance into a production operator entry point. Each runbook must begin with confirmation of environment, release SHA, current dependency status, and the safest reversible mitigation.

| Runbook | Primary source | First signal | Safe first action | Verification |
|---|---|---|---|---|
| Elevated 5xx or readiness loss | `INCIDENT_RESPONSE.md`, `docs/operations/production-deployment-observability-checklist.md` | Release health, `/healthz`, `/readyz`, error rate | Stop promotion; compare current/previous digest; do not force readiness | Authenticated smoke and readiness pass |
| Database outage | `BACKUP_RECOVERY.md`, `docs/operations/backup-and-recovery.md` | DB errors, pool saturation, readiness | Pause durable workflows; preserve state; never treat outage as empty queue | DB restored and state-integrity checks pass |
| Provider/AI outage | `OBSERVABILITY.md`, provider staging docs | Provider errors, latency, 429s, budget rejections | Disable provider or route to approved bounded fallback | Side-effect-free provider probe and visible degraded state |
| Queue backlog/worker failure | `OBSERVABILITY.md` | Queue age/depth, heartbeat, retries | Pause expensive producers; drain/restart worker safely | Queue age and terminal task outcomes recover |
| Cost anomaly | `FINOPS.md`, `COST_MODEL.md` | Spend/token/retry/storage/log growth | Apply graduated feature/provider/concurrency controls | Spend rate returns to envelope |
| Storage exhaustion | `DATA_GOVERNANCE.md`, backup docs | Disk/object-storage pressure and upload failures | Stop new uploads if necessary; preserve existing data | Capacity headroom and bounded upload succeed |
| Auth/security incident | `SECURITY.md`, `THREAT_MODEL.md` | 401/403 spike, RLS/SSRF/prompt block, audit event | Freeze affected capability, revoke/rotate credentials, preserve redacted evidence | Negative authorization checks and safe re-enable review |
| Failed deployment or migration | `DEPLOYMENT.md`, `ROLLBACK.md` | Admission, rollout, migration, readiness events | Roll back exact previous immutable release; do not edit live containers | Previous release serves and data checks pass |
| Suspected privacy/data leak | `DATA_GOVERNANCE.md`, `INCIDENT_RESPONSE.md` | Audit/telemetry/access anomaly | Freeze capability and preserve evidence without copying secrets | Security review and no-reproduction test |

## Operator hygiene

Never paste passwords, tokens, private keys, raw resumes, sensitive answer values, full provider payloads, or unredacted URLs into incident systems. Record bounded identifiers, release SHA, task/run IDs, stable failure codes, timestamps, and the exact command or dashboard view used.

## Current state

The runbook contracts and local evidence are present. Live on-call ownership, alert receiver delivery, managed-provider behavior, and production rollback/recovery rehearsals remain `NOT VERIFIED`.

## References

- `docs/production/INCIDENT_RESPONSE.md` — severity and response sequence.
- `docs/production/OBSERVABILITY.md` — signal and dashboard contract.
- `docs/production/DEPLOYMENT.md` — deployment topology.
- `docs/production/ROLLBACK.md` — rollback procedure.
- `docs/production/BACKUP_RECOVERY.md` — recovery procedure.
