# Manus-Style Architecture Research Notes

_Collected 2026-08-12 for Job Tayari system design. These notes preserve source facts separately from implementation recommendations._

## Official Manus materials

### Action-oriented execution and sandbox

The [Manus documentation introduction](https://manus.im/docs/introduction/welcome) describes Manus as an autonomous general agent designed to complete tasks and deliver results, rather than merely answer questions. It states that it operates in a sandboxed virtual computer with internet access, persistent task storage, and software installation capabilities. For Job Tayari, the applicable pattern is **observable plan → scoped tool work → durable artifacts → explicit outcome**, not a chat-only assistant.

### Trusted local-browser operation

The [Manus Browser Operator product page](https://manus.im/features/manus-browser-operator) describes operation in the user’s active browser context using their local network and existing logged-in sessions. It presents an explicit flow of browser connection, permission grant, and autonomous action. It also gives job-application automation as an example. Job Tayari should adopt the trust principles—not duplicate product claims until live—including browser connection disclosure, session ownership, visible action trace, a real server-side kill switch, and explicit approval before any externally consequential action.

### Persistent workers and messaging

The [Manus Cloud Computer announcement](https://manus.im/blog/manus-cloud-computer) distinguishes temporary sandbox tasks from persistent compute for continuous bots, scheduled workers, databases, and messaging integrations. It explicitly cites 24/7 bots across Slack, Discord, Telegram, and WhatsApp as persistent-workload examples. Job Tayari therefore needs a durable worker/queue tier for opted-in job monitors and messaging, while sensitive browser application work should remain session-scoped, cancellable, and candidate-controlled.

## Design implications carried into the Job Tayari recommendation

1. Split the system into a stateless product/API plane, durable orchestration/work queue, candidate-controlled browser session plane, connector plane, and immutable evidence/audit plane.
2. Treat messaging adapters as notification and conversational entry points. They must never be an implicit authorization channel for an external submission.
3. Make the TA assistant a persistent, accessible entry point in the authenticated shell, with real task states and capability disclosures rather than a bottom-corner shortcut alone.
4. Retain no browser credentials. Store connector tokens encrypted and scoped; store application evidence as tamper-evident records with source, timestamp, artifact hash, consent ID, and status.
5. Distinguish **prepared**, **candidate-confirmed**, and **externally verified** status. Do not present a candidate-confirmed form action as a verified external submission.

## References

1. [Manus Documentation: Welcome](https://manus.im/docs/introduction/welcome)
2. [Manus Browser Operator](https://manus.im/features/manus-browser-operator)
3. [Introducing Cloud Computer: Lowering the Barrier to Building](https://manus.im/blog/manus-cloud-computer)

## Hermes Agent source audit notes

The repository audited was [`NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent), shallow-cloned at `ed5e17f4b86da0c4f09c0694757b6074ae6b9d16` on `main`.

### What Hermes demonstrates well

The [Hermes README](https://github.com/NousResearch/hermes-agent) describes two entry points: a terminal UI and a gateway supporting messaging platforms. Its public positioning highlights model-provider choice, a shared conversation model across channels, durable session/memory features, tool outputs, and an interrupt/redirect model.

The [Messaging Gateway documentation](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/messaging/index.md) documents an adapter architecture: each platform adapter routes messages through a per-chat session store and then dispatches to the agent; the same gateway operates scheduled work. It documents `/stop`, `/approve`, and `/deny` controls, session scoping by chat origin, context compression, and a durable delivery ledger. The ledger implements deliberately **at-least-once** delivery: a potentially duplicate recovery is visibly labeled, redelivery is bounded, and ambiguous delivery is not silently described as success. This is a strong pattern for Job Tayari activity notifications and application updates.

The [Telegram guide](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/messaging/telegram.md) documents user-ID allowlists, webhook secret validation, scoped group behavior, status indicators, and the difference between observed context and dispatching the agent. Job Tayari should use an explicit account-linking flow, allowlisted conversation identity, outbound-only status/notification functions by default, and webhook signature/secret checks.

The [WhatsApp guide](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/messaging/whatsapp.md) distinguishes an unofficial Baileys/WhatsApp-Web bridge (with account-restriction risk) from the official WhatsApp Business Cloud API. It recommends the official API for a real business bot and warns against bulk or unsolicited messaging. It also describes a dedicated bot number, sender allowlists, persisted credentials, native clarification controls, deliberate separation of clarification polls from approval prompts, and message batching. Job Tayari should therefore use **Meta’s official Cloud API only for production**, treat WhatsApp/Telegram as candidate-owned conversational and notification channels, and require a first-party authenticated web approval for all sensitive actions.

### Job Tayari adoption decision

Adopt: adapter interface, per-channel session isolation, explicit stop/approval/deny controls, durable at-least-once notification ledger with visible ambiguity, identity allowlisting, webhook verification, capability negotiation, and persistent background execution.

Do not copy: consumer-personal-agent assumptions, unbounded autonomous skill creation, unofficial WhatsApp automation, cross-session access without tenancy boundaries, or any practice that lets an LLM turn a messaging reply into an application submission.

## Additional references

4. [Hermes Agent repository and README](https://github.com/NousResearch/hermes-agent)
5. [Hermes Messaging Gateway](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/messaging/index.md)
6. [Hermes Telegram setup](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/messaging/telegram.md)
7. [Hermes WhatsApp setup](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/messaging/whatsapp.md)

## Manus operating-model findings

The [Manus Browser Operator announcement](https://manus.im/blog/manus-browser-operator) describes a deliberate two-environment model: a cloud browser for a clean, isolated automation workspace and an optional authorized local-browser connection for tasks requiring an authenticated user session. The user authorizes access per task, receives a dedicated task tab, can observe actions, take over, or stop by closing it, and receives an action-level audit trail. Job Tayari should adopt this mental model rather than calling a simulated browser timeline “live”.

The [My Computer announcement](https://manus.im/blog/manus-my-computer-desktop) documents an approval-first local-computer model: explicit command approval, “Allow Once” and trusted “Always Allow” modes, folder authorization, persistent local availability, and integration with projects, agents, and schedules. Job Tayari should adopt the *capability contract*, but use job-seeking-specific policy: a browser worker may research, prepare, and fill a draft; the only final application transition must occur through a separate user-controlled confirmation and receipt-verification flow.

The [E2B description of Manus’ virtual-computer setup](https://e2b.dev/blog/how-manus-uses-e2b-to-provide-agents-with-virtual-computers) reports planner/executor decomposition, isolated per-user virtual computers, durable sandbox sessions, pause/resume around credential or human-verification gates, Chromium/terminal/filesystem tools, and a need to maintain plan and context across steps. It describes Firecracker microVM isolation and warns indirectly against treating a generic container as a full agent computer. Job Tayari should use isolated ephemeral browser workers or a managed virtual-computer platform for untrusted application-site activity, never shared browser profiles or shared storage across candidates.

### Design implication

The visible “Tayari Computer” must represent a real `worker_run_id`, adapter session, activity event stream, and receipt status. When those are unavailable, it must present `PREVIEW`, `OFFLINE`, or `NEEDS_CANDIDATE_TAKEOVER`—never fabricated progress.

## SimilarWeb benchmark attempt

A reproducible SimilarWeb script requested 2026-02 through 2026-07 traffic and global-rank results for `jobright.ai`, `simplify.jobs`, and `tealhq.com`. The API responded without extractable visits or rank values. The accompanying rendered chart and table explicitly report no usable values rather than estimating traffic. This evidence cannot support a market-share assertion.

## Additional references

8. [Manus Browser Operator announcement](https://manus.im/blog/manus-browser-operator)
9. [Manus My Computer announcement](https://manus.im/blog/manus-my-computer-desktop)
10. [E2B: How Manus uses virtual computers](https://e2b.dev/blog/how-manus-uses-e2b-to-provide-agents-with-virtual-computers)

## Open-core commercialisation findings

[Confluent’s FAQ](https://www.confluent.io/confluent-community-license-faq/) explicitly distinguishes Apache-2.0 open source from its Confluent Community License, which it describes as **source-available**, not OSI-approved open source, because it excludes providing competing SaaS. It presents the actual open-core split as an Apache-2.0 core plus community/source-available components and separately commercial enterprise controls, security, observability, support, and managed operations. The [licensing rationale](https://www.confluent.io/blog/license-changes-confluent-platform/) ties this to funding sustained engineering and operational investment.

[Supermemory’s local-versus-enterprise documentation](https://supermemory.ai/docs/self-hosting/local-vs-enterprise) offers a more directly applicable pattern: local and enterprise use the same API, while enterprise monetises team roles, revocable scoped keys, observability/control console, managed quality, scale, and regulated deployment. Its product page also differentiates connectors, spend controls, higher service levels, dedicated/self-hosted infrastructure, and support.

### Job Tayari open-core recommendation

Use a genuine **Apache-2.0 or MIT open-source candidate toolkit**, not a misleading source-available project marketed as open source. Its scope should be deliberately useful but non-critical: portable `CandidateProfile`/`CareerGoal` schemas; consent and approval state-machine specification; evaluation fixtures; job-description normaliser; citation/receipt format; a local career-journal CLI; Chrome-extension protocol types; integration-adapter SDK; and sample simulator (no automated final submission).

Keep the commercial closed source under `Tayari Cloud`: candidate identity vault; encrypted connector-token management; multi-tenant job graph and longitudinal profile model; browser-worker fleet and isolated persistent workspaces; policy registry and portal-specific execution adapters; sensitive-question detection; application-review UX; receipt verification/deduplication; WhatsApp/Telegram hosted adapters; notification ledger; proprietary matching, personalised strategy, memory-quality models, abuse prevention, observability, audit console, billing, enterprise RBAC, compliance, and managed support.

Do **not** copy Confluent’s source-available license by default. If the project is announced as open source, make its open layer truly permissive and protect the commercial value with hosted operations, trust, workflow data, provider agreements, expertise, support, and enterprise controls. Obtain legal counsel before choosing any non-OSI or contributor license agreement.

## Additional references

11. [Confluent Community License FAQ](https://www.confluent.io/confluent-community-license-faq/)
12. [Confluent licensing rationale](https://www.confluent.io/blog/license-changes-confluent-platform/)
13. [Supermemory Local vs Enterprise](https://supermemory.ai/docs/self-hosting/local-vs-enterprise)
14. [Supermemory platform and pricing](https://supermemory.ai/)

## GitHub foundation-discovery note

A structured GitHub CLI search was attempted for WhatsApp Cloud API, Telegram bot, Playwright browser-agent, and durable workflow repositories. The authenticated CLI’s advertised search JSON contract returned parsing-incompatible output in this environment, so no star-count or maintenance comparison is reported. The architecture recommendations therefore name patterns and the Hermes source audit, not unverified popularity metrics. Before selecting a production library, the engineering team should independently evaluate its maintenance cadence, security posture, license compatibility, test coverage, and official provider support.

## First-hand video evidence located

The official [Introducing Manus Browser Operator](https://www.youtube.com/watch?v=kaDwyZVFDJs) and [Introducing My Computer](https://www.youtube.com/watch?v=xtjbiY-tJKk) videos were located through YouTube search. Their titles and descriptions corroborate the first-party documents: browser operation uses existing logged-in sessions and local-computer capability applies to local files/tools. The public feature distinction remains the crucial Job Tayari product lesson: visible browser work must be attached to a real, authorized execution environment with user control, not an animation.

> **Video-analysis limitation:** An analysis request for the official Browser Operator video could not be submitted because the analysis service reported insufficient task credits. No video-specific assertions are used in this report; the design conclusions rely on the official documentation and announcement sources cited above.

## Cloud Computer / durable-worker finding

The [official Manus Cloud Computer announcement](https://manus.im/blog/manus-cloud-computer) distinguishes temporary task sandboxes, local desktop work, and persistent cloud computers. It identifies 24/7 bots, scheduled workflows, persistent knowledge bases, live databases, and hosting as durable-workload use cases. It also says tasks start in a temporary sandbox and move to a persistent environment only when needed, while persistent files/setup remain scoped to that environment. Its stated team-access and isolated-local-data properties support a Job Tayari design of **ephemeral candidate browser workspaces by default** plus an opt-in persistent career workspace only for scheduled discovery, connector syncs, user-owned artifacts, and consented notifications.

The [Manus introduction](https://manus.im/docs/introduction/welcome) calls out task planning, execution, sandboxed tools, persistent task context, and delivered work products. Job Tayari should make the career equivalent visible in the UI: outcome, plan, current activity, artefacts, approval checkpoint, and final evidence—not a chat transcript masquerading as execution.

15. [Manus Cloud Computer announcement](https://manus.im/blog/manus-cloud-computer)
16. [Manus introduction](https://manus.im/docs/introduction/welcome)
