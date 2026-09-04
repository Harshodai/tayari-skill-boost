# DeepSeek Execution Brief: Build Job Tayari into a Manus-Style Career Agent

## Role and operating constraints

You are the principal engineer for **Job Tayari**, a career operating system for software engineers. You are working in an existing monorepo with a React/Vite frontend, a Go gateway, and Python services. Your goal is to make the product feel **as transparent, reliable, observable, consent-driven, and polished as a premium agent workspace**. Do not use aspirational language to hide a missing implementation.

> **Non-negotiable truth rule:** A UI must never imply that a browser is connected, a job was discovered, an application was submitted, Gmail has limited mailbox access, or saved posts are synchronized unless the backend has recorded verifiable evidence for that exact claim.

Work directly in the repository. Preserve existing working-tree changes. Do not commit, push, or delete user data. Before changing a file, inspect the current code and existing tests. After every implementation slice, run focused tests and leave the repository with `git diff --check` clean.

## Product contract

Job Tayari must become a **candidate-controlled career agent**, not a high-volume application bot. The product can research, prepare, rank, draft, fill permitted fields, and surface evidence. It must pause for candidate action when a portal policy, sensitive question, credential, CAPTCHA, legal attestation, compensation decision, equal-opportunity question, work authorization statement, or final submission is involved.

| Capability | Required product truth | Absolute prohibition |
|---|---|---|
| Resume optimizer | Accept resume upload/paste, pasted job description, public job-description URL, and custom instructions; show source provenance and every suggested change for review. | Inventing experience, metrics, employers, dates, qualifications, or claiming an output is safe without a truth check. |
| Transition onboarding | Store and expose current role/domain, target role/domain, transition type, constraints, target companies, geography, compensation expectations, and timeline. | Treating a domain shift as a cosmetic title preference. |
| Career computer | Display a real worker/session URL, capability state, timestamps, event stream, screenshot/DOM evidence, pause/stop action, and receipt state only when supplied by the backend. | Rendering simulated browser progress as live execution. |
| Applications | Bind approval to immutable hashes of the job post, resume, cover letter, answers, and profile version. | Marking `applied` from a client-side status update or an unverified self-report. |
| Dream-company pipeline | Discover only permitted sources, deduplicate requisitions, track freshness, rank explainably, create tailored artifacts, and queue candidate review. | Scraping or auto-submitting in violation of a portal policy or silently using credentials. |
| Omnisave | Import candidate-provided public URLs and answer with source links. | Saying Substack, Medium, or LinkedIn saved-post accounts are connected when only URL import exists. |
| Gmail | Obtain explicit OAuth consent, display exact scopes, use the narrowest practical query/time window, support disconnect/deletion, and show why an email was classified. | Claiming `gmail.readonly` is mailbox-limited or reading unrelated email without disclosed policy. |

## Multi-agent architecture to implement

Use an orchestrator with small agents that have typed inputs and outputs. Each agent must emit an auditable event. The orchestrator must fail closed: if evidence, approval, source policy, or artifact integrity is missing, it returns `blocked` with a clear reason and no external action.

| Agent | Owns | Inputs | Must return | Cannot do |
|---|---|---|---|---|
| Profile Agent | Canonical candidate profile and transition intent | Versioned profile | Validated profile version and missing fields | Infer or overwrite material facts |
| Job Scout | Permitted job discovery and freshness | Source allowlist, company/role filters | Normalized jobs, source URL, timestamp, policy state | Submit applications or bypass portal restrictions |
| Match Agent | Explainable fit and gaps | Profile, resume, job version | Score breakdown, evidence citations, uncertainty | Invent skills or score without evidence |
| Artifact Agent | Resume/cover-letter/answer drafts | Approved source resume and job description | Diff, claim provenance, artifact hashes | Finalize without candidate review |
| Truth Gate | Fact and claim integrity review | Original artifacts and drafts | Flags, rationale, pass/fail, risk | Approve fabricated or unsupported claims |
| Approval Agent | Candidate consent ledger | Artifact hashes, job hash, scope, expiry | Signed/recorded approval state | Approve on behalf of candidate |
| Browser Worker | Isolated, policy-permitted browser assistance | Run token and approved scope | Event stream, screenshot refs, pause state, receipt evidence | Handle sensitive questions or perform final submit without candidate action |
| Receipt Verifier | External outcome evidence | Browser events, confirmation page evidence | `verified`, `unverified`, or `failed` receipt | Upgrade a local status to `verified` |
| Interview Agent | Narrow Gmail interview triage | Explicit query/window and consent | Extracted interview card, source/message reference, confidence | General inbox search outside declared scope |
| Knowledge Agent | Candidate-owned reading retrieval | URL-imported sources and question | Answer with per-claim citations or abstention | Claim account-level saved-post synchronization without connector evidence |

### Required orchestration state machine

Implement one immutable run record with the following states. Persist every transition, actor, timestamp, reason, and evidence reference. Invalid transitions must be rejected server-side.

```text
DRAFT
  -> JOB_DISCOVERED
  -> JOB_SCREENED
  -> ARTIFACTS_PREPARED
  -> TRUTH_GATE_PASSED | REVISION_REQUIRED
  -> CANDIDATE_APPROVAL_PENDING
  -> APPROVED_FOR_ASSISTANCE
  -> BROWSER_SESSION_ACTIVE
  -> SENSITIVE_QUESTION_HANDOFF | READY_FOR_CANDIDATE_SUBMIT
  -> CANDIDATE_SUBMITTED
  -> RECEIPT_VERIFIED | RECEIPT_UNVERIFIED | FAILED | CANCELLED
```

`RECEIPT_VERIFIED` is allowed only with a source URL, observed timestamp, candidate/job/artifact binding, and confirmation evidence. `CANDIDATE_SUBMITTED` means the candidate confirmed the final external action; it is not the same as a verified receipt. Any material artifact or job-description change invalidates approval and sends the run back to `CANDIDATE_APPROVAL_PENDING`.

## Completed changes to preserve

The current working tree already contains important safety and truthfulness changes. Do not remove or weaken them.

| Area | Existing change to preserve |
|---|---|
| Landing and resume workflow | Public claims now distinguish live product capability from planned capability, and job-description provenance/custom-instruction review is visible. |
| Tayari Computer | The control room identifies itself as a preview, shows no connected browser, and exposes the required safety sequence instead of pretending to execute. |
| Omnisave | The page describes the real public-URL import model and does not claim account-level saved-post synchronization. |
| Gmail | The modal clarifies that `gmail.readonly` can read mailbox messages and that the connector needs more candidate controls before broad release. |
| Go application pipeline | Generic status updates cannot mark an application as applied without a valid stored submission mode; review queue records candidate-confirmed rather than externally verified application status. |
| Python A2A squad | `backend/python/app/a2a/agent_squad.py` now runs the real optimizer and truth gate, records fingerprinted audit events, requires candidate approval, and always returns `submission_permitted: false`. |

## Ruthless implementation sequence

### Slice 0 — Establish non-negotiable safety primitives

Implement persistent `application_run`, `approval`, `browser_session`, `worker_event`, and `submission_receipt` models. Use UUIDs, version numbers, SHA-256 content hashes, user ownership, timestamps, and explicit foreign keys. Write server-side transition validation. Add structured error codes such as `APPROVAL_STALE`, `POLICY_BLOCKED`, `SENSITIVE_QUESTION_REQUIRED`, `NO_RECEIPT_EVIDENCE`, and `WORKER_UNAVAILABLE`.

**Acceptance criteria:** A direct API call cannot move a run to `applied`, `candidate_submitted`, or `receipt_verified` unless all required server-side evidence is present. Unit tests attempt invalid transitions and prove they fail.

### Slice 1 — Make the control room a real observer, not an imitation

Create a browser-worker service boundary. It must expose a run-specific authenticated event stream (SSE or WebSocket), session state, worker capability state, event sequence number, screenshot reference, current URL, and explicit pause/stop control. The frontend must render an offline/blocked state when unavailable. Do not display a fake browser viewport.

**Acceptance criteria:** The control room shows real event IDs and timestamps from a test worker. Killing the worker changes the UI to offline. Pause/stop is idempotent and recorded. No final-submit endpoint exists without a candidate-controlled confirmation flow.

### Slice 2 — Bind candidate approvals to precise content

Build an approval drawer that presents diffed resume/cover-letter/answers, job source/version, truth-gate flags, and a scope statement. Approval must record the user, artifact hashes, job hash, declared allowed actions, expiration, and revocation. Any edit invalidates approval.

**Acceptance criteria:** Changing one character of a reviewed artifact causes a stale-approval error. The client cannot reuse a former approval token against a changed job or new browser run.

### Slice 3 — Build the dream-company pipeline honestly

Add a source registry with terms/policy status, direct ATS integration support where available, company career-page watch configuration, deduplication keys, and source freshness. For Google or any dream company, show source name, last checked time, permission state, requisition identifier, change history, explanation of match, and manual fallback.

**Acceptance criteria:** The system can monitor a permitted source, detect a new or changed job, generate a review package, and place it in the queue. It never asserts that it applied until candidate confirmation and receipt evidence exist.

### Slice 4 — Complete connector privacy controls

For Gmail, add candidate-facing search-query, time-window, processing-purpose, retention, disconnect, delete-derived-data, and re-consent controls. On the server, enforce the declared query/window and exclude message body persistence unless explicitly necessary and consented. For Omnisave, implement either official authorized integrations or documented user-export importers; keep public URL import as the current reliable path until then.

**Acceptance criteria:** The candidate can see and change Gmail scope settings, revoke access, and delete derived interview data. Tests prove the query/window filter is enforced server-side. Omnisave citations link only to ingested, candidate-owned sources.

### Slice 5 — Turn onboarding into a transition engine

Store an explicit transition plan: `job_change`, `domain_change`, `level_change`, `location_change`, or `return_to_work`. Ask for evidence of transferable skills, target-domain gaps, learning plan, portfolio gaps, time/financial constraints, and dream-company strategy. Make every field editable with audit history.

**Acceptance criteria:** A backend engineer moving into ML engineering receives a materially different roadmap, job-ranking rationale, resume strategy, and interview plan than a candidate making an equivalent-role job change.

### Slice 6 — Production quality and observability

Add tenant isolation tests, rate limits, encrypted credential storage, secret rotation, audit-log retention, error monitoring, per-agent latency/error metrics, real-user event telemetry with privacy controls, retry budgets, dead-letter handling, and test fixtures for the common ATS variants. Implement release canaries and a kill switch for every external-action worker.

**Acceptance criteria:** Every action is traceable to user, approval, agent, source, and evidence. A production incident can pause new browser runs immediately without destroying queued candidate work.

## Ruthless launch gates

Do not call Job Tayari 10/10, autonomous, or end-to-end until every row below is green in production.

| Gate | Evidence required |
|---|---|
| Product truth | Claim-to-evidence inventory has no unsupported copy, and UX snapshots cover offline, blocked, pending, failed, and live states. |
| Resume integrity | Truth-gate precision/recall suite, human spot checks, provenance display, and no-fabrication escalation policy. |
| Approval integrity | Hash-bound approvals, expiry/revocation, server-side tests, and audit exports. |
| Browser safety | Isolated worker, portal allowlist/policy check, secret handling, sensitive-question handoff, pause/stop, and kill switch. |
| Submission truth | Confirmation evidence captured, receipt verifier tested, no client-only `applied` state, and clear `unverified` status. |
| Gmail privacy | Exact scopes, narrow enforced query/window, disconnect/delete, consent audit, and data-retention policy. |
| Omnisave truth | Citation-grounded answers with abstention, source access control, and no false account-sync claim. |
| Reliability | Contract tests across React, Go, and Python; load/error budgets; idempotency and recovery tests. |
| Accessibility and polish | Keyboard flow, focus management, readable errors, empty states, mobile layouts, and no jargon-led onboarding. |
| Business viability | Retention and conversion instrumentation; trustworthy outcome metrics; human-support path for high-stakes failures. |

## Questions that must be answered before broad launch

1. Which exact job sources have written permission or a documented acceptable-use pathway for browser assistance?
2. Who owns a candidate’s resume, generated artifacts, Gmail-derived interview data, and browser evidence, and how quickly can each be deleted?
3. What proof distinguishes a candidate clicking submit from a portal accepting the application?
4. What happens when a worker encounters a CAPTCHA, anti-bot page, unexpected authentication prompt, or policy warning?
5. How is every sensitive question detected, paused, surfaced, and prevented from accidental answer generation?
6. What is the numeric false-positive rate for truth-gate approval, and who resolves a disputed flag?
7. Which customer cohort gets enough recurring value to pay monthly after the first tailored resume?
8. What measures candidate outcomes without mistaking volume of applications for quality of opportunity?
9. Which actions are reversible, and how can an agent run be cancelled in less than one minute?
10. What prevents a stale approval from applying an old resume to a newly changed role?
11. How do domain-switch candidates get a credible evidence plan rather than generic keyword insertion?
12. Can a support engineer reconstruct one application run using only audit IDs and no raw resume text?
13. What is the fallback when a connector is unavailable or a job page cannot be accessed?
14. What is the user-visible difference between a recommendation, a prepared draft, a candidate-confirmed action, and externally verified completion?
15. Which portal terms, privacy rules, and geographic employment regulations govern each supported workflow?

## Required validation commands

Run only commands applicable to changed code, then report exact status and failures:

```bash
(cd backend/python && .venv/bin/python -m pytest app/tests/test_agent_squad.py -q)
(cd backend/go && gofmt -d internal/api/routes_mvp.go internal/api/routes_review_queue.go internal/api/routes_mvp_status_test.go)
(cd backend/go && go test ./internal/api -run 'Test.*(Application|Status|Review)' -count=1)
npm run build
git diff --check
```

For each completed slice, give a short report with changed files, contracts added, tests run, test results, remaining blockers, and a plain-language statement of what is **not** live yet.

## Final instruction

Prioritize **reality over theater**. Make the happy path fast and polished, but invest equally in blocked, denied, stale, unavailable, and handoff states. The product earns trust by showing what it knows, what it did, what it needs from the candidate, and what it cannot safely do.
