# Root-Cause Production Hardening Contract

- Untrusted/generated code never executes in the API process.
- Workflow state mutations require owner/tenant authorization, legal transitions, and optimistic version checks.
- HITL approval is durable, single-use, expiry-bound, and bound to the exact plan/action/artifact hash and version.
- Stop/takeover prevents subsequent external side effects.
- External side effects use durable idempotency claims and verifiable receipts.
- Security-critical persistence failures fail closed.
- Workers derive identity and authorization from durable server state.
- Backend access remains explicitly owner/tenant scoped even when DB RLS is bypassed.
- Browser navigation validates every redirect and is constrained by egress policy.
- Release promotion requires green CI/CD and production evidence.
