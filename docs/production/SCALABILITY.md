# Tayari Skill Boost — Scalability and Capacity

## Evidence boundary

The repository has local functional, failure-injection, bundle, and liveness evidence. It does not yet have a representative concurrent load run, so the capacity values below are not asserted as measured limits.

| Traffic band | Expected workload questions | First likely bottleneck | State |
|---|---|---|---|
| 10 users | Can one canary host keep interactive API and small background work responsive? | Provider latency or local CPU | ESTIMATED; requires canary measurement |
| 100 users | Can queue age remain below target with bounded AI concurrency? | Python/worker concurrency, Redis queue age | ESTIMATED |
| 1,000 users | Can PostgreSQL connections, storage, and provider quotas sustain workflow volume? | Database pool, provider quotas, storage | THEORETICAL until load-tested |
| 10,000 users | Can the single-host topology be replaced or partitioned without state loss? | Gateway/worker/database scale-out | THEORETICAL |
| 100,000 users | Can event, storage, provider, and tenant isolation architecture support this volume? | Overall architecture and cost envelope | THEORETICAL; not a launch assumption |

## Scaling controls

The initial low-cost canary keeps Caddy public, Go behind the edge, Python and Redis private, and PostgreSQL/Auth external or managed. Scale decisions should follow measured saturation rather than defaulting to a complex multi-cluster design. The first scale-out changes are likely to be separate worker pools by task class, bounded provider concurrency, database pool/query optimization, object-storage lifecycle policy, and queue partitioning.

## Required measured capacity run

A disposable staging run must vary concurrency and request class, capture p50/p95/p99 latency, throughput, error rate, CPU, memory, DB connections, query latency, queue depth/age, provider responses, and cost per successful result. The run must include duplicate requests, provider delay, queue restart, database failure, and cancellation, and must state the first saturation point and the mitigation.

## Current release implication

No production capacity guarantee is made. PROD-007 remains `NOT VERIFIED` until the measured run is attached to the exact release SHA.

## References

- `scripts/perf_check.sh` — benchmark safety contract.
- `docs/Deployment_Architecture.md` — intended topology and scaling boundaries.
- `PRODUCTION_ISSUES.md` — performance/capacity issue PROD-007.
