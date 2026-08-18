# JobTayari Automation Expansion Map

## Current baseline

JobTayari already contains the durable primitives required for a governed automation platform: tenant-scoped automation definitions and runs, append-only automation events, Celery execution, leases and heartbeats, a canonical approval state machine, in-app approval, provider delivery ledgers, Google Workspace routes, external research adapters, browser cancellation, and a manual-submit boundary. The current checkpoint worker intentionally stops at a plan/action approval boundary and does not execute arbitrary tools from a database row.

The current recurring execution graph is narrower than the product surface. Celery Beat runs standing job watches hourly, notification delivery every 30 seconds, automation checkpoints every 15 seconds, preference learning daily, and backups daily. Most other product actions remain request-driven or isolated behind individual routes. There is no single durable event router that turns job, resume, application, calendar, Gmail, Drive, approval, provider, and outcome events into idempotent automation runs.

## Expansion targets

| Domain | Existing primitive | Automation to wire | Trigger | Default behavior | Approval tier |
|---|---|---|---|---|---|
| Job discovery | `job_watches`, Hermes, Firecrawl, Apify | Scheduled saved-search refresh, deduplication, scoring, match digest | Schedule | Read and draft only | Read/draft |
| Job intelligence | ATS scoring, company checks, salary research, skill-gap analysis | Enrich each new match with bounded intelligence | Job match event | Read-only provider calls | Read |
| Candidate preparation | Resume analysis, optimizer, cover letter, interview prep | Create a versioned preparation bundle per selected job | Match threshold or manual selection | Draft artifacts, provenance recorded | Draft |
| Pipeline | `saved_jobs`, `applications`, review queue | Stage hygiene, stale-item nudges, next-step recommendations | Stage change and daily sweep | In-app reminder or draft | Read/draft |
| Follow-up | Application/outcome records and notifications | Draft follow-up schedule and reminders after candidate-confirmed events | Outcome or elapsed time | Never send without consent and review | Sensitive/external write |
| Approvals | Durable approval requests and delivery ledger | Route approval requests, retry delivery, quiet-hours queue, fallback to in-app | Approval requested | Deliver notification only; decision remains in-app | Explicit owner |
| Google Workspace | Gmail, Calendar, Drive adapters | Save approved artifacts, create interview events, draft Gmail follow-ups, reconcile provider state | Artifact ready, interview event, approval decision | Provider writes remain disabled unless separately enabled | Sensitive/external write |
| Research providers | Firecrawl and Apify adapters | Refresh company/job intelligence with provider provenance and bounded results | Match or scheduled refresh | Read-only | Read |
| Outcomes | `application_outcomes`, bandit/preference learning | Attribute outcomes to source, resume variant, and preparation bundle | Outcome recorded | Learning and recommendation only | Read |
| Reliability | Leases, heartbeat, recovery events | Retry transient tasks, reclaim stale work, dead-letter exhausted runs, expose health metrics | Lease expiry or failure | Pause and surface truthfully | None |

## Canonical wiring rule

Every automation begins with a tenant-bound event envelope containing an event ID, event type, tenant ID, user ID, occurred-at timestamp, source, and bounded payload. The router deduplicates by event ID, checks the automation definition and capability scope, creates an idempotent `automation_run`, and enqueues only a named task. The worker owns leases and checkpoints. Any draft, sensitive, external-write, or submission step is resolved through the canonical approval boundary; email and WhatsApp are delivery channels only and never decision authority.

The event router must not infer identity from event payloads, execute arbitrary tool names from an allowlist without a registered handler, or treat provider acceptance as delivery or external success. Provider-specific payloads are normalized before routing, and all provider calls retain provenance, correlation IDs, and tenant ownership.

## Deliberate launch defaults

Read-only discovery, matching, enrichment, learning, in-app reminders, and draft generation may be implemented behind the workspace automation capability. Google Workspace writes, outbound email, WhatsApp, external provider writes, and autonomous submission remain separately gated and disabled by default in staging and production. Autonomous job submission remains outside the first-release enablement path regardless of approval state.
