# Job Tayari Release-Completion Register

> **Release rule:** A user-facing claim is not production-ready until its interface, gateway route, service contract, persistence lifecycle, consent boundary, observability, failure behaviour, and tests are all verified. A polished screen alone is not completion.

This register is the single reconciliation point for the current hardening pass. Each workstream has an independent owner path during audit, but no workstream is considered complete until it is reconciled against the end-to-end candidate experience.

| ID | Independent workstream | Completion evidence required | Initial state |
|---|---|---|---|
| WS-01 | Omnisave AI source lifecycle | Candidate-selected source intake, SSRF/robots policy, extraction, durable source/chunk persistence, listing after restart, user-scoped deletion, and citation-grounded Q&A | Assessment in progress |
| WS-02 | Frontend-to-gateway contract integrity | `apiFetch` usage, accurate request/response types, loading/error/empty states, source visibility, candidate controls, and regression coverage | Assessment in progress |
| WS-03 | Go gateway, identity, and route authority | One authoritative handler per route, authenticated user propagation, rate limits, schema validation, stable error semantics, and no legacy-path data split | Assessment in progress |
| WS-04 | AI-worker safety and durable orchestration | Explicit task/run states, idempotency, cancellation, timeout/receipt handling, source provenance, model-failure honesty, and background-job boundaries | Assessment in progress |
| WS-05 | Browser-computer and application safety | Per-run/browser lease, domain/capability restrictions, human takeover, audit events, prompt-injection escalation, and irreversible-action approval | Assessment in progress |
| WS-06 | Connector, messaging, and privacy lifecycle | Least-privilege scopes, revocation, token/session references, delivery receipts, data export/deletion, and safe provider-specific capability states | Assessment in progress |
| WS-07 | Open-core extraction boundary | Standalone protocol contracts, tests, documentation, licence/NOTICE, zero imports of Cloud implementation, and an explicit commercial-responsibility boundary | Assessment in progress |
| WS-08 | Build, test, migration, and deployment integrity | Unit and contract tests, production frontend build, Go/Python checks, migration verification, upgrade notes, and no unstaged unrelated files in a release commit | Assessment in progress |
| WS-09 | Candidate-facing truthfulness and UX | Capability disclosures, safe default modes, no fabricated completion statements, accessible controls, action history, and recovery guidance | Assessment in progress |

## Non-Negotiable Completion Matrix

Every capability must be checked against the following matrix before it can be marked as ready. A failure in one column reopens the capability regardless of success in other columns.

| Layer | Questions that must be answered affirmatively |
|---|---|
| Candidate intent and consent | Is the action purpose-specific, time-bounded, revocable, and understandable before it runs? |
| API and identity | Does the gateway authenticate the candidate, validate the request, and forward only necessary identity context? |
| Durable storage | Does a server restart preserve the right data, isolate tenants, deduplicate retries, and permit deletion? |
| Worker execution | Is expensive or network-bound work queued or bounded, idempotent, observable, and cancellable? |
| Evidence and truth | Can the result be traced to source material, and does the system decline unsupported answers? |
| Failure behaviour | Are timeout, unavailable provider, blocked source, duplicate, and partial-success outcomes explicit and recoverable? |
| Candidate interface | Can the candidate see the plan/state, stop or delete the work, understand limitations, and retry safely? |
| Test and operations | Is there automated verification plus logging/metrics/audit evidence sufficient to investigate a production incident? |

## Deliberate Boundaries

Job Tayari must not imply that it can enumerate or copy private saved-item lists from LinkedIn, Medium, or Substack without an authorised, provider-permitted integration or a candidate-provided export. Public URLs deliberately selected by a candidate may be imported subject to the platform’s access rules and the product’s scraping policy. Application submission, credential entry, CAPTCHA/MFA handling, sensitive self-identification fields, account changes, and outbound messages require human confirmation at the appropriate step.

The proposed open-source **Tayari Protocol** may publish portable state-machine contracts, approval receipts, source-provenance schemas, and conformance tests. **Tayari Cloud** remains private and commercial: it owns the web application, identity, connectors, provider credentials, browser workers, queue deployment, managed storage, analytics, observability, policy configuration, and enterprise operations.

## Audit Output Convention

The implementation report will update each workstream with: observed defect or assurance, affected user path, risk classification, code/migration/test reference, validation command, release disposition, and remaining external dependency. Items blocked by third-party product policies or credentials will be stated as blocked—not hidden behind an interface that simulates completion.


## Reconciled Status — 13 August 2026

The entries below distinguish **implemented and locally verified** work from the production conditions that remain intentionally gated. “Complete” means the reviewed source path now has a coherent contract and automated evidence; it does not mean an unconfigured external provider has magically become available.

| ID | Reconciled status | Implemented evidence | Validation evidence | Remaining gate before a public capability claim |
|---|---|---|---|---|
| WS-01 | **Implemented and locally verified** | `import_public_url()` accepts only a candidate-selected public URL, validates the extraction target, stores source and chunks durably, rejects cache-only success, lists tenant-owned sources, deletes source/chunks by `user_id`, requires the durable store to be reachable before answering, and returns bounded source excerpts with citations. | `python3 -m pytest app/tests/test_omnisave_agent_reach.py app/tests/test_knowledge_hub_routes.py -q` — 10 passed, 1 intentionally skipped; the API exposes storage loss as 503. | Production Postgres migration must be applied; a controlled extraction worker and provider-access policy must be operating. Private saved-list synchronisation remains unavailable by design. |
| WS-02 | **Implemented and locally verified** | The UI uses typed `POST /v1/saves/import` and `DELETE /v1/saves/{sourceId}` contracts, reloads durable state after import, provides a delete confirmation, disables controls during backend outages, and renders cited excerpts. | `npx vitest run src/test/OmnisaveApi.test.ts --environment happy-dom` — 2 passed; `npx tsc --noEmit` and `npm run build` passed. | The deployed frontend must target the deployed authenticated Go gateway. |
| WS-03 | **Implemented and locally verified** | The Go one-stop gateway exposes the authoritative import and candidate-scoped delete routes rather than letting the UI call a legacy pseudo-sync endpoint. | `cd backend/go && go test ./internal/api` passed. | Rate-limit and production-auth configuration must be enabled at the gateway deployment. |
| WS-04 | **Implemented and locally verified; production recovery gate remains** | The durable control plane now records immutable candidate-scoped `run_events`, persisted cancellation intent and acknowledgement, and short worker leases. The candidate-visible browser-control endpoint returns the owned run’s state, explicit cancellation/lease booleans, and bounded chronological history; it returns 403 for a foreign run, 404 for a missing run, and 503 when durable storage is unavailable. Celery is configured for late acknowledgements and worker-loss rejection. | `python3 -m pytest app/tests/test_run_control.py -q` — 6 passed; authenticated Go route compilation/tests and `npx tsc --noEmit` passed. | Run real-Postgres migration and crash/retry/dead-letter drills. Process-local compatibility paths must not be relied on as proof of durable recovery. |
| WS-05 | **Locally hardened; remains a production release gate** | Browser runs acquire and release candidate-bound durable leases; the worker watches durable cancellation intent and acknowledges an observed stop. The gateway authenticates every start/stream/cancel/control-state operation, and the Control Room now loads database-backed run evidence instead of presenting synthetic progress. AgentSpace produces drafts only and never simulates external submission. | `python3 -m pytest app/tests/test_run_control.py app/tests/test_agentspace_submission_safety.py -q` — 8 passed; `cd backend/go && go test ./internal/api/...` passed. | A true isolated per-candidate browser-worker proof of concept, visible live takeover, credential handoff boundary, artefact-bound final-click approval, and end-to-end portal test are required before any Manus-equivalent browser-computer claim. |
| WS-06 | **Implemented foundation; provider activation gated** | A channel-owned idempotent `delivery_ledger` now queues, claims, records provider receipts, and retries Telegram Bot API or official Meta WhatsApp Cloud API messages. A 30-second Celery dispatcher is registered; it fails closed when required provider configuration is absent. Web-only final approval remains mandatory. | `python3 -m pytest app/tests/test_delivery_ledger.py -q` — 4 passed. | Telegram bot credentials, Meta Cloud API credentials, signed webhooks, opt-in/opt-out, encrypted secret storage, revocation, deletion, and ambiguous-delivery drills must pass before messaging is enabled. |
| WS-07 | **Implemented and locally verified** | The extractable MIT-licensed `@tayari/protocol` now contains portable consent/application and run states, safe cancellation transitions, exact worker-lease checks, receipt verification, and final-submission approval binding checks, with no Cloud imports. | `cd open-core/tayari-protocol && npm test` — 7 passed. | Extract to a separate repository with CI, changelog, contribution policy, synthetic fixtures, licence review, semantic-release process, and a pinned Cloud dependency. |
| WS-08 | **Implemented and locally verified; deployment process gate remains** | The repository uses an explicit `vitest.config.ts` with browser-like DOM, source aliases, deterministic cleanup, offline-safe fetch, and runner-neutral tests. CI now verifies that required database migrations are byte-for-byte mirrored into the self-hosted bundle, mounted by Compose, and materialise required tables after startup. | `npm test` — 32 files / 94 tests passed cleanly; `npm run build`, `npx tsc --noEmit`, `npm run security:scan`, `python3 scripts/verify_self_hosted_migrations.py`, and focused Go/Python/protocol checks passed. The security scan returned 115 existing baselined findings and no new findings. | Make the complete suite, real-Postgres migration smoke test, and deployment health checks required protected-branch checks before release. |
| WS-09 | **Implemented for Omnisave; broader rollout pending** | Omnisave explicitly states URL-import-only scope, avoids simulated synchronisation, exposes durable failure states, requires a delete confirmation, and shows citation evidence. | Component/API contract and build checks passed. | Apply the same audited capability-state treatment to every remaining connector, agent, and browser-control surface before a broad “fully automated” claim. |

### Immediate TODO Queue — Nothing Implicit

| Priority | Owner surface | Work item | Definition of done |
|---|---|---|---|
| P0 | Deployment | Apply and verify `saved_sources`/chunk migrations in a non-production environment; run import, restart, list, question, delete, and tenant-isolation smoke tests against real Postgres. | A fresh worker process can retrieve exactly the candidate’s imported source; deletion removes retrieval eligibility and child chunks. |
| P0 | Orchestrator | Execute real-Postgres crash/retry and dead-letter recovery drills for the implemented durable event ledger, leases, cancellation acknowledgement, and delivery claims; extend idempotency coverage to every connector action. | A forced worker crash and retry cannot duplicate an external action or lose an approval/revocation event. |
| P0 | Browser control | Deliver isolated, candidate-scoped browser sessions with a visible takeover and an exact final-submission approval binding. | A security test proves one candidate cannot access another candidate’s cookies/files, and a final click cannot occur without a current artefact-bound approval. |
| P1 | Connectors | Activate the implemented Telegram and official WhatsApp Cloud API adapters only after credentials, signed webhooks, consent/opt-out, encrypted secret storage, and provider-compliance tests are complete. | Opt-out, `/stop`, retry, ambiguous delivery, and deletion behaviours are automated and observable. |
| P1 | Open source | Extract `open-core/tayari-protocol` into its own public repository and make private Cloud import a pinned published version. | Clean clone builds and passes conformance tests without private code, credentials, candidate data, or provider policies. |
| P1 | CI enforcement | Require the repaired Vitest suite plus Go, Python, protocol, migration, and deployment smoke tests in the protected-branch pipeline. | `npm test` is reproducible from a clean checkout and the combined CI status is required for merge. |
| P2 | Product proof | Conduct usability, accessibility, load/recovery, privacy/deletion, and provider-compliance reviews with logged remediation. | No severity-one issue remains and the public capability matrix matches demonstrated behaviour. |

> **Truthful readiness position:** Omnisave’s public-URL workflow is now end-to-end in code and locally verified. Job Tayari is **not yet entitled** to claim a fully autonomous Manus-equivalent browser computer, private social saved-list sync, or production messaging integration until the P0/P1 gates above are demonstrably passed.
