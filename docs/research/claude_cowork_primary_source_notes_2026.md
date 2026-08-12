# Claude Cowork Primary-Source Findings (12 August 2026)

## Official sources consulted

1. https://claude.com/docs/cowork/overview
2. https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork
3. https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool

## Findings relevant to Job Tayari

Anthropic’s current official Cowork overview describes a task-oriented agent experience that works with local files, Chrome/browser actions, sub-agent coordination, professional outputs, and account-managed connectors/skills/plugins. Its help documentation states Cowork runs cloud sessions in an isolated environment, can continue after a user steps away, keeps persistent projects with files/links/instructions/memory, supports long-running and scheduled tasks, and surfaces progress, approach, and active work for steering.

Cowork executes a plan, divides complex work into subtasks, runs code/shell work in an isolated server environment, coordinates multiple workstreams, then delivers outputs into the session. It offers three connector-permission modes: Manual (write actions require approval), Auto (read-only approved while write/delete handling is risk-scored and can pause), and Skip (no approval safeguards). It requires explicit permission before permanent file deletion. Team/Enterprise supports capability disabling, task deletion/retention behaviour, compliance capture, and OpenTelemetry activity monitoring.

Anthropic’s computer-use documentation requires a sandboxed environment, describes screenshot/mouse/keyboard computer controls, and presents an application-operated agent loop that turns model tool requests into environment actions and sends screenshots/outputs back. It warns of prompt-injection risk, instructs implementers to obtain end-user consent, and describes human confirmation when safety classifiers flag potential injection. Its reference pattern is a containerised virtual display/desktop/tool implementation with iteration limits as a cost/safety safeguard.

## Job Tayari design decisions derived from these sources

1. Use a persistent career workspace per candidate, containing only a versioned career goal, profile summary, job artefacts, sources, approvals, and run history—not shared long-lived agent memory.
2. Make each run visibly plan-first, checkpointed, steerable, cancellable, and resumable. A single visible status must map to a durable event and worker state.
3. Introduce execution modes that are stricter than generic agent approvals: `preview`, `review_only`, `draft_fill`, and `candidate_confirm`. No auto/skip mode may bypass candidate confirmation for application submission, sensitive questions, credential entry, account changes, or outbound messaging.
4. Keep computer/browser operations in a per-candidate isolated worker with capability-scoped leases, URL and download controls, screenshot/evidence references, prompt-injection escalation, max-step/max-cost limits, and server-side stop.
5. Add organisation-grade observability: append-only audit events, run timelines, policy/version hashes, data/retention deletion ledger, and OTel-compatible trace fields.

## Sources

- [Claude Cowork Overview](https://claude.com/docs/cowork/overview)
- [Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork)
- [Claude Computer Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)
