# Job Tayari Deployment and Performance Readiness Report

**Reference date:** 2026-08-24  
**Scope:** Kubernetes deployment planning, synthetic ghost users, resource optimization, latency, quality, security, and customer/investor evidence.

## Executive status

The repository now contains an opt-in synthetic health/read-only ghost-user harness, a guarded staging-only runner, an authenticated `/metrics` snapshot collector, an optional Kubernetes CronJob template, and an operator runbook. These assets are designed for controlled development/staging measurement and do not create users, mutate production data, invoke billing, send email, use real credentials, submit applications, or navigate third-party job boards.

No cloud provider, region, DNS, TLS, WAF, external secret manager, managed PostgreSQL/Redis service, production cluster, or production workload has been selected or provisioned. No synthetic load run has been executed because the local environment does not have the k6 binary or a connected Kubernetes API. Those are explicit pending gates, not passing results.

## Implemented repository assets

| Asset | Purpose | Status |
|---|---|---|
| `perf/k6/synthetic.js` | k6 health ghost and opt-in read-only authenticated candidate requests with error/latency/check thresholds. | Added; JavaScript syntax checked. |
| `perf/k6/README.md` | Safe run instructions, labels, retention, and non-production boundaries. | Added. |
| `scripts/run-synthetic.sh` | Rejects unapproved targets, requires `ALLOW_SYNTHETIC_RUN=true`, and tags run metadata. | Added; shell syntax checked. |
| `scripts/collect-metrics.sh` | Reads the existing token-protected `/metrics` JSON endpoint and writes mode-600 snapshots. | Added; shell syntax checked. |
| `infra/k8s/optional/ghost-k6-cronjob.yaml` | Opt-in CronJob template with `Forbid` concurrency, deadline, TTL, non-root security context, and resource limits. | Added; intentionally not included in the base overlay; image digest and script injection remain required. |
| `docs/Synthetic_Performance_Runbook.md` | Operational instructions, provisional gates, resource tuning, incident handling, and future additions. | Added. |

## Verified checks

| Check | Result | Limitation |
|---|---|---|
| `bash -n scripts/run-synthetic.sh scripts/collect-metrics.sh` | Passed. | Syntax only. |
| `node --check perf/k6/synthetic.js` | Passed. | k6 runtime not installed, so no live scenario executed. |
| `git diff --check` | Passed for the checked repository scope. | Does not prove runtime behavior. |
| `npm run security:scan` | Passed with no new security findings. | Existing resolved-finding ledger remains separate from a full production security assessment. |
| Kubernetes client-side apply | Blocked by disconnected Kubernetes API/OpenAPI discovery. | Must rerun with a real staging cluster; the failure is environment availability, not an accepted deployment. |
| k6 ghost run | Not run. | Requires k6 and an approved loopback/staging target. |
| Authenticated metrics snapshot | Not run. | Requires a short-lived staging metrics token. |
| Browser ghost | Not implemented as a live external workflow. | Must use a local/mock job-board fixture and remain prohibited from real external actions. |

## Provisional performance gates

These gates are starting hypotheses for staging and must be revised from measured data. They are not current production claims.

| Area | Starting target |
|---|---:|
| HTTP error rate | `< 1%` during an approved ramp. |
| Health/read-only p95 | `≤ 500 ms`; p99 `≤ 1,200 ms`. |
| k6 checks | `> 99%`. |
| Browser fixture completion | `≥ 99%`, with zero real external actions. |
| OOMKills | `0` during the gate. |
| Sustained CPU throttling | `0` during the gate; right-size requests/limits before further ramp. |
| Queue age | Below the product’s user-visible SLA, with no growing oldest-task age. |
| Quality corpus | No schema, safety, cancellation, or receipt regression. |

## Remaining production gates

1. Select and approve a provider/region using equivalent staging measurements across two managed Kubernetes candidates and one lighter alternative.
2. Externalize PostgreSQL/Supabase and Redis with tested backup, restore, failover, retention, and data-residency controls.
3. Add OpenTelemetry-compatible traces, Prometheus-compatible dashboards, alert routing, and cost tags.
4. Add a mock job-board fixture, test-mode receipt/idempotency checks, model golden-corpus evaluation, and cleanup verification.
5. Run controlled API and browser ramps, then tune requests/limits, HPA/KEDA or queue scaling, connection pools, process counts, browser concurrency, timeouts, and retry budgets.
6. Run failure drills for pods, nodes, queue, database, model provider, secret rotation, bad release, and backup restore.
7. Complete customer trust materials, DPA/subprocessors, retention/deletion/export, support/status process, signed desktop distribution, billing/entitlement acceptance, and investor KPI/unit-economics evidence.
8. Promote immutable image digests through staging, canary, and gradual production rollout only after all owners approve the stop conditions.

## Customer and investor interpretation

Synthetic runs are valuable operational evidence: they show whether a known workflow can be repeated, traced, cleaned up, and protected from external side effects. They are not customer traction, retention, revenue, market share, or proof of employment outcomes. Investor materials should present synthetic results alongside paid-pilot activation, retained usage, support burden, cost per successful workflow, gross-margin drivers, and a dated SLO history.

## Sources

[1]: https://cloud.google.com/kubernetes-engine/pricing "Google Kubernetes Engine pricing"
[2]: https://aws.amazon.com/eks/pricing/ "Amazon EKS pricing"
[3]: https://grafana.com/docs/k6/latest/ "Grafana k6 documentation"
[4]: https://opentelemetry.io/docs/platforms/kubernetes/ "OpenTelemetry with Kubernetes"
[5]: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/ "Kubernetes Deployments"
[6]: https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/ "Kubernetes Horizontal Pod Autoscaler"
[7]: https://kubernetes.io/docs/concepts/services-networking/network-policies/ "Kubernetes Network Policies"

This is research and analysis only, not personalized financial advice.
