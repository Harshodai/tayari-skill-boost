# Root-Cause Remediation Status

This repository is not considered production-ready until the root-cause invariants in `ROOT_CAUSE_REMEDIATION_PLAN_V2.md` are proven by code, tests, and deployment evidence.

Current known blockers: real sandboxed CodeAct execution; durable artifact-bound approvals; hard cancellation before external side effects; elimination of unscoped privileged state mutation; fail-closed workflow persistence; durable worker authorization; side-effect idempotency; backend tenant isolation when the database role bypasses RLS; green current CI/CD; real cloud promotion; credentialed macOS release if distributing macOS.
