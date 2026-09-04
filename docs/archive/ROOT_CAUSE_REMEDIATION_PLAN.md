# Root-Cause Remediation Plan

This file records the production-hardening invariants that must remain true as Tayari evolves.

## Non-negotiable execution invariants

1. Untrusted/generated Python never executes in the API process.
2. Workflow state changes only through owner-checked, version-checked state transitions.
3. HITL approvals are durable, single-use, user/tenant/resource/version/hash bound, and expire.
4. A stopped/taken-over run cannot perform a new external side effect.
5. External side effects use durable idempotency claims and must produce verifiable receipts.
6. Security-critical persistence failure fails closed; best-effort persistence is limited to telemetry.
7. Worker tasks derive identity and authorization from durable server state, not client/task-payload identity alone.
8. Backend-mediated data access is explicitly owner/tenant scoped because privileged DB roles bypass Postgres RLS.
9. Browser destinations are validated on every hop and must remain outside private/link-local/metadata address space.
10. CI/release gates must be green before promotion.

## Evidence requirements

Every production-sensitive transition should have an automated integration test covering:

- foreign-resource access
- stale version
- changed artifact/plan hash
- duplicate request
- concurrent request
- expired/replayed approval
- stop/takeover race
- worker restart/redelivery
- database outage
- malicious external content

This is an engineering contract, not a substitute for runtime security controls.
