# Tayari — Ruthless User-Serving Productionization Program

**Purpose:** Turn the current repository into a demonstrably safe, useful, operable, and supportable product for real users.  
**Starting point:** Fresh local re-audit at `df44b7f`; the remote observed at re-audit start was `origin/main` `9368025`.  
**Current decision:** **Do not invite a final staging cohort or promote to production yet.** Fix the red gates, prove the narrow core with real users in a controlled staging environment, then decide from evidence rather than confidence.

This is intentionally not a feature wish list. It is an operating program. A task is not complete when code compiles; it is complete only when its acceptance tests, staging evidence, and rollback condition are recorded.

> **Launch doctrine:** A product is ready to serve users only when it is truthful about what it did, protects their data, fails safely, can be observed by an operator, can be rolled back, and remains useful when an external dependency is degraded.

---

## 1. The Product We Are Actually Launching

### 1.1 Approved initial user promise

Tayari’s first credible public promise is a **candidate-controlled career workspace**. A candidate can bring their resume, add a public job description, receive reviewable analysis and drafts, track jobs and applications, and decide what to do next. The candidate remains responsible for all submissions and all external communications.

Do **not** position the first launch as autonomous job application. The codebase contains advanced agent, browser, extension, desktop, automation, Google/Gmail, social, voice, and billing surfaces, but their existence does not prove they are reliable or safe enough for user-facing operation. Those surfaces require separate capability-specific proofs.

### 1.2 Approved production scope after all gates pass

| Scope | User value | Required current state | Public-launch decision |
|---|---|---|---|
| Public landing, methodology, privacy, terms, about | Understand the product and constraints | Public routes render and legal copy is current | **Enable** |
| Authentication and account/profile | Create and use a personal workspace | Password, session expiry, deletion, rate limiting, and support flows verified | **Enable** |
| Resume upload/paste and public JD import | Start a career workflow from candidate-owned inputs | File validation, PII hygiene, deletion, and failure states verified | **Enable** |
| Resume analysis, ATS scan, and results | Receive reviewable match/gap guidance | Provider availability, grounded result structure, cost limit, uncertainty UI | **Enable with limits** |
| Job search, saved jobs, pipeline, application tracking | Organize the job search | Owner isolation, honest status labels, CRUD/refresh/error paths | **Enable** |
| Cover-letter and communication drafting | Prepare materials for manual review | Draft-only, source-grounded, no automatic send | **Enable with review language** |
| Candidate review queue and bounded AutoPilot preparation | Reduce repetitive organization work | `auto_apply=false`, cost/job cap, cancellation, audit, no side effects | **Pilot only** |
| Apply Agent | Automate application execution | One typed persistence contract, manual-submission boundary, E2E lifecycle | **Keep disabled** |
| Browser, desktop, or computer control | Interact with external sites | Dedicated threat model, isolated runtime, cancellation, consent, policy review | **Keep disabled** |
| Gmail, Google Drive, Calendar, WhatsApp, external messaging | Connect external accounts/send communications | OAuth scope/revocation, explicit approval, audit, delivery/undo semantics | **Keep disabled** |
| Voice coach and live interview AI | Real-time coaching | Audio privacy, deterministic test provider, latency/SLO, consent | **Keep disabled** |
| Payments/billing | Charge users | Separate payment-webhook/reconciliation/refund/support readiness plan | **Pricing information only** |
| Extension, social, moderation, advisor/admin | Capture, publish, moderate, or advise | RBAC, retention, policy, audit and user-visibility controls | **Internal only** |

### 1.3 Explicit non-promises

Until a separate release proves otherwise, the product must not claim that it has applied to a job, sent a message, contacted a recruiter, booked an interview, verified an employer, verified a salary range, verified a company, or completed a browser action. A generated artifact is a draft. A user-declared action is candidate-confirmed. An external action requires durable, source-specific evidence.

---

## 2. Current Evidence: What Is Strong and What Is Not

### 2.1 Verified strengths at the current local revision

| Verification | Fresh result | Why it matters |
|---|---|---|
| `pnpm promotion:gate` | **66 passed, 0 failed** | Static production compose, fail-closed secret syntax, immutable-image rules, health/readiness contracts, and security-scan requirements are present. |
| Frontend test/type/build/budget | **Passed** | Current frontend has a buildable, typechecked, unit-tested production bundle within the existing budget. |
| Go `go test ./...` and `go vet ./...` | **Passed** | The current Go API packages pass their local automated checks. |
| RLS/migration validation | **Passed** | Self-hosted migration mirror verification and the public-table RLS gate passed. |
| Sensitive anonymous REST probes | **401** for `api_keys`, `applications`, `saved_sources`, and `password_reset_tokens` | The previously observed anonymous-access exposure is closed in the local validation stack. |
| Authenticated browser smoke | **14/14 passed** | Auth, stale-token handling, authenticated career-ops CRUD, stats, and unauthenticated access behavior are working locally. |
| Public route smoke | **7/7 passed** | Public information pages and the free-scan redirect render without server errors. |
| Resume-to-results journey | **1/1 passed** | Synthetic registration, PDF upload, JD entry, analysis trigger, and results navigation work end to end. |

### 2.2 Evidence that currently blocks final staging

| Red gate | Current outcome | Why it is a stop-ship condition |
|---|---|---|
| Normal Python suite | Fails collection because two different files import as `test_career_ops_evaluator` | CI invokes normal `pytest`; a release suite that does not collect cannot defend a safe change. |
| Python suite with importlib isolation | 928 passed, 4 skipped, **2 failed** | Agent-squad tests expect completed LLM output with no provider configured; test behavior is not deterministic or aligned with fail-closed AI. |
| Full Playwright suite | 47 passed, **3 failed**, 5 did not run | Final browser regression gate is red. One failure exposes a real keyboard interaction defect. |
| Mobile navigation | Escape did not close the mobile `dialog` in a browser test | Keyboard users cannot reliably dismiss navigation; this is an accessibility defect. |
| Release SHA parity | Local re-audit HEAD was ahead of observed remote | A staging deployment must be built from the exact immutable SHA that passed evidence gates. |

### 2.3 Correct interpretation

The platform is **not a non-working prototype**. The core works locally and important security/release controls have been added. It is **not yet a launch candidate** because its complete release signal remains red and the broad feature surface exceeds the proven operational scope.

---

## 3. The Non-Negotiable Rules for Every Fix

Every task in this program must comply with these rules.

1. **No fabricated success.** If an AI provider, database, browser worker, external API, or queue is unavailable, the UI/API must say unavailable, failed, queued, cancelled, or awaiting review. It must never return plausible substitute content as if it succeeded.
2. **No direct external side effect without explicit candidate approval.** No autofill that crosses sensitive fields; no account creation; no password, MFA, CAPTCHA, legal declaration, EEO, work authorization, compensation, or application submission.
3. **No sensitive data in console logs, analytics payloads, error trackers, test artifacts, screenshots, or support exports.** Resume text, job-description text, email, contact details, tokens, and job applications require redaction.
4. **Every user-owned record requires server-enforced identity and owner-scoped data access.** Client filters are never authorization.
5. **Every release is one immutable SHA and image-digest set.** A local “works on my machine” result is not release evidence.
6. **Every launch-critical failure needs a user-safe fallback and an operator runbook.** Users must know what happened and what to do; operators must know how to diagnose, stop, and recover.
7. **Do not broaden the launch scope to justify unfinished features.** Disable, hide, and server-gate features not in the approved ring.

---

## 4. Release-Critical Work Breakdown

The work is ordered. Do not start a later phase until the stated exit criteria for the earlier phase are true.

### Phase 0 — Restore Green Engineering Truth

This phase fixes the release system before it fixes more product. It is the immediate work.

| ID | Owner | Objective | Root cause / current evidence | Exact implementation sequence | Files likely involved | Done means | Required validation | Rollback / failure handling |
|---|---|---|---|---|---|---|---|---|
| **QE-001** | Backend + QA | Make normal Python test collection deterministic. | `pytest -q` stops because `app/tests/test_career_ops_evaluator.py` and `tests/test_career_ops_evaluator.py` collide. | 1. Decide canonical test home by responsibility: service tests under `app/tests`; API/integration tests under `tests`. 2. Rename or merge one evaluator file so module names are globally unique. 3. Add `--import-mode=importlib` only if package import behavior is reviewed; do not use it to hide duplicate ownership. 4. Remove stale imports/fixtures. | `backend/python/pytest.ini`; both evaluator test files; test package `__init__.py` only if necessary. | Plain `pytest -q` collects the intended suite without import errors. | `cd backend/python && PYTHONPATH=. .venv/bin/pytest -q`; CI Python job. | Revert rename/fixture move if unrelated imports fail, then resolve package structure rather than excluding tests. |
| **QE-002** | AI/backend + QA | Make agent-squad tests deterministic and faithful to fail-closed behavior. | Importlib run yields 2 failures because squad tests call real LLM path without provider but expect `completed`. | 1. Identify the narrow provider/tool boundary used by `AgentSquadOrchestrator`. 2. Inject fake optimizer/truth-gate responses in the success tests. 3. Add explicit test for `LLMNotConfiguredError` that expects a truthful `failed`/`unavailable` run. 4. Assert no final artifact is marked ready when a subagent fails. 5. Test retry/cancellation if implemented. | `backend/python/tests/test_phase4_adaptations.py`; `test_adaptations_routes.py`; A2A/service test helpers; possibly `app/a2a/agent_squad.py`. | Success tests use fakes, no test needs a live key, and provider-unavailable behavior is explicit. | Full Python suite; coverage command; grep/assert no unmocked live provider in tests. | Preserve fail-closed production code. Never restore static “completed” fallback data to make tests green. |
| **QE-003** | Frontend + AI/backend + QA | Make full browser testing deterministic when AI capabilities are disabled or unavailable. | Live Interview Audio Copilot E2E expects 200 but receives 502 without LLM. Feature is currently production-disabled. | 1. Choose the contract: disabled route returns a clear 404/403/feature-unavailable UI, or E2E injects an approved fake provider. 2. Do not assert a live provider in generic browser CI. 3. Add one contract test for disabled state and one mocked-provider test for the happy path. 4. Assert UI uses user-safe “unavailable” language. | `e2e/all_features.spec.ts`; voice/interview route; feature config; test-mode configuration. | Full E2E has no live-provider dependency; disabled capability cannot masquerade as working. | `TAYARI_E2E_TEST_MODE=true pnpm test:e2e`; focused API/route tests. | Keep feature server-gated and hidden if test-mode seam is not ready. |
| **UX-001** | Frontend + QA | Fix mobile navigation keyboard dismissal and focus restoration. | At 390 px viewport, Escape leaves `role="dialog" aria-label="Mobile navigation"` visible. | 1. Reproduce with focused trigger and with focus inside menu. 2. Make Escape handler deterministic at the component boundary. 3. Close menu, set `aria-expanded=false`, return focus to trigger, and prevent background focus leak. 4. Test click, Escape, route change, resize, and focus order. | `src/components/layout/Header.tsx`; `e2e/supporting_code_quality.spec.ts`; optionally a component test. | Escape always closes, focus returns, and dialog no longer appears in tab order. | Mobile Playwright test; keyboard manual check on Safari/Chrome; axe scan. | Revert visual-only menu changes if focus handling regresses; preserve a button fallback that always closes. |
| **QE-004** | Product frontend + QA | Make the primary CTA accessibility contract intentional and durable. | Test searches for “Start my career rhythm” but current DOM does not expose it. | 1. Decide final CTA copy and user intent. 2. Ensure the visible label and accessible name match. 3. Use role/name for user semantics; only add a test ID if copy is deliberately variable. 4. Update reduced-motion/focus test to check the actual primary action. | Landing/Index component; `e2e/supporting_code_quality.spec.ts`; copy source. | Keyboard focus and reduced-motion test pass without brittle, accidental copy coupling. | Full E2E; manual screen-reader announcement check. | Revert copy if it breaks activation analytics; do not weaken accessible name for test convenience. |
| **QE-005** | Go/backend + frontend + QA | Eliminate unintended 429/401 noise in broad browser testing and verify public request design. | Full E2E recorded repeated 429s for analytics/tenant branding and a 401 dashboard request. | 1. Instrument which screen triggers each request. 2. Decide whether it should be public, authenticated, lazy, cached, or not requested on landing. 3. Scope test traffic with a documented test identity/isolated rate-limit bucket only in `TAYARI_E2E_TEST_MODE`. 4. Add rate-limit reset/fixture lifecycle. 5. Keep production abuse limits unchanged. | Go rate-limit middleware; analytics/tenant clients; E2E config/fixtures; relevant React query hooks. | Standard full E2E has no unexpected 429/401; expected denial is asserted where appropriate. | Full E2E; focused rate-limit tests; browser network assertion. | Remove only test-mode bypass, never broadly weaken production rate limits. |
| **REL-001** | Release owner | Establish an immutable release candidate. | Local re-audit assessed `df44b7f`; observed remote started at `9368025`. | 1. Finish QE tasks. 2. Review clean `git status`, diff, staged files, tests. 3. Commit one coherent release candidate. 4. Push and tag. 5. Build images from tag/SHA, capture digests. 6. Deploy staging from those exact digests. | Git history; CI; `scripts/build-images.sh`; deployment manifests. | `git rev-parse HEAD`, tag, CI run, image attestations, and staging `/version`/metadata all match. | Promotion gate and CI on remote SHA; deployment attestation checklist. | Redeploy previous immutable digest; never hot-patch an untracked host. |

### Phase 0 Exit Gate

All requirements must be true simultaneously:

- [ ] Plain Python collection and full suite are green.
- [ ] Python coverage command is green and meets the enforced floor.
- [ ] Frontend test, typecheck, build, lint budget, and bundle budget are green.
- [ ] Go test/vet are green.
- [ ] Full Playwright suite is green with no skipped critical tests and no unexpected 429/401/5xx requests.
- [ ] Promotion gate and RLS/migration gate are green.
- [ ] The exact SHA is committed, pushed, tagged, and used by CI.

If any box is incomplete, the decision is **NO-GO**.

---

## 5. User-Safety and Data-Handling Work Before Real Resumes

The initial staging cohort will give the product real personal data. This changes the standard of proof. Synthetic tests prove mechanics; they do not prove that users understand the workflow, that data is retained correctly, or that failures remain safe.

### 5.1 P0 privacy and data tasks

| ID | Objective | Required implementation | Evidence required before inviting a real participant | Owner |
|---|---|---|---|---|
| **DATA-001** | Prove resume/JD text is not exposed through client diagnostics. | Remove any raw text console logging; add redaction helper for errors/telemetry; add tests that scan captured browser console, server logs, request logs, Playwright traces, screenshots, and error reports. | A synthetic canary resume containing sentinel strings does not appear in any retained artifact except intended encrypted storage. | Frontend + backend + SRE |
| **DATA-002** | Define the user data lifecycle. | Document what is stored for resume source, extracted text, job descriptions, analysis, drafts, user profile, files, logs, backups, and audit records; assign retention durations; implement account-specific deletion/erasure flow. | Deletion test proves user can request deletion and expected records/files become inaccessible; backup exception/retention is disclosed. | Product + backend + legal/privacy reviewer |
| **DATA-003** | Enforce account isolation with executable evidence. | Build two-user test fixtures; exercise read/list/update/delete on every approved table/API route; test direct PostgREST denial and Go gateway denial. | No account can observe/mutate another’s records; all deny responses are correctly 401/403/404 without leakage. | Backend + QA |
| **DATA-004** | Make generated insights honest. | Persist source/provenance metadata where available; distinguish sourced facts, extracted text, model inference, unknown, and unavailable; remove misleading confidence labels. | Provider outage, malformed output, missing source, and contradictory source cases render safe UI states. | AI/backend + frontend |
| **DATA-005** | Create participant consent and incident protocol. | Write short informed-consent copy for staging; state data types, purpose, limitations, reporting path, deletion path, and no-autonomous-submission rule. | Participant signs/accepts before data entry; operator can identify who to contact and how to stop a run. | Product owner + operations |

### 5.2 Required user-facing failure states

For every approved core workflow, implement and test these states. The status must not be a generic toast that disappears before the user can act.

| Workflow | Required states | User action offered |
|---|---|---|
| Resume file upload | invalid type, oversized file, corrupt PDF/DOCX, parse failure, upload timeout, duplicate upload | Replace file, paste text instead, retry, download support-safe diagnostic ID |
| Job-link import | invalid URL, private/login wall, blocked host, redirect, unsupported board, slow fetch, extraction failure | Paste JD, retry, save link without import, explain that no employer interaction occurred |
| AI analysis | queued, in progress, provider unavailable, timed out, malformed output, cost/rate limit, cancelled | Retry later, edit inputs, use non-AI tools, see safe explanation; never show fake score |
| Job/pipeline save | offline, conflict, permission denied, duplicate record, stale update | Retry, refresh, resolve conflict, support link with operation ID |
| Cover-letter draft | no resume/JD basis, provider outage, unsafe claim detected | Edit evidence, generate later, mark as draft-only |
| Account/session | expiry, unauthorized, deletion requested, rate limited | Sign in again, wait/retry time, contact support; no silent disappearance of work |

### 5.3 Real-data redaction test

Use a **synthetic sentinel resume** that includes unique values such as `TAYARI_PRIVATE_SENTINEL_8A73`, a fake email, and fake phone. Do not use a real resume to test leakage.

1. Upload/paste it through the complete approved path.
2. Trigger analysis and an intentional provider failure.
3. Inspect browser console, browser network capture, Go logs, Python logs, structured telemetry payloads, error tracker events, Playwright traces, screenshots, and support/export locations.
4. Search for the sentinel value.
5. Any uncontrolled occurrence is a **P0**. Fix redaction, purge local artifacts, repeat from a clean environment.

---

## 6. AI and Agent Readiness: What Must Be Proved Before Users Trust It

### 6.1 Required AI contract

Every AI-backed endpoint must return a typed lifecycle result, not an ambiguous text blob.

| Field | Requirement |
|---|---|
| `status` | One of `completed`, `queued`, `running`, `awaiting_review`, `unavailable`, `failed`, `cancelled` |
| `run_id` | Durable, opaque identifier for support/audit correlation |
| `input_version` | Version/hash of resume/JD/input snapshot, never raw PII in client logs |
| `model/provider` | Internal metadata, recorded for audit; show user-safe version only if useful |
| `provenance` | What came from candidate input, job text, explicit source, inference, or is unavailable |
| `warnings` | Missing information, unsupported assumption, low confidence, safety restriction |
| `cost/limit state` | Server-enforced quota/limit result without exposing provider key/cost details |
| `cancelled_at` | Set when user/operator cancellation terminates real background work |

### 6.2 AI task cards

| ID | Priority | Objective | Implementation | Acceptance criteria | Tests |
|---|---|---|---|---|---|
| **AI-001** | P1 | Create offline, versioned evaluation fixtures. | Store synthetic resume/JD fixtures plus expected schema, grounded claims, banned fabrications, and safe failures. | Every approved AI workflow has a minimum happy, missing-data, adversarial prompt-injection, malformed-provider, timeout, and no-provider fixture. | Offline pytest evaluation job; no live LLM calls. |
| **AI-002** | P1 | Enforce output schemas at every UI boundary. | Validate provider output server-side; reject/repair only structural errors; surface unavailable/failed instead of guessing content. | UI cannot render incomplete or invented scores/claims as a successful result. | Service and API contract tests. |
| **AI-003** | P1 | Add latency/cost/queue budgets. | Establish per-workflow timeout, retries, concurrency, queue depth threshold, and user-visible wait limit. | Over-budget run is cancelled/queued safely and alertable; no request waits indefinitely. | Load/light concurrency tests; timeout/cancellation tests. |
| **AI-004** | P2 | Add evidence-first quality controls. | Require citation/provenance for company/job factual claims; label model recommendations as suggestions. | No “verified,” salary, employer, or applied claim appears without qualifying evidence. | Truthfulness snapshot tests and manual review. |
| **AI-005** | P2 | Version prompts and model routing. | Put prompts/templates and model config behind version IDs; record version on run. | A production regression can be traced and rolled back to previous prompt/model configuration. | Unit tests and a prompt-version migration/rollback check. |

### 6.3 AI user readiness bar

A user should be able to answer, from the interface: **What did Tayari use? What is uncertain? What failed? What can I do now?** If not, do not expose the output as a decision-grade recommendation.

---

## 7. Operations: Make It Possible to Serve and Support Users

A release gate is not an operations program. Before staging with real users, create the minimum operating system below.

### 7.1 Service objectives and alerts

Set initial, intentionally conservative objectives for the approved core only. These are starting targets; replace with observed baselines after the first controlled cohort.

| Signal | Initial threshold | Alert response | Launch effect |
|---|---|---|---|
| Go `/readyz` and Python `/readyz` | No more than 1 minute unavailable in 15 minutes | Pause AI requests; investigate dependency/DB/provider | Stop new cohort invites if breached twice in 24 hours |
| Core API 5xx rate | Less than 1% over 15 minutes | Page operator; capture redacted correlation IDs | Roll back if sustained 30 minutes |
| Resume/JD core completion | At least 95% of started synthetic canary journeys complete excluding user cancellations | Identify stage: upload, parse, provider, persistence, UI | No progression to next cohort if below threshold |
| AI provider unavailable/error | Less than 5% of eligible runs over 1 hour | Show safe unavailable state; provider failover only if approved | Disable AI feature if error budget exhausted |
| Queue age | Less than 2 minutes for interactive runs | Scale/stop intake; inspect worker failure | Pause AutoPilot/preparation workflows |
| Unexpected 429/401 on approved user path | Zero in canary synthetic suite | Inspect auth/rate-limit config | Release blocker |
| Cross-user authorization denial test | 100% pass | Immediate incident if any read/write succeeds | Immediate stop-ship |
| PII sentinel telemetry leakage | Zero | Purge, rotate, incident review | Immediate stop-ship |

### 7.2 Required dashboards and logs

Do not log raw resumes or job text. Create structured, redacted logs with `request_id`, `run_id`, authenticated account hash/opaque ID, route, feature capability, status code, latency, queue time, provider outcome, error category, cancellation state, and deployment SHA/image digest.

Build at least these views:

1. **User journey funnel:** start → upload/paste → JD accepted → analysis requested → result available → saved next action.
2. **Service health:** Go/Python/worker/DB/Redis readiness and error rate.
3. **AI health:** provider outcome, schema failures, latency buckets, queue depth, no-provider/timeout rate, per-capability volume.
4. **Safety:** rate limits, auth failures, authorization denials, feature-gate denials, cancellation events, external side-effect attempts.
5. **Release:** deployment SHA, image digest, migration version, feature flag/capability state, current cohort size.

### 7.3 Minimum incident runbooks

Write each as a one-page, tested procedure. The operator must be able to execute them without reading source code.

| Runbook ID | Trigger | First five actions | Recovery condition |
|---|---|---|---|
| **OPS-001** | DB/RLS anomaly or cross-user access report | Disable affected capability; preserve redacted evidence; stop writes if needed; verify grants/RLS; rotate compromised credentials | Negative anonymous/two-user tests pass on corrected database; incident review signed off |
| **OPS-002** | AI provider outage/malformed response spike | Disable AI capability flag; keep saved inputs; show unavailable UI; inspect provider status; verify no fake output | Health returns and synthetic evaluation/canary succeeds |
| **OPS-003** | Queue backlog/cancellation failure | Stop new work; invoke real server-side cancellation; inspect worker/Redis; drain only safe jobs | Queue age healthy and cancellation test passes |
| **OPS-004** | PII/logging leak | Stop affected telemetry/export; preserve minimal evidence; purge accessible artifacts; rotate secrets if needed; notify affected users per policy | Sentinel test clean; remediation reviewed |
| **OPS-005** | Bad deployment | Stop traffic/promote previous digest; run migration compatibility check; verify health/RLS; communicate status | Previous release runs synthetic canary successfully |
| **OPS-006** | User deletion request | Verify identity; issue deletion workflow; delete user-owned active data; record backup-retention exception; notify completion | Automated verification shows records inaccessible and lifecycle audit entry exists |

### 7.4 Backup and recovery is a real gate

Before final staging and before production, perform a restore drill:

1. Take an encrypted database backup and record its checksum and timestamp.
2. Restore into a disposable, isolated environment.
3. Run migrations required for the target release.
4. Run health checks, RLS gate, anonymous negative probes, and a synthetic account journey.
5. Measure recovery time and data freshness.
6. Destroy the disposable environment and document the result.

No screenshot of a successful backup command is sufficient. A backup that has not been restored is an untested assumption.

---

## 8. Controlled Real-User Staging Campaign

### 8.1 Cohort design

| Ring | Participants | Permitted scope | Required evidence to enter | Exit decision |
|---|---:|---|---|---|
| **Ring 0: Synthetic** | 0 real users | Full test suite and synthetic canary only | Phase 0 green from remote release SHA | Enter only if all gates pass |
| **Ring 1: Internal** | 2–3 trained operators | Approved core using synthetic sentinel data and their own non-sensitive test content | Redaction test, two-user isolation, runbooks, backup restore | 48 hours without unhandled P0/P1 incident |
| **Ring 2: Informed candidate pilot** | 5 real participants | Resume/JD/pipeline/draft-only core; no external side effects | Consent, support channel, operator coverage, feature gates locked | 7-day evidence review |
| **Ring 3: Controlled preparation automation** | Same 5, opt-in | Bounded AutoPilot preparation; `auto_apply=false`; internal review only | Cancellation, job/cost cap, audit, no-side-effect proof | 7-day soak, no safety breach |
| **Ring 4: Limited public core** | 25–50 invited users | Same approved candidate-controlled core | All prior exit criteria plus production operational evidence | Production readiness review |

Never grow the cohort to “see what happens.” Growth is earned by evidence.

### 8.2 Participant operating protocol

Before a participant is invited, give them a concise statement covering:

- This is a staging product and may be unavailable or changed.
- They should use a resume they are comfortable testing; they may omit sensitive details.
- The product creates drafts and recommendations, not job applications or verified facts.
- They must review all generated content before use.
- No application, account, message, or payment occurs without their own direct action outside the product.
- They can request deletion, report a problem, or stop a workflow through a visible control.
- They have a support contact and expected response time.

### 8.3 Real-user task script

Ask each participant to perform only the following tasks in the first session. Observe but do not guide silently; confusion is evidence.

1. Create account and explain in their own words what the product does and does not do.
2. Upload or paste resume; identify what data they expect Tayari to keep.
3. Paste a public job description or job URL; explain whether they expect Tayari to contact the employer.
4. Review analysis; identify one fact, one inference, and one uncertainty.
5. Edit a resume/cover-letter draft; save a job/pipeline item.
6. Trigger a controlled failure or use the offline/unavailable state; explain the recovery path.
7. Locate deletion/privacy/support controls.
8. On an optional Ring 3 run, start and cancel a preparation workflow; verify no external action occurred.

Record time to complete, misunderstanding, support request, error type, recovery success, and whether the user trusts the output for the right reason. Do not record raw resume/JD content in research notes.

### 8.4 Stop rules during cohort testing

Immediately freeze new invites and disable affected capability if any of the following occurs:

- Cross-user data disclosure or mutation.
- Raw resume/JD or token appears in logs, telemetry, browser trace, screenshot, support export, or unauthorized interface.
- An external side effect occurs without explicit candidate approval.
- AI produces a fabricated application, contact, verification, salary, or employer claim shown as factual.
- Deletion workflow cannot complete or records become inaccessible only superficially.
- Users cannot cancel a long-running process whose real server-side work continues.
- Core completion rate falls below 95% in the active cohort for a non-user-abandonment reason.
- Operator cannot diagnose an incident from dashboards/runbook within 15 minutes.

---

## 9. Final-Staging Exit Evidence Ledger

Create `docs/release-evidence/<release-sha>/` for each candidate. A signed/owned record must exist for every row.

| Evidence ID | Artifact required | Owner | Pass standard |
|---|---|---|---|
| **EV-001** | Remote commit, tag, CI link, image digest manifest | Release owner | All identifiers resolve to same immutable release |
| **EV-002** | Full test results | QA owner | Python, Go, frontend, full E2E, security, RLS/migration, promotion gates green |
| **EV-003** | Staging config/capability manifest | Platform owner | Only approved Ring capability flags enabled; all blocked routes server-gated |
| **EV-004** | RLS/anonymous/two-user report | Backend/security owner | No unauthorized records or writes; all negative tests deny correctly |
| **EV-005** | PII sentinel redaction report | Security/privacy owner | Zero uncontrolled sentinel occurrences |
| **EV-006** | AI evaluation report | AI owner | Schema/truthfulness/failure/cost/latency thresholds meet agreed standard |
| **EV-007** | Backup restore report | Platform owner | Restore, migrations, health, RLS, synthetic journey succeed within documented objective |
| **EV-008** | Canary/soak dashboard export | Operations owner | No unresolved P0/P1; metrics stay within thresholds for 24 hours |
| **EV-009** | Cohort feedback and support summary | Product owner | No unresolved severe usability/trust problem; core task completion evidence reviewed |
| **EV-010** | Rollback rehearsal log | Release owner | Previous digest restored and synthetic canary passes |
| **EV-011** | Approval record | Product, engineering, security, operations owners | Each explicitly signs Go/No-Go; any dissent defaults to no-go |

No artifact, no pass. A verbal “it looked fine” is not evidence.

---

## 10. Production Promotion Checklist

### 10.1 Engineering gate

Run on the exact release SHA from a clean checkout/CI runner.

```bash
pnpm lint:budget
pnpm test -- --run
pnpm exec tsc --noEmit
pnpm build
pnpm performance:budget
pnpm promotion:gate

cd backend/go
go test ./...
go vet ./...

cd ../python
PYTHONPATH=. pytest -q
PYTHONPATH=. pytest app/tests tests --cov=app --cov-report=term-missing --cov-fail-under=60

cd ../..
python3 scripts/verify_self_hosted_migrations.py
scripts/check_public_table_rls.sh
TAYARI_E2E_TEST_MODE=true E2E_TEST_PASSWORD='<ephemeral CI secret>' pnpm test:e2e
```

The actual CI commands may use pinned runtime versions; match CI exactly. Never pass a personal password, real resume, real job link, or production secret into browser test output.

### 10.2 Pre-deploy gate

- [ ] Production environment secrets are in the approved secret store, not `.env` in Git or host shell history.
- [ ] Staging/prod uses external cloud Supabase only if the self-hosted frontend incompatibility guard is satisfied.
- [ ] Database backup is recent, checksum recorded, and restore was verified for this release family.
- [ ] Required migration applies cleanly and RLS/grant negative tests pass on target database.
- [ ] Feature/capability manifest matches approved scope exactly.
- [ ] `AUTONOMOUS_SUBMIT_ENABLED=false` is enforced server-side and deployment-time.
- [ ] Go/Python/worker/Redis/DB health and readiness endpoints are monitored.
- [ ] Dashboards, alerts, support inbox, on-call person, and rollback instructions are ready.
- [ ] Build image digests resolve in registry and are attached to release evidence.

### 10.3 Deploy and canary gate

1. Deploy to staging/canary from immutable digests.
2. Confirm frontend, Go `/healthz` and `/readyz`, Python `/healthz` and `/readyz`, worker, DB, and Redis health.
3. Run synthetic anonymous, authenticated, two-user, resume/JD, provider-unavailable, cancellation, and RLS denial canaries.
4. Confirm telemetry is redacted and dashboard sees deployment SHA.
5. Keep cohort at zero for at least one hour while watching errors/queues/auth/rate limits.
6. Invite Ring 1 only after all canaries are green.

### 10.4 Final go/no-go question set

| Question | Required answer |
|---|---|
| Can we prove which code and images are deployed? | Yes, with one SHA/tag/digest evidence chain. |
| Can a real candidate complete the approved core flow? | Yes, through synthetic and controlled cohort evidence. |
| Can a candidate understand what the system did and did not do? | Yes, via truthful states, provenance, drafts, and clear failure UX. |
| Can we protect their data and prove account isolation? | Yes, through RLS/grants, two-user tests, deletion, and redaction evidence. |
| Can we observe, cancel, disable, and roll back work? | Yes, through dashboards, kill switches, tested runbooks, and rollback drill. |
| Is every enabled feature independently proven safe enough? | Yes; otherwise it is disabled/gated. |
| Are full release tests green? | Yes; any red critical suite is a no-go. |

If the answer to any question is “not sure,” “probably,” “works locally,” or “we will monitor it,” the decision is **NO-GO**.

---

## 11. Work Sequencing for a Small Team

| Order | Focus | Do not start next until |
|---:|---|---|
| 1 | QE-001 through QE-005 | Every full engineering gate is green from same SHA |
| 2 | DATA-001 through DATA-005 | Synthetic PII sentinel, deletion, and two-user evidence all pass |
| 3 | REL-001, Ops dashboards, runbooks, restore | Staging deployment/recovery can be operated by someone other than original implementer |
| 4 | Ring 1 internal exercise | 48-hour clean internal evidence and resolved issues |
| 5 | Ring 2 five-person pilot | 7-day task/support/trust evidence and no stop rule fired |
| 6 | Ring 3 bounded preparation automation | Cancellation/no-side-effect/cost-audit proof holds in soak |
| 7 | Ring 4 limited public core | Production checklist and all evidence ledger rows signed |
| 8 | Separate capability launches | One capability ring at a time, never a broad “turn everything on” launch |

---

## 12. Architecture and Maintainability Work That Must Not Block the Core—but Must Be Planned

The repository has a reasonable service split but very large modules: API route files, Python application/service files, and frontend pages exceed 800–2,300 lines. Do not launch a rewrite before the core is proven. Do reserve capacity to reduce the risks deliberately.

| ID | Priority | Work | Why it matters | Safe boundary |
|---|---|---|---|---|
| **ARC-001** | P2 | Split `routes_mvp.go` into domain route modules. | 2,349-line route file is hard to review and easy to regress. | Keep router registration and API contracts unchanged. |
| **ARC-002** | P2 | Decompose `app/main.py` into application composition, route registration, middleware, and lifespan modules. | 2,343-line application entry masks dependency/config lifecycle. | Preserve endpoint paths; use contract tests. |
| **ARC-003** | P2 | Break large frontend pages into state hook, view sections, and typed API client. | Pages such as InterviewBoard/ResumeResults conflate user flow, state, rendering, and transport. | Preserve accessible behavior and existing URLs. |
| **ARC-004** | P2 | Centralize agent/run lifecycle contract. | Prevents a mix of booleans, fake success, and invisible async state. | Introduce typed API DTOs with backward-compatible adapters. |
| **DX-001** | P1 | Create one canonical verification guide. | AGENTS/history docs contain stale Bun commands despite current pnpm scripts. | `docs/development/verification.md` becomes canonical; link from README/AGENTS/CONTRIBUTING. |
| **DX-002** | P2 | Maintain a capability register with owner, flag, route/API/worker, data classification, risk tier, and test suite. | Prevents feature flags becoming an incomplete launch control. | Validate register in CI against feature config/routes. |

---

## 13. Definition of “Ready to Serve Users”

Tayari is ready to serve a limited public core only when all of the following are true:

1. **Correctness:** full automated suites are green from the deployed SHA, including deterministic AI/provider failure tests.
2. **Security and privacy:** owner isolation, RLS/grants, PII redaction, deletion, backup/restore, and secret handling have direct evidence.
3. **Usefulness:** real candidates can complete the core loop without an operator rescuing them; the output is understandable and reviewable.
4. **Truthfulness:** the system does not overstate applications, messages, verification, evidence, or AI certainty.
5. **Control:** the user can cancel; the operator can disable a capability; the release owner can roll back.
6. **Operations:** health, queue, errors, data access, provider failure, deployment, and support are observable and actionable.
7. **Scope discipline:** enabled functionality matches proven capability; the rest is hidden and server-gated.
8. **Supportability:** a new on-call engineer can use the runbooks and evidence ledger to diagnose an incident within 15 minutes.

Only then does the answer move from “the code is promising” to “the product is ready to serve users.”

---

## 14. Immediate First Ten Actions

1. Create a branch for Phase 0 corrections; do not mix product redesign into the test-recovery work.
2. Fix duplicate Python test module identity (QE-001).
3. Convert agent-squad success tests to deterministic provider-boundary fakes and add explicit unavailable tests (QE-002).
4. Fix mobile Escape/focus behavior and primary CTA contract (UX-001, QE-004).
5. Make AI E2E disabled/test-provider behavior explicit (QE-003).
6. Trace/remove unexpected analytics/branding 429s and dashboard 401 browser noise (QE-005).
7. Run the entire engineering gate from a clean environment; commit, push, tag, and capture the release SHA/digests (REL-001).
8. Run the synthetic PII sentinel test, two-user isolation suite, and deletion exercise (DATA-001–DATA-003).
9. Create dashboards/runbooks and complete a backup restore into a disposable staging environment (OPS-001–OPS-006).
10. Only then invite Ring 1 internal users and begin the evidence ledger.

> **The goal is not to make every test green by weakening the test or hiding the feature. The goal is to make the candidate-controlled core predictably useful, transparently limited, safely recoverable, and demonstrably operable.**


---

## 15. Specialist-Guided Omission Pass — New Mandatory Controls

This section was added after challenging the plan against the current automation, persistent-runtime, AI, data-rights, release-evidence, and capability-gating implementations. These are not generic best practices. Each item is grounded in a current repository control or gap.

### 15.1 P0 — Account deletion can report success even if the final auth deletion fails

**Evidence.** `backend/go/internal/api/routes_account.go` deletes application records inside a transaction, commits, then asks GoTrue to delete the auth user. If GoTrue fails, it attempts a direct `DELETE FROM auth.users`; if that fallback fails too, the code logs the failure but still returns HTTP 200 with `{"status":"deleted"}`. The user can therefore be told their account is deleted while the auth identity/session state has not been conclusively removed. There are no account-handler-specific Go tests currently found.

| ID | Objective | Exact change | Acceptance criteria | Validation | Rollback/failure rule |
|---|---|---|---|---|---|
| **DATA-006** | Make deletion an honest, durable completion workflow. | Replace the post-commit best-effort pattern with a durable deletion operation/status record or compensating retry workflow. Do not return `deleted` until the auth identity/session revocation result is confirmed. If finalization is pending, return `deletion_pending` with a support-safe operation ID and retry state; never expose internal errors or user content. Preserve a minimal non-content compliance completion record with retention disclosed. | GoTrue failure and direct SQL fallback failure cannot produce a false `deleted` response. A deleted account cannot authenticate, resume a worker, or access an existing token. A pending deletion is visible to the user/operator and retries safely. | New Go handler/integration tests: normal deletion, AI-purge failure, transaction failure, GoTrue failure + successful fallback, GoTrue failure + fallback failure, replay/idempotency, expired token after deletion. Run deletion on disposable Supabase stack. | If deletion orchestrator is unhealthy, stop accepting new deletion requests only if they would falsely complete; return an honest temporary-unavailable/pending state and page the operator. |

### 15.2 P0 — Evidence validation accepts synthetic placeholder attestations as if they were deployment evidence

**Evidence.** `scripts/run_staging_hostile_suite.py` defaults environment attestation values to example URLs and all-zero/all-one hashes when executing local test mode. `scripts/verify_staging_evidence_bundle.py` validates only the SHA-shaped format and explicitly permits `staging-hostile-verification` and `development` environments. A well-formed synthetic artifact can therefore satisfy the current structural evidence verifier unless an operator distinguishes it from real deployment proof.

| ID | Objective | Exact change | Acceptance criteria | Validation | Rollback/failure rule |
|---|---|---|---|---|---|
| **REL-002** | Make release evidence cryptographically and semantically tied to a real target. | Separate local hostile-suite output from promotion evidence schema or mark it `synthetic=true`. For final staging/production, reject example domains, all-zero/all-one placeholder digests, local/development environment labels, and untrusted operator-only values. Resolve deployed image digest from the target runtime/registry; hash the actual SBOM artifact; bind provider configuration fingerprint to deployment secret metadata without exposing secrets. Require HTTPS for external staging/production URLs. | Synthetic evidence is useful for development but can never pass final staging/production verification. Final evidence identifies an actual environment, target SHA, deployed digest, SBOM hash, and provider config fingerprint. | Unit tests for rejected placeholders/labels/URLs; one genuine canary bundle; verification script with strict production mode. | If evidence cannot be generated, release is no-go; do not hand-edit a JSON bundle to bypass the verifier. |

### 15.3 P0 — Candidate-controlled task control is an always-on server-side exception and needs a direct no-side-effect proof

**Evidence.** `backend/go/internal/capabilities/capabilities.go` disables workspace capabilities by default in staging/production but explicitly keeps `workspace.task_control` enabled. The code comment says it is safe because it cannot authorize submission. That invariant is central to user safety and must be executable evidence, not a comment.

| ID | Objective | Exact change | Acceptance criteria | Validation | Rollback/failure rule |
|---|---|---|---|---|---|
| **CAP-001** | Prove the always-on task-control capability cannot create irreversible or external side effects. | Build a route-to-capability inventory and test that every task-control transition is candidate-owned, owner-scoped, auditable, cancellable, and cannot reach browser submission, Gmail, messaging, billing, or irreversible-job paths without separately enabled capability and explicit approval. Ensure frontend navigation, Go middleware, Python worker dispatch, and queue consumer agree on capability state. | When all autonomous/external capabilities are false, task control may plan/pause/review but cannot dispatch a side-effecting operation. Every blocked attempt returns a clear denial and leaves no external effect or orphaned worker. | Go route tests, Python worker tests, queue/outbox integration tests, capability-matrix contract test, negative browser/E2E test. | Any unexpected dispatch is P0: disable `workspace.task_control`, cancel queued runs, preserve redacted audit evidence, and investigate before reopening. |

### 15.4 P1 — Data export is not yet an explicit completeness contract

**Evidence.** `handleExportAccount` caps the ZIP at 10 MiB and applies a 1,000-row limit only to selected direct queries; generic export queries can accumulate unbounded results and a large user can receive HTTP 413. The helper `exportJSONRows` logs a database query error and substitutes an empty array, which makes a partial export indistinguishable from a genuinely empty data category. No dedicated account export/deletion test files were found.

| ID | Objective | Exact change | Acceptance criteria | Validation | Rollback/failure rule |
|---|---|---|---|---|---|
| **DATA-007** | Make data export complete, transparent, and safe for large accounts. | Define an export manifest with every durable user-owned dataset, category status, row count, byte count, schema version, and omitted/retry reason. Replace silent `[]` degradation with explicit per-category failure and a non-success overall status. Make large exports asynchronous, paged/streamed, or securely downloadable rather than returning an opaque 413. Include file/object references and documented retention exceptions where applicable. | A user can distinguish “empty” from “failed/omitted”; large accounts receive a safe export workflow; no partial artifact is called complete. | Go tests for empty, normal, query-failure, >1,000 rows, >10 MiB, concurrent request, authorization, ZIP integrity, and no cross-user data. End-to-end disposable database/export test. | Preserve the old small synchronous path only as an optimization; never silently truncate or claim a partial export is complete. |

### 15.5 P1 — Browser telemetry scrubbing is shallow and truncation is not redaction

**Evidence.** `src/lib/telemetry-scrub.ts` makes a shallow copy and redacts only top-level keys matching a name regex. Nested objects/arrays, arbitrary string values, and the first 200 characters of console messages can still contain resume or job-description data. Truncation limits volume; it does not remove sensitive content.

| ID | Objective | Exact change | Acceptance criteria | Validation | Rollback/failure rule |
|---|---|---|---|---|---|
| **DATA-008** | Replace best-effort browser PII filtering with a recursive allowlist/redaction boundary. | Use a recursive, cycle-safe sanitizer for nested objects and arrays, with an allowlist of safe telemetry fields for production events. Treat console breadcrumbs containing user content as disabled or fully redacted rather than truncated. Apply an equivalent redaction contract in Go/Python structured logs and error reporting. | Nested sentinel PII, arrays, exception messages, URL parameters, and breadcrumb text do not leave the process in telemetry; safe operational IDs remain available. | Extend telemetry unit tests; browser integration test with synthetic sentinel; Go/Python log capture test; inspect actual emitted event payload in non-production sink. | On sanitizer failure, drop the telemetry field/event rather than send raw data. |

### 15.6 P1 — Recovery proof must inventory all durable user state, not only the `public` database schema

**Evidence.** `scripts/backup-restore-smoke.sh` deliberately restores only PostgreSQL `public` schema and verifies 14 tables. It correctly refuses to fabricate `auth.users`, but its own comments make clear that auth, storage, realtime/configuration, and other platform-managed domains are not part of the portable dump. This does not mean the script is wrong; it means its passing result is **not a complete service recovery proof**.

| ID | Objective | Exact change | Acceptance criteria | Validation | Rollback/failure rule |
|---|---|---|---|---|---|
| **OPS-007** | Create a complete recovery inventory and service restoration drill. | Enumerate every durable domain: application DB, auth identities/sessions, uploaded objects/file storage, database migrations/RLS policies, secrets/configuration, queue state policy, external OAuth client settings, billing/webhook idempotency ledger, and release artifacts. For each, state backup owner, RPO/RTO, restore mechanism, validation query, and whether it is intentionally reconstructible. | A restore drill can rebuild a usable disposable environment from the documented recovery set and identify every intentional exclusion. | Run current public-schema restore plus auth/storage/config recovery checks, RLS gate, synthetic account journey, file access/download where applicable, and report measured RPO/RTO. | If a required domain has no recovery path, restrict launch scope so it cannot become user-critical or add the recovery implementation before promotion. |

### 15.7 P1 — Live dependency checks exist but are not yet a required release-evidence bundle

**Evidence.** `scripts/live_provider_verify.py` has a deliberate read-only harness for Go/Python health/readiness, LLM configuration, Stripe, Firecrawl, Apify, Gmail/Calendar/Drive, observability metrics, queue, and Supabase auth. It distinguishes `pass`, `degraded`, `blocked_by_configuration`, and `blocked_by_policy`, and can fail when required providers are unavailable. The existing program required live proof conceptually but did not name this implementation as a release artifact.

| ID | Objective | Exact change | Acceptance criteria | Validation | Rollback/failure rule |
|---|---|---|---|---|---|
| **OPS-008** | Bind enabled external dependencies to a read-only live readiness report. | Add a release command that invokes `live_provider_verify.py` against the actual staging target with `--allow-live` and `--require-providers` generated from the approved capability manifest. Store the redacted JSON in the evidence ledger. Do not require blocked providers that are not in approved scope. | Every enabled dependency passes live readiness from target environment; disabled integrations are recorded as intentionally blocked, not green. | Read-only provider verification plus synthetic user journey against deployed canary. | A degraded/blocked required provider disables its dependent feature or blocks promotion; do not promote on a configuration-only check. |

### 15.8 P1 — Automation requires a durable, idempotent execution contract, not just a capability flag

The product has workers, schedules, task control, and external/provider integrations. Automation guidance confirms that any recurring/event-driven or background action must be durable, observable, and hosted in a continuously available service—not a developer session. This is a **required verification area**, not a confirmed defect in one named implementation.

| ID | Objective | Exact change | Acceptance criteria | Validation | Rollback/failure rule |
|---|---|---|---|---|---|
| **AUTO-001** | Prove all approved scheduled/background work is single-dispatch, idempotent, bounded, and recoverable. | Document worker/scheduler topology, time zone policy, leader/lock behavior, retry/backoff, dead-letter/failure state, idempotency key, cancellation propagation, queue retention, and operator pause mechanism. Make no-job/no-external-action defaults explicit. | Duplicate delivery, retry after timeout, scheduler restart, queue restart, user deletion, capability disable, and cancellation cannot create duplicate drafts, messages, or side effects. | Queue/worker integration tests; restart test; duplicate-event test; cancellation deadline test; task-control negative test. | Pause schedules and drain/cancel only safe jobs; never replay an unknown side-effecting job automatically. |

### 15.9 P2 — Supply-chain controls are present; evidence must be real, not merely syntactically required

**Evidence.** Image build/deploy tooling already requests build provenance and SBOM generation, and deployment requires an attestation gate. This is a strength, not a missing feature. The omission is procedural: the final evidence ledger must include the real SBOM hash/provenance result for deployed images, and the verifier must reject placeholders as in REL-002.

| ID | Objective | Exact change | Acceptance criteria | Validation |
|---|---|---|---|---|
| **REL-003** | Make existing image provenance/SBOM controls auditable at release time. | Attach generated SBOM/provenance artifacts to release evidence, verify their hashes against the deployed image digest, and record vulnerability scan disposition with an expiry for any accepted finding. | No production promotion accepts a syntactically valid but unavailable or mismatched SBOM/provenance artifact. | Release attestation test against actual registry artifact and deployed digest. |

### 15.10 Updated final-stage hard stops

Add the following to the prior stop rules. Each is now a **hard no-go** for final staging or production.

- [ ] Account deletion can return a false completion state after an auth deletion failure.
- [ ] A synthetic/local evidence bundle can pass the same verifier used to certify a live deployment.
- [ ] The always-on task-control capability can dispatch or leave an external/irreversible side effect when dependent capabilities are disabled.
- [ ] A user export can silently omit a failed category or call a truncated export complete.
- [ ] A nested/sentinel resume or JD value reaches telemetry, an error tracker, or a breadcrumb.
- [ ] A recovery drill does not account for every durable user-state domain in the approved scope.
- [ ] A required enabled provider is blocked/degraded in the actual target environment.
- [ ] Background work can duplicate, survive cancellation/deletion, or resume after a kill switch without an explicit user-approved retry.

### 15.11 Updated immediate execution order

1. Complete QE-001 through QE-005 to restore fully green engineering truth.
2. Complete **DATA-006** and **REL-002** before any real-user invitation; false deletion completion and synthetic evidence acceptance are unacceptable privacy/release claims.
3. Complete **CAP-001**, **DATA-007**, and **DATA-008** before enabling the candidate pilot; these protect capability boundaries and data rights.
4. Complete **OPS-007**, **OPS-008**, and **AUTO-001** before Ring 3 automation or any external integration.
5. Use **REL-003** when producing the immutable staging/production release evidence bundle.

The result is stricter by design: it distinguishes a tool that exists from an assurance that can be trusted by a real user, operator, or future investigator.
