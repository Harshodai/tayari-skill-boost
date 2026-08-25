# JobTayari Agent-Ready Production Checklist

**Purpose:** Execute the remaining production-readiness gates without inventing evidence. This checklist is bound to one reviewed Git SHA and its immutable image digests.

**Launch decision:** Do not expose public traffic until every P1 gate is `PASS`, every approval is named, and the release identity is immutable.

## Operating rules

The agent may inspect, build, test, render, deploy to an explicitly approved disposable staging target, collect redacted evidence, and roll back. The agent must stop and create a human handoff before entering passwords, OTP/MFA, CAPTCHA, legal declarations, work authorization, sponsorship, salary, EEO answers, browser cookies, saved passwords, or final application/payment submissions. Disabled connectors remain disabled unless the owner authorizes that connector and its lifecycle evidence is complete.

Never paste secrets into Git, task payloads, tickets, logs, screenshots, evidence files, or chat. Use the approved secret manager and record only secret names, versions, checksums where appropriate, and rotation timestamps.

## Release identity and local gates

| Check | Agent action | Evidence | Owner | Status |
|---|---|---|---|---|
| Reviewed source | Record `git rev-parse HEAD`, branch, dirty state, and migration manifest | `release-identity.txt` | Engineering | `PENDING` |
| Repository audit | Run `make audit` from the reviewed SHA | Audit log with exit code | Engineering | `PENDING` |
| Frontend/backend tests | Run `pnpm test`, `pnpm build`, `cd backend/go && go test ./...`, and the CI-configured Python suite | Redacted test summaries | Engineering | `PENDING` |
| Browser companion | Run `pnpm test:extension` and `pnpm extension:validate` | Extension test summary | Engineering | `PENDING` |
| Supply chain | Build all release images with `scripts/build-images.sh` using the reviewed SHA, `--provenance=true`, and `--sbom=true` | Registry digests, SBOMs, provenance attestations | Platform/Security | `PENDING` |

## P1 cloud and dependency gates

| Gate | Required owner input | Agent procedure | Pass evidence | Status |
|---|---|---|---|---|
| AWS or Kubernetes staging | Account/role, region/context, VPC/network, approved domain, operator CIDR, budget, rollback owner | Deploy only through the approved runbook; verify Caddy-only public ingress, private Python/Redis, readiness, auth, and rollback | Redacted ingress/auth/readiness/rollback artifacts tied to SHA and image digests | `USER ACTION REQUIRED` |
| Managed PostgreSQL/Auth/Redis | Secret-manager references, staging project/database, TLS material, separate signing keys | Apply ordered migrations, verify schema fingerprint, readiness, JWT compatibility, RLS, grants, Redis auth, outage behavior, and two-user negatives | Query summaries and redacted logs; no secret values | `USER ACTION REQUIRED` |
| Enabled providers | Explicit launch allowlist and test-mode/read-only credentials | Verify latency, quota, retry, timeout, schema quality, cost, and failure behavior per provider; keep disabled providers disabled | Sanitized provider matrix and cost envelope | `USER ACTION REQUIRED` |
| Observability and paging | Metrics destination, dashboard owner, alert receiver, on-call contact | Scrape protected metrics, verify redaction, dashboards, retention, alert routing, and controlled page delivery | Alert/page receipt and dashboard links | `USER ACTION REQUIRED` |
| Backup/PITR/recovery | Managed backup/PITR destination, retention policy, restore target, RPO/RTO owners | Restore to a distinct disposable target; verify migrations, RLS, Auth/key-row integrity, queue recovery, cleanup, and rollback | Checksums, measured RPO/RTO, approval record | `USER ACTION REQUIRED` |
| Stripe test mode | Test-mode account, webhook endpoint, signing secret via secret manager, approved test owner | Test checkout, signed webhook, replay/idempotency, fulfillment, refund, failure, and billing-disabled behavior; never use production instruments | Redacted event IDs and ledger results | `USER ACTION REQUIRED` |

## P2 scale and product-quality gates

| Gate | Agent procedure | Required result | Status |
|---|---|---|---|
| Capacity | Run bounded authenticated load against disposable staging with conservative worker concurrency | p50/p95/p99, throughput, saturation, queue growth, bottleneck, and cost-per-successful-workflow decision | `PENDING` |
| Durable workers | Kill/restart workers during polling and persistence; verify lease expiry, reclaim, cancellation, idempotency, and no duplicate irreversible action | Redacted lifecycle trace and replay result | `PENDING` |
| Retrieval quality | Run the approved versioned opaque-ID benchmark | NDCG@K, Recall@K, family precision, threshold comparison, and regression decision | `PENDING` |
| Preparation outcomes | Use explicit consent to record practice completion, confidence, correction, and outcome signals | Retention/deletion proof and outcome-quality report | `PENDING` |
| Chrome/ATS staging | Use a disposable Chrome profile and disposable non-production portal | Install, PKCE, origin/tab grant, redaction, stop/revoke, manual handoff, and no-final-submit evidence | `USER ACTION REQUIRED` |
| Accessibility/performance | Run automated accessibility checks and manual keyboard/screen-reader review on realistic slow network | Findings triaged; no critical keyboard, focus, label, or latency blocker | `PENDING` |

## Approval gate

The release may advance only when Engineering, Platform, Security/Privacy, Product, and Incident owners are named; the release SHA equals the approved source; every application image uses an immutable digest; `RELEASE_ATTESTATION_VERIFIED=true` and `PRODUCTION_CHANGE_APPROVED=true` are set only after the evidence index is reviewed; and `AUTONOMOUS_SUBMIT_ENABLED=false` remains enforced server-side.

If any gate fails, the agent records the failure, preserves the redacted artifact, disables the affected capability, and stops before public traffic. A green local audit is not evidence of cloud capacity, live provider behavior, billing acceptance, backup recovery, alert delivery, or browser portal safety.

## Evidence index template

For each artifact, record `gate_id`, `release_sha`, image digests, UTC timestamp, operator/owner, environment, command or action, result, redaction review, and retention/cleanup outcome. Use stable filenames such as `PROD-001-canary-readiness-<sha>.md`, `PROD-005-restore-rpo-rto-<sha>.md`, and `PROD-015-supply-chain-<sha>.md`. Do not commit raw secrets, cookies, passwords, OTPs, CAPTCHA values, full resumes, full job descriptions, payment instruments, or unredacted provider payloads.
