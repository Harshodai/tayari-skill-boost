# Tayari — Ruthless Re-Audit After Hardening Work

**Audit date:** 24 August 2026  
**Audited local revision:** `df44b7f`  
**Remote observed during audit:** `origin/main` at `9368025`  
**Verdict:** **NO-GO for final staging promotion today.** The platform has materially improved and its bounded core flow is demonstrably closer to staging-ready, but the current repository cannot honestly claim a green release candidate while the complete Python suite and complete browser suite fail. The narrow core is a credible **conditional staging candidate after the blockers below are fixed, committed, pushed, and revalidated.**

## Executive Summary

The repository is now substantially stronger than the pre-hardening baseline. Its production-promotion contract passed **66 checks with zero failures**; current self-hosted migration integrity and the database RLS/grant gate passed; direct anonymous PostgREST denial probes returned HTTP 401 for the previously exposed sensitive tables; frontend typecheck/build/unit/bundle-budget commands passed; Go tests and vet passed; and several live local end-to-end flows passed. Specifically, authenticated smoke tests passed 14/14, public-route smoke passed 7/7, a core flow passed 1/1, and resume upload plus resume/JD analysis passed 1/1 against the running local stack.

That progress does not yet equal final-staging readiness. A normal Python `pytest` run stops in test collection because two test modules have the same import name. Forcing importlib collection reveals 928 passing tests but **two failing agent-squad tests** that still expect a successful LLM-generated result when no LLM is configured; the engine now correctly fails closed rather than fabricating a result. The complete Playwright suite also failed: 47 passed, 3 failed, and 5 did not run. The failures include a real keyboard/mobile-menu defect and two stale or non-deterministic tests. The codebase therefore has a gap between strong targeted verification and a truly green release gate.

The product is also still much broader than the dependable candidate value proposition. Its strongest launch narrative is a candidate-controlled workspace: resume upload/paste, public job-description import, evidence-backed analysis, job triage/pipeline, cover-letter drafting, and candidate review. It should not launch the many secondary agent, extension, desktop, browser-control, external-integration, social, and automation surfaces merely because their routes exist. They need their own proofs of data isolation, truthful state, cost controls, provider policy, external-side-effect containment, and operational rollback.

## 1. Current Repository Health Score

| Dimension | Score | Evidence and interpretation |
|---|---:|---|
| Build, type safety, and frontend unit quality | **82/100** | `pnpm test -- --run`, `tsc --noEmit`, and production build passed. Full lint reports 392 warnings, so type/runtime gates are healthier than code hygiene. |
| Go API quality | **82/100** | `go test ./...` and `go vet ./...` passed. Gateway boundary, health/readiness, trusted client-IP propagation, and service separation are present. |
| Python/AI quality | **58/100** | 928 tests pass under importlib isolation, but the normal suite is not runnable and two tests fail; deterministic provider-free agent testing remains incomplete. |
| Database/security boundary | **86/100** | Migration mirror verification and RLS gate passed; anonymous probes for `api_keys`, `applications`, `saved_sources`, and `password_reset_tokens` all returned 401. |
| Deployment/release engineering | **78/100** | Static promotion gate passed 66 checks, including fail-closed env contracts and immutable-image checks. It is still static validation, not a deployed-canary/restore proof. |
| Browser/E2E quality | **63/100** | Critical targeted paths pass; complete suite fails 3 tests and records repeated 429s during broad UI audit. |
| UX/accessibility | **60/100** | Public pages render, but the mobile Escape-key close path fails a real browser test and the primary-action focus test is stale/broken. |
| Documentation and agent readiness | **68/100** | Strong `.agents/AGENTS.md`, release docs, and recent audit documents. Multiple instructions/history documents still use stale Bun commands despite pnpm-based scripts. |
| Architecture/maintainability | **62/100** | Clear React → Go → Python separation and feature flags, but 147,705 first-party source lines and multiple 800–2,300 line modules create real change-risk. |
| **Core controlled-staging readiness** | **65/100** | Credible after blocker closure; not ready to promote today. |
| **Broad public-production readiness** | **40/100** | Too many advanced/external/agentic surfaces lack the evidence needed for a unified public launch. |

> Scores summarize observed release evidence; they are not a substitute for the explicit pass/fail gates below.

## 2. What Was Revalidated Successfully

| Area | Command or journey | Fresh result | What it proves | What it does not prove |
|---|---|---|---|---|
| Release contract | `pnpm promotion:gate` | **66 passed, 0 failed** | Static production compose, secret syntax, immutable-image, health/readiness, and security-scan contracts are wired. | A real deployed canary, actual secrets, cloud/network behavior, restore, or live alerting. |
| Frontend | `pnpm lint:budget`, unit suite, `tsc --noEmit`, build, performance budget | **Passed** | Current source builds and static test/bundle gates hold. Largest generated chunk: charts at 518,350 bytes; within current budget. | No comprehensive mobile/accessibility/performance measurement for all routes. |
| Go service | `go test ./... && go vet ./...` | **Passed** | Current Go package tests and vet are green. | Production DB/network load behavior. |
| Self-hosted DB | Migration verification, `scripts/check_public_table_rls.sh`, four negative REST probes | **Passed; four probes 401** | The audited local schema has mirrors, RLS, least-privilege grants, and denial for sample sensitive tables. | Every cloud/staging/prod database has received the migration. |
| Auth and API smoke | Authenticated Playwright smoke | **14/14 passed** | Registration, login, stale-token cleanup, authenticated career-ops CRUD, communication suggestions, stats, route parity, and unauthenticated 401 behavior work locally. | External provider, high-load, or real-user privacy behavior. |
| Public routes | Public Playwright smoke | **7/7 passed** | Core public pages and legacy free-scan redirect render without server errors. | Full visual/a11y correctness and marketing copy accuracy. |
| Resume core journey | Resume Playwright E2E | **1/1 passed** | A synthetic user can register, upload the fixture PDF, add a JD, trigger analysis, and reach results. | Human review quality, actual provider quality, real-resume privacy, deletion, or adversarial content. |
| Core app path | Critical-flow Playwright test | **1/1 passed** | The currently defined critical flow works locally. | Broader feature inventory. |

## 3. Fresh Critical Failures and Their Exact Meaning

### P0 — The complete Python test suite is not a valid release gate

**Evidence.** `PYTHONPATH=. .venv/bin/pytest -q` fails during collection because both `backend/python/app/tests/test_career_ops_evaluator.py` and `backend/python/tests/test_career_ops_evaluator.py` import as `test_career_ops_evaluator`. Running `pytest --import-mode=importlib -q` avoids that collection collision but produces **928 passed, 4 skipped, 2 failed**.

The two failures, `tests/test_adaptations_routes.py::test_squad_run_endpoint` and `tests/test_phase4_adaptations.py::test_agent_squad_orchestrator`, expect `status == "completed"` while calling the real agent path with no LLM configured. The current engine correctly returns `failed` after `LLMNotConfiguredError`, rather than fabricating an application result. The failure is therefore a **test architecture mismatch introduced by correct fail-closed AI behavior**, not evidence that the engine should restore fake output.

| Item | Recommendation | Files likely affected | Acceptance criterion |
|---|---|---|---|
| **QE-001** | Give Python test modules unique import names or set `addopts = --import-mode=importlib` in `backend/python/pytest.ini`; choose one canonical test location and move/remove duplicate legacy tests. | `backend/python/pytest.ini`, `backend/python/tests/test_career_ops_evaluator.py`, `backend/python/app/tests/test_career_ops_evaluator.py` | Plain `pytest -q` collects the intended complete suite without an import mismatch. |
| **QE-002** | Rewrite squad tests to patch the optimizer/truth-gate/provider boundary and assert a deterministic successful mocked run. Add a separate test that explicitly asserts the no-provider path returns a truthful failed/unavailable result. | `backend/python/tests/test_phase4_adaptations.py`, `backend/python/tests/test_adaptations_routes.py`, potentially `app/a2a/agent_squad.py` | Full suite green; no test requires a live LLM key; provider failure never looks completed. |

**Why this blocks staging.** CI itself invokes plain `pytest` and then a coverage run over `app/tests tests` in `.github/workflows/ci.yml`. Until the same exact command is green locally and in CI, there is no defensible release signal.

### P0 — The complete browser suite is red

**Evidence.** `TAYARI_E2E_TEST_MODE=true pnpm test:e2e` produced **47 passed, 3 failed, 5 not run**. The following failures need disposition before final staging.

| Item | Observed failure | Classification | Required correction |
|---|---|---|---|
| **QE-003** | `e2e/all_features.spec.ts` expects the Live Interview Audio Copilot STAR endpoint to return 200; it returned 502 because no LLM provider is configured. | Test is non-deterministic and misaligned with a feature flag that is currently disabled. | Do not weaken fail-closed AI. Either use an explicit injected fake provider in E2E, or assert a clear 503/502 unavailable contract when no provider exists. Keep the feature disabled outside its dedicated pilot. |
| **UX-001** | On a 390 px viewport, opening mobile navigation then pressing Escape leaves `role="dialog" aria-label="Mobile navigation"` visible. | **Confirmed accessibility/interaction defect.** | Make Escape handling synchronous/reliable for the trigger/dialog, restore focus to the menu trigger, and add a browser regression test that passes. |
| **QE-004** | `supporting_code_quality.spec.ts` cannot find the accessible primary action named “Start my career rhythm.” | Stale test or changed accessible marketing copy; either way the contract is not maintained. | Choose an intentional accessible primary CTA name or a stable test ID. Update test and copy together, then test keyboard focus/reduced motion. |
| **QE-005** | Broad UI audit records repeated 429 responses on analytics/tenant-branding and a 401 dashboard request. | Potential test-isolation/rate-limit design weakness; not yet classified as a user-facing defect. | Make E2E mode use a documented authenticated/test client identity or reset rate-limit state between suites; assert intended 401/429 behavior instead of emitting noisy failures. Investigate whether public landing requests unnecessarily invoke authenticated analytics/branding APIs. |

### P1 — Current local release work is ahead of the observed remote

**Evidence.** The audited local HEAD is `df44b7f`, while `origin/main` was `9368025` at baseline inspection. The local history includes unpushed newer fixes, including AI fabrication-on-failure and recruiter-outreach corrections.

**Why it matters.** A staging environment that deploys `origin/main` is not testing the local revision that this re-audit assessed. A release candidate must be committed, pushed, tagged, and deployed from one immutable SHA.

**Required action.** After QE-001–QE-005, commit only intended changes, push, tag the release candidate, record its image digests, and rerun the entire gate from that remote SHA.

### P1 — The core product remains overly broad relative to the evidence

The source tree contains routes and feature flags for resume work, jobs, pipelines, career operations, AI agents, automation, browser control, desktop control, extension capture, Google/Gmail integrations, social/moderation, billing, voice coaching, portfolio generation, referral/outreach, knowledge graph, negotiation, company radar, and more. This is product optionality, not a unified launch scope.

The recommended initial final-staging scope remains deliberately narrow:

1. Public information/legal pages and authentication.
2. Resume upload/paste, public job-description import, and reviewable resume analysis.
3. Free ATS scan under strict cost/rate limits.
4. Job search, saved jobs, pipeline/application tracking, cover-letter drafting, and review queue.
5. Candidate-controlled AutoPilot **only after** Ring 3 evidence proves `auto_apply=false`, cancellation, rate/cost caps, and no external side effects.

Everything else should follow the activation labels in `FINAL_STAGING_TO_PRODUCTION_GO_NO_GO_2026-08-24.md`. In particular, Apply Agent, browser automation, computer/desktop control, Google/Gmail/Calendar/Drive, external messaging, real billing, workspace automation, and voice coaching remain blocked or internal-only.

## 4. Security, AI, and Operations Reconciliation

### Security verdict

The earlier confirmed PostgREST/RLS issue is **remediated in the current local validation stack**. Current results show migration mirror verification passed, the public-table RLS gate passed, and four sample sensitive/user-owned anonymous queries returned 401. The production promotion script also passed its static security contract and source security scan.

The remaining production-security decision is operational, not a source-code scanner question: every target database must have a verified backup, the migration applied under the table owner, the RLS gate run against that environment, and negative two-user/anonymous checks performed after deployment. This remains a release condition, not a completed universal fact.

The current Node production dependency audit still reports one low-severity advisory: `esbuild 0.27.7`, brought through `@lovable.dev/mcp-js`, is vulnerable on Windows development-server configurations through `<0.28.1`. This is not a staging P0 for the current macOS/Linux container launch surface, but should be upgraded before a broad developer distribution. The local Python virtual environment does not include the CI-only `pip-audit` executable, so its dependency audit was not rerun locally; CI declares it as a blocking step and must be observed green on the release SHA.

### AI/agent verdict

The current code has improved in a meaningful direction: no-provider paths now fail visibly rather than emitting plausible mock content. That is the correct production behavior. The tests that expect a completed squad run with no configured LLM are now misleading and must be fixed by mocking at the provider/tool boundary, not by restoring a silent fallback.

The AI system is **not ready for broad autonomous operation**. It needs deterministic evaluation fixtures, explicit provider/model/version recording, cost and latency budgets per workflow, prompt-injection and unsupported-claim regression tests, and a per-feature assertion that downstream UI cannot call a failed run successful. Current task/agent/browser/automation paths should be treated as candidate-controlled preparation only, with no external submission.

### Operations and deployment verdict

The new promotion gate is valuable and passed. It verifies fail-closed env syntax, image digest rules, health/readiness endpoints, capability defaults, reverse proxy expectations, and source security scanning. However, it cannot prove the deployed cloud environment has the right values, that image references exist in the registry, that alerts fire, that a provider outage is observed, or that restoration works. The final staging campaign must therefore add real deployment evidence: canary deployment, synthetic user checks, RLS negative probes, provider outage test, alert receipt, 24-hour soak, and backup restore rehearsal.

## 5. Product and UX Reconciliation

The strongest product is not “an autonomous job applicant.” It is a **reviewable career workspace** that turns candidate-owned evidence into tailored, candidate-approved materials. That is coherent with the architecture, candidate-control rules, current feature gating, and the resume/JD core path that actually passed fresh browser validation.

The current architecture nevertheless creates discoverability and trust problems: dozens of routes and feature-flagged concepts compete for attention, while several richer labels can overpromise. The product must make the core loop obvious: **bring resume → select/paste/import public job → review evidence and gaps → tailor materials → track next step → decide manually.** Advanced intelligence should appear only when it improves the next action and can explain its source.

The mobile Escape failure matters beyond one test: it shows that visual polish does not guarantee keyboard behavior. Before external final staging, add automated axe checks to the public pages and core authenticated resume/job/pipeline flow, then manually test keyboard, focus order, mobile viewport, reduced motion, form errors, loading, and empty/error states.

## 6. Architecture and Agent-Readiness Reconciliation

The intended service boundary is sound: React/TypeScript client → Go gateway for identity/CRUD/proxying → Python for AI, scraping, and workers → Postgres/Supabase/Redis/Celery. `.agents/AGENTS.md` gives useful constraints, including no direct browser-to-Python calls, candidate-control boundaries, RLS requirements, and staging/deployment rules.

The maintainability risk is the size and concentration of the implementation. The repository contains approximately 147,705 first-party source lines. The largest modules include `backend/go/internal/api/routes_mvp.go` (2,349 lines), `backend/python/app/main.py` (2,343), `src/pages/InterviewBoard.tsx` (1,538), `backend/python/app/services/omnisave_service.py` (1,233), `backend/go/internal/billing/billing.go` (1,108), and several 800–900-line pages/services. This raises review, test, merge-conflict, and agent-change risk.

The next refactoring priority is not a new framework. It is targeted seam creation: split route registrations/handlers by bounded domain, isolate feature API clients, centralize run-state contracts, remove duplicate Python tests, and make every external/agent capability expose one typed lifecycle contract: requested, queued, running, awaiting review, completed, failed, cancelled. Preserve the existing service separation rather than adding another orchestration tier.

Agent readiness is good enough for bounded tasks but not frictionless. The top-level agent guide still references `bun run security:production`, while the actual package-manager scripts use `pnpm`; historical `docs/superpowers` materials contain many stale Bun test/build claims. Update a single canonical `docs/development/verification.md` and have AGENTS/README point to it. The exact normal Python suite command must be green and documented before an autonomous coding agent is asked to judge a change safe.

## 7. Feature Completeness Matrix — Current Launch View

| Feature family | Current classification | Fresh evidence | Final staging action |
|---|---|---|---|
| Auth/account/profile/public legal pages | **Functional but weakly broad-tested** | Auth smoke 14/14; public routes 7/7 | Include Rings 1–2 after password/reset, deletion, mobile/a11y and rate-limit checks. |
| Resume upload, JD import, analysis/results | **Functional core** | Resume browser E2E 1/1 passed | Include candidate pilot after real-resume consent/privacy/deletion/no-fabrication test. |
| Free ATS scan | **Functional but cost/abuse-sensitive** | Route renders; rate-limit path previously hardened | Include only with configured provider, client-fairness canary, cost cap, privacy disclosure. |
| Job search/pipeline/application/review | **Functional core** | Authenticated smoke CRUD/parity checks pass | Include with two-user isolation, accurate status terminology, review queue side-effect proof. |
| Cover letter/communications/outreach/referrals | **Partially implemented / draft-only** | Route/API presence and communication suggestions pass | Keep draft-only; prove no external send and source-grounded content. |
| Career ops/knowledge/analytics/roadmaps | **Functional but weakly validated** | Career-ops CRUD/stats pass; very large UI modules | Staging pilot after provenance/freshness and own-data isolation checks. |
| AutoPilot/task workspace/one-shot | **Experimental agentic preparation** | UI/routes exist; AutoPilot uses `auto_apply=false` in earlier audit | Trusted-user only after cancellation, budget, audit and no-external-action proof. |
| Apply Agent | **Blocked / intentionally gated** | Schema mismatch previously confirmed; flag production false | Keep disabled until one durable typed data contract and E2E lifecycle tests exist. |
| Browser/desktop/computer control | **Experimental/high risk** | Feature flags production false; browser/desktop stack exists | No external candidate staging; separate threat model and isolated runtime needed. |
| Browser extension/Omnisave/LinkedIn import | **Experimental/external-policy-sensitive** | Manifest has broad host/native permissions; capture routes exist | Staff-only after permission minimization, platform policy, auth binding, privacy/delete review. |
| Google/Gmail/Calendar/Drive and messaging | **Disabled/high side effect** | Feature flags disabled, routes exist | Do not stage externally; OAuth/minimal-scope/consent/audit/revocation testing required. |
| Interview AI/voice coach | **Disabled and non-deterministic** | Full E2E voice endpoint returned 502 with no LLM | Keep disabled; deterministic mocked E2E and audio privacy/eval work required. |
| Billing/pricing | **Partial** | Pricing route/tests exist; billing service present | Pricing information can stage; no real payment activation without separate finance/webhook/reconciliation launch. |
| Social/moderation/admin/advisor surfaces | **Internal/evaluation** | Routes/modules exist | Do not expose without RBAC, moderation, retention, audit and user-visibility design. |

## 8. Ruthless Backlog From This Re-Run

| ID | Priority | Exact change | Likely files | Acceptance criterion | Validation |
|---|---|---|---|---|---|
| **QE-001** | **P0** | Eliminate Python duplicate-test import collision and make normal collection deterministic. | `backend/python/pytest.ini`; duplicate `test_career_ops_evaluator.py` files | `pytest -q` runs full intended suite without import mismatch. | Same CI command, locally and in GitHub Actions. |
| **QE-002** | **P0** | Mock agent-squad provider boundaries in success tests; add explicit no-provider fail-closed contract tests. | `backend/python/tests/test_phase4_adaptations.py`, `test_adaptations_routes.py`, potentially A2A test helpers | No live key required; all tests green; no fake output on provider outage. | `pytest -q` and coverage command. |
| **QE-003** | **P0** | Make full E2E deterministic for disabled/no-provider voice AI; either inject approved fake provider or test clear unavailable state. | `e2e/all_features.spec.ts`, test config/route contract | Full E2E no longer expects live AI 200 without provider; disabled feature remains gated. | `TAYARI_E2E_TEST_MODE=true pnpm test:e2e`. |
| **UX-001** | **P0** | Fix mobile navigation Escape close and focus restoration. | `src/components/layout/Header.tsx`, `e2e/supporting_code_quality.spec.ts` | Escape closes dialog from trigger/menu, `aria-expanded=false`, focus returns to trigger. | Mobile Playwright plus keyboard manual test. |
| **QE-004** | **P0** | Reconcile primary CTA accessible name/test and prevent fragile marketing-string regressions. | Landing/Index component; `e2e/supporting_code_quality.spec.ts` | Keyboard focus test passes with intentional accessible label or stable test hook. | Full E2E. |
| **QE-005** | **P1** | Remove rate-limit noise/429s from broad E2E through explicit test-client policy and investigate unauthenticated landing analytics calls. | Go rate-limit middleware, test fixtures, analytics/branding clients, E2E headers | No unexpected 429 during standard suite; public requests avoid unnecessary protected calls. | Full E2E and rate-limit regression tests. |
| **SEC-001** | **P1** | Upgrade/replace transitive `esbuild` vulnerable range from `@lovable.dev/mcp-js`. | Lockfile/package dependency chain | Production audit has zero known advisories, or documented risk acceptance expires. | `pnpm audit --prod --json`. |
| **OPS-001** | **P1** | Run production-like deployed canary, not only static promotion script; attach signed evidence. | `deploy/aws/*`, staging config, runbooks | Health, RLS, provider outage, alert, backup restore, rollback, 24-hour soak pass. | Staging evidence ledger. |
| **DX-001** | **P1** | Establish one canonical verification document and correct stale Bun/pnpm instructions. | `.agents/AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `docs/development/verification.md` | A new engineer/agent can run exact green commands without reconciling historical docs. | Clean-machine/document walkthrough. |
| **ARC-001** | **P2** | Split oversized route/page/service modules along feature boundaries, beginning with MVP routes, Python app entry, Interview Board, and Resume Results. | Files named in Section 6 | Each extracted module has typed interfaces and focused tests; no behavioral regression. | Existing suite plus feature-specific contracts. |
| **UX-002** | **P2** | Add axe-based browser checks and required mobile/error/empty/loading state coverage to core flow. | E2E/tests, core pages | Accessibility regressions block CI; core state matrix is exercised. | E2E accessibility job. |
| **AI-001** | **P2** | Build an evaluation harness for resume analysis, cover letters, squad runs, and provider outages. | `backend/python/app/evaluations/`, fixtures, CI | Versioned adversarial fixtures, schema/truthfulness/latency/cost thresholds. | Offline evaluation gate. |
| **PROD-001** | **P2** | Make feature-flag exposure auditable by ring/capability, not a single broad boolean. | `src/config/features.ts`, gateway capability config, docs | Every advanced route has UI, route, API, worker, and kill-switch status recorded. | Feature-matrix contract test. |

## 9. Reconciled Staging-to-Production Path

### Phase A — Restore green engineering truth

Complete QE-001 through QE-004 before inviting another final-staging cohort. Do not hide the Python/E2E failures by reducing discovery, skipping tests, or using a live LLM key in CI. Commit and push the corrected release candidate. The exact normal Python suite, coverage suite, complete E2E suite, promotion gate, RLS gate, Go suite, frontend suite, build, and security scan must all pass from the same remote SHA.

### Phase B — Prove the narrow candidate workspace

Use an isolated staging environment with five informed participants. Test consent, resume upload/paste, public job-link import, evidence/gap review, free scan, job save/pipeline, cover-letter draft review, owner isolation, deletion, provider failure, and no PII in browser console/logging/telemetry. Do not enable external communications, browser automation, or payments.

### Phase C — Prove bounded preparation automation

Only after Phase B passes, allow one AutoPilot preparation run per participant with `auto_apply=false`, a five-job cap, no external actions, visible cancellation, durable audit, and internal-only review-queue approval. Run a 24-hour soak with queue, rate-limit, provider, error, and cost alerts.

### Phase D — Final production decision

Promote only the bounded core scope after a deployed canary, RLS verification, backup restore, provider outage, alert delivery, rollback rehearsal, two-user isolation, and release evidence ledger all pass. Keep all advanced features out of public navigation and direct routes until their own separately approved staging rings complete.

## 10. Final Answer to “Are We Ready?”

**The repository is no longer a speculative demo. It now has a functioning and testable core, meaningful security hardening, static deployment controls, and a credible path to controlled staging.**

**It is not ready today for a final-staging promotion or broad production launch.** The reason is narrow and fixable: the full release gates are not green, the current local release work is not yet demonstrably the remote release candidate, and advanced feature scope remains far ahead of evidence.

When QE-001 through QE-005 are complete and the same immutable remote SHA passes the full engineering gate plus the staged real-user evidence plan, Tayari can sincerely enter final staging for the narrow candidate-controlled core. Broad production follows only after that cohort, soak, restore, and operational evidence—not after another round of code generation.
