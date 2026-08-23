# Tayari Skill Boost — Production Architecture

## Scope and current release boundary

Tayari is a reviewable job-application workspace. The public release promise is resume tailoring, opportunity triage, cover-letter drafting, and candidate-controlled review. Desktop, extension, browser automation, coaching, and other advanced surfaces remain internal evaluation capabilities until their live evidence gates are closed.

The architecture is intentionally split between a browser frontend, a Go gateway, a Python AI/async service, PostgreSQL/Supabase, Redis/Celery, and external providers. The Go service is not an LLM execution layer; complex AI, NLP, scraping, and browser automation remain in Python.

## System map

```text
User browser
    |
    | HTTPS / authenticated browser requests
    v
React + TypeScript + Vite frontend
    |
    | API calls through centralized apiFetch
    v
Caddy / Nginx public edge
    |
    v
Go gateway (JWT/auth, routing, CRUD, owner predicates, proxy)
    |                         \
    | database/auth/CRUD         \ reverse proxy for AI routes
    v                            v
Supabase Auth + PostgreSQL      Python FastAPI AI service
    |                            |
    |                            +--> LLM provider / Ollama
    |                            +--> Hermes provider tiers
    |                            +--> browser-use + Playwright
    |                            +--> object/file storage paths
    v                            v
PostgreSQL system of record <--- Celery workers <--- Redis queue/cache
    |
    +--> metrics, structured logs, alerts, audit records
```

The diagram is a logical system map. It does not claim that every optional provider is configured or that every internal surface is part of the public release.

## Workload responsibilities

| Workload | Responsibility | Must not own |
|---|---|---|
| Frontend | User interaction, route visibility, validation, loading/error/empty states, authenticated API calls | Direct Python calls, server-side authorization, irreversible external submissions |
| Go gateway | JWT/authentication, routing, CRUD, owner predicates, request identity, rate limits, proxying approved AI routes, readiness | Complex LLM/NLP logic, hidden autonomous action, unverified user identity |
| Python API | AI inference, NLP, resume processing, Hermes scraping, browser automation coordination, async task orchestration | Treating client-provided identity as authoritative, bypassing human approval, direct public exposure |
| Celery worker/beat | Long-running AI/scraping/background work and scheduled tasks | Unbounded retries, irreversible submission without an approved handoff |
| PostgreSQL/Supabase | System of record for users, applications, audit/state transitions, sensitive answer snapshots, evidence, and operational state | Being treated as optional for durable workflows |
| Redis | Queue/cache and recoverable worker state | System-of-record storage or the sole source of cancellation/approval truth |
| Caddy/Nginx | TLS/public edge, static frontend serving, reverse proxy, health endpoints, security headers | Business authorization or direct database access |

## Trust boundaries

1. **Browser to public edge.** Treat all browser input, hidden fields, IDs, and headers as untrusted. Authentication tokens must be validated by the server.
2. **Public edge to Go gateway.** Forwarded headers are trusted only from configured proxy networks. `TRUSTED_PROXY_CIDRS` is required in deployable environments.
3. **Go gateway to Python.** The gateway must forward verified user identity and owner context; Python must reject synthetic/default identities.
4. **Services to PostgreSQL/Supabase.** Every user-owned read/write/transition must include an owner predicate and database authorization must be backed by RLS and least-privilege grants.
5. **Services to external providers.** Provider output is untrusted and must be bounded, sanitized, timeout-limited, and treated as potentially prompt-injected or malformed.
6. **Worker to external side effects.** External applications, emails, payments, or submissions require explicit human approval and durable handoff state. `AUTONOMOUS_SUBMIT_ENABLED=false` is mandatory.
7. **Telemetry boundary.** Logs and metrics must not contain passwords, tokens, secrets, or unnecessary sensitive payloads.

## Critical dependencies

| Dependency | Class | Failure behavior | Current verification |
|---|---|---|---|
| PostgreSQL/Supabase | Critical | Readiness fails closed; durable queues and state must not appear empty during outage | Local restore and failure contracts pass; real managed staging readiness BLOCKED |
| Redis/Celery | Critical for async workflows; degradable for synchronous pages | Queue outage must surface a controlled error and pause unsafe work | Local outage/recovery passed; managed production path NOT VERIFIED |
| LLM provider | Critical for AI features, degradable for non-AI pages | Provider failures should be bounded, visible, and non-submitting | Contract exists; provider configuration/quotas NOT VERIFIED |
| Supabase Auth | Critical for hosted auth mode | Authentication failure must not become synthetic identity | Local/contract evidence exists; real production Auth NOT VERIFIED |
| Hermes providers | Optional/degradable by tier | Circuit breakers and safe failure allow lower tiers or no results | Hostile and provider contracts exist; live provider acceptance NOT VERIFIED |
| Browser automation | Internal/high-risk | Cancellation must terminate the real session; manual-submit boundary remains | Cancellation contracts exist; real external portal staging NOT VERIFIED |
| Object/file storage | Critical for uploaded documents | Upload errors must be explicit; no silent loss | Local/container behavior tested; production storage acceptance NOT VERIFIED |

## Expensive operations and state transitions

The expensive paths are PDF/OCR ingestion, LLM optimization, multi-board scraping, semantic ranking, browser automation, and large background batches. They must be queued or bounded, carry budgets/timeouts, expose status, and support cancellation.

The high-risk state transitions are task creation, approval/handoff creation, candidate answer confirmation, application package generation, external submission, verification receipt creation, account deletion, and privacy purge. Each transition requires verified owner context, durable persistence, idempotency where retries are possible, and an audit record.

## Simplification and scale risks

The cost-conscious architecture avoids an unnecessary load balancer, NAT gateway, RDS, or ElastiCache for the initial low-cost canary. The first likely constraints at higher traffic are Python/LLM concurrency, browser sessions, provider rate limits, queue depth, PostgreSQL connection and query load, upload storage growth, and telemetry/LLM spend. A representative measured capacity test is still required; no theoretical capacity is presented as measured.

## Evidence and open risks

The architecture is **documented and code-aligned at the repository level**. Real managed dependency reachability, provider behavior, public ingress, cloud observability, cloud recovery, and measured scale remain `BLOCKED` or `NOT VERIFIED` in [`PRODUCTION_ISSUES.md`](../../PRODUCTION_ISSUES.md).

## References

- `README.md` — current product scope and stack.
- `docs/Deployment_Architecture.md` — deployment topology and operating boundaries.
- `.agents/AGENTS.md` — service separation and production safety constraints.
- `.ruthless-evidence/PRODUCTION_READINESS_REPORT.md` — verified release evidence and remaining blockers.
- `PRODUCTION_ISSUES.md` — shared second-pass issue register.
