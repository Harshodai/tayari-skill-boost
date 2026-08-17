# A2A and MCP Provider Adapters

## Scope

Tayari now separates external research and agent federation from core workspace authorization. The Python service exposes a typed external-research adapter for Firecrawl and allowlisted Apify Actors, plus an outbound A2A federation client. Both surfaces are disabled in staging and production until their capability flags are explicitly enabled.

## Provider roles

| Integration | Appropriate first use | Explicitly out of scope |
|---|---|---|
| Firecrawl MCP/API | Public job-posting and company-page search, scrape, and structured extraction with citations | Private ATS portals, credentialed pages, application submission, unrestricted crawling |
| Apify MCP/API | Public research through a reviewed Actor allowlist, bounded datasets, and tenant-scoped enrichment | Arbitrary Actor discovery, private account scraping, anti-bot bypass, irreversible actions |
| A2A | Delegation between approved research/review agents using signed, bounded tasks | Trusting arbitrary agent URLs, remote capability escalation, sending/purchasing/submitting without human approval |

## Environment contract

Set `FIRECRAWL_API_KEY` or `APIFY_API_TOKEN` only in the deployment secret manager. The corresponding base URLs are pinned to approved hosted endpoints by the adapter. Apify requires both `APIFY_RESEARCH_ACTOR_ID` and membership in `APIFY_ALLOWED_ACTORS`; a caller cannot choose an arbitrary Actor.

Set `CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH=true` only after staging provider tests pass. Set `A2A_FEDERATION_SECRET`, `A2A_ALLOWED_PEERS`, and `CAPABILITY_INTEGRATION_A2A_FEDERATION=true` only for an approved partner allowlist. Never place any of these secrets in MCP input, database rows, logs, generated frontend bundles, or agent cards.

## Trust and data controls

Every provider request is associated with the verified subject, optional tenant context, and request ID. Provider results are bounded and sanitized. URLs are restricted to public HTTP(S) destinations; private, loopback, link-local, reserved, multicast, localhost, and internal destinations are removed or rejected. Remote page content is untrusted data and must not become instructions for tools, capabilities, or authorization.

The adapter returns normalized research records and intentionally does not persist raw provider payloads. A future persistence layer must add tenant-owned rows, provenance, retention, deduplication, and deletion semantics before storing results. Provider timeouts, rejection, missing credentials, and budget failures are mapped to non-success responses rather than empty or fabricated results.

## A2A federation controls

The outbound client requires the federation capability, a configured peer allowlist, HTTPS public peer URLs, a shared signing secret, and a SHA-256 Agent Card fingerprint. Dispatch requests include timestamp, nonce, and HMAC signature headers. The receiving side must add durable nonce replay protection and signature verification before production federation is enabled; the current legacy inbound route remains shared-secret authenticated and is not, by itself, a complete federation trust boundary.

Remote agents may request only explicitly registered skills. Their responses cannot grant new permissions or activate autonomous capabilities. Consequential operations remain behind Tayari’s existing human-in-the-loop and launch-scope guards.

## Staging acceptance

The first staging campaign should use synthetic job/company queries and disposable provider credentials. It must prove provider authentication, allowlist enforcement, budget and timeout behavior, SSRF/private-IP rejection, prompt-injection containment, tenant isolation, redacted telemetry, duplicate-request idempotency, and disabled-capability responses. A provider with missing credentials or incomplete safety evidence remains blocked rather than being treated as available.

## Official provider references

- [Apify MCP documentation](https://docs.apify.com/integrations/mcp)
- [Apify MCP connectors](https://docs.apify.com/integrations/mcp-connectors)
- [Firecrawl MCP documentation](https://docs.firecrawl.dev/mcp-server)
- [A2A protocol](https://github.com/a2aproject/A2A)
