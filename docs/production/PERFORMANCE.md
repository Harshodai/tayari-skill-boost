# Tayari Skill Boost — Performance

## Measurement boundary

The current evidence distinguishes local timing and bundle checks from representative authenticated workload performance. No production or staging load result is fabricated.

| Measurement | Result | Scope | Status |
|---|---:|---|---|
| Largest frontend bundle | 518,350 bytes (`charts-DuMP2N3OO.js`) | Current local production build | LOCALLY MEASURED; bundle budget PASS |
| Gateway liveness request | HTTP 200; 0.006051 s observed | Local Compose, one unauthenticated health request | LOCALLY MEASURED; not a workload percentile |
| Python liveness request | HTTP 200; 0.005373 s observed | Local Compose, one unauthenticated health request | LOCALLY MEASURED; not a workload percentile |
| Representative authenticated AI workflow | Not run | Requires disposable target, auth/token, endpoint contract | NOT VERIFIED |
| p50/p95/p99 under concurrency | Not available | Requires real load harness and safe fixtures | NOT VERIFIED |
| CPU/memory/DB/queue saturation | Not available | Requires measured load target | NOT VERIFIED |

## Required next benchmark

Use `scripts/perf_check.sh --plan` to materialize the required target and safety inputs. The benchmark must run only against a disposable staging account and endpoint, with an explicit auth header or internal token, bounded request count, expected status, timeout, and cleanup. Capture p50/p95/p99, throughput, error rate, CPU/memory, database connections/query latency, queue age/depth, provider latency, and cost per successful workflow.

## Performance risks

Likely first constraints are LLM/provider latency and cost, Python/browser-worker concurrency, Redis queue age, PostgreSQL connections and query plans, upload/OCR processing, and telemetry volume. These are hypotheses until measured under representative load.

## References

- `scripts/perf_check.sh` — fail-closed benchmark contract.
- `scripts/check_bundle_budget.mjs` — frontend bundle budget.
- `.ruthless-evidence/productionization/performance_second_pass.log` — current local measurements.
- `PRODUCTION_ISSUES.md` — performance/capacity issue PROD-007.
