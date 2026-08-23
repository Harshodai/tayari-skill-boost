# Tayari Skill Boost — Observability

## Observability objective

Production operators must be able to identify whether a failure is in the public edge, Go gateway, Python API, worker/queue, database, authentication, storage, or an external provider without searching by a user’s email, token, resume, or raw payload. Every signal must carry enough bounded correlation to reconstruct a workflow while minimizing sensitive-data exposure.

## Required correlation fields

Operational events should contain UTC timestamp, environment, immutable `release_sha`, service, request/trace ID, run/task ID where relevant, bounded provider class, outcome, stable failure code, duration, and policy version for approvals/provenance/external-action decisions. Tenant and user identifiers must be redacted, hashed, or restricted to audit logs; they must not be high-cardinality metric labels.

## Signals and dashboards

| Signal | Minimum fields/metrics | Dashboard | Current state |
|---|---|---|---|
| HTTP/API | Request/error counters, latency histogram, timeout/rate-limit count, readiness | Release health | Contracted; live dashboard NOT VERIFIED |
| Worker/queue | Queue age/depth, task duration/failures/retries, lease expiry, cancellation, heartbeat | Worker health | Contracted; live queue NOT VERIFIED |
| Providers | Count, latency, 429/5xx, timeout, blocked, budget rejection, terminal state, truncation | Provider health | Contracted; providers BLOCKED |
| Authorization/safety | RLS denial, SSRF block, prompt-injection block, token-refresh failure, approval replay rejection, deletion outcomes | Tenant safety | Contracted; live receiver NOT VERIFIED |
| Database/recovery | Pool saturation, query latency, lock waits/deadlocks, WAL/replication, backup age, restore-drill age, storage pressure | Data protection | Local restore PASS; cloud telemetry NOT VERIFIED |
| Frontend | JS errors, route failures, API errors, auth failures, Web Vitals, asset mismatch | Frontend experience | Local browser observed; live telemetry NOT VERIFIED |

## Protected telemetry

`/metrics` must remain internal/protected and require `X-Internal-Token` or the approved equivalent. Tokens must never be logged. The repository contract verifier covers endpoint protection, metric naming, bounded labels, and alert definitions. Production approval additionally requires a real scraper, dashboard, retention policy, and a controlled page/ticket test.

## Baseline alerts

The repository defines queue age above 300 seconds for five minutes, provider/LLM errors above five in five minutes, budget rejections above ten in five minutes, and sustained task failures. Production alert instances require an owner, severity, deduplication key, escalation policy, suppression procedure, runbook URL, and receiver evidence.

## Privacy and retention

Never log passwords, authorization headers, cookies, OAuth codes, access/refresh tokens, provider keys, webhook signatures, raw resumes, email bodies, form fields, or full sensitive job/application payloads. Error messages must use stable failure codes rather than unbounded exception text. Operational logs, security audit events, provider evidence, and compliance records require separate bounded retention classes.

## Current verification boundary

Repository observability contracts and local redacted-log checks pass. Live metrics authentication, dashboard population, alert delivery, paging/ticket routing, retention enforcement, and cost of telemetry remain `NOT VERIFIED` and are tracked in [`PRODUCTION_ISSUES.md`](../../PRODUCTION_ISSUES.md).

## References

- `docs/operations/production-deployment-observability-checklist.md` — authoritative observability checklist.
- `infra/observability/alerts.yml` — baseline alert definitions.
- `scripts/verify_observability_contract.py` — contract verifier.
- `backend/go/internal/api/middleware.go` — gateway request logging/metrics.
- `.ruthless-evidence/productionization/performance_second_pass.log` — local bounded timing and bundle evidence.
