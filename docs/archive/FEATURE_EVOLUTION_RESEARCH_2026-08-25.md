# Tayari Skill Boost — Feature Evolution Research

**Review date:** 25 August 2026
**Scope:** Current attached-computer repository plus parallel research across AI job-search products, career-transition systems, interview coaching, agent orchestration, and browser automation.
**Author:** Manus AI

## Executive recommendation

Tayari does not primarily need more disconnected feature pages. The repository already contains a large surface area: resume optimization, job discovery, cover letters, application tracking, career intelligence, knowledge graphs, answer reuse, networking, negotiation, portfolio generation, a review queue, One-Shot preparation, and a candidate-controlled task workspace. The strongest next move is to compose these capabilities into one **evidence-backed career operating loop**:

> **Understand the candidate → discover and verify opportunities → explain fit → prepare grounded artifacts → practice for the specific role → review and approve → track verified outcomes → learn from feedback.**

This direction is supported by current market patterns. Jobright combines matching, job-specific resume tailoring, autofill, insider connections, and a career copilot [1]. Careerflow combines resume analysis, job-fit analysis, tracking, networking, skill-gap analysis, LinkedIn optimization, and interview preparation [2]. Simplify emphasizes one profile spanning matching, tailoring, browser autofill, tracking, and recruiter introductions [3]. LinkedIn’s Career Explorer demonstrates that skills-transition guidance is more useful when it shows overlap, skills to build, transition similarity, popularity, regional jobs, and relevant connections rather than only returning a generic career suggestion [4].

The implication is strategic: **feature breadth is now table stakes; context continuity, provenance, uncertainty, candidate control, and measurable improvement are the moat.**

## What I found in the current repository

The current branch is `main` at `44fc3cf`, aligned with `origin/main`. The working tree contains existing user changes in `HANDOFF_2026-08-24.md` and `NEXT_AGENT_PROMPT.md`; those files should remain untouched. The repository’s own instructions establish strict Go/Python service separation, gateway-only frontend access, self-hosted compatibility, feature flags, owner-scoped persistence, explicit error states, durable cancellation, and a hard human-review boundary for sensitive external actions.

The public product scope is intentionally narrower than the codebase. The feature registry keeps the primary navigation focused on resume optimization, job search, cover letters, career roadmap, and the candidate-controlled task workspace. High-risk or immature capabilities such as autonomous browser submission, desktop control, broad connectors, interview AI, voice coaching, and durable automation remain disabled or preview-only in production. This is the correct safety posture.

The existing maturity review and remediation backlog already identify the important engineering gaps: a canonical application state machine, job identity and freshness, claim-level artifact provenance, versioned profile snapshots, evaluation corpora, application-bound answer reuse, measurable career plans, minimum-scope connectors, LLM cost/quality traces, and a staged browser proof. The new research confirms that these are not secondary polish items; they are the foundation that makes advanced features trustworthy.

## Research signals from the parallel tracks

| Track | Repeated external pattern | Tayari opportunity | Strategic interpretation |
|---|---|---|---|
| Product and UX | One coherent flow from profile to matched jobs, tailored materials, tracking, and follow-up [1] [2] [3] | Replace page-by-page discovery with a single next-action command center | Reduce cognitive load before adding more capability |
| AI and learning | Adaptive interview questions, structured feedback, practice history, skill-gap analysis, and personalized learning paths [2] [4] | Link each target job to an interview kit, practice loop, and skill plan | Advanced means learning from each candidate action, not merely generating text |
| Automation | Durable state, resumability, human checkpoints, persistent memory, and execution traces are core agent primitives [5] | Upgrade the Tay Workspace into a durable career-task control plane | Keep automation reviewable and recoverable instead of invisible |
| Browser execution | Mature browser-agent tooling can navigate, fill forms, extract data, use custom tools, and retain state, but also introduces credential, replay, drift, and side-effect risk [6] | Keep browser work prepare-only or isolated-preview until every acceptance gate passes | Do not equate technical capability with permission to act |
| Skills intelligence | Skills overlap, transition similarity, skills-to-build, popularity, local opportunity, and connection paths create a more actionable career graph [4] | Turn the existing knowledge graph and skill-gap radar into scenario-based plans | Explain why a target role is plausible and what closes the gap |
| Trust and economics | Products compete on speed and breadth, while Tayari’s defensible distinction is evidence, provenance, approval, and self-hosted privacy | Make every score, draft, recommendation, and receipt inspectable | Trust should be a visible product feature, not only an internal control |

## Recommended product architecture: the Career Operating Loop

### 1. Career Command Center

Create one protected home surface that shows the candidate’s current goal, active search strategy, five highest-value opportunities, pending reviews, upcoming interview preparation, stale records, and the next recommended action. It should not be another analytics dashboard. It should be a **decision queue** with a short explanation for each item and a clear “why now.”

Every card should state whether it is verified, candidate-confirmed, inferred, illustrative, or unavailable. It should also show freshness, required effort, expected value as a planning estimate, and the evidence used. This directly operationalizes the repository’s truthfulness rules and avoids the common failure mode of presenting generated recommendations as facts.

**Acceptance bar:** a candidate can open the app and reach a useful, grounded next action in under one minute without visiting more than two screens.

### 2. Explainable Opportunity Intelligence

Upgrade job search from a result list into an opportunity ledger. Each opportunity should have a canonical identity, source URL, provider, observed time, expiry/freshness state, duplicate links, hard constraints, fit factors, missing evidence, and a reasoned recommendation. Hard constraints such as location, work authorization, salary floor, employment type, and required certification must remain separate from semantic similarity.

The fit view should expose a **factorized fit matrix** instead of a single universal percentage:

| Dimension | Example output | Required evidence |
|---|---|---|
| Hard-constraint compatibility | Pass, fail, or unknown | Candidate preferences and job facts |
| Skill alignment | Strong, mixed, or weak | Resume claims and job requirements |
| Experience relevance | Evidence-backed summary | Role history and achievement links |
| Seniority alignment | Under, aligned, or over | Timeline and target level |
| Evidence strength | High, medium, or low confidence | Claim provenance and source quality |
| Opportunity freshness | Current, aging, expired, or unknown | Provider timestamp and refresh history |
| Risk flags | Missing salary, suspicious source, duplicate, or unverifiable claim | Source and parser diagnostics |

**Acceptance bar:** every recommended opportunity answers “why this role,” “what is missing,” “what would change the recommendation,” and “when was this checked?”

### 3. Application Package Studio

The existing One-Shot Console should evolve into a versioned package studio rather than a broad generation page. A package contains the exact job snapshot, profile snapshot, resume variant, cover letter, answer snapshot, outreach draft, interview kit, artifact hashes, provenance, review state, and export history. A side-by-side diff should identify every changed claim, every inserted keyword, every unresolved field, and every candidate decision.

The candidate should be able to approve individual artifacts or the package as a whole. Download and external-use actions should remain blocked when required provenance, review, or unresolved-sensitive-field conditions are missing.

**Acceptance bar:** a candidate can reproduce exactly which inputs produced a document and can reject or restore any changed claim before export.

### 4. Adaptive Interview and Evidence Coach

Interview preparation is the clearest high-value advanced feature to add after the core spine is stable. It should use the selected job, the candidate’s approved resume version, the application package, and the company evidence to generate a role-specific interview plan. The practice loop should include adaptive follow-up questions, STAR/story coverage, technical or domain drills, concise answer timing, and a post-session report that compares progress to the candidate’s previous sessions.

Voice coaching can be added later, but only with explicit recording consent, visible recording state, short retention defaults, deletion controls, language/accent evaluation, and streaming backpressure. The product should avoid live interview assistance during real interviews; preparation is safer, more defensible, and more aligned with Tayari’s review-first promise.

**Acceptance bar:** each session produces a small set of prioritized drills tied to job requirements and evidence gaps, not just generic advice. The system must measure completion and improvement without claiming that a score predicts hiring.

### 5. Skill-to-Action Career Graph

The existing knowledge graph should become a planning engine for multiple scenarios: role change, domain change, seniority increase, return to work, relocation, and compensation goals. For each scenario, display transferable skills, missing skills, evidence strength, estimated effort, recommended actions, and available roles. Record candidate feedback so the graph learns whether a recommendation was useful, irrelevant, too difficult, or already satisfied.

This is where Tayari can go beyond generic job matching. LinkedIn’s Career Explorer shows the value of presenting skill overlap, target-role similarity, skills to build, transition popularity, open jobs, and connections together [4]. Tayari can differentiate by grounding each transition in the candidate’s own evidence and exposing uncertainty instead of implying that a similarity score is a guaranteed path.

**Acceptance bar:** a candidate can select a target scenario and receive a versioned plan containing evidence, confidence, freshness, effort, and a next action.

### 6. Trustworthy Networking and Hidden-Market Preparation

The networking surface should focus on research and drafting, not automated sending. Generate a target-company brief, possible referral paths, decision-maker hypotheses, and a personalized outreach draft. For every contact or claim, show source URL, timestamp, identity confidence, relationship basis, and whether it is verified or inferred. Candidate approval should be required for every send, with duplicate detection, rate limits, wrong-recipient protection, replay protection, opt-out, and delivery receipts.

This is commercially valuable because competitors visibly emphasize insider connections and recruiter introductions [1] [3], but it is also a high-risk area for spam, privacy violations, and false identity inference. Tayari should win by making the draft more grounded and the action more controlled, not by sending more messages.

### 7. Outcome Learning Loop

The platform should learn from candidate decisions and verified outcomes. Track which opportunities were saved, rejected, applied to, interviewed for, declined, or confirmed as stale; which resume changes were accepted; which interview drills were completed; and which outreach drafts were edited or sent. Keep operational metrics, model-quality metrics, and employment outcomes separate.

Useful measures include time to first useful result, match precision on candidate-reviewed opportunities, artifact acceptance rate, unsupported-claim rate, duplicate-opportunity rate, freshness accuracy, review completion, interview-practice completion, repeat usage, cost per workflow, and verified downstream outcomes. Small samples must be reported with sample size and confidence limits; no universal “3x” or “guaranteed” claims should be introduced.

**Acceptance bar:** the system can show what improved or degraded over time and why, while clearly separating candidate-confirmed events from externally verified outcomes.

## Advanced technical layer to support the product

The next technical layer should be a **Career Workflow Control Plane** built on the existing Go gateway, Python AI services, Celery/Redis, Postgres, and review queue rather than a parallel catalog of agents.

| Control-plane capability | Required behavior | Recommended timing |
|---|---|---|
| Canonical state machine | Prepared, reviewed, candidate-confirmed, approved, attempted, receipt-confirmed, externally verified | P0 |
| Durable checkpoints | Resume after worker death, provider failure, or browser interruption without duplicating actions | P0 |
| Idempotency and reconciliation | One action ID per external side effect; reconcile receipts before retry | P0 |
| Versioned memory | Profile, goals, resume claims, job snapshot, artifact, and policy versions | P0/P1 |
| Provenance graph | Trace every output to source document, parser, prompt/model, and user decision | P1 |
| Evaluation harness | Truthfulness, prompt injection, structured output, regression, cost, latency, and refusal tests | P1 |
| Observability | Request ID, queue age, provider error, token/cost, stage latency, user-visible failure state | P1 |
| Policy engine | Action class, sensitivity, scope, approval requirement, expiry, and cancellation behavior | P0/P1 |
| Scenario planner | Goal-specific plan with evidence, confidence, freshness, effort, and feedback | P1 |
| Connector boundary | One connector at a time, minimum scope, revocation, deletion, budgets, signed webhooks | P2 |

LangGraph is a credible reference for durable execution, human-in-the-loop state modification, persistent memory, tracing, and long-running stateful agents [5]. Browser Use is a credible reference for browser interaction, structured extraction, custom tools, and persistent browser-agent operation [6]. The repository’s current backlog correctly recommends evaluating mature components such as Unstructured, browser-use, Langfuse, and Inngest before adding dependencies. The rule should remain: **benchmark against the current Celery/lease/event spine, then add a component only when the measured gap justifies its operational cost.**

## Priority sequence

| Priority | Build | Why now | Do not do yet |
|---|---|---|---|
| P0 | Career Command Center; canonical application state; opportunity identity/freshness; package manifest; reviewable next-action queue | Converts breadth into a coherent product and closes trust gaps in the main workflow | Do not expose unattended submission or broad automation |
| P1 | Factorized fit matrix; claim-level artifact diff; profile/goal snapshots; AI cost/quality traces; evaluation corpus; skill-to-action plans | Turns existing AI capability into explainable, measurable value | Do not add more agent types before shared evaluation exists |
| P1 | Adaptive role-specific interview coach in text first, with practice history and job-linked drills | Fills the largest visible user-value gap while staying review-first | Do not begin with live interview assistance or always-on voice recording |
| P1/P2 | Draft-only networking intelligence, company briefs, referral paths, source/confidence display | Uses existing networking and company-radar assets with controlled side effects | Do not auto-send outreach or infer identities without confidence and source data |
| P2 | One isolated browser proof for one allowlisted ATS; candidate takeover for sensitive fields; receipt reconciliation | Tests a real advanced capability without expanding risk surface | Do not generalize to many ATSs or enable autonomous final submission |
| P2 | Narrow read-only connectors, beginning with one provider | Adds workflow continuity only after the core data contract is stable | Do not enable broad OAuth scopes, messaging approval, or silent sync |
| P3 | Social graph expansion, gamification expansion, general desktop automation, broad A2A federation, unattended AutoPilot | These are expensive and multiply privacy/support risk | Defer until retention, trust, and contribution margin are measured |

## Product north-star metrics

| Metric | Definition | Why it matters |
|---|---|---|
| Time to first useful result | Time from onboarding or resume upload to first candidate-accepted recommendation or artifact | Measures whether the product is immediately useful |
| Candidate review completion | Share of generated packages with a completed candidate review | Measures whether the review-first UX works |
| Evidence coverage | Share of claims, scores, recommendations, and artifacts with provenance and freshness | Measures the trust moat |
| Unsupported-claim rate | Share of generated claims rejected by automated or candidate review | Measures truthfulness quality |
| Match precision | Share of candidate-reviewed opportunities marked useful or relevant | Measures job discovery quality without pretending to predict hiring |
| Artifact acceptance rate | Share of suggested edits retained by candidates | Measures grounded usefulness of generation |
| Practice loop completion | Share of candidates completing a job-linked interview drill and returning for another | Measures recurring value |
| Verified outcome rate | Share of candidate-confirmed outcomes with external evidence or receipt | Separates real outcomes from self-reported states |
| Repeat workflow rate | Share of users returning for a second application or career task | Tests whether Tayari is an operating system rather than a one-time resume tool |
| Variable cost per useful workflow | Attributed model, provider, storage, browser, and support cost per useful result | Protects profitability before scaling breadth |

## Final position

Tayari should become **the reviewable, evidence-backed career operating system** rather than another AI job-application generator. The current codebase already has the ingredients. The next phase should make them feel like one product: one goal, one opportunity ledger, one evidence-bound package, one review queue, one role-specific preparation loop, and one outcome history.

The most advanced feature is not an agent that submits more applications. It is a system that can explain what it knows, show what it does not know, preserve the candidate’s facts, ask for approval at the right moment, recover safely from failure, and improve recommendations from verified feedback.

## References

[1]: https://jobright.ai/ "Jobright — AI job search copilot"
[2]: https://www.careerflow.ai/ "Careerflow — AI career platform"
[3]: https://simplify.jobs/ "Simplify — AI job search partner"
[4]: https://linkedin.github.io/career-explorer/ "LinkedIn Career Explorer — skills-based job transitions"
[5]: https://github.com/langchain-ai/langgraph "LangGraph — stateful agent orchestration"
[6]: https://github.com/browser-use/browser-use "Browser Use — browser automation for AI agents"
[7]: https://github.com/Unstructured-IO/unstructured "Unstructured — document processing"
[8]: https://github.com/langfuse/langfuse "Langfuse — LLM observability and evaluations"
[9]: https://github.com/inngest/inngest "Inngest — durable event-driven workflows"

## Repository evidence

- [Tayari README](README.md)
- [Feature registry](src/config/features.ts)
- [Current remediation backlog](TAYARI_REMEDIATION_TODOS.md)
- [End-to-end maturity review](docs/reports/jobtayari-end-to-end-maturity-review-2026-08-25.md)
