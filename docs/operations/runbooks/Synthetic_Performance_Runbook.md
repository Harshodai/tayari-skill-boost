# Job Tayari Synthetic Performance Runbook

## Purpose

This runbook defines how to measure Job Tayari’s API, AI, queue, browser-worker, quality, and cost behavior with synthetic identities. It is deliberately separate from customer analytics: synthetic success proves an operating path, not product-market fit, retention, or revenue.

## Required labels

Every run must carry `environment`, `cohort`, `run_id`, `release_sha`, `image_digest`, `model_version`, and `tenant_id`. Values must be bounded and must not contain email addresses, résumé text, credentials, cookies, raw prompts, or job descriptions.

## Safety gates

Run the supplied k6 health ghost only against loopback development or an approved staging hostname. The wrapper rejects other targets unless `ALLOW_SYNTHETIC_RUN=true` is explicitly set. Do not provide production credentials to the script. The optional Kubernetes CronJob is not part of the base overlay and must not be scheduled until its image is pinned by digest, its ConfigMap is populated from the reviewed script, and a staging owner approves it.

A production probe is read-only and rate-limited. The current harness does not sign up users, create receipts, invoke billing, send email, navigate external job boards, or exercise non-idempotent actions. Browser workflows must use a local/mock fixture and a dedicated egress policy.

## Baseline sequence

1. Capture the release SHA, image digests, model version, provider region, and current resource requests/limits.
2. Run one low-concurrency health ghost and save the k6 summary.
3. Run the candidate read-only cohort with a short-lived staging token only if the token is explicitly approved and the routes remain read-only.
4. Capture the authenticated `/metrics` JSON snapshot with `scripts/collect-metrics.sh` using `METRICS_TOKEN` from the environment. The endpoint is protected by `X-Internal-Token` and must never be made public.
5. Repeat at increasing concurrency. Stop if error rate, queue age, memory, browser crash rate, provider throttling, or cost crosses the agreed gate.
6. Correlate k6 output with server metrics, Kubernetes pod/node metrics, traces, and logs using `run_id` and `release_sha`.
7. Remove synthetic data and temporary browser profiles according to the staging retention window.

## Resource optimization rules

For Go and frontend services, tune requests from observed CPU and memory percentiles and watch CPU throttling during the ramp. For Python, tune process count against memory and model concurrency; do not assume more processes improve tail latency. For Celery browser workers, begin with low concurrency and measure Chromium RSS, ephemeral storage, startup time, task duration, retries, and crash rate. Keep browser workers on separate capacity from the gateway and AI API.

Use HPA for stateless API workloads after resource metrics are verified. Use queue depth and oldest-task age for Celery scaling only after concurrency, rate limits, and duplicate semantics are understood. Do not add retries to non-idempotent external actions. Bound provider calls with timeouts, retry budgets, and circuit breakers.

## Acceptance gates

| Gate | Initial staging target | Stop condition |
|---|---:|---|
| HTTP error rate | < 1% for the approved ramp | Any unexplained 5xx cluster or timeout storm. |
| API p95 | ≤ 500 ms for authenticated CRUD, excluding deliberate AI time | Tail latency rises across two successive ramp steps. |
| HTTP p99 | ≤ 1,200 ms for the health/read-only scenario | p99 exceeds the budget with rising queue or CPU saturation. |
| k6 checks | > 99% | Any safety, authentication, or route-contract failure. |
| OOMKills | 0 | Immediate stop and memory investigation. |
| CPU throttling | No sustained throttling | Right-size limits or requests before further ramp. |
| Browser fixture completion | ≥ 99% | Any external navigation, credential use, or duplicate action. |
| Queue age | Below the product’s user-visible SLA | Oldest task grows for two intervals or dead letters increase. |
| Quality corpus | No schema, safety, cancellation, or receipt regression | Block release even if latency improves. |

These values are provisional gates for baseline work, not production claims. Revise them with evidence from the first approved staging runs.

## Incident response

If a synthetic run fails, preserve the run summary and correlated trace IDs, stop the ramp, identify whether the failure is edge/API/AI/queue/browser/database/provider-related, and mark the release as blocked until an owner reviews it. Do not delete evidence before the incident record is created. If a synthetic run reaches a real external action, revoke the test credential, stop all related workers, preserve audit evidence, and treat the event as a security/process incident.

## Required future additions

Before calling the deployment end to end, add a local mock job-board fixture, explicit test-mode receipt/idempotency assertions, model golden-corpus evaluation, cleanup verification, dashboards, alert routing, resource-cost tagging, backup/restore evidence, and a provider-specific cluster overlay. Production promotion remains blocked until the Docker-backed local E2E acceptance suite, billing/entitlement contract, and cloud secret/DNS approvals are complete.
