# Tayari Skill Boost — FinOps Controls

## Budget ownership

The environment owner must define a monthly envelope for compute, database/Auth, storage, Redis, AI/LLM, scraping/providers, email/billing, observability, and CI/registry. The budget must be created before AWS provisioning, and the owner must document warning, intervention, and emergency thresholds.

| Threshold | Action | Owner |
|---|---|---|
| 70% of monthly envelope | Investigate trend, top service, token/request growth, and forecast | FinOps + service owner |
| 85% | Reduce non-essential provider/model spend, review retries/concurrency, require release owner sign-off | FinOps + SRE |
| 100% | Apply graduated controls: disable optional features/providers or route to bounded fallback; do not silently corrupt core workflows | Incident commander + product owner |

## Anomaly signals

Monitor daily spend, token usage, cost per active user, cost per successful core action, request volume, retries, queue backlog, storage growth, bandwidth, logs, and failed AI generations. Alert on sudden token/user growth, retry storms, provider 429 increases, storage acceleration, unexpected telemetry volume, or runaway jobs.

## Cost controls

The application must enforce request size, concurrency, timeout, retry, token, feature, user, and system budgets. Optional providers should be disabled rather than allowed to fail-expensively. Model routing should use the least expensive model that satisfies the task, with caching and prompt/context bounds where safe. Queue retries require backoff and terminal failure limits. Telemetry must control sampling, cardinality, verbosity, and retention.

## Current state

The repository contains static safety contracts and budget rejection metrics. Live AWS billing, provider invoices, token rates, cost dashboards, and anomaly alert delivery are not available in this environment. The cost model is therefore a control plan, not a claim of known monthly spend.

## References

- `deploy/aws/provision.sh` — cost/budget preflight.
- `scripts/production_promotion_gate.sh` — release safety controls.
- `docs/production/COST_MODEL.md` — cost drivers and formulas.
- `PRODUCTION_ISSUES.md` — provider/capacity/evidence blockers.
