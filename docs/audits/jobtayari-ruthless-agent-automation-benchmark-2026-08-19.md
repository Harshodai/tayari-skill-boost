# JobTayari Ruthless Agent and Automation Benchmark

**Date:** 2026-08-19
**Scope:** Manus-like agent UX, Claude Code–class task execution, durable automations, human approvals, email/WhatsApp delivery, Computer use, MCP/A2A, OAuth, tenant isolation, provenance, and release operations.

## Comparison doctrine

This audit distinguishes **feature presence**, **deterministic code evidence**, **staging evidence**, **production evidence**, and **independent assurance**. A competitor feature is not treated as proof that the design is safe. Every external lesson must become one of four outcomes: a repository control, an automated regression, a staging evidence requirement, or an explicit no-go boundary.

## Failure-mode rubric

| Dimension | Questions that must be answered | Minimum evidence |
|---|---|---|
| Truthfulness | Can the product distinguish planned, attempted, accepted, delivered, verified, and unknown? | Response-class tests, provider receipts, no simulated success paths |
| Human control | Can a user approve the exact action without approving a future or mutated action? | Snapshot hash, policy version, expiry, one-time decision, replay rejection |
| Tool safety | Can tools be discovered, scoped, revoked, and prevented from crossing risk boundaries? | Allowlist, grants, origin/tenant binding, timeout, kill switch, hostile corpus |
| Computer safety | Does stop terminate the real resource, not only the UI stream? | Server cancellation, resource teardown, stop-latency evidence, recovery |
| Reliability | Does a worker restart resume or fail closed without duplicate side effects? | Leases, idempotency, checkpoints, crash/restart/duplicate drills |
| Privacy/isolation | Can one tenant or channel see another tenant’s state, metadata, or delivery event? | RLS, gateway owner predicates, two-tenant negative tests, backup/restore proof |
| Notification integrity | Are email/WhatsApp delivery, approval, and execution kept separate? | Opt-in, signed webhooks, dedupe, delivery receipts, fallback, suppression |
| Provider risk | Are API limits, outage, revocation, retention, and provider policy handled? | Live staging probes, quota/terms review, outage and deletion evidence |
| UX parity | Can users inspect plans, diffs, tool calls, files, checkpoints, and approvals? | Product route inventory, truthful states, accessibility/e2e evidence |
| Operations | Can operators observe, roll back, rotate secrets, restore, and investigate incidents? | SLOs, dashboards, runbooks, immutable logs, restore/rollback drills |

## JobTayari baseline at audit start

The repository has deterministic controls for tenant-bound task runs, risk-tiered approvals, exact action hashes, token digests, expiry, Celery checkpoint dispatch, feature/capability gates, provider-neutral notification adapters, signed webhook verification, RLS, route exposure, provenance, Computer stop controls, and manual-submit blocking. Email, WhatsApp, automation execution, live provider delivery, two-tenant staging, restart/reclaim, and independent assurance remain staged or disabled.

## Explicit comparison targets

| Target class | Examples to research | Failure modes to extract |
|---|---|---|
| Agent coding/CLI | Claude Code, OpenAI Codex CLI, Aider, OpenHands, SWE-agent | Prompt injection, secret leakage, command approval fatigue, workspace escape, unbounded loops, patch/diff trust |
| Agent orchestration | Temporal, Hatchet, Trigger.dev, n8n, Kestra, LangGraph | Durable state, retries, duplicate effects, human pauses, schedules, backpressure, replay |
| Approval systems | GitHub Actions environments, Slack/Teams approvals, Zapier/n8n human-in-the-loop, Temporal signals | Approval binding, expiry, identity, channel spoofing, stale approvals, delivery vs decision confusion |
| Communications | Meta WhatsApp Business, Twilio, SES/Postmark/SendGrid | Opt-in, templates, signature verification, delivery states, retries, complaints, suppression, regional rules |
| Computer use | OpenHands, BrowserGym, Playwright, OpenSandbox, Browserbase | Browser isolation, local-browser consent, visual/DOM prompt injection, stop semantics, data exfiltration |
| Tool protocols | MCP, A2A, Composio, Browser Use | Tool poisoning, confused deputy, credential scope, message integrity, replay, provenance, revocation |
| Growth/product | SimilarWeb comparisons for public agent/automation products | Distribution/engagement signals only; never infer safety or product quality from traffic |
| Agent skills | Verified skill repositories and reusable workflows | What is reusable, what is unsafe to import, missing safeguards, maintenance signals |

## No-repeat rule

No external project is copied directly into production. Any adopted pattern requires a threat model, tenant/identity review, deterministic test, staging evidence requirement, and a clear rollback or disable path.
