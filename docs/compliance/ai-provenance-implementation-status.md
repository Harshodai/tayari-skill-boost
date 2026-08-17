# Tayari A2A Evidence and EU AI Provenance Implementation Status

**Status:** Implemented locally; not a legal compliance certification. The repository now has a provenance foundation and disclosure path, but production claims still require staging evidence, historical backfill, deployment-specific classification, and review by qualified EU regulatory/privacy counsel.

## 1. A2A Agent Cards updated in `bd59705`

The hardening commit adds `required_capability` to `AgentCard` and makes discovery filter child cards by launch scope. The cards are not new autonomous permissions: they describe registered agents, and their visibility is conditional on the capability registry.

| Agent Card | Source | Required capability | Operational effect |
|---|---|---|---|
| `ats-assistant` | `backend/python/app/a2a/agents/ats_agent.py` | `workspace.ats_assistance` | Hidden from discovery when ATS assistance is outside launch scope. |
| `resume-optimizer` | `backend/python/app/a2a/agents/optimizer_agent.py` | `workspace.resume` | Hidden from discovery when resume assistance is disabled. |
| `truth-gate` | `backend/python/app/a2a/agents/truth_gate_agent.py` | `workspace.resume` | Hidden with the resume capability; it does not advertise an independently enabled skill. |
| `interview-coach` | `backend/python/app/a2a/agents/interview_coach_agent.py` | `workspace.interview_prep` | Hidden from discovery when interview preparation is disabled. |
| `job-search` | `backend/python/app/a2a/agents/job_search_agent.py` | `workspace.application_tracker` | Hidden from discovery when application-tracker/job-search capability is disabled. |

The system Agent Card is assembled in `backend/python/app/a2a/registry.py`. `bd59705` also hardens signed Agent Card discovery so the outbound fetch uses the same HMAC timestamp/nonce/body contract as dispatch.

## 2. Replay and message-integrity evidence

The implementation is in `backend/python/app/a2a/federation.py` and inbound enforcement is in `backend/python/app/api/a2a_routes.py`.

The signed payload is:

```text
HMAC-SHA256(shared_secret, timestamp + "." + nonce + "." + raw_request_body)
```

The verifier checks required headers, bounded header lengths, integer timestamp parsing, a default five-minute clock-skew window, constant-time signature comparison, and one-time nonce use. The body is the raw request body, not parsed and reserialized JSON, so body tampering is detected even when the semantic JSON content could otherwise remain equivalent.

Redis is the replay authority in staging and production. Nonces are claimed atomically with `SET NX` and a five-minute expiry. Redis absence or failure is a hard rejection in staging/production; development uses a bounded in-memory fallback only for local testing. This distinction is essential because process memory cannot enforce replay protection across replicas or restarts.

The focused evidence run after the signed-discovery update was:

```text
17 passed in 5.46s
```

The focused tests cover signed federation authorization, development bearer compatibility, signature tampering, timestamp/nonce integrity, replay rejection, production/staging Redis dependency, capability isolation, and capability-filtered Agent Cards. The full post-change Python suite was:

```text
802 passed, 4 skipped, 2 warnings in 8.87s
```

The logs are available from the validation run at `/tmp/tayari-provenance-release-validation.log` in the execution environment; the corresponding full terminal capture was saved under `/home/ubuntu/terminal_full_output/2026-08-17_18-51-57_551350_774.txt`.

## 3. Provenance model implemented for Tayari

The new forward-only migration is `backend/db/migrations/20260817_01_ai_provenance.sql`, mirrored as `supabase-local/volumes/db/init/37-20260817_ai_provenance.sql` and mounted in `supabase-local/docker-compose.yml`.

| Layer | Implementation |
|---|---|
| AI registry | `ai_applications` and `ai_models` hold service-owned application/model metadata. They are RLS-enabled and server-only. |
| Artifact identity | `artifacts` provides owner-scoped logical artifacts, classification, disclosure status, sensitivity, and retention class. |
| Version identity | `artifact_versions` records SHA-256 content identity, MIME type, storage reference, parent version, and supersession. Raw content is not stored in the provenance tables. |
| Origin graph | `artifact_origin_events` is append-oriented, idempotent by `(user_id, idempotency_key)`, hash-bound, and records human, AI, external-provider, A2A, MCP, import, review, correction, and dispute events. |
| Disclosure projection | `artifact_disclosures` stores the policy/evaluator version, user-facing label, reason codes, confidence, review state, channel, and supporting event references. |
| Owner access | Authenticated users receive read-only owner-scoped access; writes are service-role-only. Every table is RLS-enabled. |
| Machine-readable access | `/api/v1/provenance/artifacts`, `/api/v1/provenance/artifacts/{id}`, `/api/v1/provenance/artifacts/{id}/disclosure`, and `/api/v1/provenance/export` expose typed JSON envelopes through the Go gateway. |
| Historical gap handling | `scripts/backfill_provenance.py` defaults to dry-run and writes only explicit `unknown` records with a stable reason when `--apply` is intentionally supplied. |

The classification vocabulary is deliberately conservative: `human_only`, `ai_assisted`, `ai_generated`, `ai_transformed`, `machine_imported`, `unknown`, and `disputed`. Missing evidence never becomes human authorship by inference.

## 4. Artifact-producing paths covered

The implementation instruments the candidate-safe Agent Squad review workflow, core AI routes for strategic analysis, resume optimization, cover letters, and interview preparation, and governed Firecrawl/Apify external research. Captured records contain hashes and bounded workflow/provider metadata, not raw résumé text, prompts, credentials, cookies, or provider payloads. The frontend exposes typed provenance APIs and a Knowledge Hub badge that renders `Origin not recorded` when an older resource lacks an attached record.

The Go gateway now proxies provenance operations under both `/api/v1/provenance/...` and `/api/provenance/...`, preserving repository route parity and forwarding only the verified identity header.

MCP tools and some A2A federation paths still require an explicit owner-bound context before they can create durable user-scoped provenance. They must remain `unknown` or operationally blocked rather than inventing an owner from a caller-controlled value.

## 5. EU AI Act-oriented plan and boundaries

The design responds to a real systems problem: disclosure is a retrieval problem. A label is only defensible when the organization can retrieve the artifact, its version, its origin events, the producing application/model, the relevant policy/evaluator versions, and the completeness gaps.

The technical plan distinguishes five controls:

| Control | Tayari role | What it does not do |
|---|---|---|
| Metadata schema | Records origin, producer, time, hashes, policy, and disclosure state. | It does not prove that a source claim is factually true. |
| Controlled vocabulary | Ensures consistent `ai_assisted`, `ai_generated`, `unknown`, and related labels. | It does not decide EU legal scope for every customer or workflow. |
| Ontology/event graph | Connects artifact versions to inputs, applications, models, providers, A2A/MCP boundaries, human review, and corrections. | It does not replace technical documentation, risk management, or privacy records. |
| Machine-readable export | Makes origin records queryable and exportable as versioned JSON. | It is not automatically a legal filing or a universal watermark. |
| UI disclosure badge | Presents an understandable label and an explicit unknown state. | It does not by itself satisfy every applicable transparency or labeling obligation. |

The legal starting point is the current consolidated EU AI Act text and the Commission’s Article 50 guidance. The Commission states that Article 50 transparency obligations apply from 2 August 2026 and include machine-readable marking for certain AI-generated/manipulated content and disclosure obligations for specified deployer scenarios [1] [2]. The Commission’s Code of Practice is a voluntary practical route for demonstrating adequacy; it does not replace the legal obligations [3]. The exact applicability to Tayari depends on role, system purpose, content type, audience, human review/editorial control, and customer deployment context.

## 6. Remaining gates before making compliance claims

Local code and contract evidence does not prove production compliance. Before enabling customer-facing claims, the repository needs a staged governance and evidence program:

| Gate | Evidence required |
|---|---|
| Scope mapping | A system inventory mapping each Tayari workflow, model/provider, customer role, content type, audience, and jurisdiction to the applicable AI Act obligation and any parallel GDPR/employment/consumer rule. |
| Historical baseline | A dry-run backfill report with unknown/disputed counts by workflow and a signed decision on retention, correction, and owner notification. |
| Two-tenant access | Live PostgreSQL negative tests proving user A cannot read, export, update, or infer user B’s artifacts, versions, events, or disclosures. |
| Production provider identity | Real model/provider metadata, model version, application registry entries, and A2A/MCP owner-bound identity propagation. |
| Disclosure acceptance | UX, wording, icon, accessibility, localization, and audience tests reviewed by product, privacy, and counsel owners. |
| Marking strategy | Decision on whether applicable outputs need machine-readable marking, watermarking, content credentials, or an equivalent documented control; metadata alone may not be enough for every content class. |
| Audit and restore | Backup/restore proof for all provenance tables, immutable event history, retention/deletion behavior, export redaction, and incident-response procedures. |
| Operational resilience | Alerts for write failures, unknown-rate spikes, evaluator/version drift, correction events, and cross-tenant anomalies. |

## 7. Final validation matrix

| Check | Result |
|---|---|
| Go gateway tests | Passed in the full validation matrix; the provenance package also passed `go test ./internal/api ./internal/capabilities ./internal/config`. |
| Python suite | **802 passed, 4 skipped**. |
| Frontend | **42 test files passed; 149 tests passed**; production build passed in 6.17 seconds. |
| RLS contract | Passed, including new artifact/event/disclosure tables and server-only AI registries. |
| Route authorization | Passed. |
| Observability | Passed. |
| Self-hosted migration parity | Passed; **5 required mirrored migrations** verified. |
| Provider configuration | Passed without live Firecrawl/Apify calls. |
| Security scan | Passed with **0 unresolved findings**. |
| Master release contract | **46 passed, 0 failed**; promotion gate passed. |
| Backfill dry run | Correctly blocked because durable database storage was unavailable in the sandbox; no write occurred. |

## References

[1]: https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng "Regulation (EU) 2024/1689 — EUR-Lex consolidated legal text"

[2]: https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations "European Commission — Guidelines on transparency obligations under Article 50"

[3]: https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content "European Commission — Code of Practice on Transparency of AI-generated Content"
