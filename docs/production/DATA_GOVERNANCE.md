# Tayari Skill Boost — Data Governance

## Data classes

| Class | Examples | Storage/access | Logging rule | Lifecycle |
|---|---|---|---|---|
| Public product copy | Landing text, feature descriptions, docs | Public frontend/docs | May be logged as deployment metadata | Versioned with release |
| Account identity | Auth ID, email, profile metadata | Auth/database, owner/service access | Never log tokens or full identity unnecessarily | Retain while account exists, delete/export per policy |
| Candidate documents | Resume, cover letter, uploads | Owner-scoped storage/database | Never log raw documents or full payloads | Retention and deletion policy required |
| Sensitive answers | Legal/work authorization/salary/EEO and similar answers | Owner/version/provenance/sensitivity/expiry metadata; service-only where appropriate | Never log raw values | Explicit current-application confirmation; no silent reuse |
| Workflow/audit state | Tasks, approvals, handoffs, cancellation, evidence | Owner-scoped durable database | Log bounded event/failure code, not sensitive payload | Retain for operational/audit period, then purge per policy |
| Provider/AI data | Prompts/results, job descriptions, model metadata | Feature-scoped and bounded | Redact secrets and sensitive payloads | Minimize, expire, and do not use for unrelated purposes |
| Telemetry | Metrics, logs, traces, audit events | Protected observability backend | No secrets or unnecessary PII | Separate retention by class |

## Rights and lifecycle

The system must define creation, active use, export, archival, deletion, backup, restore, and retention for each persistent class. Account deletion must be owner-authorized, auditable, idempotent, and explicit about provider/storage limitations. A backup is not a bypass of deletion policy; retention and legal/compliance requirements must be reviewed with the environment owner.

## Third-party sharing

Provider integrations must be individually approved and documented with data fields, purpose, region, retention, failure behavior, credential owner, and opt-out/disable path. Optional providers remain disabled until their evidence gates pass. No provider payload should silently expand the user-visible product promise.

## Current status

Owner-scoped storage, RLS/grants, sensitive-answer contracts, redacted logs, and manual-submit boundaries are verified locally. Live provider data processing, cloud retention settings, deletion/export acceptance, and telemetry sink policies are not verified.

## References

- `.agents/AGENTS.md` — sensitive answer and truthfulness rules.
- `.agents/lessons.md` — data ownership, queue outage, submission verification, and migration lessons.
- `docs/operations/backup-and-recovery.md` — backup lifecycle.
- `PRODUCTION_ISSUES.md` — outstanding privacy/production evidence gaps.
