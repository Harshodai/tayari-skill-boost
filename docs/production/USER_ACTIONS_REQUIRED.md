# JobTayari User Actions Required for Production

**Current state:** Repository-complete staging candidate. The actions below require the owner’s cloud accounts, provider authorizations, operational approvals, or real-device access and must not be fabricated by an agent.

## Required owner decisions

| Decision | What to provide | What the agent will do after approval |
|---|---|---|
| Hosting target | AWS EC2 canary or protected Kubernetes staging; account/role, region/context, domain, operator CIDR, budget, rollback owner | Deploy through the approved runbook, validate ingress/readiness/auth, collect redacted evidence, and rehearse rollback |
| Managed dependencies | Separate staging PostgreSQL/Auth/Redis projects and secret-manager references | Apply migrations and run two-user isolation, JWT, TLS, Redis, outage, and recovery checks |
| Provider allowlist | Explicitly approved LLM and other provider names, scopes, test/read-only credentials in the approved secret manager | Run provider latency, quota, retry, timeout, schema-quality, cost, and outage acceptance |
| Operations | Metrics destination, dashboard owner, alert receiver, on-call and incident contacts | Verify protected scraping, redaction, dashboards, retention, alert routing, and a controlled page |
| Recovery | Backup/PITR policy, retention, restore target, RPO/RTO objectives and approvers | Perform a distinct-target restore, validate data-plane integrity, measure recovery, and clean up |
| Billing | Stripe test-mode account, webhook configuration and signing secret through the secret manager | Test checkout, signed webhooks, replay/idempotency, fulfillment, refunds, and disabled billing |
| Browser staging | Disposable Chrome profile, extension installation access, disposable ATS/non-production form, and manual takeover availability | Test PKCE, origin/tab bridge, redaction, stop/revoke, manual handoff, and no-final-submit behavior |
| Product evaluation | Consent-safe opaque-ID retrieval labels and approved preparation-outcome schema | Run NDCG/Recall@K/family-precision benchmarks and outcome/retention checks |

## Information that must never be provided to the agent

Do not provide Chrome cookies, saved passwords, OTP/MFA codes, CAPTCHA answers, production payment instruments, private signing keys in chat, or legal/work-authorization/sponsorship/salary/EEO answers. Use the browser takeover/manual handoff path for sensitive entry. The agent must never create external accounts or make a final application or payment submission.

## Owner completion sequence

First choose the hosting target and create a budget. Next create isolated staging dependencies and store secrets by reference. Then authorize only the launch provider allowlist. After that, authorize the observability and recovery owners, configure Stripe test mode, and provide disposable browser/ATS access. Finally approve the labeled evaluation set and name Engineering, Platform, Security/Privacy, Product, and Incident approvers.

The release cannot be called production-ready until all P1 evidence is attached to one exact source SHA and immutable image digests. Until then, keep public traffic disabled or allowlisted, keep high-risk connectors disabled, and keep `AUTONOMOUS_SUBMIT_ENABLED=false`.
