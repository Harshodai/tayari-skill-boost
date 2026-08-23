# Tayari Skill Boost — Test Strategy

## Principle

Coverage percentage is not the release criterion. Each critical behavior must have a test that would fail if the behavior broke, plus an evidence artifact that another engineer can inspect. Tests are layered so local fast feedback does not substitute for integration or real-browser behavior.

| Layer | Scope | Current evidence |
|---|---|---|
| Frontend unit/component | Forms, truthfulness, feature flags, API client, error states, accessibility assertions | Fresh frontend suite passes; focused AutoPilot truthfulness regression passes 6/6 |
| Frontend build/lint/type | Production compilation and static hygiene | Fresh lint, type, build and bundle budget pass |
| Go unit/race/vet | Auth, routing, owner predicates, rate limiting, trusted proxy, proxy contracts | Fresh Go tests/vet pass; prior race suite pass |
| Python unit/integration | FastAPI, AI guardrails, queue, cancellation, migrations/runtime contracts | Fresh repository Python suite passes; live providers not configured |
| Database/RLS/migration | Schema, grants, policies, owner negatives, restore | Local restore and RLS/migration contracts pass |
| E2E browser | Critical local UI journeys, failure states, screenshots/visual audit | 39 passed, 14 intentional skips in final hardened run |
| Hostile/red-team | Authorization, SSRF, prompt injection, abuse, resource exhaustion, privacy | 34/34 synthetic checks passed in preserved bundle |
| Failure injection | Python outage/recovery, Redis outage/recovery, queue/cancellation behavior | Local failure injection passed |
| Release/promotion | Environment, images, approvals, liveness/readiness, security | Fresh release/promotion contracts pass |
| Real staging | Managed dependencies, ingress, provider, telemetry, backup/PITR, rollback | BLOCKED in current environment |
| Load/capacity | Authenticated concurrency, p50/p95/p99, saturation, cost | NOT VERIFIED; benchmark plan requires disposable target/token |

## Regression rule

Every serious bug becomes a root-cause record, fix, focused regression, and independent verification. The AutoPilot copy issue is the current second-pass example: browser observation → P2 issue → copy/label fix → six-test regression.

## Failure-path requirements

For critical journeys test invalid/empty/large inputs, duplicate submissions, slow dependencies, backend/provider outage, expired sessions, permission failures, refresh/back-forward, browser restart, cancellation, and concurrent activity. Do not create external accounts, submit applications, enter credentials, or perform irreversible actions without an explicit owner-controlled handoff.

## Current gaps

Live staging, production provider behavior, public ingress, cloud recovery, and representative load remain outside the current evidence set. They are release blockers or `NOT VERIFIED` items in [`PRODUCTION_ISSUES.md`](../../PRODUCTION_ISSUES.md).

## References

- `README.md` — repository-native test commands.
- `.agents/AGENTS.md` — password, loopback, E2E, and manual-submit rules.
- `.ruthless-evidence/security/final_playwright_e2e_hardened.log` — final E2E result.
- `.ruthless-evidence/security/staging_hostile_evidence_final.json` — hostile suite evidence.
- `.ruthless-evidence/productionization/second_pass_postfix_regression.log` — current post-fix gates.
