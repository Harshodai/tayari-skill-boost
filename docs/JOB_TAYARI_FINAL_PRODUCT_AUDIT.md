# Job Tayari: Final Product Audit, Implementation Record, and 90-Day Release Plan

**Audit date:** 12 August 2026
**Audited implementation:** `main` through commit `48ad4d6`
**Author:** Manus AI

> **Verdict:** Job Tayari has been materially strengthened into a more truthful, candidate-controlled career operating-system foundation. It is **not yet a 10/10 autonomous job-application platform**. Claiming that today would be inaccurate. It can earn that level only after it proves isolated browser execution, receipt-backed application verification, connector minimisation, and end-to-end recovery controls in production-like tests.

## Executive assessment

The strongest strategic choice is to compete on **trustworthy career execution**, not mass application volume. The platform should turn a candidate's goal into a visible plan, perform bounded preparatory work, pause when a human decision is necessary, and display evidence for every claimed outcome. This transfers the useful interaction principles of task planning, controlled execution, and delivered artefacts associated with Manus while maintaining stricter job-seeking consent and verification boundaries.[1] [2]

| Dimension | Current readiness | Audit finding | What turns this into a 10/10 capability |
|---|---:|---|---|
| Candidate-facing professionalism | 7/10 | Clearer truthful language and disclosures exist, but visual consistency, task-first information architecture, responsive QA, and accessibility validation remain incomplete. | End-to-end UX and accessibility audit with observed candidate usability tests. |
| Resume optimiser | 7.5/10 | Resume upload, pasted job descriptions, public URL import, custom instructions, provenance labels, and no-fabrication guidance exist. | Integration tests across supported source types, extraction fallbacks, source snapshots, and human truth-review evidence. |
| Career-change onboarding | 8/10 | Job/domain transition inputs and edits are supported, but routing is not yet deeply differentiated by transition type. | Versioned plans for job, domain, level, location, and return-to-work transitions. |
| Browser computer and safety | 4/10 | The control room now honestly displays preview/offline state; it is not a live, isolated browser worker. | Per-run browser isolation, control stream, stop/kill semantics, takeover, policy enforcement, and receipt verification. |
| Dream-company pipeline | 5/10 | Reviewable preparation exists, but company monitoring through browser assistance to verified receipt is not complete. | Allowlisted source watchers, deduplication, job freshness, approval-bound artefacts, browser drafting, and verified receipt reconciliation. |
| Omnisave-style knowledge hub | 6/10 | Candidate-pasted public URL import, organisation, and cited Q&A exist; saved-list synchronisation does not. | Authorised provider integrations or exports, source ownership, retention/deletion, and grounded-answer evaluation. |
| Gmail interview ingestion | 7/10 | Interview-focused processing exists, but `gmail.readonly` is still broad and must be constrained server-side. | Candidate-visible query/time window, minimised storage, disconnect/deletion, and filter-behaviour tests. |
| Governance and ruthless review | 10/10 as a mechanism | Launch blockers, state machines, evidence rules, and an agent-ready implementation brief are documented. | Require written, test-linked evidence for every blocker before expanding external execution. |
| Commercial potential | Promising; unproven | A trust-first, managed execution layer can differentiate from resume generators and volume-application tools. Profitability is a hypothesis, not a guarantee. | Demonstrate activation, paid retention, cost-to-serve, provider-compliance, and reliable outcomes in a controlled beta. |

## Direct answers to the nine product questions

### 1. Professional appearance and adaptable language

**Answer: improving, but not 10/10.** The landing, resume, Omnisave, computer-control, and Gmail surfaces were changed to use candidate-facing language and disclose actual capability limits instead of implying unavailable automation. The next barrier is not more copy: it is a consistent product design system, an accessibility review, and a task-first dashboard where the candidate's next decision is always obvious.

### 2. Resume optimiser with resume, pasted description, link, and instructions

**Answer: the path is implemented, but live reliability is not fully proven.** The product supports uploading/pasting a resume, pasting a job description, importing a public URL, and forwarding custom instruction. Job-description provenance is shown as `pasted` or `imported`, and the candidate is warned not to fabricate experience. The next release must add deterministic integration coverage for each input combination, failed source extraction, and model-output provenance.

### 3. Onboarding for job change versus domain change

**Answer: yes, at a useful foundation level.** Candidate transition information is collected and editable. It must now change downstream product behaviour: role matching, evidence-gap analysis, portfolio plan, interview preparation, and recommendation cadence. A generic profile field is not sufficient; every agent run should show which profile and career-goal version it used.

### 4. Manus-style browser computer, sandbox, profile, and safety

**Answer: no live computer exists today, and the UI now says so honestly.** The control room is a preview/offline representation rather than a false simulation. The release-standard design is an isolated per-candidate worker, a durable event stream, profile-version and approval binding, credential handoff without retention, candidate takeover for sensitive steps, a server-side kill switch, and external receipts before success is claimed. Manus materials and E2B's public implementation discussion support the broader patterns of isolated task environments and resumable human intervention; Job Tayari adds job-specific approval and evidence requirements.[1] [2] [3]

### 5. Dream-company monitoring to tailored, approved applications

**Answer: not end to end yet.** The current system can prepare reviewable work and enforce non-submission in its multi-agent review flow. It does **not** yet monitor Google or another employer, draft-fill an external portal, and return a verified receipt. The required pipeline is `goal → permitted discovery → normalised fresh job → fit/truth review → artefact version → hash-bound candidate approval → browser draft → candidate confirmation → receipt verifier`. Each retry must reconcile receipt state before it can repeat any external action.

### 6. Omnisave-style Substack, Medium, and LinkedIn knowledge hub

**Answer: partially.** Public URLs that a candidate explicitly provides can be imported, organised, and queried with citations. The product does not currently enumerate or synchronise saved-post lists from those platforms. The correct path is authorised integrations or user-export import, source ownership controls, provenance-backed answers, and deletion/retention settings—not scraping or silent synchronisation.

### 7. Gmail connector and interview-board privacy

**Answer: partially.** The interface now correctly explains that `gmail.readonly` is a broad read-only permission and does not inherently mean “only interview email”. The product must enforce the candidate-selected query and date range at the server, retain only the minimum metadata/content needed, expose disconnect and deletion, and prove those filters through tests before claiming strict mailbox minimisation.

### 8. Ruthless questions and agent governance

**Answer: yes.** Fifteen launch-blocking questions are preserved in the architecture decision record and the execution brief. They ask, among other things, whether every applied card has a receipt, whether candidates can revoke approvals, whether workers are tenant-isolated, how CAPTCHA/ambiguous portal states behave, and which recommendation claims are facts versus inferences. A feature cannot graduate from preview merely because it demos well.

### 9. Can this become an exceptional and profitable software-engineering career product?

**Answer: it can become differentiated and commercially viable, but profitability cannot be guaranteed.** The credible wedge is not “apply to everything.” It is a trusted, evidence-backed career operating system for software engineers that can plan a transition, find fitting work, improve truthful materials, organise interview signals, retain job-search knowledge, and coordinate candidate-approved action. Its commercial proof must come from beta evidence: activation to first useful plan, weekly retained use, candidate review completion, verified outcome quality, gross margin after browser/LLM/provider cost, and churn. Do not promise outcome guarantees or autonomous mass submission.

## Implemented in this audit pass

The earlier hardening commit, `6aae38f`, corrected false product claims, added job-description provenance, hardened application status updates, introduced a fail-closed optimiser/truth-gate squad, and created the DeepSeek execution brief. This final commit, `48ad4d6`, delivers the persistent TA experience and open-core extraction boundary.

| Area | Delivered change | Evidence |
|---|---|---|
| Persistent TA assistant | `AskTayariButton` now offers a labelled desktop header CTA plus mobile floating launcher, context-aware real routes, a candidate-control disclosure, and a route to agent work/evidence. | `src/components/ai/AskTayariButton.tsx`, `src/components/layout/AppShell.tsx`, `src/test/AskTayariButton.test.tsx` |
| Test portability | The shared DOM bootstrap no longer imports a Bun-only assertion module, allowing the focused assistant test to run with the available local runner as well as the repository command. | `src/test/setup.ts` |
| Open-core boundary | Added an isolated, independently buildable `open-core/tayari-protocol` package with state-machine contracts, approval expiry checks, evidence-backed verification, tests, MIT licence, and extraction guide. | `open-core/tayari-protocol/` |
| Architecture and research | Added a complete nervous-system decision record, source notes, reproducible SimilarWeb attempt, and an honest no-data benchmark visual. | `docs/MANUS_STYLE_OPEN_CORE_ARCHITECTURE.md`, `docs/research_manus_architecture_sources.md`, `docs/research/similarweb_benchmark/traffic_benchmark.png`, `scripts/similarweb_benchmark.py` |

## Manus-style nervous system

The recommended architecture separates the experience, control, orchestration, execution, and evidence planes. This ensures messaging, UI, and agents can request or report work without silently authorising or claiming an external action. Hermes provides useful patterns for per-session channel isolation, stop/approval controls, and delivery tracking; it must be adapted, not copied blindly.[4] [5]

| Plane | Role | Non-negotiable rule |
|---|---|---|
| Experience gateway | Web control room, mobile, extension, Telegram, WhatsApp, accessibility, and takeover UI. | Messaging never grants final-submission approval. |
| Career control plane | Candidate tenancy, profile/goal versions, connector permissions, policy choices, and run registry. | It never impersonates a portal session or claims portal success. |
| Durable orchestration | Idempotent work, retries, queue/outbox, pause/resume, scheduled monitoring, and dead-letter handling. | A retry cannot repeat an external action until it reconciles the receipt and approval. |
| Specialist execution | Career, discovery, fit/truth, document, question, browser-draft, and receipt-verifier agents. | Every capability is task-scoped, least-privileged, and tenant isolated. |
| Evidence plane | Append-only events, artefact hashes, approval references, delivery ledger, and receipts. | Every candidate-visible status traces to evidence. |

## Open-core commercial strategy

The public package must be genuinely useful without exposing the managed trust and operations layer. Confluent explicitly distinguishes open source from source-available licensing, and that distinction should remain precise in Job Tayari's language.[6] [7] The repository now contains an extractable **MIT-licensed Tayari Protocol** package, while `tayari-skill-boost` remains the private Tayari Cloud implementation.

| Open source: Tayari Protocol | Closed source: Tayari Cloud |
|---|---|
| Opaque candidate references, career-goal contracts, job-posting schema, approvals, receipts, event envelopes, state transitions, synthetic fixtures, and adapter interfaces. | Identity vault, encrypted connector credentials, browser-worker fleet, provider/portal adapters, policy engine, proprietary matching, candidate memory, observability, enterprise administration, billing, and support. |

The protocol intentionally forbids a false “externally verified” state without an evidence-backed receipt. It is publishable only after legal review of licence, trademarks, governance, contribution rules, and a secret/history scan.

## WhatsApp and Telegram plan

Telegram should start as opt-in status notifications, task summaries, `/status`, `/stop`, and deep links into the web review centre. WhatsApp should use the **official Meta WhatsApp Business Cloud API** with a dedicated business number, approved templates when required, signed webhooks, account-link confirmation, opt-out, and rate controls. Do **not** use Baileys or unofficial WhatsApp Web automation in production. Neither chat channel is allowed to collect sensitive answers or provide final approval; the authenticated web control room remains the single approval surface.[5] [8]

## Ninety-day release gates

| Period | Delivery scope | Evidence required before the next gate |
|---|---|---|
| Days 0–30 | Canonical run/event contract, versioned profile/goal records, policy evaluator, review centre, approval hashes, and truthful TA header. | Every rendered status maps to a stored event; no UI can mark an item applied without receipt evidence. |
| Days 31–60 | One allowlisted ATS proof of concept with isolated worker, candidate takeover, stop/kill, durable outbox, receipt verifier, and opt-in Telegram. | Tenant isolation, cancellation, idempotency, ambiguous receipt, and takeover tests pass; no password/cookie retention. |
| Days 61–90 | WhatsApp Cloud API opt-in, Gmail minimisation controls, scheduled monitor, protocol v0.1 release, and private policy console. | Security, provider-compliance, deletion/revocation, recovery/load, legal licence, and external usability gates complete. |

## Validation record

| Command | Result |
|---|---|
| `npx vitest run src/test/AskTayariButton.test.tsx --environment happy-dom --globals` | Passed: 3 focused assistant tests. |
| `npx tsc --noEmit` | Passed. |
| `npm run build` | Passed: production frontend build. |
| `cd open-core/tayari-protocol && npm test` | Passed: 3 protocol contract tests. |
| Focused Python squad tests, focused Go API tests, and prior frontend build from the hardening pass | Passed as recorded in `MANUS_STYLE_IMPLEMENTATION_STATUS.md`. |
| `git diff --check` before commit | Passed. |

The implementation commits `6aae38f` and `48ad4d6` are published to `main`. A pre-existing local modification at `supabase/functions/mcp/index.ts` was intentionally left uncommitted and was not altered by this work.

## Agent-ready execution materials

The hand-off source of truth is `DEEPSEEK_COPY_PASTE_PROMPT.md`. It instructs an engineering agent to preserve the approval-to-evidence spine, use strict service separation, implement individual state-machine and recovery tests, and answer every launch-blocking question with test-linked evidence. The architecture decision record adds the open-core split, messaging boundaries, and release gates.

## References

[1] [Manus Documentation: Welcome](https://manus.im/docs/introduction/welcome)
[2] [Manus Browser Operator](https://manus.im/features/manus-browser-operator)
[3] [E2B: How Manus uses E2B to provide agents with virtual computers](https://e2b.dev/blog/how-manus-uses-e2b-to-provide-agents-with-virtual-computers)
[4] [Hermes Agent repository](https://github.com/NousResearch/hermes-agent)
[5] [Hermes Messaging Gateway](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/messaging/index.md)
[6] [Confluent Community License FAQ](https://www.confluent.io/confluent-community-license-faq/)
[7] [Confluent licensing rationale](https://www.confluent.io/blog/license-changes-confluent-platform/)
[8] [Meta WhatsApp Cloud API documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
