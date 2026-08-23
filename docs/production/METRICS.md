# Tayari Skill Boost — Metrics and Event Contract

## Measurement rules

The project must distinguish **LOCALLY MEASURED**, **STAGING MEASURED**, **ESTIMATED**, **TARGET**, and **NOT YET AVAILABLE**. No production users, conversion rates, uptime, latency, cloud spend, token spend, or retention values are fabricated in this document.

## Technical metrics

| Metric | Type | Why it matters | Current state |
|---|---|---|---|
| Request count by method/path/status | Counter | Traffic and error-rate denominator | Implemented in gateway metrics/logging; live dashboard NOT VERIFIED |
| Request latency distribution | Histogram | p50/p90/p95/p99 and SLO measurement | Instrumentation exists; representative staging/load measurements NOT VERIFIED |
| `budget_exceeded_total` | Counter | Detect feature/system budget exhaustion | Observed by alert contract; live routing NOT VERIFIED |
| `llm_errors_total` | Counter | Detect provider/model failures | Observed by alert contract; provider configuration NOT VERIFIED |
| `queue_age_seconds` | Gauge/histogram | Detect background-work backlog | Observed by alert contract; production queue baseline NOT VERIFIED |
| `task_failures_total` | Counter | Detect durable workflow failures | Observed by alert contract; live dashboard NOT VERIFIED |
| Database query latency/errors/connections | Histogram/counter/gauge | Detect system-of-record pressure | Target metric; production measurement NOT VERIFIED |
| Provider request count/latency/retries/throttling | Counters/histograms | Control reliability and third-party spend | Provider probes BLOCKED by missing configuration |
| AI model/tokens/cache/retry/fallback/cost | Counters/histograms | Attribute and bound LLM spend | Token/cost telemetry target; live provider measurement NOT VERIFIED |
| Upload bytes and processing duration | Counter/histogram | Bound storage and OCR/processing cost | Production measurement NOT VERIFIED |

## Minimal product event taxonomy

Events should be versioned, owner-scoped where applicable, and contain no resume text, tokens, sensitive answers, or full provider payloads.

| Event | Required properties | Purpose | Status |
|---|---|---|---|
| `signup_completed.v1` | timestamp, anonymous/session ID, auth source | Acquisition and onboarding funnel | Target; implementation audit pending |
| `onboarding_completed.v1` | account ID, duration bucket, session ID | Activation | Target; implementation audit pending |
| `resume_uploaded.v1` | account ID, file-type class, size bucket, outcome | Core workflow start and storage health | Target; implementation audit pending |
| `optimization_completed.v1` | account ID, feature, model class, success/failure, duration bucket | Core AI workflow success | Target; provider/live telemetry pending |
| `job_saved.v1` | account ID, provider class, outcome | Opportunity triage engagement | Target; implementation audit pending |
| `draft_reviewed.v1` | account ID, artifact type, review outcome | Candidate-controlled quality loop | Target; implementation audit pending |
| `task_created.v1` | account ID, task type, approval state | Durable task adoption | Target; implementation audit pending |
| `task_cancelled.v1` | account ID, task type, cancellation reason class | Reliability and safety | Target; implementation audit pending |
| `handoff_created.v1` | account ID, application context ID, expiry bucket | Manual-submit safety | Target; implementation audit pending |
| `account_deleted.v1` | account ID, purge outcome class | Privacy lifecycle | Target; implementation audit pending |

## North-star metric candidate

**Candidate-controlled successful application package completion rate** is the most relevant candidate metric for the public release, but it is not yet an approved or measured north-star metric.

Proposed definition: successful, candidate-reviewed application package completions divided by eligible candidate workflow attempts, measured weekly, using durable application/package state rather than client analytics alone. The owner, target, denominator exclusions, and alert threshold must be approved by product and data owners before implementation.

## Privacy constraints

Analytics must use coarse buckets and stable identifiers only where necessary. Do not send resume contents, candidate answers, provider secrets, authentication tokens, legal declarations, work authorization data, salary values, or full external payloads into analytics or logs.

## References

- `scripts/verify_observability_contract.py` — required alert metric names.
- `backend/go/internal/api/middleware.go` — request metrics and structured logging.
- `.agents/AGENTS.md` — truthful UI, data ownership, and manual-submit rules.
- `PRODUCTION_ISSUES.md` — product metrics remain NOT VERIFIED.
