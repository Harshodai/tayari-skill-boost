# Remaining Production-Readiness Gaps

**Review date:** 2026-08-25

**Current release identity:** `255cc7113ecdc43eb5087e33a55e528aafc2f269` is equal to `origin/main`; the current worktree is clean apart from the new audit addendum being prepared for the next completion loop.

**Decision:** **NOT READY FOR PRODUCTION — staging candidate only.**

## Executive assessment

The local Docker verification is strong: all Compose services are running, health and readiness probes pass, the rebuilt Docker-backed Playwright suite passed 39 tests with 14 intentional skips, the hostile suite passed 34/34, Celery recovered after migration repair and service restarts, and repository security/release/promotion contracts pass. Those results establish a credible local staging candidate, not production readiness.

The remaining release blockers are principally **environmental and operational rather than basic code correctness**. No evidence currently proves a real AWS canary or production Kubernetes rollout, managed database/Auth/Redis reachability, live provider behavior, protected telemetry and paging, cloud recovery, representative load/capacity, or an approved immutable release artifact containing the latest local changes. A public launch must remain blocked until the P1 items below are closed with evidence tied to one reviewed release SHA and its immutable image digests.

## P1 stop-ship gaps

| ID | Gap | Why it blocks production | Required closure evidence | Current state |
|---|---|---|---|---|
| PROD-001 | AWS target and canary unavailable | Image, network, DNS/TLS, managed dependency reachability, ingress, and rollback have not been exercised in AWS | Approved account/role/region/VPC/subnet/AMI/admin path; budget; immutable images; successful canary health/readiness/auth/rollback/cleanup artifacts | **BLOCKED** |
| PROD-002 | Managed database/Auth/Redis readiness absent | Local readiness cannot prove cloud DNS, TLS, connection pools, Auth JWT compatibility, Redis authentication, or data-plane isolation | Staging secrets materialized from a manager; Go/Python readiness through real ingress; two-user reads/writes and failure injection | **BLOCKED** |
| PROD-003 | Enabled-provider acceptance absent | LLM, Firecrawl, Apify, Google, and other enabled integrations have no live latency, quota, retry, timeout, cost, or failure envelope | Run read-only provider verification for only launch-approved providers; preserve sanitized results and explicit blocked status for disabled providers | **BLOCKED** |
| PROD-004 | Live observability and paging absent | Contract tests do not prove dashboards, metric authentication, redaction, alert routing, retention, ownership, or actual page delivery | Live protected metrics scrape; redacted logs/traces; release/worker/provider/data dashboards; controlled alert/page test; owner and runbook links | **NOT VERIFIED** |
| PROD-005 | Cloud backup/PITR and measured recovery absent | A local restore does not prove off-host durability, managed PITR, production-shaped restore, or launch RPO/RTO | Exact launch backup with checksum/retention; distinct managed restore; schema/RLS/Auth/key-row validation; measured RPO/RTO; cleanup and approval record | **NOT VERIFIED** |
| PROD-006 | Kubernetes production admission absent | No protected production context, external secret manager, signed/attested registry images, network policy, rollout, or rollback evidence exists | Explicit context check; external secrets; signed digest images; ingress/network policy; staged rollout; worker drain/reclaim; rollback and two-person approval evidence | **BLOCKED** |
| PROD-012 | Live Stripe acceptance absent | Local billing integrity tests cannot prove real test-mode checkout, webhook signature verification, replay/idempotency, refunds, or account configuration | Test-mode checkout/webhook matrix with no production instruments; signature/replay/idempotency evidence; billing-disabled verification; owner approval | **RESOLVED LOCALLY; live acceptance pending** |
| PROD-015 | Reviewed release artifact is not yet cut | The current source SHA is known, but immutable image digests, SBOM, attestation, and deployment evidence are not tied to it | Review diff; exclude logs/secrets/generated output; build all images from the reviewed SHA; record digests/SBOM/provenance and approval | **OPEN / BLOCKED** |

## P2 release-enabling gaps

| ID | Gap | Consequence | Closure evidence | Current state |
|---|---|---|---|---|
| PROD-007 | Representative performance and capacity not measured | No defensible p50/p95/p99, throughput, saturation point, queue behavior, or cost-per-successful-workflow baseline | Bounded load against disposable staging with authenticated fixtures; API/AI/DB/Redis/worker/provider metrics; bottleneck and capacity decision | **NOT VERIFIED** |
| PROD-008 | Product event instrumentation and north-star metric not approved/measured | Technical logs exist, but activation, funnel, retention, and product-value denominators are not release-operational | Approve privacy-safe event schema; emit and validate events in staging; define owner, numerator, denominator, target, and alert threshold | **NOT VERIFIED** |
| PROD-009 | Documentation and evidence-index parity remains unfinished | Some operational documents retain older baselines or count language; contradictory instructions can cause unsafe release execution | Reconcile checklist baseline, gate counts, command paths, branch/SHA references, and all artifact links; independent contradiction review | **IN PROGRESS** |
| PROD-011 | Clean Minikube startup remains blocked | Local Kubernetes process behavior cannot currently be revalidated in a clean profile; it is not a production blocker if managed staging evidence exists, but it limits local confidence | Diagnostic retry or documented environment limitation; if successful, render/apply only disposable synthetic canary and capture readiness boundary | **BLOCKED** |
| PROD-014 | Long-lived local Docker database had migration drift | Local workers silently returned structured failures until recent migrations were applied; clean-install and managed migration sequencing remain unverified | Fresh-volume bootstrap test; ordered migration manifest; schema fingerprint; owner-role and lock review; managed staging apply/rollback evidence | **RESOLVED LOCALLY; managed rollout pending** |

## What is already locally closed

The following areas are not current stop-ship code findings within the tested local scope: trusted-proxy client-IP handling; frontend centralized API access; owner-scoped Go routes and RLS contracts; Task Workspace server-side capability gating; billing direct-grant denial and one-time fulfillment idempotency; truthfulness of the AutoPilot review-only copy; local health/readiness; local backup/restore contracts; hostile SSRF, prompt-injection, tenant-isolation, cancellation, and privacy-purge scenarios; and authentication starvation from the shared public rate-limit bucket. Each remains subject to real-environment acceptance where applicable.

Local closure must not be promoted to a cloud claim. In particular, the Docker stack does not prove public TLS, managed Auth/DB/Redis, registry supply-chain provenance, provider quotas, live Stripe, page delivery, managed PITR, production capacity, or production rollback.

## Recommended closure sequence

### 1. Cut a clean release candidate

First review the current worktree and create one approved release candidate containing the source, migration, E2E fixture, and documentation changes. Exclude raw logs, screenshots, test-results, `.env` files, cookies, tokens, and generated evidence that is not intentionally versioned. Record the exact SHA, ordered migration manifest, six application/proxy image digests, SBOM/provenance, and security-scan result.

### 2. Establish isolated staging infrastructure

Choose either the AWS EC2 canary path or a protected Kubernetes staging target. Use separate staging Auth, PostgreSQL/Supabase, Redis, storage, provider credentials, domains, signing keys, and telemetry destinations. Materialize secrets through the approved secret manager; do not copy secret values into Git, manifests, tickets, task payloads, or logs.

### 3. Prove data-plane and worker behavior

Apply migrations to a disposable staging database after backup, validate RLS and schema fingerprints, and run two-tenant negative tests through the real ingress. Kill a worker during provider polling and durable persistence, then verify lease expiry, reclaim, cancellation, idempotency, and absence of duplicate irreversible actions. Confirm queue recovery and graceful shutdown.

### 4. Prove provider, billing, and safety boundaries

Run read-only acceptance only for providers explicitly enabled for launch. Keep Google, browser, desktop, WhatsApp, and external-submission capabilities disabled unless their separate approval gates are met. Run Stripe in test mode only and verify signatures, replay, idempotency, fulfillment, failure, and billing-disabled states. Preserve candidate-controlled manual submission.

### 5. Prove operations before traffic

Connect protected metrics, redacted logs, traces, dashboards, alert routing, on-call ownership, backup freshness, and a controlled page test. Restore the launch-shaped backup into a distinct target and measure RPO/RTO. Execute an approved staging rollback and verify readiness, traffic, queues, migrations, and audit evidence afterward.

### 6. Measure scale and approve the canary

Run bounded authenticated load against disposable staging, capture p50/p95/p99 and saturation metrics, and set capacity limits and cost budgets. Admit only a small allowlisted canary cohort after all P1 gates are green. Hold or roll back on readiness loss, tenant-isolation anomalies, unsafe provider behavior, queue growth, misleading approval state, recovery failure, or unexplained cost.

## Non-negotiable approval conditions

Production approval must not set `RELEASE_ATTESTATION_VERIFIED=true` or `PRODUCTION_CHANGE_APPROVED=true` until the following are attached to the same exact release SHA and immutable image digests: real staging ingress health/readiness and auth evidence; two-tenant isolation; live provider acceptance for enabled providers; worker restart/reclaim and cancellation; protected telemetry and a real page test; cloud backup/restore with measured RPO/RTO; an approved rollback rehearsal; and named Engineering, Platform, Security/Privacy, Product, and incident owners.

`AUTONOMOUS_SUBMIT_ENABLED=false` remains mandatory. No candidate-controlled external application submission, real payment, credential/OTP/CAPTCHA entry, sensitive legal/salary/EEO input, or external account creation is required to close the current release gates.

## References

[1]: ../../PRODUCTION_ISSUES.md "Shared production issue register"
[2]: FINAL_PRODUCTION_READINESS.md "Evidence-indexed final readiness report"
[3]: PRODUCTION_READINESS.md "Category-by-category readiness matrix"
[4]: DUAL_TRACK_DEPLOYMENT_ROADMAP.md "AWS and Kubernetes deployment roadmap"
[5]: DEPLOYMENT.md "Deployment contract"
[6]: BACKUP_RECOVERY.md "Backup and recovery contract"
[7]: OBSERVABILITY.md "Observability contract"
[8]: PERFORMANCE.md "Performance boundary and benchmark contract"
[9]: METRICS.md "Technical and product metrics contract"
[10]: ../../docs/operations/production-deployment-observability-checklist.md "Authoritative production operations checklist"
[11]: ../../deploy/aws/README.md "AWS canary operator runbook"
[12]: ../../infra/k8s/SECRETS.md "Kubernetes secret contract"
