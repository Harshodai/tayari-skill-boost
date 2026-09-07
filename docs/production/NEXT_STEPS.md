# NEXT STEPS — prioritized (2026-09-07)

## P0 — must precede any production claim

1. **Authenticated end-to-end run** of the five critical journeys (auth → resume → job save → pipeline stage → cover letter) against a running Go + Python stack, capturing DB state after each step.
   *Acceptance*: every step has a persisted row verified by query and a matching UI state after reload.
2. **Two-user negative tests** executed live (not statically) for `saved_jobs`, `resume_analyses`, `agent_runs`, `submission_receipts`, `contacts`, `push_subscriptions`.
   *Acceptance*: user B receives 403/empty for every read, update, delete, and job trigger on user A's rows.
3. **Docker clean-start proof**: clone → two `.env` files → `docker compose --profile dev up -d --build` → health checks → one full smoke journey.
   *Acceptance*: documented command sequence reproduced from scratch with output captured.

## P1

4. Regression test for the push IDOR fix (`routes_push_test.go`): user A's token + user B's `user_id` must yield 403.
5. Resolve the two orphaned API paths (`/v1/communications/{id}/response`, `/v1/saves/{id}/highlights/{id}`) — either register the routes or delete the callers.
6. Failure-injection matrix: Go down, Python down, Redis down, LLM 429/timeout. *Acceptance*: no misleading success state, bounded retries, recoverable UI.

## P2

7. Wire `useBackendHealth` / `BackendUnavailableBanner` into every page that depends on the Go/Python stack so degradation messaging is uniform.
8. Make the eight unused feature flags actually gate their routes in `src/App.tsx`.
9. Eliminate the app-wide "Function components cannot be given refs" warnings.
10. Latency budget: measure p50/p95 for page load, auth, and each AI call; record and set thresholds.

## P3

11. Remove the dead `/automations` path or re-enable the flag with evidence.
12. Rate-limit / spam-protect the public contact form.
13. Accessibility pass: keyboard-only completion of each critical journey.
