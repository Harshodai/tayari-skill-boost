# Desktop Assist and Ruthless Automation Upgrade

**Date:** 25 August 2026
**Scope:** Tayari desktop workspace, signed-in dashboard, application preparation, and durable task execution

## Executive result

Tayari now has one coherent, review-first automation loop across the dashboard, Manus-style Desktop Assist, the application flow, and the durable task worker. The system can prepare useful work across four career lanes while remaining explicit about what it did, what it knows, what is missing, and where the candidate must decide.

This is an implementation of the highest-value roadmap that the current repository can support safely. It does not pretend that credentials, CAPTCHAs, legal declarations, message sending, or final applications can be automated without a separate governed capability and a real provider-specific proof.

## Implemented automation lanes

| Lane | User value | Grounded context | Boundary |
|---|---|---|---|
| Build an application packet | Prepares fit analysis, resume direction, cover letter, answers, and a review packet | Profile, latest resume, saved jobs, and application records | Draft-only; stops before submission |
| Sweep for better-fit roles | Organizes saved opportunity data into a reviewable shortlist with fit rationale and unknowns | Search strategy, saved jobs, and candidate context | No discovery claim without provider data; no applying or contacting |
| Run an interview sprint | Creates role-specific practice drills, story prompts, and a transparent progress baseline | Approved role context, resume, and profile | Preparation-only; no hiring-probability prediction |
| Prepare follow-up actions | Detects stale pipeline moments and prepares message options and timing checks | Candidate-owned application records and timestamps | Draft-only; no message is sent |

## Frontend changes

The Desktop Assist workspace now has a selectable automation-lane console. Each lane displays its promise, number of bounded steps, number of review gates, and the shared safety posture before a task is created. Dashboard cards deep-link directly to a chosen lane, so the user can move from daily focus to execution without retyping intent.

The desktop workspace loads recent task plans, makes each plan reopenable, and states the ruthless guardrails in the product surface: candidate-owned context only, durable approval or takeover for risky steps, no credentials or OTPs, no CAPTCHA solving, no legal declarations, no sends, no submissions, and server-side cancellation.

The task control room now exposes step details, risk-tier badges, explicit review-gate badges, and a stale-data warning. The user can see exactly what the approved plan intends to do rather than receiving a generic list of titles.

The existing Apply Agent now links directly to Desktop Assist and explains that the broader lanes support opportunity sweeps, interview sprints, and pipeline follow-up preparation while preserving the same review-first boundary.

## Backend execution changes

The durable task worker now infers the selected lane from the task title and objective, uses lane-specific output contracts, and records the lane in execution events and artifact provenance. The worker still executes only the draft-only runtime. Its only allowlisted tool remains `candidate_context.read`.

Candidate context now includes bounded, owner-scoped slices of the profile, latest resume, saved jobs, and applications. Saved job and application payloads are compacted before they reach the model. Missing context is represented as unavailable rather than silently fabricated.

The lane-aware prompt explicitly treats task text and source content as untrusted data, forbids claims of browsing or external side effects, forbids invented facts and provider data, and prevents practice scores from being presented as hiring probability. Each lane receives headings appropriate to its output, such as fit and evidence, freshness and source limits, role-specific drills, or draft-only follow-up options.

## Tests and validation

| Check | Result |
|---|---:|
| Frontend unit tests | 50 files passed; 189 tests passed |
| Backend full pytest suite | 960 passed; 4 skipped |
| Lane-aware backend safety tests | 9 passed |
| ESLint | Passed with 0 errors; existing warnings remain |
| Production build | Passed |
| `git diff --check` | Passed |

The connected browser reached the authentication screen when attempting to inspect the protected workspace, so no real account actions were performed.

## Files changed

- `src/lib/agent/taskRecipes.ts` — lane definitions, typed deep-link validation, and safe plan conversion.
- `src/lib/agent/taskRecipes.test.ts` — lane and no-submission regression tests.
- `src/pages/DesktopAgent.tsx` — lane selector, query-string deep links, recent plans, and guardrails.
- `src/pages/Dashboard.tsx` — Ruthless Automation Center with direct lane links.
- `src/pages/TaskControlRoom.tsx` — detailed plan-step, risk, and review-boundary presentation.
- `src/pages/ApplyAgent.tsx` — Desktop Assist connection and broader-lane explanation.
- `src/pages/manusStyleWorkflow.test.ts` — recipe-driven workflow contract coverage.
- `backend/python/app/tasks/task_control.py` — lane-aware prompts, bounded candidate context, and lane provenance.
- `backend/python/app/tests/test_task_control.py` — lane routing and prompt safety coverage.
- `src/integrations/supabase/previewAuthStorage.ts` — corrected an existing `prefer-const` lint blocker without changing behavior.

The existing handoff files `HANDOFF_2026-08-24.md` and `NEXT_AGENT_PROMPT.md` were not modified.

## Remaining gated expansion

The next safe expansion is provider-backed opportunity ingestion with freshness, canonical identity, and source receipts. After that, the application packet can be connected to a real versioned artifact store and a structured question queue. Any browser-assisted work must continue through the existing capability gate, owner-scoped approvals, takeover path, cancellation endpoint, and receipt reconciliation. Unattended external submission remains intentionally out of scope until those proofs exist.
