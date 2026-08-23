# Tayari Skill Boost — Backup and Recovery

## System of record

PostgreSQL/Supabase is the system of record for users, applications, task state, approvals, audit records, evidence, and sensitive answer metadata. Redis is recoverable queue/cache state and must not be the only source of truth for cancellation, approvals, or durable workflow state.

## Current recovery posture

| Control | Current result | Scope |
|---|---|---|
| Real PostgreSQL backup/restore drill | PASS | Fresh disposable local target with required tables |
| Restore without destructive `--clean` assumption | PASS | Repository restore script contract |
| Auth/extension preflight | PASS | Restore script contract |
| Daily logical backup plan | Documented | Existing operational runbook |
| Off-host backup copy | NOT VERIFIED | Requires real production storage/account |
| Managed PITR | NOT VERIFIED | Requires chosen managed Postgres/Supabase plan |
| Measured RPO/RTO in launch environment | NOT VERIFIED | Requires live launch backup and disposable managed restore |

## Launch requirements

Before public traffic, define backup frequency, retention, encryption, access ownership, off-host copy, restore target, RPO, RTO, and deletion/retention interaction. Take a launch backup from the exact schema/release, restore into a disposable managed target, verify table counts, constraints, owner policies, required rows, Auth compatibility, and application smoke behavior, and record measured recovery time. Redis may be rebuilt, but queued work and user-facing state must remain safe and explainable after recovery.

## Recovery failure behavior

If backup freshness or restore verification fails, freeze production promotion. If the database is unavailable during a workflow, the application must pause or surface an explicit storage failure; it must not show an empty queue, fabricate completion, or retry irreversible actions without idempotency.

## References

- `docs/operations/backup-and-recovery.md` — current operational runbook.
- `scripts/backup-hosted.sh` — hosted backup contract.
- `scripts/restore-drill.sh` — restore drill implementation.
- `.ruthless-evidence/security/backup_restore_drill.log` — local restore evidence.
- `PRODUCTION_ISSUES.md` — recovery issue PROD-005.
