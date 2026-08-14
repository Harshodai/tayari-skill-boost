# Tayari Remediation Program

**Owner:** Tayari engineering  
**Mode:** Security-first, proof-driven execution  
**Status:** In progress  
**Release policy:** No public backend, autonomous application submission, or macOS distribution until the applicable S0 gates pass.

## Execution rules

1. Every security or deployment claim must have a repository test, staging test, or captured command result. A comment or UI control is not evidence.
2. Public endpoints must be classified explicitly as `public`, `authenticated`, or `service-only`. Anything expensive, state-changing, or PII-bearing defaults to authenticated.
3. Browser automation remains review-only until a server-enforced, single-use approval token is bound to the user, job origin, form hash, and content versions.
4. All tests use synthetic resumes, synthetic tenants, fake ATS pages, and non-production credentials. No real credentials or customer documents belong in the test fixture set.
5. Every phase must leave the worktree buildable. Each completed phase receives a focused commit; unrelated formatting and generated artifacts are prohibited.
6. Production images must be immutable, environment-configured, signed, scanned, and deployable from a clean checkout. No localhost defaults, placeholders, source mounts, demo credentials, or mutable `latest` promotion.
7. A finding is not closed when the code is changed. It closes only when the negative proof test fails safely and the positive path still works.

## Milestones and dependency order

| Milestone | Depends on | Release effect |
|---|---|---|
| M0 — Backlog and baseline | None | Establishes the audit trail and current failing gates |
| M1 — Backend exposure lockdown | M0 | Blocks unauthenticated resource and automation abuse |
| M2 — Consent and tenant safety | M1 | Blocks unauthorized external actions and cross-tenant access |
| M3 — Release and deployment integrity | M1 | Makes the promoted artifact trustworthy and reversible |
| M4 — macOS distribution hardening | M1, M3 | Makes desktop distribution safe to test |
| M5 — Website and operational reliability | M1, M3 | Makes the public surface truthful and observable |
| M6 — Full proof suite and release decision | M2–M5 | Determines what, if anything, can launch |

## M0 — Baseline and controls

- [x] **M0-01** Preserve the v3 adversarial audit and evidence log.
- [ ] **M0-02** Add a `make audit` or equivalent command that runs the security, type, unit, integration, and route-gate checks without mutating the worktree.
- [ ] **M0-03** Add a clean-worktree guard around frontend and macOS packaging commands.
- [ ] **M0-04** Record the current baseline: frontend lint failures, dependency audit findings, Python test failures, E2E prerequisites, Go tests/vet, and deployment validation.

## M1 — Backend exposure lockdown

- [x] **M1-01 / S0** Move Go voice WebSocket routes behind authentication. Reject unauthenticated upgrades before dialing Python AI.
- [x] **M1-02 / S0** Add voice connection limits: per-user, global, duration, read/write deadlines, and an explicit close path.
- [x] **M1-03 / S0** Add negative and positive WebSocket tests for auth, origin policy, quotas, timeout, and backend-dial ordering. Focused auth/origin/upgrade tests pass; live socket quota test remains.
- [ ] **M1-04 / S0** Decide which Python ATS/AI routes are genuinely public. Make strategic AI, parser, importer, and automation routes authenticated or service-only.
- [ ] **M1-05 / S0** Make the public ATS scan a narrow, bounded endpoint with explicit payload, file, CPU, and request budgets.
- [x] **M1-06 / S0** Make Python rate limiting real: install the middleware or decorators, use a distributed store where replicas exist, and key expensive actions by authenticated user plus IP. Middleware is now installed; distributed storage and identity keying remain.
- [ ] **M1-07 / S1** Add per-operation quotas and cost budgets for LLM calls, browser minutes, imports, uploads, queue jobs, and WebSockets.
- [ ] **M1-08 / S1** Add request-size, timeout, concurrency, retry, and queue-backpressure controls to all expensive routes.
- [ ] **M1-09 / S1** Add tests proving anonymous flood requests fail before expensive work and that limits remain effective across two service replicas.
- [ ] **M1-10 / S1** Add an outbound importer budget and per-origin concurrency limit while preserving private-IP, redirect, and DNS-pinning protections.

**M1 exit gate:** unauthenticated voice upgrade returns 401/403 before the backend dial; public expensive routes enforce measured quotas; flood tests pass; authenticated happy paths remain green.

## M2 — Consent, automation, and tenant safety

- [ ] **M2-01 / S0** Split browser automation into prepare/review/submit states. Default to review-only.
- [ ] **M2-02 / S0** Require a server-generated, single-use approval token for final submission.
- [ ] **M2-03 / S0** Bind approval to user ID, normalized job URL/origin, form-field hash, resume version, cover-letter version, and expiry.
- [ ] **M2-04 / S0** Reject missing, expired, rejected, replayed, wrong-job, wrong-origin, and changed-form approvals atomically.
- [ ] **M2-05 / S0** Add a final-action guard independent of the LLM, page text, renderer, or UI drawer.
- [ ] **M2-06 / S1** Treat all ATS page text and form labels as untrusted data. Add a synthetic prompt-injection page test that proves no unauthorized navigation, upload, field mutation, or submit.
- [ ] **M2-07 / S0** Add a bounded kill switch that terminates browser, worker, queue, and downstream action within a defined deadline.
- [ ] **M2-08 / S0** Prove two-tenant isolation for every tenant-scoped table and endpoint using psql and PostgREST with anon, authenticated, and service roles.
- [ ] **M2-09 / S1** Add explicit RLS, grants, and policy tests for tenants, cohorts, memberships, push subscriptions, durable runs, approvals, receipts, and all new tables.
- [ ] **M2-10 / S1** Inventory and test account deletion across relational rows, object storage, screenshots, browser cookies, local volumes, Redis, queues, logs, and external-provider records.
- [ ] **M2-11 / S1** Make export and deletion schemas explicit, versioned, complete, and resistant to unbounded response or ZIP amplification.

**M2 exit gate:** no final submit without a matching approval token; prompt-injection, replay, wrong-job, kill-switch, tenant-isolation, and erasure tests pass.

## M3 — Release, supply chain, and deployment integrity

- [ ] **M3-01 / S0** Remove localhost and development Supabase values from release workflow defaults and Docker build args.
- [ ] **M3-02 / S0** Require explicit HTTPS production endpoints and fail builds on forbidden `localhost`, `127.0.0.1`, dev ports, demo secrets, or self-hosted defaults.
- [ ] **M3-03 / S0** Replace placeholder images and the fake Helm path with one real deployment promotion path.
- [ ] **M3-04 / S0** Build, scan, generate SBOM, sign, attest, push, render immutable digests, apply, wait for rollout, smoke-test, and record rollback metadata.
- [ ] **M3-05 / S1** Pin GitHub Actions to immutable commit SHAs, set least-privilege workflow permissions, and require review for workflow changes.
- [ ] **M3-06 / S1** Remove source bind mounts, local Supabase, Ollama, demo credentials, and development ports from staging/production Compose.
- [ ] **M3-07 / S1** Add standardized `/healthz` and `/readyz` endpoints and correct Compose/Kubernetes probes. Remove success-on-failure healthchecks.
- [ ] **M3-08 / S1** Add backup, restore, migration-order, rollback, and schema-compatibility tests in disposable staging.
- [ ] **M3-09 / S1** Add structured logs, metrics, tracing, queue-age alerts, provider-error alerts, and budget alerts.
- [ ] **M3-10 / S1** Consolidate package manager/lockfile and restore dependency scanning as a blocking, reviewable gate.

**M3 exit gate:** a clean commit produces a signed, scanned, immutable staging deployment with passing smoke tests and a tested rollback.

## M4 — macOS app hardening

- [ ] **M4-01 / S0** Configure real semantic version, application ID, icon, and release metadata.
- [ ] **M4-02 / S0** Add CSP, deny-by-default navigation and new-window handling, validate IPC senders, and schema-check all IPC inputs.
- [ ] **M4-03 / S0** Restrict external URLs to an allowlist and file reveals to user-selected session paths.
- [ ] **M4-04 / S1** Stop lifecycle processes safely on exit and add explicit local data retention/purge controls.
- [ ] **M4-05 / S0** Remove backend/source/dev virtual-environment payloads from the shipped app or replace them with a minimal, versioned runtime.
- [ ] **M4-06 / S0** Configure Developer ID signing, hardened runtime, entitlements, notarization, stapling, and update metadata in CI.
- [ ] **M4-07 / S1** Build and test arm64 and x64 artifacts, or document and enforce an Apple Silicon-only policy.
- [ ] **M4-08 / S1** Add clean-machine install, Gatekeeper, update, downgrade, corrupted-update, and offline-start tests.

**M4 exit gate:** clean macOS installation passes Gatekeeper and notarization checks; updater is authenticated; package size and contents are reviewed; build leaves the worktree clean.

## M5 — Website, truthfulness, and operational readiness

- [ ] **M5-01 / S0** Fix `/free-ats-scan` versus `/free-scan` route mismatch and add marketing-link crawl tests.
- [ ] **M5-02 / S1** Centralize frontend API access through `apiFetch`; remove direct page-level fetches and unsafe localhost fallbacks.
- [ ] **M5-03 / S1** Add production asset scans for endpoints, secrets, analytics IDs, CSP, security headers, and source maps.
- [ ] **M5-04 / S1** Add public-route browser smoke tests that do not require authenticated credentials.
- [ ] **M5-05 / S2** Reduce initial JS/image payloads, compress oversized assets, and enforce bundle budgets.
- [ ] **M5-06 / S1** Make marketing claims, receipts, demo states, and metrics explicitly labeled and sourced from real backend state.
- [ ] **M5-07 / S1** Add privacy/retention disclosures for resumes, browser sessions, screenshots, AI providers, and deletion behavior.
- [ ] **M5-08 / S2** Add accessible error, loading, empty, cancellation, and offline states for all public conversion paths.

**M5 exit gate:** public routes, CTA links, production asset configuration, headers, accessibility checks, and bundle budgets pass.

## M6 — Final proof and release decision

- [ ] **M6-01** Run Go tests, vet, Python tests, frontend typecheck/lint/unit, E2E, dependency audit, secret scan, and container validation from a clean checkout.
- [ ] **M6-02** Run unauthenticated endpoint inventory and compare every route to the explicit exposure registry.
- [ ] **M6-03** Run hostile staging tests for flood, SSRF, prompt injection, cross-tenant access, approval replay, kill switch, deletion, backup restore, and rollback.
- [ ] **M6-04** Verify the release artifact contains no localhost/dev placeholders, unapproved secrets, source mounts, or unsigned images/apps.
- [ ] **M6-05** Record residual risks with owner, evidence, expiry date, and explicit launch scope.
- [ ] **M6-06** Issue one of three decisions: `NO-GO`, `INTERNAL DEMO ONLY`, or `PUBLIC BETA GO`.

## Current execution order

The first implementation slice is **M1-01 through M1-06**. It closes the most dangerous exposure path before any product polish or cloud launch work. The next slice is **M2-01 through M2-05**, because a polished automation product that can submit without a server-side consent boundary is not safe to ship.
