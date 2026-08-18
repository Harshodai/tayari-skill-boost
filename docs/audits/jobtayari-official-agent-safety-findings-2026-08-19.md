# External Agent Safety Findings — 2026-08-19

## OpenHands sandbox documentation
Source: https://docs.openhands.dev/openhands/usage/sandboxes/overview

OpenHands explicitly distinguishes Docker, Process, and Remote sandbox providers. Docker is recommended for isolation; Process is labeled unsafe because it runs as a regular process without container isolation; Remote is used for managed deployments. Lesson for JobTayari: a local process mode must never be presented as equivalent to isolated Computer use, and provider selection must be visible in capability/status output.

## Temporal human-in-the-loop documentation
Source: https://docs.temporal.io/ai-cookbook/human-in-the-loop-python

Temporal models risky actions as a workflow pause waiting for a Signal, with durable timers, complete audit trail, and execution only after approval or a timeout/rejection decision. It emphasizes that waiting for human input should consume no worker compute and that the approval request identifier must match the pending workflow state. Lesson for JobTayari: approval must be a durable workflow state, not a transient API response; expiry and restart recovery must be first-class; approval must be correlated to the exact pending request.

## n8n tool-level human review documentation
Source: https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools

n8n places human review before a selected tool call, shows the reviewer the tool and parameters, supports approve/deny, and supports multiple approval channels including email and WhatsApp Business Cloud. It states that denied calls must be canceled and that the system prompt should describe the review behavior. Lesson for JobTayari: approval must be attached to a concrete tool invocation and its parameters, not a vague automation title; the agent must receive an explicit denial outcome and continue safely; channel choice must not change the canonical decision record.

## VS Code trust and safety documentation
Source: https://code.visualstudio.com/docs/agents/concepts/trust-and-safety

VS Code layers review-before-apply, approval-before-side-effect, autonomy levels, OS-level sandboxing, and trust boundaries for workspaces, extensions, MCP servers, and network domains. It explicitly warns about approval fatigue, best-effort command parsing bypasses, prompt injection, and unintended external service actions. It describes file-system and network isolation as separate controls and says built-in file tools are not covered by terminal sandboxing. Lesson for JobTayari: approval prompts cannot be the only boundary; command/file/network execution need independent OS or container enforcement; trusted domains and MCP servers require explicit consent; allowlists must account for shell parsing and file-tool escape paths; user experience must avoid repetitive approval fatigue.

## Claude Code official permissions and security

Sources: https://code.claude.com/docs/en/permissions and https://code.claude.com/docs/en/security

Claude Code separates permission rules from sandboxing. It uses deny/ask/allow precedence, scoped tool rules, permission modes, and managed policies. It warns that Bash pattern rules are fragile around redirects, variables, protocol changes, wrappers, and compound commands; it recommends hooks or domain-aware tools for reliable enforcement. It also states that prompt instructions do not enforce permissions—the product enforcement layer does. MCP servers are not security-audited or managed by Anthropic, so users must trust and govern them. Lesson: JobTayari’s capability registry must enforce policy server-side; tool authorization must parse structured tool inputs rather than rely on raw command prefixes; every MCP/A2A connector needs an independent trust and revocation record; approval UI cannot be the only enforcement layer.

## Claude Code sandbox environment documentation

Source: https://code.claude.com/docs/en/sandbox-environments

Claude Code explicitly distinguishes permission prompts from isolation boundaries. Its Bash sandbox covers only Bash and child processes; built-in file tools, MCP servers, and hooks can remain outside that boundary. Full-process sandboxing, containers, or VMs are required when unattended runs need isolation across tools. It warns that network egress can still leak data, writable mounts can modify code, sandboxing does not change what files are sent to the model, and sandbox deny lists may miss paths created later on Linux/WSL. Lesson: JobTayari Computer must report the actual enforcement coverage, deny network by default, limit writable mounts, test newly created nested repos/hooks, and keep built-in file tools and MCP servers inside the same isolation boundary for unattended mode.

## OpenAI Codex official safety documentation

Source: https://openai.com/index/running-codex-safely/

OpenAI describes sandboxing, approvals, network allow/deny policies, keyring-held credentials, managed requirements, agent-native OpenTelemetry logs, and enterprise compliance logs as separate controls. It explicitly keeps open-ended outbound access disabled, requires approval for unfamiliar domains, binds credentials to an enterprise workspace, and records prompts, approvals, tool results, MCP usage, and network policy decisions. Lesson: JobTayari needs a central network policy with explicit domain decisions, scoped credentials outside the agent workspace, managed policy immutability, agent-native telemetry including user intent and approval context, and audit correlation across tool, network, provider, and execution events.

## MCP official security best practices

Source: https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices

The MCP security guidance explicitly covers confused-deputy attacks in OAuth proxies, per-client consent, exact redirect URI matching, CSRF state, token audience validation, prohibition of token passthrough, SSRF through metadata/redirect discovery, private-IP blocking, DNS rebinding, state-handle hijacking, local server compromise, and tool/resource poisoning. Lesson: JobTayari’s MCP adapters must never pass through upstream tokens, must bind OAuth consent to client/tenant/user, must exact-match redirects, must validate audience, must use egress policy/SSRF defenses, must bind state handles to verified identity, and must version/hash tool metadata to detect tool-description changes.

## Meta WhatsApp Business webhooks

Source: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview

Meta documents that webhooks carry messages and outgoing-message statuses, payloads may be up to 3 MB, delivery failures cause retries for up to seven days, and duplicate notifications can result. Production requires a configured endpoint and appropriate permissions; mTLS is available. Lesson: JobTayari’s WhatsApp receiver needs payload-size enforcement, provider-shaped payload parsing rather than a flat internal test schema, seven-day retry/replay handling, event ordering tolerance, mTLS or equivalent network hardening, and template/account status monitoring. A single HMAC check plus one provider event ID is not enough for production evidence.

## A2A security guidance

Sources: https://developers.redhat.com/articles/2025/08/19/how-enhance-agent2agent-security and https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/

Google describes A2A as an interoperability protocol for capability discovery, long-running tasks, status updates, and agent collaboration. Red Hat’s security analysis emphasizes that A2A does not define authorization policy, recommends TLS/mTLS and remote-agent identity validation, least privilege, nonces/timestamps/MACs for replay, signed or access-controlled Agent Cards, SSRF-safe webhook targets, relevant-notification checks, and defenses against cross-agent prompt injection. Lesson: JobTayari’s A2A layer must treat Agent Cards and remote skills as untrusted input, require signed/allowlisted cards, bind tasks to tenant/user/purpose, add nonce/timestamp/MAC and idempotency, validate webhook target and sender, and isolate cross-agent content from execution policy.
