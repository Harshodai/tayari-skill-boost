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
- [x] **M1-03 / S0** Add negative and positive WebSocket tests for auth, origin policy, quotas, timeout, and backend-dial ordering. Go API tests now prove unauthenticated and untrusted-origin rejection before dialing, non-WebSocket rejection, and a same-user third upgrade blocked before the backend dial.
- [x] **M1-04 / S0** Decide which Python ATS/AI routes are genuinely public. Make strategic AI, parser, importer, and automation routes authenticated or service-only. Strategic, parser, importer, export, job-search, autopilot, one-shot, and browser routes now require verified user identity; only the text-only quick score remains public.
- [x] **M1-05 / S0** Make the public ATS scan a narrow, bounded endpoint with explicit payload, file, CPU, and request budgets. `/api/v1/ats/score` is text-only with 20,000-character field caps; file parsing is private and capped at 10 MiB; a 12 MiB application body cap runs before parsing.
- [x] **M1-06 / S0** Make Python rate limiting real: install the middleware or decorators, use a distributed store where replicas exist, and key expensive actions by authenticated user plus IP. Production requires Redis-backed SlowAPI storage; keys are user-plus-IP for authenticated gateway calls and IP for anonymous calls.
- [x] **M1-07 / S1** Add per-operation quotas and cost budgets for LLM calls, browser minutes, imports, uploads, queue jobs, and WebSockets. Redis-backed operation budgets cover public scans, imports, AI generation, browser automation, and autopilot starts; autopilot also enforces a daily 10,000-token reservation and a bounded active queue; upload/body and Go voice limits cover the remaining surfaces.
- [x] **M1-08 / S1** Add request-size, timeout, concurrency, retry, and queue-backpressure controls to all expensive routes. The app has a pre-parse body cap, bounded importer/global-origin semaphores and timeout, existing provider/client timeouts and long-context semaphore, browser step/run/cancel caps, and autopilot queue backpressure.
- [x] **M1-09 / S1** Add tests proving anonymous flood requests fail before expensive work and that limits remain effective across two service replicas. Proofs cover handler non-entry on flood, shared Redis counters across independent budget instances, tenant separation, and expiry.
- [x] **M1-10 / S1** Add an outbound importer budget and per-origin concurrency limit while preserving private-IP, redirect, and DNS-pinning protections. Import size is capped at 1 MiB, each fetch is capped at 5 seconds, global concurrency at 8, and per-origin concurrency at 2; proof test passes.

**M1 exit gate:** unauthenticated voice upgrade returns 401/403 before the backend dial; public expensive routes enforce measured quotas; flood tests pass; authenticated happy paths remain green. Current evidence: Go API voice tests pass; Python suite 664 passed / 4 skipped plus focused quota/importer/request proofs.

## M2 — Consent, automation, and tenant safety

- [x] **M2-01 / S0** Split browser automation into prepare/review/submit states. Autopilot produces reviewable packages and defaults scheduled runs to `auto_apply=false`; browser submission is a separate guarded action.
- [x] **M2-02 / S0** Require a server-generated, single-use approval token for final submission. The durable approval UUID is consumed atomically and then wrapped in a server MAC before browser execution.
- [x] **M2-03 / S0** Bind approval to user ID, normalized job URL/origin, form-field hash, resume version, cover-letter version, and expiry. The schema stores all five hashes plus a 15-minute expiry.
- [x] **M2-04 / S0** Reject missing, expired, rejected, replayed, wrong-job, wrong-origin, and changed-form approvals atomically. Approval SQL uses exact hashes, `expires_at`, `decision='approved'`, `consumed_at IS NULL`, and `UPDATE ... RETURNING`.
- [x] **M2-05 / S0** Add a final-action guard independent of the LLM, page text, renderer, or UI drawer. The browser library requires the signed guard, validates all content fingerprints, and rejects cross-origin completion evidence.
- [x] **M2-06 / S1** Treat all ATS page text and form labels as untrusted data. Synthetic proofs block hostile navigation, uploads, unknown-field mutation, and submit actions before execution.
- [x] **M2-07 / S0** Add a bounded kill switch that terminates browser, worker, queue, and downstream action within a defined deadline. Durable cancellation, Celery revoke, browser termination, and a five-second cleanup bound are covered by proof tests.
- [x] **M2-08 / S0** Prove two-tenant isolation for every tenant-scoped table and endpoint using psql and PostgREST with anon, authenticated, and service roles. The forward migration provides explicit tenant membership policies and the test contract enumerates all protected tables; live disposable-Postgres execution remains a staging gate.
- [x] **M2-09 / S1** Add explicit RLS, grants, and policy tests for tenants, cohorts, memberships, push subscriptions, durable runs, approvals, receipts, Agent Space tasks, and all new tables.
- [x] **M2-10 / S1** Inventory and test account deletion across relational rows, object storage, screenshots, browser cookies, local volumes, Redis, queues, logs, and external-provider records. Go performs the relational transaction; the private Python purge revokes workers, closes browsers, clears runtime/Redis state, removes screenshots, and clears the privacy ledger.
- [x] **M2-11 / S1** Make export and deletion schemas explicit, versioned, complete, and resistant to unbounded response or ZIP amplification. Exports carry a schema version, row ceilings, a 10 MiB JSON ceiling, and an explicit HTTP 413 failure.

**M2 exit gate:** no final submit without a matching approval token; prompt-injection, replay, wrong-job, kill-switch, tenant-isolation, and erasure proofs pass. Live psql/PostgREST two-tenant execution is still required before public launch.

## M3 — Release, supply chain, and deployment integrity

- [x] **M3-01 / S0** Remove localhost and development Supabase values from release workflow defaults and Docker build args. Release builds now require repository-provided Supabase URL and publishable key values.
- [x] **M3-02 / S0** Require explicit HTTPS production endpoints and fail builds on forbidden `localhost`, `127.0.0.1`, dev ports, demo secrets, or self-hosted defaults. Frontend release Dockerfiles and the promotion contract fail closed.
- [x] **M3-03 / S0** Replace placeholder images and the fake Helm path with one real deployment promotion path. Production promotion is delegated to `scripts/deploy-environment.sh`.
- [x] **M3-04 / S0** Build, scan, generate SBOM, sign, attest, push, render immutable digests, apply, wait for rollout, smoke-test, and record rollback metadata. Provenance/SBOM and attestation/digest gates are wired; live registry signing and rollback remain staging evidence.
- [x] **M3-05 / S1** Pin GitHub Actions to immutable commit SHAs, set least-privilege workflow permissions, and require review for workflow changes. All workflow action references are SHA-pinned.
- [x] **M3-06 / S1** Remove source bind mounts, local Supabase, Ollama, demo credentials, and development ports from staging/production Compose. Development Compose is explicitly dev/eval-only; production Compose is image-only.
- [x] **M3-07 / S1** Add standardized `/healthz` and `/readyz` endpoints and correct Compose/Kubernetes probes. Readiness fails closed without required dependencies.
- [x] **M3-08 / S1** Add backup, restore, migration-order, rollback, and schema-compatibility tests in disposable staging. Local proof covers contract and migration order; disposable-Postgres execution remains required before launch.
- [x] **M3-09 / S1** Add structured JSON request logs with X-Request-ID correlation in Go and Python; add token-protected `/metrics` endpoints; count requests, 5xx responses, LLM/provider failures, budget rejections, Celery task failures, and queue age; wire Celery lifecycle signals; and version the queue-age/provider-error/budget alert thresholds in `infra/observability/alerts.yml`. Proof: `backend/go/internal/api/observability_test.go`, `backend/python/app/tests/test_observability.py`, and `scripts/release_contract_test.sh`.
- [x] **M3-10 / S1** Consolidate package manager/lockfile and restore dependency scanning as a blocking, reviewable gate. Bun is the sole frontend installer with a frozen `bun.lock`; Python `pip-audit --strict` and the corrected Bun audit parser run in CI. The dependency gates now pass with zero new high/critical frontend findings and zero Python audit findings. Vulnerable transitive branches were upgraded through reviewed overrides; optional browser-use and Crawl4AI trees were removed from the core image and fail closed/require explicit opt-in.

**M3 exit gate:** a clean commit produces a signed, scanned, immutable staging deployment with passing smoke tests and a tested rollback.

## M4 — macOS app hardening

- [x] **M4-01 / S0** Configure real semantic version, application ID, icon, and release metadata. The app is version `0.1.0`, uses `app.tayari.desktop`, and has explicit product/copyright metadata.
- [x] **M4-02 / S0** Add CSP, deny-by-default navigation and new-window handling, validate IPC senders, and schema-check all IPC inputs. The macOS contract proves these controls and JavaScript syntax.
- [x] **M4-03 / S0** Restrict external URLs to an allowlist and file reveals to user-selected session paths. External links require HTTPS and approved hosts; reveal IPC rejects paths not selected in the current session.
- [x] **M4-04 / S1** Stop lifecycle processes safely on exit and add explicit local data retention/purge controls. Development services are stopped best-effort before quit; packaged builds cannot orchestrate local services and settings are written with mode 0600.
- [x] **M4-05 / S0** Remove backend/source/dev virtual-environment payloads from the shipped app or replace them with a minimal, versioned runtime. Packaged electron-builder contents exclude backend, Supabase, Compose, and source-map payloads.
- [x] **M4-06 / S0** Configure Developer ID signing, hardened runtime, entitlements, notarization, stapling, and update metadata in CI. Hardened runtime, entitlements, notarization team variable, signed DMG metadata, `docs/MACOS_RELEASE_RUNBOOK.md`, and `scripts/mac_artifact_contract.sh` are configured; actual Apple signing/notarization, Gatekeeper, and stapling evidence remains a release credential gate.
- [x] **M4-07 / S1** Build and test arm64 and x64 artifacts, or document and enforce an Apple Silicon-only policy. The package explicitly enforces Apple Silicon arm64 targets; x64 is not claimed.
- [ ] **M4-08 / S1** Add clean-machine install, Gatekeeper, update, downgrade, corrupted-update, and offline-start tests. The runbook defines the required evidence and the artifact verifier fails closed, but no credentialed clean-machine artifact execution has been performed.

**M4 exit gate:** clean macOS installation passes Gatekeeper and notarization checks; updater is authenticated; package size and contents are reviewed; build leaves the worktree clean.

## M5 — Website, truthfulness, and operational readiness

- [x] **M5-01 / S0** Fix `/free-ats-scan` versus `/free-scan` route mismatch and add marketing-link crawl tests. `/free-ats-scan` now redirects to `/free-scan`; Playwright covers both paths and public marketing routes.
- [x] **M5-02 / S1** Centralize frontend API access through `apiFetch`; remove direct page-level fetches and unsafe localhost fallbacks. Page/context calls now use the shared response wrapper, while only low-level API/MCP modules retain raw transport access.
- [x] **M5-03 / S1** Add production asset scans for endpoints, secrets, analytics IDs, CSP, security headers, and source maps. The website contract checks owned development endpoints, security headers in both edge configurations, and source-map/bundle output conditions; secret and analytics signature scanning remains a follow-up.
- [x] **M5-04 / S1** Add public-route browser smoke tests that do not require authenticated credentials. The isolated Playwright suite passed seven public-route tests with synthetic configuration.
- [x] **M5-05 / S2** Reduce initial JS/image payloads, compress oversized assets, and enforce bundle budgets. The Vite build passed with a 900 KiB largest-JavaScript and 6 MiB total-JavaScript budget.
- [x] **M5-06 / S1** Make marketing claims, receipts, demo states, and metrics explicitly labeled and sourced from real backend state. ReceiptShowcase and GhostJobStat are labeled illustrative/synthetic, SocialProofSection renders only fetched counters or an unavailable/loading state, and the website contract scans public copy for closed unsupported claims. Proof: `src/test/TruthfulnessAccessibility.test.tsx`, `src/test/SocialProofSection.test.tsx`, and `scripts/website_release_contract.mjs`.
- [x] **M5-07 / S1** Add privacy/retention disclosures for resumes, browser sessions, screenshots, AI providers, and deletion behavior. `src/pages/Privacy.tsx` now distinguishes self-hosted and hosted modes, provider terms, browser/session artifacts, backups, runtime cleanup, and non-instant deletion; PrivacyReadiness shows unreported residency/redaction fields as unreported rather than successful. Proof: `src/test/TruthfulnessAccessibility.test.tsx`.
- [x] **M5-08 / S2** Add accessible error, loading, empty, cancellation, and offline states for all public conversion paths. The free ATS scan now has labeled inputs, live offline/error states, abort/cancel behavior, invalid-result rejection, and retry; Auth has inline errors, offline guards, accessible password state, and social-provider error propagation. Proof: `src/test/TruthfulnessAccessibility.test.tsx`, frontend lint, and TypeScript checks.

**M5 exit gate:** public routes, CTA links, production asset configuration, headers, accessibility checks, and bundle budgets pass.

## M6 — Final proof and release decision

- [x] **M6-01** Run Go tests, vet, Python tests, frontend typecheck/lint/unit, E2E, dependency audit, secret scan, migration, release contract, build, and desktop-contract proofs. Current full suite: Go tests/vet pass; Python **691 passed, 4 skipped**; frontend **33 files / 100 tests**, typecheck, lint, and build pass; migrations, release contract, JS security scan, Python audit, and macOS static contract pass. The run was executed from the current checkout; an unrelated pre-existing `supabase/functions/mcp/index.ts` diff remains intentionally unstaged and is not part of this remediation series.
- [ ] **M6-02** Run unauthenticated endpoint inventory and compare every route to the explicit exposure registry. Existing targeted endpoint proofs pass, but a complete registry comparison has not been produced.
- [x] **M6-02a / S1** Add `infra/endpoint-exposure.yml` and Go route-walking proofs for the registered anonymous routes, representative authenticated/API-key routes, and internal-token metrics boundary. A full generated inventory comparison remains part of M6-02.
- [ ] **M6-03** Run hostile staging tests for flood, SSRF, prompt injection, cross-tenant access, approval replay, kill switch, deletion, backup restore, and rollback. Unit and contract proofs exist; live staging flood/SSRF/restore/rollback evidence is still missing.
- [x] **M6-03a / S1** Add `scripts/staging_recovery_contract_test.sh`; it proves restore-drill mode/target separation, backup source/restore separation, rollback approval, immutable promotion preflight, and provenance/dry-run checks. It deliberately does not claim live disposable-Postgres or cluster evidence.
- [ ] **M6-04** Verify the release artifact contains no localhost/dev placeholders, unapproved secrets, source mounts, or unsigned images/apps. Frontend, desktop, and production Compose contracts pass; dependency gates are green, but Apple signing/notarization and immutable staging promotion were not executed.
- [x] **M6-05** Record residual risks with owner, evidence, expiry date, and explicit launch scope. Residual risks and owners are recorded in `TAYARI_RELEASE_GATE.md`.
- [x] **M6-06** Issue one of three decisions: `NO-GO`, `INTERNAL DEMO ONLY`, or `PUBLIC BETA GO`. Decision: **INTERNAL DEMO ONLY**; code gates and dependency/privacy/claims/accessibility proofs are green, but live staging, complete endpoint inventory, immutable promotion, backup/rollback execution, and Apple credentialed distribution evidence remain open.

## Current execution order

The first implementation slice is **M1-01 through M1-06**. It closes the most dangerous exposure path before any product polish or cloud launch work. The next slice is **M2-01 through M2-05**, because a polished automation product that can submit without a server-side consent boundary is not safe to ship.


## M7 — Competitive outperformance: nxtjob.ai and jobstep.io

**Purpose:** Use the public strengths of nxtjob.ai and jobstep.io as a benchmark, while making JobTayari materially more trustworthy, evidence-driven, and end-to-end than either point of comparison. This is a product strategy and validation backlog, not a request to copy competitors’ branding, claims, or unverified outcome numbers.

### Competitive benchmark captured on 2026-08-25

| Competitor | Public strengths to match or learn from | JobTayari response and intended advantage |
|---|---|---|
| [nxtjob.ai][nxtjob-home] | Senior-professional positioning; a simple “job search strategy” narrative; hidden-market and decision-maker networking language; a nine-agent story spanning discovery, tailoring, networking, pitching, content, interviews, and negotiation; free-to-paid progression and coaching. | Keep JobTayari’s audience and launch scope honest, then expose the existing observable resume-to-interview chain. Use the knowledge graph and evidence-backed networking workflow to make recommendations explainable rather than presenting a large agent roster as proof of execution. Maintain candidate-controlled review and never auto-send outreach or submit applications without explicit authorization. |
| [jobstep.io][jobstep-home] | Low-friction four-step funnel; visually clear resume score, job-match percentages, tailored resume and cover-letter workflow, centralized application dashboard; prominent trust, privacy, localization, reviews, and “start free” messaging. | Make JobTayari’s primary path equally legible: resume → fit analysis → tailor → review → track → interview. Outperform the single-score pattern with confidence bands, per-dimension evidence, anti-stuffing penalties, provenance, and an explicit explanation of what the system does not know. Surface the already-built guardrails, receipts, and human approval boundary in the product experience. |

The competitor evidence above is based on public landing-page and pricing/homepage claims and must not be treated as independently verified performance evidence. NxtJob’s page publicly claims a senior-professional focus, hidden jobs, direct decision-maker access, nine specialized agents, and outcome-oriented interview messaging; its [pricing page][nxtjob-pricing] lists a free tier, a ₹15,000/month Nova tier, a coaching-oriented Signature Program, one-time purchase language, and a non-refundable policy. JobStep’s homepage publicly claims 120,000+ users, 689,231+ applications created, an average of 3x more replies, AI-scored job matching, and Swiss/GDPR/EU-data privacy positioning. Its direct `/en/pricing` URL returned 404 during review, so no exact JobStep price is recorded here. These claims require validation before they are used in product, pricing, or marketing decisions.

### Work items

- [ ] **M7-01 / P1 — Maintain a 90-day competitor scorecard.** Track nxtjob.ai, jobstep.io, Jobscan, Teal, Huntr, Simplify, and other relevant alternatives across onboarding time, resume analysis, job discovery, tailoring, tracker quality, networking, interview preparation, negotiation, privacy, approval boundaries, provenance, pricing, and evidence quality. Record page URL, capture date, observed behavior, and whether each item is a vendor claim or verified behavior.
- [ ] **M7-02 / P1 — Match JobStep’s clarity without copying its unsupported outcome claims.** Define one primary JobTayari funnel with a four-to-six-step progress model and a single next action at each stage. The UI must show real backend state, loading/error/empty states, and no fabricated scores, names, company data, reviews, or conversion claims.
- [ ] **M7-03 / P0 — Build the defensible trust-first scoring experience.** Replace the exposed single ATS number with structural score, semantic job fit, evidence strength, experience relevance, achievement quality, seniority alignment, keyword coverage, stuffing penalty, unsupported-claim penalty, confidence band, and human-readable rationale. Add adversarial tests for keyword stuffing, repeated job-description text, unsupported claims, prompt injection, and malformed provider output.
- [ ] **M7-04 / P1 — Productize senior-career strategy without an “agent theater” dependency.** Add an evidence-backed target-market brief that explains recommended roles, companies, industries, decision-maker hypotheses, and reasons grounded in the user’s resume, target job, and graph evidence. The system must distinguish verified facts, inferred suggestions, and unknowns.
- [ ] **M7-05 / P1 — Strengthen hidden-market discovery and referral intelligence.** Extend the existing tiered, circuit-breakered search and social graph into a reviewable workflow for company pages, referral paths, hiring-manager discovery, and unposted-opportunity hypotheses. Store source URLs, timestamps, confidence, and consent state; never imply that an unverified role or contact is real.
- [ ] **M7-06 / P0 — Make networking assistance safer and more useful than competitor automation claims.** Generate personalized outreach drafts, follow-up sequences, and referral context, but require candidate review before every send. Add tests for prompt injection, wrong-recipient binding, duplicate sends, replayed approvals, rate limits, and unverifiable contact data.
- [ ] **M7-07 / P1 — Connect interview and negotiation preparation to the same application record.** Every tailored application should carry its job description, resume version, evidence summary, interview preparation plan, follow-up tasks, and negotiation context into the reviewable application timeline. Measure whether this reduces repeated work and improves downstream interview readiness without claiming causal lift prematurely.
- [ ] **M7-08 / P0 — Turn privacy and operational truth into a visible moat.** Publish and test provider provenance, data-retention behavior, self-hosted/local-LLM mode, deletion scope, browser-session cleanup, receipt verification, and candidate-controlled approval boundaries. The public experience must clearly distinguish verified evidence, candidate-confirmed information, illustrative fixtures, and unavailable data.
- [ ] **M7-09 / P1 — Design a transparent free-to-paid experiment.** Benchmark JobStep’s “start free” funnel and NxtJob’s free-to-premium/coaching ladder, then propose JobTayari packaging based on actual infrastructure cost, user value, and privacy commitments. Do not copy pricing, scarcity, refund, or outcome language without product-owner and legal review.
- [ ] **M7-10 / P1 — Establish a competitive proof dashboard.** Use synthetic and opt-in real-user cohorts to measure time to first useful result, resume-fact preservation, job-match precision, tailoring acceptance rate, unsupported-claim rate, keyword-stuffing rate, provenance coverage, review completion, application duplication rate, interview-prep completion, and verified downstream outcomes. Report confidence intervals and sample sizes; never turn a small sample into a universal “3x” claim.
- [ ] **M7-11 / P2 — Clarify the JobTayari category narrative.** Test positioning that combines JobStep’s simple end-to-end funnel with NxtJob’s strategic senior-search orientation, but anchor the promise in JobTayari’s real differentiators: an observable resume-to-interview chain, evidence-backed skill graph, reflective optimization, tiered job discovery, guardrail-gated Apply Assist, candidate control, and self-hosted privacy.
- [ ] **M7-12 / P1 — Add a release gate for competitor-derived claims.** Any public statement comparing JobTayari with nxtjob.ai or jobstep.io must include a dated source, claim classification, verification status, and owner. Marketing copy must not imply that JobTayari has higher response rates, better placement, more users, or superior provider quality until the corresponding evidence artifact exists.

### M7 exit gate

JobTayari should not claim to outperform either competitor until the primary funnel is demonstrably simpler, the scoring output is more transparent, the application workflow is safer and more observable, and a dated benchmark shows improvement on agreed metrics. The exit artifact must include the competitor scorecard, product comparison, synthetic evaluation results, opt-in outcome methodology, privacy/truthfulness review, and a list of claims that remain unverified.

[nxtjob-home]: https://nxtjob.ai/
[nxtjob-pricing]: https://nxtjob.ai/pricing
[jobstep-home]: https://www.jobstep.io/en
[jobstep-pricing]: https://www.jobstep.io/en/pricing


## M8 — Profitability validation and paid-pilot execution

**Purpose:** Convert the profitability thesis into measured evidence before expanding product scope, infrastructure spend, or acquisition spend. The current conclusion is **potentially profitable, not yet proven profitable**.

- [ ] **M8-01 / P0 — Instrument the paid funnel.** Measure visitor → signup → first useful result → first tailored application → paid conversion, segmented by acquisition channel and product entry point.
- [ ] **M8-02 / P0 — Measure contribution margin by workflow.** Attribute LLM tokens, provider calls, scraping, browser minutes, storage, email, payment fees, and support time to resume analysis, job search, tailoring, review, and interview preparation.
- [ ] **M8-03 / P0 — Run a bounded paid pilot.** Recruit an opt-in cohort, test transparent pricing around the proposed ₹999–₹1,999/month consumer range, record willingness to pay, and avoid unverified placement or response-rate claims.
- [ ] **M8-04 / P0 — Prove repeat usage.** Track second-application rate, weekly/monthly retention, churn reason, reactivation, and number of useful career tasks per paid user. Do not rely on resume-upload conversion alone as evidence of recurring value.
- [ ] **M8-05 / P1 — Set durable cost ceilings.** Enforce per-user, per-tenant, provider, job-run, document-token, and browser-execution budgets that survive service restarts. Alert before a user or provider becomes structurally loss-making.
- [ ] **M8-06 / P1 — Establish acquisition payback gates.** Report CAC, contribution LTV, LTV/CAC, payback period, organic share, referral rate, and support burden by channel. Do not scale a paid channel until payback is inside the approved target window.
- [ ] **M8-07 / P1 — Package the narrow paid product first.** Start with resume analysis, job-fit analysis, reflective tailoring, cover letter, review queue, application tracking, and interview preparation. Keep high-cost scraping, browser execution, and broad Career OS surfaces bounded or separately priced until economics are proven.
- [ ] **M8-08 / P1 — Test a privacy-led premium lane.** After consumer workflow evidence exists, evaluate higher-value plans for self-hosted/local-LLM deployments, career coaches, universities, outplacement providers, and private cohorts. Include implementation, support, security, and procurement costs in the model.
- [ ] **M8-09 / P1 — Maintain a monthly economics review.** Reconcile actual revenue, refunds, provider spend, infrastructure spend, support hours, active paid users, gross margin, churn, and cash runway against the scenario model. Update assumptions only from measured data.

### M8 decision gates

| Gate | Minimum decision evidence |
|---|---|
| Paid value | Users pay for the bounded workflow without unsupported outcome claims. |
| Unit economics | Measured variable cost remains below price with a safety margin after fees, refunds, and support. |
| Retention | Users return for multiple applications or career tasks; churn reasons are known. |
| Distribution | At least one channel has repeatable CAC with acceptable contribution payback. |
| Trust | No unresolved severe truthfulness, privacy, approval-boundary, or duplicate-action incident. |
| Scale | Provider, queue, browser, and storage budgets remain enforceable during restart and failure tests. |

**M8 exit gate:** JobTayari may expand acquisition or scope only after a paid pilot demonstrates repeat usage, positive contribution margin, acceptable CAC payback, and trustworthy product behavior. The approved business conclusion must state the actual cohort size, measurement period, pricing, cost basis, churn definition, and confidence limits.


## M9 — End-to-end feature maturity and state-of-the-art upgrade roadmap

**Purpose:** Advance meaningful capabilities by evidence level rather than by feature count. The full scorecard and research record are in [`docs/reports/jobtayari-end-to-end-maturity-review-2026-08-25.md`](docs/reports/jobtayari-end-to-end-maturity-review-2026-08-25.md). SimilarWeb traffic metrics and video-analysis claims are intentionally excluded because those research paths were unavailable in the current session.

### M9 priority sequence

- [ ] **M9-01 / P0 — Make the candidate-controlled spine the product contract.** Complete resume ingestion → job discovery/triage → grounded tailoring → cover-letter/application artifacts → review → tracking with profile snapshot, job identity, artifact hash, provenance, approval state, and explicit failure state at every stage.
- [ ] **M9-02 / P0 — Complete live evidence before enabling high-risk features.** Prove managed DB/Auth/Redis, two-tenant isolation, provider readiness, hostile staging, recovery, rollback, protected observability, and authenticated load. Keep browser submission, desktop control, broad connectors, WhatsApp approval, and unattended AutoPilot disabled unless their specific acceptance bundles pass.
- [ ] **M9-03 / P0 — Build the canonical application state machine.** Separate prepared, reviewed, candidate-confirmed, approved, attempted, receipt-confirmed, and externally verified states. Reconcile receipts before retry and prevent duplicate external actions.
- [ ] **M9-04 / P1 — Build the resume and ATS evidence corpus.** Add clean, scanned, malformed, multilingual, table-heavy, column-heavy, and long-document fixtures. Record source hash, parser version, extracted-text hash, claim-level diffs, parseability, relevance, portal compatibility, confidence, and candidate confirmation.
- [ ] **M9-05 / P1 — Build the canonical job identity and freshness ledger.** Store source URL, provider, observed time, content hash, first/last seen, expiry reason, deduplication key, ranking explanation, provider budget, and replayable fixture evidence.
- [ ] **M9-06 / P1 — Upgrade AI quality and cost observability.** Record model/provider/prompt versions, input/output hashes, latency, tokens, cost, safety result, fallback path, and user-visible outcome for every AI artifact. Add repeatable tests for truth preservation, prompt injection, structured-output failure, stale sources, context overflow, runaway cost, and provider failure.
- [ ] **M9-07 / P1 — Make review and answer reuse application-bound.** Bind each answer and approval to user, tenant, job, question key, artifact versions, sensitivity class, expiry, policy version, and confirmation receipt. Add stale-answer, duplicate, replay, outage, and cross-user tests.
- [ ] **M9-08 / P1 — Turn career intelligence into measurable plans.** Version goals and recommendations, show evidence/confidence/freshness/effort, and measure completed actions and candidate feedback for role, domain, seniority, return-to-work, and relocation scenarios.
- [ ] **M9-09 / P1 — Operate connectors with minimum scope.** Enable Gmail, Google, messaging, Firecrawl, and Apify one at a time with narrow scopes, explicit consent, server-side filters, deletion/revocation, signed webhooks, rate limits, provider budgets, and retained live evidence.
- [ ] **M9-10 / P2 — Run one isolated browser proof only after P0/P1 gates.** Use one allowlisted ATS with per-run isolation, no credential persistence, candidate takeover for sensitive fields, server kill, cancellation polling, replay-safe action IDs, screenshots/events, ambiguous-state pause, and receipt reconciliation.
- [ ] **M9-11 / P2 — Evaluate mature open-source building blocks before adding dependencies.** Benchmark [Unstructured](https://github.com/Unstructured-IO/unstructured) for document fixtures, [browser-use](https://github.com/browser-use/browser-use) for preview-only browser workers, [Langfuse](https://github.com/langfuse/langfuse) for LLM traces/evaluations, and [Inngest](https://github.com/inngest/inngest) against the existing Celery/lease/event spine. Do not introduce duplicate infrastructure without a measured gap.
- [ ] **M9-12 / P2 — Reduce frontend lint debt by risk.** Eliminate hook dependency warnings and unsafe `any` usage first on authentication, AI, browser, connector, billing, and user-data paths; then reduce the remaining 392 warnings in bounded batches with regression tests.
- [ ] **M9-13 / P3 — Defer broad feature expansion until core evidence exists.** Keep broad social graph, gamification expansion, general desktop automation, unattended submission, wide connector breadth, and additional agent types behind explicit scope controls until the primary workflow proves retention, trust, and contribution margin.

### M9 exit gate

A feature may move from Level 2 to Level 3 only after happy-path, validation, failure, duplicate/retry, and regression evidence. It may move from Level 3 to Level 4 only after deployed observability, security/ownership negatives, dependency failure handling, runbook, and environment-specific evidence. It may move from Level 4 to Level 5 only after measured performance/cost, bounded automation or recovery, repeatable evaluation, and operator evidence. Level 6 requires sustained comparative evidence and is not assigned by aspiration.
