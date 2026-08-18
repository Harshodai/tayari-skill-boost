# Job Tayari Kubernetes Secret Contract

The Kubernetes package intentionally contains **no secret values** and does not create a placeholder Secret. Before any overlay can start workloads, the target environment must materialize a namespace-local secret named `tayari-runtime-secrets`. Use a cloud secret manager plus workload identity or an approved external-secrets controller; do not use `kubectl create secret` in a terminal history for production.

## Required keys

| Key | Used by | Requirement |
|---|---|---|
| `DATABASE_URL` | Go gateway, Python API, Celery worker, Celery beat | Private managed PostgreSQL/Supabase-compatible connection string. Use TLS when the provider supports it. |
| `REDIS_URL` | Python API, Celery worker, Celery beat | Private managed Redis connection string with authentication and TLS when available. |
| `JWT_SECRET` | Go gateway | Rotatable high-entropy signing secret. Rotation must preserve an overlap strategy or force reauthentication deliberately. |
| `SUPABASE_URL` | Go gateway and front-end build configuration as applicable | Hosted or self-managed Supabase URL. Do not use local Compose addresses in cloud. |
| `SUPABASE_ANON_KEY` | Go gateway and front-end build configuration as applicable | Publishable key; treat as configuration but keep it with the environment secret contract for operational consistency. |
| `SUPABASE_SERVICE_ROLE_KEY` | Go gateway only | Privileged key. Never expose to browser bundles, client-side variables, logs, or worker jobs without an explicit use case. |
| `ALLOWED_ORIGINS` | Go gateway | Comma-separated, TLS-only public origins for the environment. |
| `FRONTEND_URL` | Go gateway | Canonical TLS URL for redirects and customer-facing links. |

## Conditional keys

| Key group | Condition | Control requirement |
|---|---|---|
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_PROVIDER` | Only for the selected AI provider(s). | Scope keys to the smallest account/project and record owner, quota, rotation date, and incident contact. |
| `SENTRY_DSN` | If Sentry is enabled. | Configure scrubbing so résumés, credentials, job answers, tokens, and browser artifacts are never sent as telemetry. |
| `SENDGRID_API_KEY` | If email delivery is enabled. | Domain authentication, suppression handling, rate limits, and a customer-notification policy are required. |
| `APPROVAL_EMAIL_ENDPOINT`, `APPROVAL_EMAIL_API_KEY`, `APPROVAL_EMAIL_FROM`, `APPROVAL_EMAIL_WEBHOOK_SECRET` | If approval email delivery is enabled. | Use a transactional provider endpoint with sender-domain authentication, idempotency, signed delivery webhooks, bounce/complaint suppression, redaction, and staging evidence. |
| `WHATSAPP_GRAPH_API_BASE_URL`, `WHATSAPP_GRAPH_API_VERSION`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APPROVAL_TEMPLATE_NAME`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | If WhatsApp approval delivery is enabled. | Use a Meta-approved business sender/template, explicit user opt-in, signed webhooks, replay protection, opt-out, delivery/read reconciliation, and staging evidence. |
| OAuth client IDs/secrets | If Google, LinkedIn, or GitHub login is enabled. | Enforce exact redirect URIs and separate staging/production applications. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs | **Do not add until the product model is reconciled and test-mode acceptance passes.** | Keep checkout disabled in the deployment process until pricing, credit ledger, idempotency, and webhook validation have a completed acceptance record. |

## Environment materialization checklist

1. Create separate secret paths and values for development, staging, and production. Production must never reuse development credentials.
2. Bind each Kubernetes service account to only the paths it needs. The frontend service account should not receive database, payment, or provider secrets.
3. Enable secret rotation and write a tested rollout procedure. For database, Redis, auth, AI-provider, and payment credentials, define the acceptable downtime and reauthentication impact before rotation.
4. Verify workloads receive only the expected keys, then run a log review to confirm values do not appear in startup output, errors, traces, crash dumps, or CI artifacts.
5. Record secret owner, last rotation date, and next scheduled review in the operating runbook.

> Do not enable production billing by supplying Stripe values alone. The billing model and test-mode acceptance prerequisites in the final launch checklist remain release gates.
