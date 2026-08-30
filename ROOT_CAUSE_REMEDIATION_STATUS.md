# Root-Cause Remediation Status

Status is tracked against the current `main` branch. A release is not considered production-ready merely because static checks pass; the execution, authorization, recovery, and deployment invariants in `ROOT_CAUSE_REMEDIATION_PLAN.md` must be demonstrated.

## Current known blockers

- CodeAct isolation and hard-kill semantics
- Durable, artifact-bound HITL approval
- Side-effect cancellation on stop/takeover
- Elimination of unscoped privileged workflow mutation
- Fail-closed semantics for security-critical persistence
- Durable worker identity/authorization
- Exactly-once/idempotent external side effects
- Backend tenant isolation without relying on BYPASSRLS as a safety net
- Current CI/CD green state
- Real production cloud promotion and credentialed macOS release remain operationally gated
