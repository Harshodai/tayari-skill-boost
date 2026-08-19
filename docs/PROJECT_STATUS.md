# Tayari Project Status

**As of:** 19 August 2026

## Release decision

> **INTERNAL DEMO ONLY.**

The current checkout is suitable for controlled demonstrations with synthetic or disposable data. It is not approved for public customer onboarding, real customer documents, autonomous external submissions, or public macOS distribution.

## What is currently verified

| Area | Current evidence | Interpretation |
|---|---|---|
| Frontend | Unit tests, lint, and production build run locally | Code-level checks pass; lint warnings remain |
| Go gateway | `go test ./...` and `go vet ./...` | Local gateway regression checks pass |
| Python AI engine | Full repository pytest suite | Service behavior is covered locally |
| Database security | Production scanner reports no new findings | Static database gate is green |
| Product surface | Core navigation is intentionally focused | Secondary capabilities remain internal evaluation surfaces |

## What still blocks public launch

Live hostile staging, cross-tenant negatives, prompt-injection and SSRF tests, queue outage and cancellation drills, disposable backup restore, rollback evidence, generated route inventory comparison, immutable production promotion, and credentialed macOS signing/notarization remain required. These are release proofs, not documentation tasks.

## Source of truth

Use `TAYARI_RELEASE_GATE.md` for the authoritative release decision and blocking risks. Use `README.md` for local setup and commands. Historical sprint reports and HTML reviews are context only and must not override the release gate.
