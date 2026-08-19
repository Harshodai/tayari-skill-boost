# JobTayari Apify/Firecrawl Parity Benchmark

**Date:** 19 August 2026
**Author:** Manus AI
**Repository:** `Harshodai/tayari-skill-boost`
**Scope:** Credential-free end-to-end parity of JobTayari’s in-house external-research adapters against the documented operating methods of Apify and Firecrawl.

## Executive judgment

> **Verdict:** JobTayari has a well-governed provider boundary, but it does not yet have production-grade provider parity. Firecrawl search is a bounded and defensible synchronous adapter. Apify is currently only a run-submission adapter: it starts an Actor and discards the run lifecycle and dataset output. Therefore, the Apify integration cannot produce actual research results and must remain disabled in production until result retrieval, durable state, retries, and terminal failure handling are implemented.

The benchmark is deliberately strict. It treats a provider integration as complete only when it authenticates safely, starts the provider operation, tracks the operation to a terminal state, retrieves all required output, normalizes and bounds the output, preserves tenant and provenance context, handles transient failures, and exposes enough telemetry to operate the workflow. By that standard, the current implementation demonstrates strong security and governance fundamentals but falls short on asynchronous execution semantics and feature breadth.

The current **provider-parity score is 5.1/10**, not greater than 9.5/10. The score is intentionally not inflated by the repository’s passing unit and release-contract suites. The repository is materially stronger than a prototype, but the external-provider boundary contains one functional P0: the Apify path returns `result_count=0` after receiving a run ID and never polls or reads the dataset. The score can exceed 9.5 only after the P0 lifecycle work and the P1 reliability and observability work in this report are implemented and verified with live staging credentials.

## Evidence and method

The comparison uses four evidence layers. First, the in-house implementation and its focused tests were inspected directly. Second, the official Apify API and webhook documentation and the official Firecrawl Search and Crawl documentation were used as primary behavioral references. Third, public GitHub repository metadata and SDK documentation were used to compare ecosystem maturity. Fourth, a credential-free parity probe exercised the adapters against deterministic mock responses so that no provider secret or paid live request was required.

The focused test run completed **25 tests successfully** across external research, capability gates, and automation-event coverage. The dedicated probe verified Firecrawl result bounding and private-URL removal, Apify run acknowledgement behavior, missing-credential fail-closed behavior, and Apify Actor allowlisting. The full repository verification status inherited from the previous hardening pass remains: Go tests passed; 864 Python tests passed with 4 skipped; 151 frontend tests passed; the frontend build passed; the MCP governance contract passed; and the release contract passed 46/46 checks. These repository gates do not substitute for live provider verification because no valid Firecrawl or Apify credentials were available in this session.

## What JobTayari does well

The in-house provider boundary is substantially more disciplined than an unconstrained HTTP integration. `ResearchRequest` constrains query length and result limits; `ResearchItem` bounds title, URL, description, and source fields; private, loopback, link-local, reserved, multicast, unspecified, `.local`, and `.internal` URLs are sanitized before they reach the response; and credentials are read server-side rather than returned to callers. These controls were exercised by the focused test suite and the parity probe. [9]

Both adapters fail closed when their credentials or required configuration are absent. Firecrawl rejects non-approved hosted endpoints, while Apify rejects non-approved endpoints and Actor IDs that are not in the explicit allowlist. This is a strong supply-chain and SSRF posture: callers cannot select arbitrary provider endpoints or arbitrary Actors through the typed research request. [9]

At the route and capability layers, external research is double-gated: the workspace-level external-research capability and the provider-specific capability must both be enabled. Provider configuration verification also reports Firecrawl and Apify as disabled when the relevant capability is not enabled. This is the right default for staged rollout because credentials alone do not activate a high-risk integration.

Research responses are designed to carry provenance context, and the wider external-research route records a provenance artifact for successful research. That is important for JobTayari’s EU AI Act-oriented auditability work: the result should be attributable to a provider, subject, tenant, request, and time rather than treated as anonymous text. The current adapter-level response model has a provenance slot, while route-level recording supplies the durable audit boundary.

The existing Firecrawl adapter also handles a useful minimum normalization contract. It accepts the provider’s result list, maps common URL and text fields, truncates descriptions to 4,000 characters, removes private URLs, bounds the returned list to the requested limit, and converts HTTP or transport failures into a provider-specific rejection rather than leaking raw transport details. The credential-free probe confirmed the result count, 4,000-character description bound, and private-URL sanitization.

## Credential-free parity results

| Probe | Observed result | Assessment |
|---|---|---|
| Firecrawl response normalization | 2 results returned; the public URL was retained; the 5,000-character description was truncated to 4,000 characters; the loopback URL was replaced with an empty string | **Verified strength** |
| Apify run submission | The mock provider returned `run-123`; JobTayari returned an empty item list and `result_count=0` | **P0 functional gap** |
| Firecrawl missing credential | `ProviderNotConfigured: FIRECRAWL_API_KEY is required` | **Verified fail-closed behavior** |
| Apify Actor policy | An unapproved Actor raised `ProviderRejected: Apify research Actor is not allowlisted` | **Verified policy enforcement** |
| Focused provider/gating/event tests | 25 passed, 1 deprecation warning | **Verified local contract coverage** |
| Live Firecrawl request | Not executed; no staging credential was provided | **Environment-blocked** |
| Live Apify request and dataset retrieval | Not executed; no staging credential was provided | **Environment-blocked** |
| SimilarWeb provider traffic metrics | Every requested domain and metric returned `failed_precondition` because the current user had insufficient Manus credits before the external API call | **Unavailable; no traffic claims made** |

The raw SimilarWeb responses are retained in [`docs/research/similarweb-apify-firecrawl-2026-08.json`](../research/similarweb-apify-firecrawl-2026-08.json). They are supporting evidence only; the report intentionally presents the result as an availability table rather than fabricating traffic, rank, bounce-rate, or channel data.

## Lifecycle parity against Apify

Apify documents a three-stage asynchronous workflow: start an Actor or task, monitor the run by polling the run endpoint, and fetch output items from the run’s default dataset. It also documents pagination for list endpoints and exponential backoff for rate-limit responses. The official Python client exposes the same lifecycle through `call()`, dataset iteration, automatic retries, tiered timeouts, and pagination helpers. [1] [6]

JobTayari currently implements only the first stage. It posts to the legacy-compatible `/v2/acts/{actor_id}/runs` path, validates that a run ID exists, and then returns an empty `ResearchResponse`. It does not persist the run ID in a durable provider-job record, does not poll `/v2/actor-runs/{runId}`, does not inspect terminal status, does not read `defaultDatasetId`, does not request dataset items, does not paginate, does not cancel or abort a stuck run, and does not translate provider terminal states into a durable internal state. [9]

This is not a cosmetic gap. A caller can receive a syntactically valid response that contains no research items even when the remote Actor has succeeded. The current behavior therefore creates a false-success risk unless the route explicitly labels the operation as asynchronous and pending. At minimum, the response contract must distinguish `accepted`, `running`, `succeeded`, `failed`, and `timed_out`; the current empty-success response is not sufficient.

| Apify capability | Official working method | JobTayari status | Priority |
|---|---|---|---|
| Start Actor | POST `/v2/actors/{id}/runs` or compatible legacy prefix | Present, with Actor allowlisting | P0 complete portion |
| Track run | Poll run status until terminal or receive a webhook | Missing | P0 |
| Retrieve results | Read `defaultDatasetId` items, with pagination | Missing | P0 |
| Normalize terminal states | Preserve succeeded, failed, aborted, timed-out, and unknown states | Missing | P0 |
| Rate-limit handling | Retry 429 with exponential backoff and jitter | Missing | P1 |
| 5xx/network retry | Bounded retry policy with failure classification | Missing | P1 |
| Webhooks | Authenticated callback, fast acknowledgement, idempotent processing | Missing | P1 |
| Cancellation | Abort or cancel provider run on timeout or user cancellation | Missing | P1 |
| Run observability | Provider run ID, status, latency, retry count, item count, cost, error class | Partial through wider provenance only | P1 |
| Official client parity | Use typed client or reproduce its lifecycle guarantees | Not used | P1 |

Apify’s webhook documentation further requires a 2xx response, describes exponential retries up to eleven retries, recommends a secret token, warns that deliveries can be duplicated, and advises receivers to acknowledge quickly and queue expensive work. JobTayari’s durable event-inbox and automation-lease work provides a good internal foundation for this, but no Apify webhook receiver currently binds provider events to a tenant-scoped research run. [2]

## Lifecycle and feature parity against Firecrawl

The current Firecrawl path is closer to a useful minimum because Search is synchronous and returns result records directly. The adapter’s normalization logic is compatible with both a top-level list and a nested `data.web`/`data.results` shape, which is a useful defensive choice because the current Firecrawl documentation presents the v2 response as grouped source data. However, the adapter still defaults to `/v1` and sends only `query` and `limit`; the current official examples use `/v2/search` and expose richer search options, including source types, domain filters, location, time filters, categories, and inline `scrapeOptions`. [3] [5] [9]

Firecrawl’s documented Search API can either return search metadata or retrieve page content in the same request. It also supports a two-step search-then-selective-scrape workflow, which is useful when JobTayari needs to rank or filter sources before spending content-extraction credits. JobTayari currently has neither inline content scraping nor a first-class selective-scrape operation, so its output remains closer to search snippets than grounded page content. [3]

The larger gap is asynchronous web extraction. Firecrawl Crawl starts a job, then supports polling, WebSocket watching, or webhooks; it returns paginated results for large crawls, exposes crawl errors separately, and requires HMAC-SHA256 verification through `X-Firecrawl-Signature` before webhook processing. JobTayari has no Firecrawl crawl or batch-scrape adapter, no webhook signature verifier, no result continuation handling, and no durable external-job state machine for those workflows. [4]

| Firecrawl capability | Official working method | JobTayari status | Priority |
|---|---|---|---|
| Search | POST search and normalize web/news/image results | Present in a narrow form | P1 harden |
| v2 endpoint contract | `/v2/search` with grouped response data | Default remains `/v1`; no v2 contract test | P1 |
| Inline scrape | `scrapeOptions` on Search | Missing | P1 |
| Selective scrape | Search first, then scrape selected URLs | Missing | P1 |
| Crawl | Async job plus polling/WebSocket/webhook | Missing | P1 |
| Batch scrape | Async scrape of many known URLs | Missing | P2 |
| Pagination | Follow `next` for large crawl responses | Missing | P1 |
| Crawl-error retrieval | Dedicated crawl errors endpoint | Missing | P2 |
| Webhook verification | HMAC-SHA256 `X-Firecrawl-Signature` | Missing | P1 |
| Retry-after handling | Honor provider backoff signals for 429/5xx | Missing | P1 |
| Content formats | Markdown, HTML, links, screenshots, structured JSON | Only bounded description text | P2 |

## Reliability, security, and operational comparison

JobTayari’s security controls are ahead of its lifecycle controls. The explicit endpoint restrictions, Actor allowlist, capability gates, URL sanitization, bounded fields, tenant/request context, and fail-closed configuration behavior are concrete production safeguards. They reduce SSRF exposure, accidental credential use, arbitrary Actor execution, and unbounded provider payload risk.

The reliability layer is not yet equivalent to the provider clients or documented platform methods. Apify’s official Python client advertises automatic retries for network errors, 429, and 5xx responses, typed responses, tiered timeouts, pagination, and structured errors. Firecrawl’s documented asynchronous methods likewise provide polling/watchers and pagination. JobTayari currently uses a raw `httpx.AsyncClient` with fixed 15-second Firecrawl and 20-second Apify timeouts, raises a generic provider rejection on HTTP failure, and has no `Retry-After` parsing, jittered retry budget, circuit breaker, provider health signal, or external-job reconciliation loop. [4] [6]

The appropriate target architecture is a provider-neutral external job state machine. It should create a tenant-scoped row containing an idempotency key, provider, provider operation ID, requested capability, subject, status, timestamps, attempt count, expiry, and provenance ID. A worker or webhook receiver should transition the row through `accepted`, `running`, `partial`, `succeeded`, `failed`, `aborted`, and `expired`; all transitions should be idempotent and append structured observability events. Result items should be normalized only after verifying ownership, provider authenticity, and terminal or explicitly partial status.

## Ecosystem and SimilarWeb evidence

The public GitHub ecosystem demonstrates a large maturity gap between a narrow in-house adapter and the maintained provider clients. The Firecrawl repository currently reports **169,251 stars**, 9,450 forks, 6,115 commits, and an AGPL-3.0 license. Its repository describes search, scrape, interact, crawl, map, batch scrape, agent, MCP, and multiple SDKs. [5] The official Apify Python client reports **96 stars**, 1,129 commits, and an Apache-2.0 license; despite the smaller star count, its README explicitly documents typed responses, retries, pagination, streaming, and synchronous/asynchronous clients. [6] The official Apify Go client reports **1 star** and identifies itself as official but experimental and AI-generated, while still exposing retries, timeouts, run polling, dataset access, and webhook resources. [7]

| Evidence source | Domains or repositories assessed | Result | Interpretation |
|---|---|---|---|
| SimilarWeb global rank, visits, bounce rate, and desktop traffic sources | `apify.com`, `firecrawl.dev`, `scrapy.org`, `playwright.dev`, `crawlee.dev` | All requests blocked before provider API execution because of insufficient Manus credits | No quantitative traffic or engagement conclusion is permitted |
| Firecrawl GitHub | `firecrawl/firecrawl` | 169,251 stars; broad endpoint and SDK surface | Strong public adoption and ecosystem signal; not proof of SLA for JobTayari |
| Apify Python client GitHub | `apify/apify-client-python` | 96 stars; typed, retrying, paginated official client | Direct implementation reference for P0/P1 lifecycle work |
| Apify Go client GitHub | `apify/apify-client-go` | 1 star; explicitly experimental and AI-generated | Useful API reference, but not a production-dependency recommendation without independent review |

The SimilarWeb result is a **measurement limitation**, not a provider ranking. A future rerun with sufficient credits should collect at least six months of global visits, rank, bounce rate, channel mix, geography, and device split, then render a chart or dashboard from the raw response. Until then, the only defensible conclusion is that SimilarWeb evidence is unavailable for this benchmark.

## Exact gap register

| ID | Gap | Why it matters | Release impact | Required evidence to close |
|---|---|---|---|---|
| P0-APIFY-01 | Apify results are never polled or fetched | The integration cannot return research items after a successful Actor run | Release blocker; keep Apify disabled | Mock lifecycle test plus live staging run proving items, terminal states, timeout, and failure mapping |
| P0-APIFY-02 | Apify run ID is not durable | Worker restart or request retry loses the remote operation | Release blocker for asynchronous operation | Database row with tenant, request, actor, run ID, idempotency key, and reconciliation test |
| P1-RETRY-01 | No `Retry-After`, 429, 5xx, or network retry policy | Transient provider conditions become user-visible hard failures | High | Deterministic retry test with jitter bounds and attempt cap |
| P1-WEBHOOK-01 | No Apify webhook receiver | Long Actor runs require inefficient synchronous request ownership | High | Signed/secret-token callback, duplicate delivery, fast-ack, queue handoff test |
| P1-FIRECRAWL-01 | No Firecrawl crawl, batch-scrape, or selective-scrape path | JobTayari cannot ground research in full page content or multi-page jobs | High | Search-plus-scrape and async crawl lifecycle tests |
| P1-WEBHOOK-02 | No Firecrawl HMAC verification | Callback data could be spoofed or tampered with | High | Raw-body HMAC test with valid, invalid, replayed, and stale events |
| P1-PAGING-01 | No dataset/crawl pagination | Large result sets may be silently truncated | High | Multi-page fixture with `next`/offset continuation and bounded total |
| P1-OBS-01 | Provider telemetry is too thin | Operators cannot explain latency, retries, cost, or provider-specific failures | High | Structured event schema and dashboard/alert assertions |
| P1-CONTRACT-01 | Firecrawl defaults to v1 while current docs show v2 | API drift can silently break response shape or feature access | Medium-high | v2 contract fixture and staging smoke request |
| P2-COST-01 | No provider credit/cost budget enforcement | Crawls and batch jobs can create uncontrolled spend | Medium | Per-tenant budget, preflight estimate, hard stop, and audit event |
| P2-CONTENT-01 | Only short descriptions are normalized | Results are less useful for grounded resume/job research | Medium | Markdown/HTML/structured-content normalization tests |

## Remediation plan

**P0: make Apify functionally real.** Introduce an `external_research_runs` table or extend the existing durable job model with tenant ID, subject, request ID, provider, Actor ID, provider run ID, dataset ID, idempotency key, status, attempt count, deadline, and provenance ID. On submission, persist the row before or atomically with the provider call where possible. Poll the run endpoint with bounded exponential backoff until a terminal status. For `SUCCEEDED`, read the default dataset with pagination, normalize each item through the existing safety policy, and return or enqueue the completed result. For `FAILED`, `ABORTED`, `TIMED-OUT`, or unknown status, return a typed terminal failure and never present an empty result as success. Add cancellation and deadline reconciliation.

**P1: add provider-neutral resilience.** Centralize retry classification for connection errors, 429, and selected 5xx statuses. Honor `Retry-After` when supplied, otherwise apply jittered exponential backoff with a maximum attempt count and total deadline. Emit structured events for request start, accepted, retry, provider status, page fetched, normalization rejection, terminal success, terminal failure, cancellation, and timeout. Never log credentials or full untrusted provider payloads.

**P1: implement webhook paths safely.** Add an Apify callback endpoint bound to a secret token or equivalent authenticated configuration and an idempotent dispatch key. Add a Firecrawl callback endpoint that verifies HMAC-SHA256 against the raw body using timing-safe comparison, rejects stale or replayed events, acknowledges quickly, and places work in the durable event inbox. Reuse the existing tenant-scoped automation event and lease infrastructure rather than creating an ungoverned second queue.

**P1: expand Firecrawl coverage.** Move the adapter contract to the current v2 shape behind a compatibility layer, add explicit source/category/domain/location/time parameters, support inline scrape options, and expose a selective scrape operation. Add asynchronous crawl and batch-scrape jobs with `next` pagination, crawl-error retrieval, maximum pages, maximum bytes, maximum cost, and expiry handling. Preserve the current URL sanitation and bounded-text protections for every returned document.

**P2: strengthen product and cost controls.** Add provider capability cards that distinguish search snippets, full-page grounding, crawl, batch extraction, and autonomous agent features. Add per-tenant provider budgets, preflight credit estimates, hard page and byte limits, and audit entries for provider cost. Make the UI display `accepted/running` rather than implying completion for asynchronous jobs.

## Production-readiness gate

The provider boundary should not be marked production-ready until every row below is green in staging with real provider credentials and a disposable tenant. The gate must include two tenants, worker restart during an active provider run, duplicate webhook delivery, provider 429 and 5xx simulation, invalid signatures, expired jobs, paginated output, private URL payloads, large descriptions, cancellation, and provenance verification. A successful “HTTP 201 from start endpoint” is not sufficient evidence.

| Gate | Required status |
|---|---|
| Apify run submission, polling, terminal mapping, dataset retrieval, and pagination | Must pass |
| Firecrawl v2 search and inline content contract | Must pass |
| Firecrawl crawl/batch job, pagination, error endpoint, and webhook signature | Must pass |
| Retry-after, 429, 5xx, network failure, timeout, cancellation, and idempotency | Must pass |
| Tenant isolation and provenance for every accepted and completed run | Must pass |
| No secrets in logs, database payloads, or user-visible responses | Must pass |
| Cost/page/byte budgets and hard stops | Must pass |
| SimilarWeb rerun with sufficient credits, if quantitative competitor metrics are required | Optional for functionality; mandatory for a traffic benchmark |

## Conclusion

JobTayari’s in-house provider boundary has credible security engineering: it is capability-gated, endpoint-restricted, Actor-allowlisted, fail-closed, provenance-aware, URL-safe, and payload-bounded. Those are real strengths and should be retained. The benchmark nevertheless finds a decisive functional asymmetry: Firecrawl is a narrow synchronous search adapter, while Apify is only a submission stub. Neither path currently matches the durable asynchronous, retrying, paginated, webhook-capable workflow documented by the providers.

The correct next move is not to add more provider names or UI controls. It is to complete the external-job state machine, starting with Apify result retrieval and durable run state, then adding retries, webhooks, Firecrawl crawl/scrape capabilities, pagination, signature verification, cost limits, and provider observability. After those changes are implemented, the same credential-free probe should be extended with lifecycle fixtures and then repeated against real staging credentials. Only that evidence can justify a score above 9.5/10.

## References

[1]: https://docs.apify.com/api/v2 "Apify API v2 documentation"
[2]: https://docs.apify.com/integrations/webhooks/actions "Apify webhook actions, retries, and security documentation"
[3]: https://docs.firecrawl.dev/features/search "Firecrawl Search documentation"
[4]: https://docs.firecrawl.dev/features/crawl "Firecrawl Crawl documentation"
[5]: https://github.com/firecrawl/firecrawl "Firecrawl GitHub repository"
[6]: https://github.com/apify/apify-client-python "Official Apify Python API client"
[7]: https://github.com/apify/apify-client-go "Official Apify Go API client"
[8]: ../research/similarweb-apify-firecrawl-2026-08.json "Raw SimilarWeb provider benchmark output"
[9]: https://github.com/Harshodai/tayari-skill-boost/blob/main/backend/python/app/services/external_research.py "JobTayari external research adapter source"
[10]: https://github.com/Harshodai/tayari-skill-boost/blob/main/backend/python/app/tests/test_external_research.py "JobTayari external research tests"

## Post-remediation implementation snapshot

The original 5.1/10 score in this report is the **pre-remediation baseline** captured before the Apify lifecycle was implemented. The current repository now contains a durable Apify worker path that submits an Actor through the approved `/v2/actors/{actor_id}/runs` endpoint, records the provider run ID before polling, polls `/v2/actor-runs/{run_id}` to terminal state, fetches `/v2/datasets/{dataset_id}/items` with bounded continuation, applies the existing URL and text sanitation, retries transient 429/5xx/network conditions with `Retry-After` support, heartbeats a durable lease, persists bounded results, and records provenance idempotently.

Local evidence for this remediation is **10 focused provider tests passed**, **867 Python tests passed with 4 skipped**, Go tests passed, frontend tests/build passed, the RLS contract passed, the self-hosted migration mirror check passed, and the release contract passed **46/46**. No final 9.5+ score is asserted yet because live Apify execution, staging worker-restart evidence, duplicate webhook evidence, and real provider latency/error behavior remain credential-dependent. Firecrawl crawl/batch-scrape/HMAC webhook parity, provider budgets, and invoking the remote Apify abort endpoint from the cancellation route remain follow-up gates.

The durable migration is `20260823_01_external_research_runs.sql` with self-hosted mirror `44-20260823_external_research_runs.sql`. Apify submissions now return HTTP `202` with an owner-scoped job ID, while Firecrawl retains its synchronous path. The next score review should use the staging gate in this report rather than treating local mocks as live-provider proof.
