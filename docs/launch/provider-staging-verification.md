# Provider and High-Risk Capability Staging Verification

This runbook is for staging only. A route, adapter, or passing unit test is not evidence that a provider-backed capability is ready for production. Each capability must have a real receipt, a tenant-isolation result, an outage result, and a rollback or disablement decision.

## Launch boundary

The first release is candidate-controlled. Resume assistance, ATS assistance, public research/import, saved jobs, application tracking, drafts, knowledge capture, and in-app approvals may be certified for beta. Autonomous ATS submission, sensitive browser fields, private saved-list synchronization claims, autonomous Gmail, production email/WhatsApp messaging, Google Workspace synchronization, Stripe billing, A2A federation, and Computer/Desktop surfaces remain disabled or staged until their evidence is attached.

## Required staging variables

Set secrets in the deployment secret manager, never in Git or browser-exposed `VITE_` variables.

| Capability | Variables | Required verification |
|---|---|---|
| Firecrawl | `FIRECRAWL_API_KEY`, `FIRECRAWL_API_BASE_URL`, `CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH_FIRECRAWL=true` | Health check, scrape, crawl/batch operation, polling, timeout, rate-limit, cancellation, provenance, and unsafe-URL rejection. |
| Apify | `APIFY_API_TOKEN`, `APIFY_API_BASE_URL`, `APIFY_RESEARCH_ACTOR_ID`, `APIFY_ALLOWED_ACTORS`, `CAPABILITY_WORKSPACE_EXTERNAL_RESEARCH_APIFY=true` | Approved actor run, bounded polling, dataset item retrieval, timeout, quota/rate-limit, cancellation, provenance, and actor allowlist rejection. |
| Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `GOOGLE_PROJECT_ID`, `CAPABILITY_WORKSPACE_GOOGLE_CALENDAR=true` | OAuth state binding, approved read-only scopes, refresh, revoke, delete, tenant isolation, sync provenance, and provider outage. |
| Google Drive | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `GOOGLE_PROJECT_ID`, `CAPABILITY_WORKSPACE_GOOGLE_DRIVE=true` | Metadata-only access, OAuth lifecycle, refresh, revoke, delete, tenant isolation, sync provenance, and provider outage. |
| Gmail | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, Gmail-specific webhook/Pub/Sub configuration, `CAPABILITY_AUTONOMOUS_GMAIL` only after review | Keep disabled for the first release. If staged, verify least privilege, webhook authenticity, refresh/revoke/delete, mailbox privacy, and two-tenant isolation. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price/product IDs, `CAPABILITY_AUTONOMOUS_BILLING=true` only after review | Test-mode checkout, portal, webhook signature, duplicate events, failed payment, refund, cancellation, entitlement reconciliation, and disablement. |
| Email approvals | Real `SMTP_HOST`, `SMTP_PORT`, sender/domain configuration, `CAPABILITY_WORKSPACE_NOTIFICATION_EMAIL=true` if defined by deployment | Consent, redaction, provider acceptance versus delivery, bounce/complaint, revoke, outage fallback, and no sensitive payload leakage. |
| WhatsApp approvals | `WHATSAPP_CLOUD_ACCESS_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, approved templates, webhook verification, `CAPABILITY_WORKSPACE_NOTIFICATION_WHATSAPP=true` | Explicit opt-in, template approval, signed webhook, delivery status, opt-out, replay rejection, redaction, and in-app authority. |
| A2A federation | `A2A_FEDERATION_SECRET`, `A2A_ALLOWED_PEERS`, `CAPABILITY_INTEGRATION_A2A_FEDERATION=true` | HTTPS peer allowlist, signed headers, timestamp skew, nonce replay rejection, tenant binding, allowed skills, provenance, and outage behavior. |

## OmniSaveAI live verification

Use the current unpacked extension build and the same Chrome profile that is authenticated to the source platforms. Confirm the extension service worker returns `"3.2.0"` from `chrome.runtime.getManifest().version`. Keep the authenticated Medium `/me/lists`, LinkedIn saved-posts, and Substack `/saved` pages open with saved cards rendered. The collector requires visible article-shaped links; utility URLs alone are not import candidates.

For every platform, record the source URL, visible candidate count, requested limit, pages visited, discovered count, imported count, duplicate count, skipped count, failure count, and the resulting current-workspace receipt. Repeat after a browser restart, an extension reload, a worker interruption, a cancellation request, a duplicate retry, and a source deletion. Do not claim full-history or LinkedMash parity until a fresh completed receipt reconciles with the database and UI.

## Evidence bundle format

For each enabled capability, store a redacted evidence bundle containing the commit SHA, environment name, timestamp, tenant identifiers hashed or pseudonymized, request/receipt IDs, provider result, failure and outage result, owner-isolation result, relevant logs, and the final enablement decision. Provider credentials and access tokens must never appear in the bundle.

## Disablement rule

If a live provider test fails, a required credential is absent, a webhook cannot be authenticated, a user-owned record is visible across tenants, a worker restart duplicates an external side effect, or a browser stop fails to terminate the real resource, leave the capability disabled and record the failure. Do not weaken the security baseline or convert a failed live test into a documentation-only pass.
