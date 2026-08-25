# Tayari Feature Evolution Research — V2

**Date:** 25 August 2026
**Author:** Manus AI
**Repository:** `Harshodai/tayari-skill-boost`

## Executive conclusion

Tayari does not primarily need more isolated feature pages. The repository already contains a broad catalog: job search, resume analysis, cover letters, application tracking, Desktop Assist, task control, Career Ops, interview preparation, voice coaching, company radar, skill-gap analysis, outreach, analytics, roadmap, portfolio generation, and multiple automation workers.

The next level is to make those capabilities behave like one **career operating system**. The product should accept a goal, build a candidate-owned plan, gather only authorized context, produce evidence-backed outputs, pause at explicit decision boundaries, and learn from what the candidate changes or records next. The moat should be **context continuity, provenance, explainability, and measurable improvement**, not raw application volume.

The current public landing page already communicates the review-first philosophy effectively: context before volume, visible decisions, and retraceable receipts. Its weakness is that the advanced product value appears as a feature catalog rather than an intelligent operating loop. The protected workspace could not be visually inspected from the connected browser because authentication was required, so no account actions were performed.

## Evidence from current Tayari

The latest maturity review correctly identifies the strongest product spine as resume ingestion → job discovery and triage → grounded tailoring → cover-letter/application artifacts → candidate review → application tracking. It also identifies the main blockers as operational and evidence-related: job identity and freshness, profile and goal snapshots, artifact provenance, application state semantics, provider reliability, recovery, and live staging evidence.

The recent implementation pass already introduced four Desktop Assist lanes: application packet, opportunity sweep, interview sprint, and follow-up radar. The durable worker now detects the lane, loads bounded owner-scoped profile/resume/saved-job/application context, and emits lane-specific reviewable drafts while refusing to claim external actions. This is the right direction, but the worker is still draft-oriented; the next step is to make the underlying candidate workflow and evidence model first-class.

## Parallel research findings

### 1. Opportunity intelligence should combine intent, hard constraints, and explainability

LinkedIn’s official AI job-search documentation describes natural-language intent matching against job descriptions, contextual refinement using location, experience, specialty, skills, and employment type, and suggested filters generated from the query. It also documents limitations around exclusions and profile-based “jobs I’m qualified for” searches. [1]

A 2026 ACL system demonstration, JobMatchAI, describes a hybrid retrieval stack combining Transformer embeddings, skill knowledge graphs, and interpretable reranking. Its abstract explicitly separates skill fit, experience, location, salary, and company preferences and provides factor-wise explanations rather than one opaque score. [2]

Tayari should therefore implement a stronger version of this pattern: parse natural-language intent, convert explicit negatives into deterministic exclusions, apply hard filters before semantic ranking, use a skill graph for synonyms and nonlinear career transfer, and display factor-level evidence with freshness and confidence.

### 2. Coaching should be an adaptive practice loop, not a question generator

Current interview products emphasize realistic questions, spoken practice, and instant feedback. Research results also point toward structured, personalized feedback and repeated practice rather than one-time content generation. The useful product primitive is a loop: role context → targeted question → candidate response → transparent dimensions → correction → repeated drill → progress delta.

Tayari already has interview preparation, voice coaching, story-bank, and coding-practice surfaces. The gap is continuity. A role-specific coaching session should bind to the same job snapshot and resume version used for the application packet, reuse verified candidate stories, and record improvement across practice attempts. Coaching scores should describe observable dimensions such as structure, evidence, clarity, concision, technical depth, and timing. They must not be presented as hiring probability.

### 3. Product breadth is table stakes; integrated workflow is the differentiator

Jobright’s official product pages combine personalized job matches, application autofill, tailored resumes, insider connections, interview questions, career guidance, and tracking. [3] Careerflow similarly presents a unified stack of resume building, job-fit analysis, LinkedIn optimization, application autofill, job tracking, networking tracking, skill-gap analysis, and mock-interview analysis. [4]

These products validate the expected feature surface, but they also clarify where Tayari should avoid copying them. Competing on volume, autofill, or a large feature list would make Tayari interchangeable. Tayari should win on the continuity between a role, a candidate evidence set, an artifact version, a review decision, a practice loop, and a later outcome.

### 4. Advanced agents need deterministic control around model-driven steps

LangGraph’s official documentation describes durable execution, streaming, human-in-the-loop state inspection and modification, persistence through failures, memory, and the ability to mix deterministic hand-coded steps with LLM-driven steps. [5] This matches Tayari’s existing Go gateway, durable task tables, Python worker, approvals, events, artifacts, leases, and cancellation controls.

The recommendation is not to introduce a second workflow engine immediately. Instead, Tayari should model each career lane as a typed state graph on top of the existing task-control spine. Deterministic steps should own identity, freshness, policy, provenance, budgets, and approval transitions. Model-driven steps should own bounded interpretation, drafting, ranking explanations, and coaching feedback.

## Gap matrix

| Area | Current Tayari position | Advanced target | Priority |
|---|---|---|---:|
| Career command center | Many pages and four Desktop Assist lanes | One goal-driven workspace with next-best action, plan, evidence, approvals, and recent outcomes | P0 |
| Opportunity matching | Search, portal scanners, saved jobs, scorecards, and provider services exist | Natural-language intent, hard negatives, hybrid retrieval, skill graph, factor explanations, freshness, and canonical identity | P0 |
| Application package | Resume, cover letter, answer bank, review queue, and application records exist | Versioned package manifest binding role snapshot, resume version, answers, claims, hashes, review state, and expiry | P0 |
| Application state | Several statuses and trackers exist | Explicit prepared → reviewed → approved → attempted → receipt-confirmed → externally-verified state machine | P0 |
| Interview coaching | Interview prep, voice coach, story bank, and coding pages exist | Role-bound adaptive practice with evidence-linked stories, transparent scoring dimensions, replay, and improvement deltas | P1 |
| Follow-up | Career Ops follow-up cadence and communication surfaces exist | Stale-item detector, urgency reasoning, draft-only messages, reminders, and candidate confirmation | P1 |
| Candidate memory | Profile, resume, answer bank, knowledge hub, and graph services exist | Versioned assertions with source, confidence, expiry, deletion, and retrieval evaluation | P1 |
| Desktop companion | Desktop workspace and browser controls exist in preview-oriented form | Stable local lifecycle, task inbox, secure local file selection, signed updates, rollback, and visible handoff | P1 |
| Browser automation | Live browser feed, takeover, cancellation, and capability gates exist | One allowlisted ATS proof with isolation, screenshots/events, takeover, kill switch, and receipt reconciliation | P2, gated |
| Observability | Events, logs, telemetry, and worker controls exist | Unified model/provider/task/user traces with prompt version, cost, latency, policy decision, and artifact provenance | P1 |
| Evaluation | Broad deterministic tests exist | Golden corpora for parsing, matching, truth preservation, injection resistance, coaching quality, and cost | P1 |
| Connectors | Many connector surfaces exist but evidence varies | One read-only connector at a time with narrow scope, revocation, minimization, retention, and deletion proof | P2, gated |

## What “advanced” should mean for Tayari

An advanced feature should not merely call a stronger model. It should improve the candidate’s next decision while preserving a verifiable record. The minimum advanced contract is therefore:

| Contract | Required behavior |
|---|---|
| Grounding | Every candidate claim and recommendation points to a candidate-owned source or is labeled unknown. |
| Determinism | Hard constraints, identity, freshness, policy, risk tier, and state transitions are code-controlled. |
| Explainability | The user sees why a role, skill, artifact change, or next action was recommended. |
| Versioning | Profile, goal, job, resume, prompt, model, and artifact versions are bound to the run. |
| Review | Approval is scoped to a specific artifact, target, action class, policy, and expiry. |
| Recovery | Pause, retry, reclaim, cancellation, and stale approval behavior are explicit and testable. |
| Measurement | The system records user edits, acceptance, time-to-value, evidence coverage, and downstream outcomes without claiming causality it cannot prove. |

## Ruthless product decisions

Tayari should stop treating every existing route as a product priority. The following decisions will increase quality more than adding another standalone assistant:

1. **Make the candidate workflow the product.** Every serious action should begin from the same role snapshot, candidate snapshot, and current goal.
2. **Replace opaque scores with factor explanations.** A role match should say which hard constraints passed, which skills transferred, which evidence is missing, what is stale, and how confident the system is.
3. **Treat artifacts as a package, not isolated files.** Resume, cover letter, answers, interview drills, and follow-up drafts should share provenance and version lineage.
4. **Make every automation return a decision packet.** A run is successful only when the candidate can understand the result, inspect evidence, and choose the next safe action.
5. **Do not compete on unattended volume.** Auto-apply, broad browser control, and messaging should remain separately gated until provider, safety, receipt, and recovery evidence exists.
6. **Delete or downgrade claims that cannot be measured.** No universal hiring probability, no unsupported “interview guarantee,” and no production accuracy claim based only on synthetic fixtures.
7. **Do not add a second orchestration engine prematurely.** Extend the existing task/event/lease architecture first; compare LangGraph, Temporal, Inngest, or equivalent only through an architecture spike with a measured gap.

## Recommended implementation sequence

### Wave 1 — Candidate operating system spine

Create a shared `CareerContextSnapshot` contract containing goal version, profile version, resume version, target role identity, search constraints, and consent scope. Bind every Desktop Assist task, application packet, interview session, recommendation, and follow-up draft to this snapshot. Add a next-best-action queue that derives its items from durable states rather than page-local heuristics.

### Wave 2 — Opportunity ledger

Build a canonical posting ledger with normalized company, title, location, employment type, salary evidence, source URL, source timestamp, content hash, freshness status, provider identity, and dedupe key. Add deterministic negative filters and explainable fit factors before introducing more providers. A candidate should be able to reject a role or a reason, and that feedback should be stored as a preference signal rather than silently changing the score.

### Wave 3 — Application package studio

Create a package manifest that binds one role snapshot to a resume version, cover-letter version, answer-bank snapshot, missing-facts list, claim-level diff, provenance references, artifact hashes, review state, expiry, and export history. The UI should distinguish prepared, reviewed, approved, attempted, receipt-confirmed, and externally verified. A generated artifact should never look like proof of submission.

### Wave 4 — Adaptive interview loop

Connect Interview Prep, Voice Coach, Story Bank, and Coding Practice to the same role snapshot. Start with a transparent scorecard based on structure, evidence, clarity, concision, technical depth, and timing. Add repeated drills, “show me the improved version,” and progress deltas. Store consent and retention metadata for audio and make deletion visible.

### Wave 5 — Follow-up radar and controlled reminders

Use application timestamps and candidate-recorded states to find stale or time-sensitive items. Generate a ranked queue with reason, urgency, confidence, and missing facts. Draft messages only; require candidate confirmation of recipient, content, timing, and channel before recording a send. Notifications may remind the user, but the authenticated web control room should remain the approval surface.

### Wave 6 — Evaluation and gated provider expansion

Add golden evaluation corpora for resume parsing, job identity, semantic matching, claim preservation, prompt injection, structured output, and coaching feedback. Record model, prompt, provider, latency, cost, and user edits. Only after these metrics are stable should Tayari run one isolated ATS proof with takeover, kill switch, screenshots/events, and receipt reconciliation.

## North-star metrics

| Metric | Why it matters |
|---|---|
| Time to qualified shortlist | Measures whether search intelligence reduces noise without inflating volume. |
| Evidence coverage per recommendation | Measures whether claims are grounded in candidate or provider evidence. |
| Package review completion | Measures whether generated work is understandable and usable. |
| Candidate edit acceptance rate | Measures whether assistance preserves the candidate’s voice and facts. |
| Practice improvement delta | Measures coaching value across repeated attempts. |
| Stale-pipeline recovery rate | Measures whether follow-up automation changes the next decision. |
| Provenance completeness | Measures whether artifacts and actions can be reconstructed. |
| Approval replay/expiry violations | Measures whether the control plane is actually enforcing bounded decisions. |
| Provider freshness and dedupe accuracy | Measures opportunity intelligence quality. |
| Cost per useful decision packet | Measures economic viability better than raw token volume. |

## Final recommendation

The correct next build is not “more AI features.” It is a **candidate-controlled career operating system** with a shared context snapshot, canonical opportunity ledger, versioned application package, adaptive practice loop, follow-up radar, and a durable decision packet at every boundary.

Tayari already has many of the necessary parts. The work now is to make them compose, make them measurable, and make the evidence visible. That is the advanced product direction most likely to create durable differentiation without sacrificing trust.

## References

[1]: https://www.linkedin.com/help/linkedin/answer/a6889044 "LinkedIn Help: Discover new opportunities with AI-powered job search"

[2]: https://aclanthology.org/2026.acl-demo.52/ "ACL Anthology: JobMatchAI - An Intelligent Job Matching Platform Using Knowledge Graphs, Semantic Search and Explainable AI"

[3]: https://jobright.ai/ "Jobright: Your AI Job Search Copilot"

[4]: https://www.careerflow.ai/ "Careerflow: AI career platform"

[5]: https://docs.langchain.com/oss/python/langgraph/overview "LangGraph overview: durable execution, streaming, and human-in-the-loop orchestration"


## Current release-scope comparison

The feature registry confirms that production intentionally promotes a narrow safe spine: resume optimizer, roadmap, job search, cover letter, candidate-controlled Tay Workspace, and related context-preserving surfaces. Interview preparation, interview AI, voice coaching, generic automation control, computer control, the Desktop Agent, and Google Workspace connectors remain disabled or preview-only until their evidence gates close.

This is the correct safety posture. The product issue is that advanced capabilities exist behind many direct routes while the public story still feels like a catalog. The next release should promote only the advanced workflow that can demonstrate shared context, artifact lineage, evaluation evidence, provider freshness, and an explicit human boundary.
