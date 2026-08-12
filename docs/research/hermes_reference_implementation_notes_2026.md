# Hermes Reference-Implementation Findings (12 August 2026)

## Source consulted

- Local reference clone: `NousResearch/hermes-agent`, previously audited at commit `ed5e17f`.
- Upstream repository: https://github.com/NousResearch/hermes-agent

## Transferable patterns

The Hermes reference implementation is useful as a **messaging and session-control pattern**, not as a direct dependency for Job Tayari. Its architecture separates transport/channel adapters, a gateway/event stream, session state, approval controls, and UI handling. The repository’s desktop application includes session switching and history, gateway event parsing, progressive message streaming, explicit approval-mode UI/events, terminal error handling, session reclamation, run summaries, and run tickers.

The earlier review also identified reusable design patterns for WhatsApp and Telegram: provider-specific adapter modules behind a common inbound/outbound message contract; a delivery ledger with provider message identifiers and retry-safe status handling; user-to-session mapping with strict tenant isolation; and explicit approve/deny interactions. Hermes-style messaging should remain an **attention and steering channel**, not a bypass around Job Tayari’s authenticated candidate review centre.

## Job Tayari decisions

1. Model every career task as a durable candidate-scoped run with a structured event stream and a UI that distinguishes queued, running, waiting-for-candidate, paused, failed, cancelled, and completed states.
2. Separate transport delivery receipts from domain outcomes. A delivered Telegram/WhatsApp message is not proof that an application was submitted or an action was approved.
3. Route messaging commands to an authenticated session and demand a confirmable intent/approval receipt for consequential operations. Never accept “apply”, “send”, “delete”, or profile-sensitive changes as a blind message-channel instruction.
4. Implement official provider adapters only: the WhatsApp Business Platform Cloud API for WhatsApp and the Telegram Bot API/webhook model for Telegram. Do not use unofficial consumer-session libraries to automate WhatsApp accounts.
5. Keep one commercial Job Tayari control plane for credentials, queues, browser workers, consent, audit, and policy. The open source protocol exposes only portable receipts and state-machine contracts.

## Source

- [NousResearch Hermes Agent](https://github.com/NousResearch/hermes-agent)
