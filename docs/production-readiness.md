# Tayari Production Readiness Notes

## Intentional no-database behavior

Several local development and deterministic unit-test paths intentionally run without `DATABASE_URL`. In that mode, database-backed helpers return an explicit empty result or use a process-local buffer so the application can exercise pure control-flow, security, and rendering behavior without starting PostgreSQL. These paths are not production persistence and must never be enabled for a production deployment.

| Area | No-database behavior | Production requirement |
|---|---|---|
| Scraping and Hermes task tests | Guarded task paths return cleanly when no database pool is configured; provider/network work remains separately stubbed in local tests. | Set a reachable PostgreSQL `DATABASE_URL`; a configured-but-unavailable database is an error, not a fallback. |
| Scheduler and standing watches | A scheduler tick exits without mutation when no pool exists. | Run with PostgreSQL and Redis available; readiness must be green before scheduling is enabled. |
| Agent run-control helpers | Local-only tests may use in-memory state for pure state-machine coverage. | Durable run events, controls, and delivery state must use PostgreSQL. |
| Privacy ledger | With no database configured, a process-local buffer supports local contract tests. With `DATABASE_URL` configured but the pool unavailable, purge and persistence fail closed. | Configure PostgreSQL and verify ledger persistence and purge in staging. |
| Evaluation optimizer | The evaluation runner may use a best-effort optimizer path for offline scoring experiments. | Production AI decisions must use an approved configured provider and emit explicit unavailable/degraded metadata when unavailable. |

The release contract asserts this boundary through source-level fail-closed checks, unit tests, and migration/recovery contracts. A deployment is not production-ready merely because the local no-database path is green.

## Toolchain

- Python runtime: 3.11+ required. Local verification uses `backend/python/.venv/bin/python` (Python 3.12.13).
- Do not use system `python3` 3.9 for tests or verification scripts.

## Live proof boundary

The following require a disposable staging environment and cannot be proven by static checks: two-tenant RLS isolation against real PostgreSQL, queue redelivery after worker termination, Stripe signature and replay behavior through a deployed endpoint, Gmail Pub/Sub watch renewal and push delivery, provider structured-output calls, alert delivery, and measured restore/rollback RPO and RTO.

The credential-gated live verifier and hostile-suite plan mode report these conditions as blocked rather than converting them into synthetic passes.
