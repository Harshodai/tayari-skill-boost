# JobTayari Feature-by-Feature Product Audit

**Audit date:** 19 August 2026
**Repository state audited:** `main` at `6a303e0`
**Scope:** Frontend routes and flags, Go gateway, Python/FastAPI services and workers, database migrations, integrations, tests, deployment controls, and release evidence.

> **Executive verdict:** JobTayari is a broad, unusually serious **career-operations platform foundation**, not a single finished automation product. Its strongest production-grade assets are the candidate-controlled resume/application preparation spine, provider-governance controls, provenance/evidence model, multi-tenant security work, and release-contract discipline. Its weakest areas are the features that imply external execution: browser computer, desktop agent, autonomous application submission, durable provider/webhook operations, Google connectors, live staging recovery, and several coaching/social surfaces that are implemented but not fully proven.

## 1. How to read this audit

A feature is marked **Verified local** when the repository contains a coherent implementation and automated evidence. **Implemented, not production-proven** means the code path exists but live credentials, deployed infrastructure, provider behavior, or hostile isolation evidence is missing. **Preview-only** means the UI intentionally exposes a restricted or offline surface. **Disabled** means the canonical production and preview flags are off. **Foundational** means the feature is real and valuable but is an underlying platform capability rather than a finished end-user product.

The repository itself explicitly says that the current release focus is resume tailoring, opportunity triage, cover-letter drafting, and candidate-controlled review; secondary automation, desktop, extension, and coaching surfaces remain internal evaluation capabilities until live evidence gates close. The authoritative project status remains **INTERNAL DEMO ONLY**, not public onboarding.[1]

## 2. Overall product map

| Product plane | Features | Current assessment | Best strategic move |
|---|---|---|---|
| Candidate preparation | Resume ingestion, optimizer, ATS analysis, variants, Typst export, cover letters, answer bank | Strongest product area; mostly coherent and candidate-controlled | Make this the commercial wedge and prove source-to-artifact reliability with integration fixtures |
| Opportunity intelligence | Hermes scraping, ATS providers, ranking, saved jobs, skill gaps, company radar | Broad and technically interesting, but freshness, provider, and live-source evidence are incomplete | Build a canonical job-posting and freshness ledger with deduplication and replayable source evidence |
| Review and governance | Approvals, questions, handoffs, receipts, provenance, truth gates, privacy ledger | Strong architecture and security posture; user experience and end-to-end evidence still need expansion | Make every status event and generated artifact traceable in one review center |
| External execution | Browser agent, computer control, desktop, apply agent, AutoPilot | High-risk and not launch-ready; some surfaces honestly redirect or stay preview-only | Keep disabled until isolated workers, takeover, kill, receipt verification, and recovery are proven in staging |
| Career intelligence | Roadmap, career intelligence, trajectory, skill gaps, negotiation, portfolio, recruiter outreach | Many usable modules; outcome quality and paid retention are unproven | Connect recommendations to versioned goals, evidence gaps, measurable progress, and candidate decisions |
| Knowledge and communications | Omnisave, knowledge graph, Gmail, Google Workspace, email/WhatsApp/push | Foundations exist; permissions, minimization, provider evidence, and operational contracts are incomplete | Minimize connector scopes and make the web control room the only approval surface |
| Agent platform | AgentSpace, A2A, MCP, automation catalog, durable runs/events/leases | Architecturally advanced; production federation and external connector proof remain incomplete | Ship a narrow signed task/event protocol with conformance tests before adding more agents |
| Platform operations | Auth, tenancy, RLS, observability, backups, Docker/Supabase, release contract | Strong static controls; live hostile staging and recovery remain required | Treat staging evidence as a product deliverable, not as optional infrastructure work |

## 3. Feature flags and public-surface reality

The canonical registry contains 29 named flags. The most important product truth is that **a flag being enabled is not equivalent to a feature being production-ready**. The registry enables many secondary pages, while `primaryNavigationKeys` intentionally narrows the promoted release to resume optimizer, job search, cover letter, and career roadmap. Several direct routes remain available for internal evaluation, and `settings.enableAllRoutes` is still true. This creates a documentation and product-surface risk: users can discover capabilities that are not held to the same evidence bar as the primary release.

| Flag group | Current registry state | Audit interpretation |
|---|---|---|
| Enabled in production and preview | `resumeOptimizer`, `careerRoadmap`, `jobSearch`, `blog`, `pricing`, `coverLetter`, `communicationHub`, `negotiationCopilot`, `companyRadar`, `portfolioGenerator`, `browserExtension`, `knowledgeHub`, `careerOps`, `oneShotPipeline`, `typstStudio`, `candidateAnswerBank`, `agentReach`, `verification`, `referralDrafts` | These are visible or reachable, but maturity varies significantly. Each needs a feature-level evidence contract. |
| Disabled in both modes | `interviewPrep`, `googleCalendar`, `googleDrive`, `automationControl`, `interviewAI`, `voiceCoach` | Correctly held back by current release scope; do not enable based on UI completeness alone. |
| Preview-only | `careers`, `help`, `computerControl`, `desktopAgent` | Appropriate for controlled evaluation, but must be inaccessible or clearly labelled in production. |
| Contract-drift candidate | `Footer.tsx` references `features.autoPilot`, while the canonical registry shown in `features.ts` does not define `autoPilot` | Add typed feature-key contract tests and remove undefined references. |

## 4. Feature-by-feature audit

### 4.1 Identity, authentication, and account lifecycle

**What it is.** The product supports registration, login, password reset, OAuth callback flows, protected routes, Supabase Auth/self-hosted modes, rate limiting, breach checks, and account deletion/privacy flows. The Go gateway owns authentication and routing, while the frontend uses protected routes and a central API client.

**Current maturity: Implemented, locally verified; production evidence incomplete.** The repository has Go authentication routes, Supabase integration, password-reset migrations, rate-limit tests, auth boundary tests, and E2E registration/login coverage. The important remaining risk is environment parity: the project supports both Supabase-auth and self-hosted JWT modes, so both must be exercised against the same owner and tenant contracts.

**Best next action.** Create one canonical authentication contract test matrix covering registration, login, refresh/expiry, password reset, OAuth callback, 401 token clearing, account deletion, and self-hosted/cloud mode parity. Add two-user negative tests through the real gateway rather than trusting unit-level owner predicates.

### 4.2 Multi-tenancy, ownership, and RLS

**What it is.** Candidate and tenant ownership are represented in PostgreSQL, with RLS, grants, membership checks, service-only tables, tenant branding, and owner-scoped route behavior. Recent work added `saved_jobs` RLS and durable `external_research_runs` ownership.

**Current maturity: Strong static posture; live proof incomplete.** The RLS verifier and release contract pass, and the repository has two-user isolation tooling. The project status still correctly lists live hostile staging and cross-tenant negatives as launch blockers. A static policy is not proof that the real gateway, JWT claims, PostgREST role, and runtime query all agree.

**Best next action.** Make a disposable two-tenant suite mandatory for every public table class: candidate-owned, tenant-owned, service-only, and shared aggregate. Exercise read, insert, update, delete, cancellation, artifact retrieval, notifications, and provider-run status through the Go gateway and Data API.

### 4.3 Onboarding, profile, career goals, and transition planning

**What it is.** Onboarding captures identity, resume, current and target roles, industry, level, location, transition type, and career goals. Profile editing and career-goal migrations support later intelligence features.

**Current maturity: Foundational and useful; downstream differentiation incomplete.** The profile and goal data exist, but a generic transition field is not yet enough to prove that job change, domain change, level change, return-to-work, or relocation materially alter recommendations.

**Best next action.** Version profile and goal snapshots, attach every recommendation and agent run to the exact version used, and create transition-specific plans for evidence gaps, job sources, portfolio, interview preparation, and cadence.

### 4.4 Resume ingestion and parsing

**What it is.** Resume upload, PDF/DOCX preview, text extraction, OCR/extraction fallbacks, analysis history, public source import, and resume storage are present. The frontend has dedicated upload, preview, result, and template surfaces.

**Current maturity: Implemented, locally verified; source-format reliability needs stronger proof.** The product supports the intended input paths, but extraction failures, unusual PDFs, scanned documents, malformed DOCX files, and source snapshots require explicit integration evidence.

**Best next action.** Build a versioned fixture corpus for clean PDF, scanned PDF, DOCX, malformed files, multilingual content, tables, columns, links, and long resumes. Store the source hash, parser version, extracted text hash, and user-visible extraction warnings.

### 4.5 Reflective resume optimizer and truth gates

**What it is.** The optimizer compares a resume against a target job, performs iterative scoring, generates improvement suggestions, detects keyword stuffing/PII/truth issues, and applies a pipeline gate before an artifact is emitted.

**Current maturity: One of the strongest features; quality still needs benchmark evidence.** The codebase contains optimizer, ATS, guardrail, truthfulness, and provenance services. The E2E suite exercises a truth-check path. The remaining problem is not whether an LLM can generate text; it is whether the output preserves candidate truth across diverse jobs and repeated runs.

**Best next action.** Add a golden evaluation set with human-labelled claims, quantified achievements, skill additions, omissions, and hallucination traps. Require claim-level diffs, candidate confirmation for changed facts, stable model/prompt metadata, and a regression threshold before model or prompt changes.

### 4.6 ATS detection, simulation, scoring, and resume variants

**What it is.** ATS vendor detection covers Greenhouse, Lever, Ashby, BambooHR, Workday, and related signatures. The platform includes ATS scoring, tiered ATS logic, simulator behavior, resume variants, templates, PDF/DOCX generation, and Typst Resume Studio.

**Current maturity: Broadly implemented; external compatibility not fully proven.** The API/E2E layer can identify ATS signatures, and the document surfaces are substantial. The risk is overclaiming a universal ATS score or assuming vendor detection equals successful submission compatibility.

**Best next action.** Separate three concepts: parser compatibility, job-specific relevance, and portal submission compatibility. Maintain vendor fixtures, render/parse round-trip tests, visual regression for exported documents, and a clear UI label that scores are estimates rather than hiring predictions.

### 4.7 Cover-letter and application-artifact generation

**What it is.** Cover-letter drafting, application package preparation, candidate review, document export, provenance badges, receipt cards, and evidence-backed artifacts are present.

**Current maturity: Candidate-controlled and appropriate for the current release.** This is aligned with the stated product focus because it prepares material without silently submitting external applications. The strongest opportunity is to make every artifact versioned, diffable, source-grounded, and approval-bound.

**Best next action.** Introduce an artifact review center with claim diffs, source references, approval hash, expiration, export history, and a separate `drafted`, `candidate_confirmed`, `submitted`, and `externally_verified` state. Never collapse these states into one success label.

### 4.8 Job search and Hermes scraping

**What it is.** Hermes provides a tiered job-discovery pipeline: keyless ATS JSON for supported boards, Firecrawl/SerpApi, Apify, and Crawl4AI/Playwright fallback. Provider routing, normalization, circuit breakers, rate limiting, caching, domain rules, and a hybrid ranking design are present.

**Current maturity: Technically ambitious; operationally incomplete.** The tiered architecture and provider abstractions are valuable differentiators. The remaining gaps are canonical freshness, deduplication, source drift, cost controls, job deletion/expiry, reproducible source evidence, and live provider measurements.

**Best next action.** Create a canonical `job_posting` identity and freshness ledger. Every result should carry source URL, provider, observed time, content hash, first-seen/last-seen timestamps, expiration reason, deduplication key, and ranking explanation. Add replayable provider fixtures and provider-specific budgets.

### 4.9 External Firecrawl and Apify research adapters

**What it is.** Firecrawl search/crawl/batch-scrape and Apify Actor lifecycle adapters now have approved-host enforcement, credentials fail-closed behavior, retries, polling, pagination, dataset fetching, sanitation, provenance, durable Apify job state, and remote abort handling.

**Current maturity: Locally strong; live-provider and webhook evidence missing.** The last parity remediation reached 16 focused tests and preserved the full release contract. The environment had no live credentials or staging target, so latency, provider-specific response variants, webhook delivery, and restart/reclaim behavior remain unverified.

**Best next action.** Add durable Firecrawl jobs and signed webhook receivers, run live credential smoke tests in disposable staging, measure P50/P95 latency and 429/5xx behavior, enforce per-tenant cost/volume budgets, and add provider health dashboards.

### 4.10 Saved jobs, application pipeline, and outcomes

**What it is.** The frontend has saved jobs, pipeline cards, application analytics, outcomes, feedback, receipts, and a Boomerang passive-monitoring concept. The database has owner-scoped saved jobs and application-related tables.

**Current maturity: Core workflow exists; verified external outcome loop is incomplete.** Candidate review and tracking are stronger than autonomous submission. The project must distinguish candidate-recorded outcomes from portal-verified outcomes.

**Best next action.** Make the pipeline an evidence state machine with normalized job identity, artifact version, approval reference, browser run, submission attempt, external receipt, verification state, follow-up schedule, and reconciliation before retry.

### 4.11 One-Shot Pipeline and AutoPilot

**What it is.** One-Shot provides a compact candidate workflow from objective to prepared outputs. AutoPilot and career-ops services schedule or orchestrate discovery, matching, drafting, questions, and review.

**Current maturity: Implemented evaluation surface; not autonomous production execution.** Server-side safeguards keep autonomous submission disabled by default, and recent automation work added leases, events, action registries, and approvals. Nonetheless, the product should not market AutoPilot as an unattended application agent until the browser, receipt, and recovery gates pass.

**Best next action.** Split the product into explicit modes: `prepare`, `review`, `candidate takeover`, and `verified external action`. Each mode should have separate permissions, costs, observability, and kill semantics. Keep prepare/review as the public default.

### 4.12 Browser agent and Tayari Computer control room

**What it is.** The Python browser automation layer uses browser-use/Playwright patterns, per-run sessions, origin guards, action policy, cancellation, computer grants, and a control-room UI. The stop flow now terminates the server-side session rather than merely closing an SSE reader.

**Current maturity: Preview/offline and high risk.** The UI is intentionally honest that the computer surface is preview/staging-only. The feature is not a proven isolated, multi-tenant, credential-safe browser worker in production.

**Best next action.** Prove one allowlisted ATS end to end in disposable staging: per-run worker isolation, no credential persistence, user takeover for sensitive fields, server kill switch, cancellation polling, replay-safe action IDs, screenshots/events, ambiguous-state pause, and receipt reconciliation. Do not expand portal coverage before that proof.

### 4.13 Desktop Agent and extension

**What it is.** Desktop Agent routes, task control room, desktop-download metadata, native-host/extension onboarding, and browser-extension surfaces exist.

**Current maturity: Preview/internal evaluation.** The repository contains an architectural surface but not the complete persistent desktop runtime and credentialed macOS distribution evidence required for public release. The status document explicitly lists notarization/signing and persistent-worker evidence as outstanding.

**Best next action.** Define one supported desktop lifecycle: install, authenticate, receive task, pause, takeover, stop, update, uninstall, and revoke. Prove code signing/notarization, local secret handling, extension-to-gateway auth, offline behavior, upgrade rollback, and task ownership before exposing it publicly.

### 4.14 Candidate Answer Bank and sensitive-answer controls

**What it is.** The Answer Bank stores candidate answers with application context, category matching, confirmation, expiry and sensitivity controls. The E2E suite exercises saving a sensitive answer and matching it to a question.

**Current maturity: Strong governance foundation; real-portal autofill remains unproven.** The repository lessons explicitly prohibit silently reusing sensitive answers for a new application and require current user confirmation.

**Best next action.** Require a per-application answer snapshot, version, candidate confirmation receipt, expiry, sensitivity class, and audit event. Test database outage, stale answer, changed question key, cross-user access, and browser cancellation. Never let an LLM or browser agent bypass this service.

### 4.15 Agent Questions, review queue, approvals, and human handoffs

**What it is.** Durable questions, review queue, approval drawer, handoff service, approval gates, expiry/replay controls, and candidate-facing review surfaces pause work when the system needs a human decision.

**Current maturity: One of the most important platform strengths; UX and end-to-end replay proof need continued expansion.** The architecture recognizes that approval is not equivalent to external success and that sensitive decisions must stay with the candidate.

**Best next action.** Make every approval bound to user, tenant, job, artifact hash, portal, action class, expiration, and policy version. Add a single review center with clear diff, evidence, risk, and “what will happen next” language.

### 4.16 Interview board, interview experiences, preparation, and coding practice

**What it is.** Interview board/kanban, experience capture, question queues, coding practice, prep pages, answer generation, and interview-related persistence exist.

**Current maturity: Mixed.** The board and experience-capture workflows are plausible product features. `interviewPrep` is disabled in the canonical release flag, while direct interview routes and internal components remain present. This is a classic example of a feature being implemented but not release-promoted.

**Best next action.** Keep preparation disabled until a content-quality evaluation set, grounded candidate-profile use, privacy review, and user outcome metrics exist. Separate static practice content from AI-generated coaching and label both clearly.

### 4.17 Interview AI, live voice coach, transcription, and sentiment analysis

**What it is.** Services exist for interview AI, live interview copilot, transcription, voice coaching, response sentiment analysis, and voice streaming.

**Current maturity: Disabled/not production-proven.** These features involve sensitive audio, latency, model quality, storage, and consent risks. The flags are off, which is appropriate.

**Best next action.** Before enabling, implement explicit recording consent, retention/deletion, visible recording state, streaming backpressure, redacted logs, language/accent evaluation, and a strict distinction between coaching suggestions and objective interview assessment.

### 4.18 Career roadmap, career intelligence, and trajectory prediction

**What it is.** Roadmap planning, career intelligence, trajectory prediction, goal transitions, recommendations, and skill-gap linking use profile and job signals.

**Current maturity: Enabled and useful foundation; recommendation validity unproven.** The roadmap is part of the primary surface, but its value depends on grounded profile versions, job evidence, and measurable changes rather than generic motivational output.

**Best next action.** Make each recommendation explain its evidence, confidence, freshness, and expected effort. Track plan version, completed action, outcome, and candidate feedback. Evaluate recommendations separately for job change, domain change, seniority change, and return-to-work.

### 4.19 Skill-gap radar, taxonomy, library, and learning recommender

**What it is.** Skill extraction, taxonomy mapping, gap analysis, radar visualization, skill libraries, and learning recommendations connect resume/job evidence to career development.

**Current maturity: Implemented evaluation capability.** The architecture is stronger than a simple keyword list because it includes graph/taxonomy and candidate context. The main risk is false precision: a radar score can look objective without a validated benchmark.

**Best next action.** Preserve evidence links from every skill claim to resume text, job postings, or candidate confirmation. Provide uncertainty and “why this gap” explanations. Measure whether recommendations lead to completed portfolio/interview/job-search actions.

### 4.20 Company Radar and job-sentinel monitoring

**What it is.** Company Radar provides company monitoring and scheduled job-sentinel concepts, with company intelligence and watch-related services.

**Current maturity: Enabled but not end-to-end proven.** It needs provider freshness, deduplication, notification reliability, watch ownership, source terms compliance, and cost control before becoming a dependable alert product.

**Best next action.** Ship a narrow watch contract: allowlisted source, polling cadence, change hash, deduplicated alert, pause/unsubscribe, delivery receipt, and audit trail. Do not imply that every company or source is continuously monitored.

### 4.21 Negotiation Copilot, offer calculator, and compensation intelligence

**What it is.** Offer calculation, four-year NPV-style compensation breakdown, negotiation copilot, benchmark inputs, and negotiation UI exist.

**Current maturity: Useful calculator; advice must remain explicitly advisory.** The arithmetic path is testable, but benchmark freshness, tax assumptions, equity uncertainty, geographic cost indexes, and legal/financial interpretation create risk.

**Best next action.** Show assumptions and sensitivity ranges, not a single authoritative number. Version benchmark sources, timestamp inputs, disclose uncertainty, and add “not financial/legal advice” boundaries. Separate deterministic calculation from AI negotiation language.

### 4.22 Recruiter intelligence, outreach, networking, and referral drafts

**What it is.** Recruiter lookup, email-pattern suggestions, cold outreach, recruiter outreach, networking, referral service, and personalized referral drafts are present.

**Current maturity: Drafting capability; external-contact safety incomplete.** The E2E suite exercises recruiter lookup and template generation. Draft generation is lower risk than sending, but identity inference, personal data, spam, and consent must be controlled.

**Best next action.** Keep all communications in draft mode by default. Add source provenance, confidence, opt-out, domain verification, rate limits, duplicate prevention, candidate review, and explicit send confirmation. Never claim a recruiter relationship or email deliverability without evidence.

### 4.23 Portfolio generator and Typst Resume Studio

**What it is.** Portfolio generation and Typst-based resume authoring/export provide polished candidate artifacts beyond a single resume file.

**Current maturity: Enabled and promising; export/render evidence should be deeper.** The feature has meaningful differentiation, particularly if it keeps claims grounded and produces stable, portable artifacts.

**Best next action.** Add deterministic render snapshots, accessibility checks, link validation, source-to-claim provenance, versioned exports, and a candidate preview/diff workflow. Treat generated portfolio content as an artifact requiring truth review.

### 4.24 Omnisave, knowledge hub, memory, and knowledge graph

**What it is.** Omnisave captures candidate-provided public URLs, extracts evidence/briefs, stores embeddings/metadata, supports a knowledge hub, memory composition, graph extraction, citations, and grounded Q&A.

**Current maturity: Partially implemented and strategically important.** The system can organize and query content explicitly provided by a candidate. It does not prove silent synchronization of saved lists from Substack, Medium, LinkedIn, or other platforms, and it should not attempt that without authorized integrations or exports.[2]

**Best next action.** Make source ownership, retention, deletion, collection purpose, embedding deletion, citation quality, and answer-grounding evaluation first-class. Add import/export contracts rather than scraping private saved lists.

### 4.25 LinkedIn import, social graph, verification, and gamification

**What it is.** LinkedIn import/analyzer/policy services, connections, social graph, referral relationships, verified-human badge, achievements, streaks, pet/gamification, and outcome sharing are present.

**Current maturity: Mixed and secondary.** Verification and social features can improve trust and engagement, but LinkedIn access, identity claims, profile data, moderation, and platform terms are high-risk. Gamification is not a substitute for job-search outcomes.

**Best next action.** Restrict social imports to user-authorized data/export flows, display provenance and verification scope, add moderation/deletion, and measure whether gamification improves useful behaviors rather than vanity activity.

### 4.26 Gmail interview ingestion

**What it is.** Gmail OAuth routes, interview-focused email processing, classification, notifications, and calendar-related email workflows exist.

**Current maturity: Partially implemented; privacy minimization is not yet fully proven.** The audit documentation correctly notes that `gmail.readonly` is broad and does not itself enforce “interview email only.”

**Best next action.** Enforce server-side user-selected query, date window, labels, maximum message count, content minimization, disconnect, deletion, and audit logs. Add tests that prove messages outside the declared scope are neither fetched nor retained.

### 4.27 Google Calendar and Drive

**What it is.** Go/Python routes, OAuth callbacks, migrations, UI connection cards, Calendar event and Drive file abstractions exist.

**Current maturity: Disabled and provider-evidence blocked.** The feature flags are false in both production and preview. This is correct until token storage, scope minimization, revocation, sync ownership, webhook renewal, and real provider tests are complete.

**Best next action.** Enable one connector at a time, start with read-only narrow scopes, prove connect/list/disconnect/delete/revoke/expired-token flows in disposable Google accounts, and never allow Calendar/Drive content to become an implicit approval channel.

### 4.28 Communication hub, email, WhatsApp, push, and notifications

**What it is.** Communication templates, email/WhatsApp webhooks, push registration/sending, notification preferences, delivery ledger, email classifier, and delivery events exist. The product has architectural plans for official WhatsApp Cloud API and Telegram-style status controls.

**Current maturity: Draft/notification foundation; sensitive approval delivery not yet a launch-grade replacement for the web control room.** The repository correctly treats messaging as status and handoff support, not as final approval for sensitive actions.

**Best next action.** Use the authenticated web control room as the sole approval surface. Messaging may notify and deep-link, but must include signed account linking, opt-out, template compliance, replay protection, delivery receipts, rate limits, and no sensitive-answer collection.

### 4.29 AgentSpace, agent router, tasks, and worker automation

**What it is.** Agent creation, instructions, task queues, task attempts, router events, Celery workers, automation catalog, automation engine, recurring schedules, durable events, leases, reclaim counters, and worker heartbeats exist.

**Current maturity: Architecturally advanced; deployment recovery still incomplete.** The code has real control-plane concepts rather than only UI buttons. The remaining gap is operational proof under worker death, queue outage, duplicate delivery, clock skew, database outage, and partial provider completion.

**Best next action.** Define one canonical task state machine and make every worker task idempotent. Add forced worker termination/restart tests, reclaim evidence, dead-letter handling, operator replay, and alert thresholds. Do not add more automation types until the existing spine passes failure drills.

### 4.30 A2A federation

**What it is.** A2A routes, HMAC message integrity, replay protection, peer identity binding, peer-to-method allowlists, and scoped Agent Card disclosure are implemented.

**Current maturity: Strong security mechanism; federation readiness not proven.** The local fixes address message integrity and peer scoping. Production federation still requires real peer registration, key rotation, trust onboarding, capability revocation, clock/replay policy, incident response, and cross-organization contract tests.

**Best next action.** Publish a versioned peer conformance suite and a deny-by-default federation registry. Require key rotation, nonce/timestamp policy, per-peer quotas, audit trails, and explicit human approval for any action that can affect candidate data or external systems.

### 4.31 MCP tools and governance

**What it is.** MCP tools include saving jobs, adding pipeline entries, resume optimization, cover letters, and outcome reporting. The authoritative TypeScript sources enforce write capability governance, and the generated Supabase MCP bundle is derived from them.

**Current maturity: Governance hardened; external ecosystem claims unproven.** The source-of-truth correction is important because generated bundles can otherwise lose security controls. The remaining risk is tool-level data minimization, tenant ownership, consent, audit, version compatibility, and third-party server trust.

**Best next action.** Add generated-bundle drift checks, MCP schema/version conformance, per-tool input/output allowlists, tenant-owner tests, rate limits, signed invocation receipts, and a kill switch for individual tools or servers.

### 4.32 AI services, LLM routing, embeddings, grounding, and prompt safety

**What it is.** LLM service abstraction, OpenRouter/Ollama/OpenAI-compatible configuration, embeddings, storage, token compression, grounding, prompt safety, injection detection, circuit breakers, and model metadata are present.

**Current maturity: Foundational platform capability; model-quality and cost evidence incomplete.** The abstraction supports multiple providers, but the product needs model/version cost, latency, failure, and quality observability to make safe routing decisions.

**Best next action.** Record model/provider/prompt version, input/output hashes, latency, token/cost estimates, safety outcomes, and fallback path for every user-visible AI artifact. Add a red-team corpus for prompt injection, data exfiltration, tool abuse, and source poisoning.

### 4.33 AI provenance and EU-oriented content records

**What it is.** Provenance artifacts, artifact versions, origin events, disclosure records, hashes, producer type, event type, and provenance badges support machine-readable origin records for generated content.

**Current maturity: Strong compliance foundation; organization-wide retrieval and disclosure UX remains incomplete.** The key design is correct: provenance must be a declared property of an artifact, not merely a hidden log. The next challenge is making it queryable, understandable, exportable, and attached to every relevant artifact type.

**Best next action.** Define a stable provenance vocabulary and retention policy, expose “human-written,” “AI-assisted,” and “machine-generated” states with evidence, support export/deletion, and add coverage checks ensuring every generated artifact has an origin event before it is downloadable or shared.

### 4.34 Analytics, route telemetry, predictive funnel, and bandit learning

**What it is.** Route analytics, application-performance metrics, funnel analytics, predictive scoring, bandit statistics, pattern analysis, and outcome analytics are present.

**Current maturity: Instrumentation exists; decision quality and privacy need proof.** Analytics can describe activity but should not be treated as evidence of user value or employment outcomes. Bandit/predictive systems also need careful monitoring for feedback loops and unfair recommendations.

**Best next action.** Separate operational telemetry from product analytics and model evaluation. Add consent, retention, aggregation, cohort fairness checks, counterfactual evaluation where possible, and metrics such as activation, review completion, verified outcome quality, cost-to-serve, and retention.

### 4.35 Privacy, deletion, security, and compliance controls

**What it is.** Privacy checks, privacy ledger, deletion/purge routes, audit tables, security scanner, password breach checking, secret-table RLS, provenance, and production release gates exist.

**Current maturity: Strong code-level posture; live operational evidence remains the gap.** The repository has more security machinery than most prototypes, including forward migrations and explicit fail-closed checks. The project status correctly refuses to treat static green gates as sufficient for public launch.

**Best next action.** Run recurring two-user, deletion, backup/restore, queue-outage, redacted-log, browser-cancellation, and secret-rotation drills in a disposable staging environment. Publish evidence bundles with timestamps, commit, environment, expected result, observed result, and operator sign-off.

### 4.36 Deployment, Docker/Supabase, health, observability, backup, and recovery

**What it is.** Docker Compose environments, self-hosted Supabase, Go/Python health and readiness probes, Redis/Celery, Flower, Caddy, AWS canary files, immutable image checks, backups, restore drills, staging hostile suite, and release-contract scripts exist.

**Current maturity: Strong release discipline; environment-dependent gates still block launch.** The latest recorded release contract passed 46/46, while the repository’s authoritative status still lists live hostile staging, recovery, rollback, route inventory, and credentialed desktop evidence as required.

**Best next action.** Treat a staging evidence bundle as the next release milestone: worker kill/restart, lease reclaim, duplicate event, database outage, restore, rollback, cross-tenant negative, browser cancellation, and alert verification. Do not widen public flags until that bundle is attached to the release commit.

## 5. Highest-priority roadmap

| Priority | Work | Why it comes first | Exit evidence |
|---|---|---|---|
| P0 | Make the current candidate-controlled spine the public product | It is the clearest value proposition and has the strongest safety boundary | Resume/job/cover-letter flow works with source provenance, truth gate, artifact review, and candidate confirmation |
| P0 | Complete live staging isolation and recovery | A large feature count is irrelevant if users or workers can cross boundaries or lose state | Two-user negatives, worker kill/restart, queue outage, restore, rollback, and alert proofs |
| P0 | Canonical application state and receipt reconciliation | Prevents false “applied” claims and duplicate external actions | Every status maps to event/artifact/approval/receipt evidence |
| P1 | Harden provider operations | Firecrawl/Apify and Hermes are strategic but provider drift and cost can damage reliability | Live credentials, latency/error dashboards, budget controls, webhook/retry tests |
| P1 | Turn career intelligence into measurable plans | Converts many AI modules into one coherent user outcome | Versioned goals, evidence-backed recommendations, action completion and feedback |
| P1 | Minimize Google/Gmail and messaging scopes | Connectors create the largest privacy and operational exposure | Narrow scopes, server-side filters, deletion/revocation, signed webhooks, audit evidence |
| P2 | Release one isolated ATS browser proof | Browser execution is the highest-risk differentiator | Candidate takeover, stop/kill, no credential retention, receipt verification, replay safety |
| P2 | Consolidate agent/A2A/MCP contracts | Prevents platform sprawl and incompatible “agent” surfaces | Versioned conformance tests, registry, revocation, per-tool policy, signed receipts |
| P2 | Decide what to disable or delete | Reduces misleading surface area and support cost | Only evidence-backed features appear in production navigation; stale routes are measured and removed |

## 6. Ruthless product decisions

First, do not market JobTayari as an autonomous mass-application system. The repository is strongest as a **truthful, evidence-backed career operating system** that helps a candidate discover opportunities, improve materials, prepare, review, and then control any external action.

Second, stop equating page count with product depth. There are many pages, services, integrations, and flags, but the product becomes more valuable when one candidate journey is coherent: goal version → resume/source evidence → job identity → fit explanation → artifact draft → candidate review → approved next action → verifiable outcome.

Third, do not enable every technically implemented feature. Keep Google Workspace, interview AI, voice coaching, automation workspace, computer control, and desktop surfaces gated until their own evidence contracts pass. A smaller truthful product is stronger than a large ambiguous one.

Finally, make the evidence plane the product moat. Every generated claim, recommendation, action, and outcome should answer: **what source or user input supports this, which version produced it, who approved it, what happened externally, and can the result be revoked or deleted?**

## References

[1] [Current project status](../PROJECT_STATUS.md)
[2] [Repository README and release focus](../../README.md)
[3] [Canonical feature flags and navigation](../../src/config/features.ts)
[4] [Application route registration](../../src/App.tsx)
[5] [Repository contribution and production rules](../../.agents/AGENTS.md)
[6] [Repository lessons and prior hardening findings](../../.agents/lessons.md)
[7] [Final product audit](../JOB_TAYARI_FINAL_PRODUCT_AUDIT.md)
[8] [Latest Apify/Firecrawl parity report](jobtayari-apify-firecrawl-parity-2026-08-19.md)
[9] [E2E feature verification suite](../../e2e/all_features.spec.ts)


## 7. Remediation snapshot from the current hardening pass

The current hardening pass made two concrete corrections from this audit. First, the footer’s AutoPilot link now uses the canonical `jobSearch` feature flag rather than the undefined `features.autoPilot` reference. A recursive TypeScript/TSX feature-reference contract now prevents future references to undefined canonical flags; the focused feature suite passes with 8/8 tests.

Second, Gmail sync now accepts a candidate-selected, server-enforced scope containing a bounded search query, optional `YYYY-MM-DD` after/before dates, and a maximum of 50 results. The server rejects multiline or oversized queries, forbids `in:anywhere`, rejects invalid or reversed date windows, limits the date range to 90 days, and retains a safe interview/job default. The Interview Board exposes the query and date-window controls, while the existing one-click path still uses the safe default. Go route tests cover defaults, valid bounded scopes, forbidden broad searches, malformed dates, reversed windows, excessive windows, and result-limit violations.

These changes improve **feature-surface truthfulness** and **Gmail data minimization**, but they do not close the remaining environment-dependent launch gates. Live Gmail OAuth, live Apify/Firecrawl credentials, worker-restart staging, backup/restore, rollback, and credentialed desktop distribution still require a controlled environment and evidence bundle.


## 8. Verification record for this remediation pass

| Gate | Result | Interpretation |
|---|---:|---|
| Frontend feature-flag suite | 8 passed | Undefined feature-key drift is now covered by a recursive source contract. |
| Frontend full suite and production build | Passed | The Gmail scope UI and API client compile and build successfully. |
| Go gateway full suite | Passed | Gmail query/date-window controls did not break gateway contracts. |
| Python backend suite | 873 passed, 4 skipped | Existing agent, provider, browser, RLS, and worker behavior remains regression-free. |
| Release contract | 46/46 passed | Static infrastructure, security, route, image, readiness, and scanner gates remain green. |
| RLS and provider configuration checks | RLS passed; providers disabled | Ownership contracts are green; live providers are intentionally unavailable because capabilities/credentials are not enabled. |
| Hostile staging suite | Plan generated; execution blocked | Requires deployed staging, two disposable tenants, an interruptible Redis worker, and an alert receiver. |
| Local Docker smoke | Blocked | Docker daemon is not running in the current environment. |

The evidence supports **high local confidence in the changed code**, but not 100% production confidence. Live provider, deployed staging, worker interruption/restart, backup/restore, rollback, credentialed desktop, and external portal receipt gates remain environment-dependent.
