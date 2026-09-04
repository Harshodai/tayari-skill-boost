# Tayari Skill Boost — Shared Production Issue Register

**Purpose.** This register is the shared source of truth for the second-pass productionization program. It records verified defects, external blockers, and evidence gaps. A `BLOCKED` or `NOT VERIFIED` item is not treated as a pass.

**Assessment basis.** The entries below are derived from the committed production-readiness report, release matrix, final repository gates, AWS preflight, and disposable Kubernetes evidence. No issue is marked resolved without a reproducible verification artifact.

| ID | Severity | Category | Affected area | Agent/owner | Status | Evidence |
|---|---|---|---|---|---|---|
| PROD-001 | P1 | Deployment / environment | AWS EC2 canary | DevOps / environment owner | BLOCKED | `.ruthless-evidence/productionization/stage_a_external_blockers.log` |
| PROD-002 | P1 | Dependency readiness | Managed database/Auth/Redis | SRE / platform owner | BLOCKED | `.ruthless-evidence/security/minikube_probe_final.log`; `.ruthless-evidence/security/minikube_python_db_errors.log` |
| PROD-003 | P1 | Provider readiness | LLM and optional external providers | Integrations / environment owner | BLOCKED | `.ruthless-evidence/security/live_provider_verify_minikube_staging.json` |
| PROD-004 | P1 | Observability | Live telemetry and paging | SRE / observability owner | NOT VERIFIED | `.ruthless-evidence/security/live_provider_verify_minikube_staging.json`; `.ruthless-evidence/security/final_release_gate.log` |
| PROD-005 | P1 | Recovery | Cloud backup/PITR and measured RPO/RTO | Data / SRE owner | NOT VERIFIED | Local restore evidence passes; cloud recovery is explicitly separate in `docs/operations/backup-and-recovery.md` |
| PROD-006 | P1 | Kubernetes production | Production cluster, secret manager, approvals | DevOps / platform owner | BLOCKED | `.ruthless-evidence/productionization/stage_b_admission_blockers.log` |
| PROD-007 | P2 | Performance and capacity | Measured load, saturation, and capacity model | Performance owner | NOT VERIFIED | No committed real-load benchmark artifact is present in the current baseline |
| PROD-008 | P2 | Product measurement | Product event taxonomy and north-star metric | Product / analytics owner | NOT VERIFIED | Existing technical metrics contract passes; product-value metrics require a separate measured implementation |
| PROD-009 | P2 | Documentation parity | Consolidated production artifact set | Release owner | RESOLVED LOCALLY; final contradiction review pending | `docs/production/README.md`; `docs/production/FINAL_PRODUCTION_READINESS.md` |
| PROD-010 | P2 | Product truthfulness / UX | Landing-page AutoPilot animation review label | Product / frontend owner | RESOLVED LOCALLY; live presentation pending | `src/test/TruthfulnessAccessibility.test.tsx`; `.ruthless-evidence/productionization/autopilot_truthfulness_regression.log` |
| PROD-011 | P2 | Local platform validation | Disposable Minikube profile startup | DevOps / local platform owner | BLOCKED | `.ruthless-evidence/productionization/minikube_start_second_pass.log` |
| PROD-012 | P1 | Financial integrity / billing | Credit-pack purchase and fulfillment | Backend / billing owner | RESOLVED LOCALLY; live Stripe acceptance pending | `.ruthless-evidence/productionization/billing_second_pass.log` |
| PROD-013 | P1 | Authentication availability | Shared public rate limiter could starve signup/login | Backend / security owner | RESOLVED LOCALLY; production traffic profile pending | `.ruthless-evidence/productionization/docker_rate_limit_fix_go_gate.log`; `.ruthless-evidence/productionization/docker_signup_rate_isolation.log` |
| PROD-014 | P2 | Local data-plane setup | Long-lived Docker DB lacked recent automation/task migrations | DevOps / release owner | RESOLVED LOCALLY; clean/managed migration rollout pending | `.ruthless-evidence/productionization/docker_recent_migrations_apply.log`; `.ruthless-evidence/productionization/docker_automation_recovery_now.log` |
| PROD-015 | P1 | Release integrity | Latest hardening and documentation changes are uncommitted | Release / DevOps owner | OPEN / BLOCKED | `.ruthless-evidence/productionization/gap_review_identity.log`; current `git status --short` |
| PROD-016 | P1 | WhatsApp approvals | WhatsApp outbound/reply acceptance and phone ownership are not live-verified | Integrations / Security owner | IMPLEMENTED LOCALLY; STAGING BLOCKED | `.ruthless-evidence/productionization/whatsapp_official_requirements.md`; `docs/production/WHATSAPP_APPROVALS.md`; `.ruthless-evidence/productionization/whatsapp_go_full_final.log`; `.ruthless-evidence/productionization/whatsapp_schema_reapply_final.log`; `.ruthless-evidence/productionization/whatsapp_go_binding_runtime_final.log` |

## Detailed issue records

### PROD-001 — AWS EC2 canary cannot execute in the current environment

**Root cause:** The validation environment does not provide the AWS CLI, authenticated AWS target, `deploy/aws/.env`, account/network inputs, or approval inputs. The deployment wrapper therefore stops before cloud mutation.

**Business impact:** No live AWS canary, public endpoint, DNS/TLS proof, or real operator handoff can be claimed.

**Technical and security impact:** Static contracts are validated, but image pulls, host startup, managed dependency reachability, and ingress behavior remain unverified.

**Required fix and verification:** Supply the approved AWS role/account, region, VPC, subnet, AMI, narrow admin CIDR, domain, budget, private environment file, registry credentials, and immutable image digests. Run `deploy/aws/provision.sh`, then `deploy/aws/deploy.sh config`, `deploy/aws/deploy.sh up`, and capture health, readiness, TLS, rollback, and cleanup evidence.

### PROD-002 — Real managed dependency readiness is not proven

**Root cause:** The disposable Kubernetes canary used a configured database endpoint that was not resolvable/reachable from the namespace. Python `/readyz` correctly returned `503 database_unavailable` after connection retries.

**Business impact:** Core authenticated workflows cannot be approved for live traffic until the application proves it can reach its system of record and queue dependencies.

**Technical and security impact:** Treating this as an empty database or ignoring readiness would risk false health, data inconsistency, and unsafe workflow execution. The current fail-closed behavior is correct.

**Required fix and verification:** Provision environment-separated managed database/Auth/Redis resources, establish private DNS/network policy, materialize namespace-local secrets, and require Go and Python readiness to pass in real staging through the real ingress.

### PROD-003 — Provider acceptance is incomplete

**Root cause:** The live provider verification runner lacked configuration for the LLM, Stripe, Firecrawl, Apify, Google OAuth, Sentry, queue/database, and Supabase verification paths.

**Business impact:** AI and integrated workflows cannot be promised with known cost, latency, quota, or failure behavior.

**Required fix and verification:** Configure only launch-approved providers with non-production credentials. Run side-effect-free probes and record latency, error, quota, retry, timeout, and cost envelopes. Record explicit blocked evidence for intentionally disabled providers.

### PROD-004 — Live observability and paging are not verified

**Root cause:** Repository observability contracts and alert definitions pass, but live telemetry credentials, protected metrics access, destination routing, and actual page delivery were not exercised against a real deployment.

**Required fix and verification:** Configure the approved telemetry backend, verify redacted structured logs, metrics, dashboards, alert routes, ownership, and a controlled page test. Attach the result to the release SHA.

### PROD-005 — Cloud recovery acceptance is not verified

**Root cause:** A real local PostgreSQL restore into a fresh disposable target passed, but cloud-managed backup retention, PITR, off-host copy, and measured RPO/RTO were not exercised.

**Required fix and verification:** Take the exact launch backup, restore it into a disposable managed target, verify checksums and required rows/tables, measure RPO/RTO, and document operator approval and cleanup.

### PROD-006 — Kubernetes production admission is unavailable

**Root cause:** No active production context, managed secret source, immutable registry release, or production approval artifacts were available.

**Required fix and verification:** Supply a protected production context, secret-manager integration, signed/attested immutable images, ingress and network policy configuration, rollback permission, and two-person/approved production change evidence. Perform a controlled rollout and rollback without bypassing admission gates.

### PROD-007 — Performance and capacity are not verified at scale

**Root cause:** The current evidence proves functional tests and local outage/recovery behavior, not measured p50/p95/p99 latency, throughput, saturation, CPU, memory, database load, queue depth, or provider latency under representative load.

**Required fix and verification:** Define safe benchmark fixtures, run load tests against a disposable environment, capture measured p50/p95/p99, throughput, errors, CPU/memory, database connections, queue depth, and the first bottleneck. Label all forecasts as estimated or theoretical.

### PROD-008 — Product-value metrics are not yet a measured release gate

**Root cause:** The repository has technical metrics and alert contracts, but the new mission requires a product event taxonomy, activation/retention/funnel definitions, and a defensible north-star metric tied to real product behavior.

**Required fix and verification:** Agree on a minimal event model that excludes sensitive payloads, implement only meaningful events, validate emission in staging, and define numerator, denominator, source, owner, target, and alert threshold for each selected product metric.

### PROD-009 — Consolidated second-pass documentation

**Root cause:** Existing operations, deployment, backup, and readiness documents were useful but were not organized under the requested `docs/production/` artifact set.

**Fix:** Created and indexed the second-pass production artifacts, including architecture, product scope, feature/journey matrices, security/threat model, performance/scalability, observability/SLO/metrics, cost/FinOps, data governance, deployment/rollback, backup/recovery, incident response/runbooks, test strategy, and consolidated readiness documents.

**Verification:** `docs/production/README.md` indexes the artifacts and their evidence boundary; `docs/production/FINAL_PRODUCTION_READINESS.md` records the current `NOT READY FOR PRODUCTION` verdict. A final repository-wide contradiction review remains required before closing the second-pass program.

## Independent-audit rule

Any future workstream that claims to resolve an issue must provide the implementation path, a reproducible test or operational command, an evidence artifact, and a regression result. A green process exit code without the underlying evidence does not close an issue.

## Current P0 assessment

No unresolved P0 code-level issue was established by the available evidence. This does **not** authorize production: PROD-001 through PROD-006 remain P1 external release blockers, and PROD-007 through PROD-009 and PROD-011 remain P2 evidence/documentation/local-platform gaps until verified. PROD-012 and PROD-013 are locally resolved, while PROD-014 is locally resolved as a data-plane repair. PROD-015 remains open until a reviewed release artifact is cut. PROD-016 is implemented locally but staging-blocked pending Meta acceptance and phone-ownership evidence. Live Stripe acceptance, production traffic-profile validation, managed migration rollout, and WhatsApp acceptance remain part of the external release gates.

## References

1. `.ruthless-evidence/PRODUCTION_READINESS_REPORT.md` — committed readiness report.
2. `.ruthless-evidence/productionization/FINAL_RELEASE_MATRIX.md` — committed release matrix.
3. `.ruthless-evidence/productionization/stage_a_external_blockers.log` — AWS preflight blockers.
4. `.ruthless-evidence/productionization/stage_b_admission_blockers.log` — Kubernetes admission and render evidence.
5. `.ruthless-evidence/security/minikube_probe_final.log` — restricted in-cluster health probe.
6. `.ruthless-evidence/security/live_provider_verify_minikube_staging.json` — live provider verification output.
7. `docs/operations/backup-and-recovery.md` — backup and restore operating contract.
8. `scripts/production_promotion_gate.sh` — repository promotion assertions.
9. `scripts/release_contract_test.sh` — release contract assertions.
10. `scripts/verify_observability_contract.py` — observability contract verifier.
11. `scripts/verify_endpoint_exposure.py` — route/exposure parity verifier.
12. `scripts/security_scan.mjs` — production security scanner.
13. `.ruthless-evidence/productionization/minikube_start_second_pass.log` — clean minimal Minikube startup attempt.
14. `.ruthless-evidence/productionization/billing_second_pass.log` — billing integrity audit and local regression evidence.
15. `.ruthless-evidence/productionization/local_billing_migration_apply.log` — repeated local migration application.
16. `.ruthless-evidence/productionization/docker_rate_limit_fix_go_gate.log` — rate-limit isolation Go regression.
17. `.ruthless-evidence/productionization/docker_signup_rate_isolation.log` — formerly failing signup journey after the fix.
18. `.ruthless-evidence/productionization/docker_e2e_final_after_rate_fix.log` — final rebuilt Docker Playwright run.
19. `.ruthless-evidence/productionization/docker_recent_migrations_apply.log` — local recent-migration repair and owner-corrected RLS apply.
20. `.ruthless-evidence/productionization/docker_database_contract_now.log` — local table, RLS, policy, and billing-index verification.
21. `.ruthless-evidence/productionization/gap_review_identity.log` — current release SHA and dirty-worktree evidence.
22. `.ruthless-evidence/productionization/whatsapp_official_requirements.md` — official Meta webhook and interactive-template requirements captured during audit.
23. `docs/production/WHATSAPP_APPROVALS.md` — WhatsApp approval-channel implementation and staging acceptance contract.

_Last updated during the second-pass master-mission reconciliation. External conditions are intentionally not marked green._

### PROD-016 — WhatsApp approval channel is implemented locally but not staging-accepted

**Severity:** P1 · **Category:** WhatsApp approvals · **Owner:** Integrations and Security · **Status:** IMPLEMENTED LOCALLY; STAGING BLOCKED.

**Observation:** The repository can send an approved-template-shaped WhatsApp message with signed approve/deny quick-reply payloads, validate Meta webhook signatures, reconcile delivery statuses, map inbound replies to the stored WhatsApp provider identity, and require a short-lived six-digit link challenge before enabling a matching phone. Local focused/full Go tests, authenticated route limiting, database guards, Compose wiring, migration mirror verification, rebuilt Docker health, and unauthenticated API boundaries pass. No Meta credential, public TLS callback, approved template, verified recipient, outbound delivery, inbound reply, or replay/expiry acceptance is available in this environment.

**Required fix and verification:** Configure separate staging Meta assets and secrets through the approved secret manager, including approved approval and link templates. Register the HTTPS callback, pass GET verification, complete the link-code and opt-in flow with a dedicated test recipient, send the approval template, receive signed delivery and button-reply webhooks, and prove identity binding, expiry, replay deduplication, risk-tier blocking, delivery failure, and privacy redaction. Keep both `CAPABILITY_WORKSPACE_NOTIFICATION_WHATSAPP=false` and `CAPABILITY_WORKSPACE_APPROVALS=false` until the acceptance bundle is reviewed.

**Evidence:** `.ruthless-evidence/productionization/whatsapp_official_requirements.md`; `docs/production/WHATSAPP_APPROVALS.md`; `.ruthless-evidence/productionization/whatsapp_reaudit_focused_go.log`; `.ruthless-evidence/productionization/whatsapp_reaudit_crypto_go.log`; `.ruthless-evidence/productionization/whatsapp_go_full_reaudit.log`; `.ruthless-evidence/productionization/whatsapp_compose_wiring_reaudit_final.log`; `.ruthless-evidence/productionization/whatsapp_promotion_reaudit_final.log`; `.ruthless-evidence/productionization/whatsapp_migration_verifier_reaudit_final.log`; `.ruthless-evidence/productionization/whatsapp_final_gates_after_repair.log`; `.ruthless-evidence/productionization/whatsapp_schema_reapply_final.log`; `.ruthless-evidence/productionization/whatsapp_runtime_rebuild_reaudit.log`; `.ruthless-evidence/productionization/whatsapp_docker_e2e_postcorrection.log`; `.ruthless-evidence/productionization/whatsapp_docker_api_boundaries.log`.

### PROD-015 — Latest hardening and documentation changes are not yet represented by a reviewed release SHA

**Severity:** P1 · **Category:** Release integrity · **Owner:** Release and DevOps · **Status:** OPEN / BLOCKED until a deliberate release cut.

**Observation:** `HEAD` and `origin/main` both resolve to `768f633486cd9adfa30b71471b442eee87681dd0`, while the current worktree contains additional source, migration, E2E, and production-document changes. The Docker verification therefore proves the current local worktree, not an immutable reviewed release artifact.

**Required fix and verification:** Review the complete diff, exclude raw logs, screenshots, test-results, `.env` files, cookies, tokens, and unapproved generated output, then cut one reviewed commit. Build frontend, Go, Python/worker, and proxy images from that exact SHA; record immutable digests, SBOM/provenance, migration manifest, security scan, and final gates. Do not set production approval variables before this evidence is attached.

**Evidence:** `.ruthless-evidence/productionization/gap_review_identity.log`; `docs/production/REMAINING_PRODUCTION_GAPS.md`.

### PROD-014 — Long-lived local Docker PostgreSQL was behind the repository migration set

**Severity:** P2 · **Category:** Local data-plane setup · **Owner:** DevOps and release · **Status:** RESOLVED LOCALLY; clean installation and managed rollout remain unverified.

**Observation:** The running Celery worker repeatedly returned structured failures because `automation_definitions`, `automation_runs`, and `automation_event_inbox` were absent from the long-lived local database, although the repository contained the corresponding recent migrations.

**Fix and verification:** Recent automation, task, saved-jobs, billing, external-research, and OmniSave migrations were applied in dependency order to the local database. The `saved_jobs` RLS migration was correctly executed as the local table owner. Required tables, RLS/policies, and billing uniqueness were checked; scheduled automation, event dispatch, checkpoint dispatch, and Celery ping returned successful results after repair. No managed or production database was changed.

**Evidence:** `.ruthless-evidence/productionization/docker_recent_migrations_apply.log`; `.ruthless-evidence/productionization/docker_automation_recovery_now.log`; `.ruthless-evidence/productionization/docker_database_contract_now.log`.

### PROD-013 — Public traffic could starve registration through the shared rate-limit bucket

**Severity:** P1 · **Category:** Authentication availability · **Owner:** Backend and security · **Status:** RESOLVED LOCALLY; production traffic profile remains unverified.

**Observation:** The Docker-backed full E2E run reached the signup test after the landing-page audit had generated enough anonymous analytics/branding traffic to exhaust the shared public IP bucket. The registration page displayed `Rate limit exceeded` and timed out waiting for the redirect, while the backend rate-limited public requests and authentication shared the same outer group.

**Fix:** Registration and login aliases now use the dedicated login limiter outside the shared public-request limiter. A Go regression floods the public health route and asserts registration is not rejected with 429. The formerly failing Docker signup journey passed after rebuilding the gateway; the complete rebuilt Docker E2E run then passed 39 tests with 14 intentional skips.

**Verification:** `go test ./...` and `go vet ./...` pass. The focused auth-limiter regression passes. `e2e/features.spec.ts` passes 1/1 after the image rebuild. Full Docker Playwright passes 39/39 executed tests with 14 intentional skips.

**Evidence:** `.ruthless-evidence/productionization/docker_rate_limit_fix_go_gate.log`; `.ruthless-evidence/productionization/docker_signup_rate_isolation.log`; `.ruthless-evidence/productionization/docker_e2e_final_after_rate_fix.log`.

### PROD-012 — Credit-pack billing required payment-proof and mode hardening

**Severity:** P1 · **Category:** Financial integrity / billing · **Owner:** Backend and billing · **Status:** RESOLVED LOCALLY; live Stripe acceptance remains an external release blocker.

**Observation:** The authenticated direct credit-purchase endpoint could grant credits from a client session without payment proof. The checkout implementation used Stripe subscription mode while the pricing page described one-time packs. Static credit tables were not present in the repository’s authoritative migration path.

**Fix:** Direct credit grants now require the internal service token and an explicit target user. Credit-pack checkout uses one-time payment mode, validates the supported pack, and records pack metadata. Paid Checkout Session webhook fulfillment is idempotent and refuses unpaid or unknown packs. Durable `user_credits` and `credit_ledger` tables, RLS/grants, and a unique payment-reference index were added to the migration and self-hosted initialization paths. Pricing now exposes deployment billing availability and disables authenticated checkout when the backend reports billing disabled.

**Verification:** Go API/billing tests pass, including direct-grant denial and one-time paid fulfillment idempotency. Frontend pricing, Task Workspace, and feature-flag tests pass 19/19. The new migration applied successfully twice to the disposable local PostgreSQL container, proving repeatability. No real Stripe payment or production webhook was executed.

**Evidence:** `.ruthless-evidence/productionization/billing_second_pass.log`; `.ruthless-evidence/productionization/local_billing_migration_apply.log`.

### PROD-011 — Minimal Minikube startup is blocked in the attached local Docker environment

**Severity:** P2 · **Category:** Local platform validation · **Owner:** DevOps / local platform · **Status:** BLOCKED; this does not change the production verdict.

**Observation:** The pre-existing stopped profile was safely deleted only after confirming it was disposable. A clean profile was then requested with Docker, 2 CPUs, 2 GB memory, 20 GB disk, and Kubernetes v1.35.1. Startup stalled after the cached base image and Kubernetes preload both reported 100% completion; no new Minikube container or profile was created. Local Docker Compose remained unaffected.

**Root cause:** The attached Docker Desktop/Minikube environment did not complete the base-image import/profile creation within repeated bounded waits. The evidence does not distinguish Docker Desktop I/O, Minikube cache import, or host resource scheduling as the definitive cause.

**Impact:** No new Minikube render, namespace, canary, or in-cluster readiness evidence can be claimed from this attempt. Prior disposable Kubernetes structural evidence remains valid only for the earlier captured run and is not upgraded by this failed retry.

**Required fix and verification:** On the attached desktop, inspect Docker Desktop resource and disk activity, then retry with a bounded `minikube start --driver=docker --cpus=2 --memory=2048 --disk-size=20g --kubernetes-version=v1.35.1 --wait=apiserver`. If it converges, capture `minikube status`, `kubectl get nodes`, Kustomize render output, and a disposable namespace canary using synthetic non-secret configuration. Do not apply production manifests or real credentials. If it stalls again, retain the blocker and use the previously preserved structural evidence only.

**Evidence:** `.ruthless-evidence/productionization/minikube_start_second_pass.log`.

### PROD-010 — Landing-page AutoPilot animation needs an explicit review-state label

**Severity:** P2 · **Category:** Product truthfulness / UX · **Owner:** Product and frontend · **Status:** RESOLVED LOCALLY; live production presentation remains a deployment gate.

**Observation:** A real browser visit to the local frontend displayed the illustrative AutoPilot sequence containing `Submitting Application`, while the same page separately labels the receipt showcase as illustrative and states that no application was submitted.

**Root cause:** The animation label described the final review-stage preparation as a submission action, without a persistent review-only label in the mockup.

**Fix:** Changed the final step to `Preparing Submission for Review`, added `Illustrative workflow · no application submitted` to the mockup, and added a focused regression assertion in `src/test/TruthfulnessAccessibility.test.tsx`.

**Verification:** `pnpm exec vitest run src/test/TruthfulnessAccessibility.test.tsx` passed 6/6 tests. The local browser observation and test artifact are recorded in `.ruthless-evidence/productionization/browser_second_pass_notes.md` and `.ruthless-evidence/productionization/autopilot_truthfulness_regression.log`.
