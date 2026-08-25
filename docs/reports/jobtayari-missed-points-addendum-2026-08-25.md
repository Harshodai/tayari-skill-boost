# JobTayari Missed-Points Addendum — 25 August 2026

**Author:** Manus AI
**Purpose:** Expand the existing end-to-end audit with overlooked points that should be added to the next implementation roadmap.

## Executive assessment

The earlier audit correctly identified semantic job expansion, role-specific preparation, review-first automation, browser credential isolation, connector gates, and deployment evidence as the major themes. A second pass reveals that the most important missed points are not additional screens. They are the systems that make the existing screens compound in value: a persistent candidate context, a measurable learning loop, counterfactual explanations, durable data lifecycle controls, accessibility-first interaction, connector health, and observable cost and outcome metrics.

The product should therefore be judged by whether a candidate can move from an ambiguous intent such as “Data Engineer” to a defensible set of adjacent roles, understand the evidence behind each match, prepare against the actual gaps, create a truthful application packet, receive follow-up prompts at the right time, and retain control over every external action. A feature that only renders a polished card but loses context, cannot be corrected, or cannot prove its delivery status is not complete.

## Newly identified gaps

| Priority | Missed point | Why it matters | Completion evidence |
|---|---|---|---|
| P0 | **Persistent Career Context** | Role searches, preparation, applications, and follow-ups should share one versioned snapshot of target roles, constraints, seniority, location, compensation, work authorization, skills, evidence, and exclusions. Without this, semantic search and generated material drift apart. | A versioned context object is visible, editable, auditable, and referenced by every downstream artifact. |
| P0 | **Counterfactual match explanations** | A fit score says what happened; a candidate needs to know what would change the result. Explainable recommendation research specifically points toward feature importance, graph reasoning, and counterfactual explanations [1]. | For every match, show strong evidence, uncertainty, missing evidence, and the smallest credible change that would improve fit. |
| P0 | **Candidate correction loop** | Role families and skill mappings will be wrong for some candidates. Corrections must improve the current result and become reusable preference signals without silently rewriting the taxonomy. | Candidate can accept, reject, rename, or pin an adjacent role; corrections are stored with provenance and can be undone. |
| P0 | **Preparation-to-outcome loop** | Preparation should not end at a static kit. Interview answers, practice attempts, application outcomes, and candidate corrections should change the next session. Human-centered interview research emphasizes opt-in feedback and responsible adaptation [2]. | Every practice session records selected feedback dimensions, baseline, change, and next action; no “hiring probability” claim is made. |
| P0 | **Application truth ledger** | Resume versions, cover letters, answer-bank entries, evidence, approvals, and submissions need one immutable lineage. Otherwise a candidate cannot explain which version was used. | Every artifact shows source context, version, freshness, claim provenance, approval owner, and external receipt if any. |
| P0 | **Connector health and lifecycle center** | Connector breadth without status, scopes, revocation, expiration, last sync, errors, retention, and deletion is not a trustworthy integration. | Each connector has a permission manifest, connection state, last-success/last-failure event, revoke button, deletion semantics, and owner scope. |
| P0 | **Browser recovery and replay protection** | A browser companion must recover after a service-worker restart, tab change, origin change, network retry, or expired grant without repeating a sensitive action. | Durable run state, nonce/replay protection, origin mismatch refusal, visible stop, and a recovery test that proves no duplicate action. |
| P1 | **Role-family confidence and ambiguity** | “Data Engineer” may mean analytics engineering, platform engineering, data infrastructure, or product analytics depending on the user. The system needs confidence and an ambiguity question, not an unbounded synonym list. | Search results expose family confidence, inferred seniority, excluded families, and a single clarifying question when confidence is low. |
| P1 | **Market freshness and change detection** | A role can close, change requirements, or become stale between discovery and application. Freshness should be a first-class factor rather than a timestamp badge. | The opportunity ledger records source timestamp, content hash, change diff, stale threshold, and revalidation result before packet generation. |
| P1 | **Skill transfer graph** | Matching should distinguish exact, transferable, adjacent, and unsupported skills. A candidate can then prepare for the smallest bridge rather than chase every keyword. Knowledge-graph matching is repeatedly used in explainable job recommendation work [1] [3]. | Each skill edge has relation type, evidence, confidence, and a proposed bridge exercise. |
| P1 | **Evidence quality scoring** | A skill should not count equally when it is listed, described in a project, measured by an outcome, or verified by a portfolio artifact. | Claims have evidence type, recency, specificity, and verification status; the UI explains why a claim is trusted. |
| P1 | **Notification policy engine** | Daily alerts are only useful when deduplicated, quiet-hour aware, frequency-controlled, and tied to user-defined urgency. A simple enabled flag is insufficient. | Candidate controls channels, quiet hours, digest mode, maximum daily volume, unsubscribe, and delivery receipts. |
| P1 | **Application form accessibility** | Online application accessibility is a known problem for screen-reader users [4]. Autofill that works visually but fails semantically is not complete. | Keyboard-only and screen-reader fixture tests cover labels, errors, focus, dynamic fields, reduced motion, and recovery after failed fill. |
| P1 | **Extension context continuity** | Claude/Manus-style companions feel powerful because context survives navigation without silently expanding authority. | The side panel shows active tab, origin, captured evidence, task state, stale status, and exactly what will be sent before each action. |
| P1 | **Graceful offline and degraded mode** | A candidate should not lose drafts, notes, or approvals when the API or provider is temporarily unavailable. | Local queue/state is bounded and encrypted where appropriate; replay is idempotent; the UI clearly distinguishes local draft from server-confirmed state. |
| P1 | **Cost and latency budgets per workflow** | Semantic expansion, preparation generation, browser minutes, and connector syncs can have very different cost profiles. | Each run exposes budget, usage, remaining allowance, provider latency, retry count, and a safe stop on budget exhaustion. |
| P2 | **Accessibility and localization system** | Advanced career tools serve candidates under stress and across languages. Color-only signals, dense tables, and untranslated generated content undermine trust. | WCAG-oriented keyboard, contrast, focus, motion, locale, date/time, and screen-reader checks are part of release gating. |
| P2 | **Candidate privacy center** | Users need to see what data exists, where it came from, how long it is retained, which connectors can access it, and how to purge it. | Data inventory, export, deletion preview, connector-specific purge, retention countdown, and audit history are tested. |
| P2 | **Human review workload controls** | Review-first automation can itself become exhausting if it creates too many low-value decisions. | The system groups similar approvals, shows expected value, supports batch reject, and never batches irreversible external actions. |
| P2 | **Experiment and evaluation plane** | Search quality, preparation usefulness, and automation safety need a stable evaluation corpus, not only unit tests. | Golden role queries, adversarial page fixtures, claim-level grading, candidate feedback, and regression dashboards exist. |
| P2 | **Commercial proof** | Pricing UI is not billing proof, and feature breadth is not willingness-to-pay proof. | Test-mode checkout, webhook idempotency, cancellation, entitlement reconciliation, paid-pilot conversion, retention, and cost-to-serve evidence exist. |
| P2 | **Operational runbooks** | Production readiness requires recovery knowledge, not only scripts. | Runbooks cover incident response, provider outage, connector revocation, browser-worker compromise, migration rollback, and user notification. |

## Specific additions to the semantic role experience

The current Data Engineer example should become a structured intent interpreter rather than a flat synonym expansion. The system should preserve the literal query, infer a primary role family, generate adjacent families, and show why each is included. A strong result could present “Data Engineer” as the primary family, “Data Platform Engineer” and “Data Infrastructure Engineer” as high-confidence adjacent families, “Analytics Engineer” as a conditional adjacent family, and “Software Engineer, Data” as a transfer path. It should ask a single clarifying question when the distinction affects ranking materially, such as whether the candidate prefers platform reliability, analytics modeling, or product-facing data work.

The search result should combine hard constraints and semantic relevance. Work authorization, location, compensation floor, seniority, employment type, and explicit exclusions must be deterministic filters. Embeddings, taxonomy edges, and transferability can rank the remaining set. A single opaque score should be replaced with factor-level evidence: title-family match, skill evidence, seniority, domain transfer, freshness, compensation, location, and candidate preference alignment. The JobMatchAI pattern of combining dense embeddings, a knowledge graph, and BM25-style retrieval supports this hybrid direction [3].

## Specific additions to preparation material

Preparation material should be a living program attached to the candidate and the opportunity, not a generated paragraph. Each kit should contain a minimum viable preparation path, a deeper optional path, evidence to collect, missing-skill bridges, role-specific system-design or domain questions, behavioral stories, questions to ask the interviewer, and a short practice loop. Every item should indicate whether it is grounded in the job description, the candidate’s own evidence, a general skill taxonomy, or an explicit assumption.

The system should measure improvement in candidate-selected dimensions such as specificity, structure, technical correctness, concision, confidence, and evidence use. It should show before/after examples and let the candidate opt out of dimensions they do not want measured. It should never claim to forecast hiring decisions. Research on human-centered AI interview training supports opt-in feedback and responsible risk practices rather than opaque evaluation [2].

## Specific additions to connectors

The connector center should treat every integration as a lifecycle, not a button. A connector must declare requested scopes, data categories, read/write actions, retention period, refresh behavior, last successful operation, last failure, and revocation behavior. Google Calendar/Drive, Gmail, messaging, job providers, scraping services, and browser control should be enabled one at a time behind disposable-account acceptance tests.

Connector responses should carry provenance and delivery state. “Sent,” “synced,” or “submitted” must mean the provider returned a verifiable receipt; “accepted by API” and “visible to user” should not be conflated. Webhooks need signature verification, replay protection, idempotency, and explicit recovery for ambiguous delivery. A user must be able to revoke a connector and see which cached artifacts will be deleted immediately, retained for legal reasons, or converted into redacted local evidence.

## Specific additions to the Chrome companion

The Chrome side panel should have three explicit modes: **Observe**, **Prepare**, and **Act with approval**. Observe can capture bounded page context and evidence. Prepare can create drafts, role kits, notes, and task plans. Act with approval can perform only an allowlisted reversible or reviewable action, with a visible artifact-bound confirmation immediately before execution. Submission, messaging, financial actions, legal declarations, OTPs, CAPTCHA handling, and credential extraction remain blocked.

The panel should also expose an event timeline: connected origin, grant age, page generation, captured evidence hash, task state, next action, approval owner, and stop/revoke controls. When a tab changes origin or a grant expires, the panel should switch to a visibly disconnected state and require reconnection. Chrome’s Side Panel API provides the persistent, tab-aware surface needed for this context-preserving experience [5].

## Implementation order

| Wave | Focus | Exit gate |
|---|---|---|
| 1 | Persistent career context, role-family confidence, deterministic filters, factor-level explanations | Same candidate context produces consistent search, preparation, and packet metadata. |
| 2 | Skill transfer graph, evidence quality, preparation loops, candidate corrections | Candidate can correct a role/skill mapping and see the next preparation plan change. |
| 3 | Application truth ledger, freshness/change detection, notification policy | Every packet and alert has source, version, freshness, and delivery evidence. |
| 4 | Connector lifecycle center, privacy/purge center, degraded mode | One connector can be authorized, revoked, purged, and recovered in disposable staging. |
| 5 | Chrome Observe/Prepare/Act modes, recovery/replay tests, accessibility fixtures | Browser companion survives restart/origin change and never repeats a sensitive action. |
| 6 | Evaluation, cost/latency budgets, commercial proof, production runbooks | Release decision is based on outcome, safety, and operational evidence rather than route count. |

## Ruthless non-goals

Do not add more provider buttons before the connector lifecycle is complete. Do not enable unattended application submission because a plan can be generated. Do not use a single semantic score as a substitute for candidate intent. Do not treat generated preparation text as trustworthy unless its claims are linked to evidence. Do not persist browser credentials in the web app or backend. Do not call local tests production proof. Do not present disabled or preview-only capabilities as if they were generally available.

## References

[1]: https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1660548/full "Explainable person–job recommendations: challenges, approaches, and comparative analysis"
[2]: https://iris.unil.ch/bitstreams/619fdc74-6e21-4045-88ae-b26b73dcdda5/download "Advancing Human-Centered AI Interview Training Grounded in Job Seeker Needs and Responsible Risk Practices"
[3]: https://arxiv.org/html/2603.14558v2 "JobMatchAI: semantic job matching with embeddings, knowledge graph, and BM25 retrieval"
[4]: https://pmc.ncbi.nlm.nih.gov/articles/PMC10961918/ "The Accessibility and Usability of Online Job Applications for People with Visual Impairments"
[5]: https://developer.chrome.com/docs/extensions/reference/api/sidePanel "Chrome for Developers: chrome.sidePanel API"
