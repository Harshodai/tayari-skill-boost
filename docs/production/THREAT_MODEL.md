# Tayari Skill Boost — Threat Model

## Assets

The highest-value assets are user identity and sessions, resumes and uploaded documents, candidate answers and sensitive application data, application/task state, approval and handoff records, provider credentials, database connection material, LLM prompts/results, audit logs, and any external-action evidence.

## Trust-boundary model

| Boundary | Attacker capability | Primary controls | Current result |
|---|---|---|---|
| Browser → public edge | Modify requests, IDs, headers, timing, and client state | TLS, server-side auth, input validation, CORS/CSP, no client authority | Verified locally; public ingress NOT VERIFIED |
| Proxy → Go gateway | Spoof forwarded identity or request IDs | Trusted proxy CIDR resolver, safe request IDs, structured logs | Verified locally |
| Go → Python | Send synthetic identity or bypass owner scope | Verified gateway identity forwarding and owner-scoped service contract | Verified locally |
| User → database | Read/write another user’s records | RLS, grants, owner predicates, two-user negatives | Verified locally/contract; real managed DB NOT VERIFIED |
| Provider → AI context | Inject instructions, malformed data, or oversized payloads | Provider allowlists, bounded output, prompt/context guardrails, timeouts, budgets | Verified synthetically; live provider behavior NOT VERIFIED |
| Worker → external portal | Trigger irreversible action or duplicate side effect | Manual approval, durable handoff, cancellation, idempotency, autonomous-submit disabled | Contracts pass; real portal isolation NOT VERIFIED |
| Service → telemetry | Leak sensitive payloads or credentials | Redaction, structured fields, protected metrics, retention controls | Contract pass; live sink/paging NOT VERIFIED |

## Abuse cases and mitigations

| Abuse case | Impact | Mitigation | Evidence status |
|---|---|---|---|
| User A changes an object ID to read User B data | Privacy breach | Verified auth context plus owner predicate/RLS and two-user negative tests | PASS locally |
| Untrusted caller spoofs `X-Forwarded-For` | Rate-limit/audit bypass | Honor forwarded headers only for trusted proxy peers | PASS with Go tests |
| Flood an AI/search/upload endpoint | Cost and availability impact | Rate limits, burst control, penalty backoff, request/queue budgets | PASS locally; live tuning pending |
| Provider content injects instructions into an AI prompt | Unsafe output or tool use | Input/context boundaries, output validation, prompt-injection guardrails | PASS synthetically |
| Malicious redirect targets private IP | SSRF/data exposure | Private-IP/localhost rejection and redirect safety | PASS synthetically |
| Replay an approval or handoff token | Unauthorized action | Owner-bound expiring handoff and durable transition records | PASS in contract tests |
| Cancel only the browser reader | Real browser continues acting | Server-side cancellation terminates resource; work loop polls cancellation | PASS in local contract; external portal NOT VERIFIED |
| Database outage appears as an empty safe queue | Unsafe state transition/data loss | Fail-closed readiness and explicit storage errors | PASS locally; managed outage NOT VERIFIED |
| Autonomous submission enabled by environment override | Irreversible external action | Server-side false default and deployment-time rejection of non-false values | PASS in promotion/release gates |
| Telemetry captures a resume, token, or secret | Sensitive data leak | Redaction checks and structured logging policy | PASS locally; live sink NOT VERIFIED |

## AI-specific controls

LLM/provider input is treated as untrusted. The application must bound prompt size, context, retries, timeouts, output size, and feature-level/system-level cost. External provider results must not expand tool authority or override human approval. Candidate facts must be sourced from verified profile/application context rather than fabricated defaults. Any browser automation remains a high-risk internal surface until real isolation, cancellation, and manual-handoff evidence is available.

## Residual risks

Live network egress, provider quota behavior, managed Auth/DB/Redis policies, production image attestations, public ingress, telemetry routing, and real external portal behavior were not verified in the available environment. These are P1 release blockers or P2 evidence gaps in [`PRODUCTION_ISSUES.md`](../../PRODUCTION_ISSUES.md).

## References

- `scripts/security_scan.mjs` — security rule families.
- `backend/go/internal/clientip/client_ip.go` — trusted-proxy implementation.
- `backend/go/internal/api/middleware.go` — rate limiting, logging, and test isolation.
- `.ruthless-evidence/security/staging_hostile_evidence_final.json` — synthetic adversarial cases.
- `.agents/lessons.md` — cancellation, identity, sensitive answer, and manual-submit lessons.
- `PRODUCTION_ISSUES.md` — current residual-risk register.
