# Tayari Skill Boost — SLI, SLO, and Error Budget

These are proposed launch targets, not measured production results. The current system has local contract evidence but no real production history; targets must be reviewed by the service owner before being adopted as an operational commitment.

| Service objective | SLI definition | Proposed target | Window / error budget | Alert and owner | State |
|---|---|---:|---|---|---|
| Authenticated API availability | Successful eligible candidate API requests / eligible requests, excluding planned maintenance | 99.9% monthly | 43m 49s monthly error budget | Page on sustained 5xx/readiness loss; Go/SRE | TARGET, not measured |
| Candidate API latency | Eligible candidate API requests under 800 ms / eligible requests, excluding long-running jobs | p95 < 800 ms | Rolling 30 days | Ticket on sustained breach; SRE | TARGET, not measured |
| Readiness recovery | Time from deploy start to all required readiness checks passing | < 5 minutes | Per deployment | Page a canary that never becomes ready; Release owner | TARGET, not measured |
| Queue freshness | Normal queued work below 300 seconds age | 99% of normal work | Rolling 30 days | Page `TayariQueueAgeHigh`; Worker owner | TARGET, not measured |
| Worker completion | Successful eligible tasks / attempted tasks, excluding explicit policy blocks | >= 99% | Rolling 30 days | Page sustained `TayariTaskFailures`; Worker owner | TARGET, not measured |
| Provider completion | Successful provider workflow completions / eligible attempts | Provider-specific budget | Per provider, reviewed monthly | Ticket degradation; disable unsafe provider; Integrations owner | TARGET, not measured |
| Approval delivery | Accepted approval notifications / requested approvals | >= 99% | Rolling 30 days | Page pending approvals without delivery; Product/SRE | TARGET, not measured |
| Backup freshness | Age of newest valid backup | Within declared RPO | Daily/continuous depending managed service | Page when older than RPO; Data owner | TARGET, cloud NOT VERIFIED |
| Restore drill freshness | Time since last successful restore drill | <= quarterly | Quarterly | Ticket before expiry; launch blocker when overdue | TARGET, cloud NOT VERIFIED |
| Tenant isolation | Confirmed cross-tenant events | Zero | Immediate | Immediate security incident and capability freeze | HARD ZERO |

## Error-budget policy

When an objective consumes more than 50% of its windowed budget, investigate the cause and pause risky feature expansion. At 75%, require owner review and mitigation. At 100%, freeze non-essential releases for the affected service until the budget is recovered or an explicit risk acceptance is recorded. A tenant-isolation event, unauthorized external action, secret leak, or destructive data event bypasses normal budget policy and triggers incident response immediately.

## Measurement requirements

The SLO implementation must use immutable release SHA, bounded route classes, explicit environment, and stable outcome classifications. Long-running AI jobs, provider-blocked work, and intentional human handoffs must not be mixed with ordinary request availability without a documented denominator. All target values must be revalidated after representative staging load testing.

## Current status

The repository contains alert and observability contract coverage. Real production measurements, error-budget burn, and paging behavior are `NOT VERIFIED`. They remain release conditions in [`PRODUCTION_ISSUES.md`](../../PRODUCTION_ISSUES.md).

## References

- `docs/operations/production-deployment-observability-checklist.md` — SLO baseline and alert guidance.
- `infra/observability/alerts.yml` — repository alert definitions.
- `scripts/verify_observability_contract.py` — telemetry contract verifier.
- `PRODUCTION_ISSUES.md` — current external and evidence blockers.
