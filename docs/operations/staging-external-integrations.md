# Secure Staging Configuration: Firecrawl and Apify

## Scope and default state

Firecrawl and Apify are optional public-research providers. They are **disabled by default** in staging and production because `CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH` defaults off in those environments. Enabling the capability without complete provider configuration must fail the deployment check; missing credentials must never degrade into an apparently successful empty result.

The initial staging scope is limited to synthetic public job and company research. Do not use personal accounts, private ATS credentials, candidate mailboxes, authenticated pages, login/session cookies, or any Actor that can submit applications or take irreversible actions.

## Required staging variables

| Variable | Secret? | Firecrawl value | Apify value | Constraint |
|---|---:|---|---|---|
| `CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH` | No | `true` when explicitly approved | `true` when explicitly approved | Global research switch; keep `false` until staging approvals and disposable credentials exist. |
| `CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH_FIRECRAWL` | No | `true` when Firecrawl is approved | Not used | Provider-specific kill switch; requires the global switch. |
| `CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH_APIFY` | No | Not used | `true` when Apify is approved | Provider-specific kill switch; requires the global switch. |
| `FIRECRAWL_API_KEY` | Yes | Staging-only provider key | Not used | Store only in the staging secret manager. |
| `FIRECRAWL_API_BASE_URL` | No | `https://api.firecrawl.dev/v1` | Not used | Must match the approved HTTPS endpoint exactly. |
| `APIFY_API_TOKEN` | Yes | Not used | Staging-only Apify token | Store only in the staging secret manager. |
| `APIFY_API_BASE_URL` | No | Not used | `https://api.apify.com/v2` | Must match the approved HTTPS endpoint exactly. |
| `APIFY_RESEARCH_ACTOR_ID` | No | Not used | One reviewed public-research Actor | Must also appear in `APIFY_ALLOWED_ACTORS`. |
| `APIFY_ALLOWED_ACTORS` | No | Not used | Comma-separated reviewed Actor IDs | Never accept an arbitrary Actor ID from a request. |

The values below are safe **shape examples only** and must not be copied as credentials:

```dotenv
CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH=true
CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH_FIRECRAWL=true
CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH_APIFY=true
FIRECRAWL_API_BASE_URL=https://api.firecrawl.dev/v1
FIRECRAWL_API_KEY=<staging-firecrawl-key-from-secret-manager>
APIFY_API_BASE_URL=https://api.apify.com/v2
APIFY_API_TOKEN=<staging-apify-token-from-secret-manager>
APIFY_RESEARCH_ACTOR_ID=<reviewed-public-research-actor-id>
APIFY_ALLOWED_ACTORS=<reviewed-public-research-actor-id>
```

## Recommended secret-manager workflow

Create a dedicated `staging` secret scope. Generate provider keys in the provider consoles with the minimum permissions and a disposable billing/project boundary. Store `FIRECRAWL_API_KEY` and `APIFY_API_TOKEN` as write-only secret values. Store non-secret endpoint and allowlist values as deployment configuration, not as user-controlled request fields.

For Kubernetes, materialize the values through the approved external-secrets controller or secret manager into the existing `tayari-runtime-secrets` object in the `tayari-staging` namespace. Do not commit a populated YAML file or pass a secret on a shell command line. The deployment should expose the values only to the Python API/worker process that performs research.

For GitHub Actions, create or use the `staging` Environment and add the two provider keys as Environment secrets. Add the endpoints, Actor ID, Actor allowlist, and capability flag as Environment variables or protected configuration. Restrict deployment reviewers and ensure the job uses the staging Environment rather than repository-wide secrets. The live verification workflow currently requires workflow-write permission to publish; if it is not present on `main`, run the equivalent verifier from an approved trusted runner and retain the redacted artifact.

## Pre-deployment validation

Run the repository validator in a shell that receives the staging Environment values without printing them:

```sh
python3 scripts/verify_external_provider_config.py --provider all --require-enabled
```

Expected output has only provider names, statuses, and non-secret explanations:

```text
firecrawl: pass — enabled with approved endpoint and key present
apify: pass — enabled with approved endpoint, key, and allowlisted Actor
```

A missing key, incorrect endpoint, or Actor not present in the allowlist exits non-zero. If the capability is intentionally disabled, run without `--require-enabled` and expect `disabled` rather than `pass`.

## Staging acceptance sequence

Deploy the immutable staging image with the configuration above, confirm `/healthz` and `/readyz`, and run the existing live-provider verifier. Then exercise only synthetic public research requests through the authenticated Go-to-Python boundary. Confirm that the capability gate returns HTTP `423 disabled_by_launch_scope` when the flag is removed.

For Firecrawl, verify a bounded public search, timeout/error mapping, source URL retention, private-IP/localhost rejection, redirect safety, response-size limits, and prompt-injection containment. For Apify, verify that the reviewed Actor starts only with the allowlisted ID, that an unapproved Actor is rejected before any provider call, that the run budget and timeout are enforced, and that provider output is bounded and sanitized.

Review logs and telemetry for the absence of API keys, Authorization headers, cookies, page credentials, raw résumé text, raw prompts, and unbounded provider payloads. Retain only redacted request IDs, provider name, Actor ID where non-sensitive, latency bucket, status, source URL, and deployment digest.

## Rollback and rotation

To disable either provider immediately, set `CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH=false` and redeploy or restart the Python API/worker. To rotate a key, create the replacement in the provider console, update only the staging secret-manager value, restart the affected workload, run the configuration validator and one synthetic request, then revoke the old key. Never place old or new keys in Git history, issue comments, evidence artifacts, or chat messages.

## References

[1]: https://docs.firecrawl.dev/mcp-server "Firecrawl MCP Server documentation"
[2]: https://docs.apify.com/integrations/mcp "Apify MCP server documentation"
[3]: https://docs.apify.com/integrations/mcp-connectors "Apify MCP connectors documentation"
