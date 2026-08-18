# JobTayari Agent Handoff

**Purpose:** Give a future research or implementation agent a decision-complete, evidence-aware starting point for continuing JobTayari hardening without redoing the entire repository audit or making unsupported production claims.

**Repository:** `Harshodai/tayari-skill-boost`
**Branch:** `main`
**Last committed baseline before this handoff:** commit `5129478` (`Document ruthless external JobTayari audit`)
**Current handoff scope:** additional uncommitted hardening and evidence infrastructure listed below.
**Operating rule:** Unknown behavior is not complete. If live evidence is missing, keep the capability staged or disabled.

## Mission

JobTayari is a multi-tenant AI-powered career workspace. Its defensible product boundary is candidate-controlled assistance: resume and ATS assistance, job discovery, application tracking, tailored drafts, review queues, interview preparation, analytics, public-source knowledge, provenance, and bounded browser assistance.

The platform also contains high-risk or provider-dependent surfaces: Gmail, messaging, billing, external research, A2A, MCP, OpenSandbox isolated computers, local-browser bridge control, desktop execution, and legacy autonomous-agent routes. These must not be described as production-ready merely because code, a route, an adapter, or a unit test exists.

## Non-negotiable rules

1. **Never enable autonomous external ATS submission in the first release.** `workspace.computer_submission` and sensitive browser actions remain disabled.
2. **Never enter or handle passwords, MFA/OTP values, CAPTCHA answers, legal declarations, credentials, work authorization, sponsorship, EEO, salary, or other sensitive application fields autonomously.**
3. **Never expose public CDP or VNC.** OpenSandbox control planes and browser endpoints must be private, HTTPS-protected, digest-pinned, and teardown-verifiable.
4. **Never trust caller-supplied identity.** Tenant and user identity must come from verified gateway context or validated JWT claims, and every database query must carry owner and tenant predicates.
5. **Never treat internal success as external success.** A candidate-approved handoff is not an externally verified application until an ATS-side receipt, application ID, confirmation page, or provider evidence exists.
6. **Never use static fixtures as production data.** Development fixtures must require explicit flags, carry `evidence_class: demo_fixture`, and fail closed in staging/production.
7. **Never report credentials as live verification.** The runtime capability manifest may report `configured_unverified`, but only a signed staging evidence bundle can establish live proof.
8. **Never commit secrets or workflow changes.** The GitHub token lacks workflow permission; do not modify or push `.github/workflows/*` unless explicitly authorized and supported.

## Current implementation evidence

| Area | Current state |
|---|---|
| Product truth | `scripts/verify_production_truth_contract.py` blocks known simulated success paths, checks disabled route/flag parity, checks launch-scope declarations, and requires legacy fixture gates. |
| ATS simulation | `/api/v1/ats/simulate` requires explicit development `ENABLE_DEMO_FIXTURES` and returns 423 otherwise. |
| Legacy agent | Legacy job-seeker search, tailoring, autofill, and interview-prep routes require `ENABLE_LEGACY_JOB_SEEKER_FIXTURE` and are blocked in staging/production. |
| Billing | Pricing no longer fabricates checkout success or mutates balances when a checkout URL is absent. |
| Newsletter | Blog subscription uses `/v1/waitlist/join`; failed delivery retains the email and reports failure. |
| Frontend scope | Interview-prep, Computer, and Desktop routes obey explicit feature flags and redirect when disabled. |
| Runtime authority | `/capabilities` and `/api/v1/capabilities` expose non-secret capability state plus provider state: `disabled`, `unconfigured`, or `configured_unverified`. |
| Computer control | Signed grants, HMAC verification, nonce replay protection, RLS, owner/tenant predicates, origin checks, bounded action classes, extension attach/revoke, OpenSandbox adapter, and fail-closed browser-agent binding exist. |
| Computer provenance | Computer run creation, observations, and action authorization fail closed if durable provenance cannot be captured; revoke remains an always-available kill switch. |
| Staging evidence | `scripts/verify_staging_evidence_bundle.py` validates redacted staging evidence, required scenarios, image/SBOM/provider hashes, HTTPS endpoints, and explicit live authorization. |
| Recovery evidence | `scripts/verify_recovery_evidence.py` rejects dry-run claims and requires throwaway restore, RLS negatives, tenant deletion, audit reconciliation, rollback, and RPO/RTO metrics. |
| Governance | `docs/governance/ai-system-inventory.yml` records seven AI system families, owners, risk tiers, lifecycle states, data classes, human controls, exclusions, evidence requirements, and review owners. |
| Standards | `docs/audits/jobtayari-standards-evidence.md` maps controls to NIST AI RMF/AI 600-1, OWASP GenAI/Agentic guidance, and ISO/IEC 42001. |

## Full validation commands

Run from `/home/ubuntu/tayari-skill-boost` with non-production test configuration. Never use live provider credentials for the deterministic suite.

```bash
cd backend/go && go test ./... && cd ../..
cd backend/python && JWT_SECRET=ci-test-jwt-secret-not-production PYTHONPATH=. pytest -q && cd ../..
pnpm test -- --run
pnpm build
python3 scripts/verify_rls_contract.py
python3 scripts/verify_route_authorization_contract.py
python3 scripts/verify_observability_contract.py
python3 scripts/verify_self_hosted_migrations.py
python3 scripts/verify_production_truth_contract.py
python3 scripts/verify_ai_system_inventory.py
python3 scripts/verify_staging_evidence_bundle.py --plan
python3 scripts/verify_recovery_evidence.py --plan
SECURITY_BASELINE_ENFORCE=true node scripts/security_scan.mjs
bash scripts/release_contract_test.sh
node scripts/validate-extension.mjs
```

Expected deterministic baseline at the time of this handoff: Python **835 passed, 4 skipped**; Go pass; frontend tests/build pass; security scanner zero unresolved findings; release contract **46 passed, 0 failed**; extension pass. Re-run rather than trusting these historical counts.

## Environment-dependent proof still required

These are not complete in the repository and must remain staged/disabled:

| Blocker | Required proof |
|---|---|
| OpenSandbox | Real private HTTPS control plane, digest-pinned image, deny-private network policy, quota, TTL, teardown, crash recovery, no cross-run filesystem visibility, and provider-side destroy timestamp. |
| Local browser bridge | Dedicated staging profile, signed attach, nonce replay rejection, wrong-origin rejection, selected-tab boundary, extension revoke, stop latency, reconnect behavior, and proof that no cookies/profile/password/MFA data leaves the extension. |
| Tenant isolation | Two real GoTrue users in two tenants across API, worker, Redis, object storage, logs, backups, restore, retry, and restart conditions. |
| Recovery | Throwaway PostgreSQL/Supabase restore using `scripts/restore-drill.sh`, post-restore RLS negatives, deletion/export reconciliation, rollback, and measured RPO/RTO. |
| Providers | Real staged Firecrawl, Apify, A2A, MCP, Gmail, messaging, and Stripe evidence with least-privilege credentials, quotas, revocation, outage, idempotency, deletion, and receipts. |
| Adversarial safety | Trajectory-level prompt injection, visual injection, hidden DOM/PDF/email instructions, tool misuse, credential boundary, redirect, iframe, and destructive-action scenarios. |
| Independent assurance | Separate security, product-quality, privacy, and operations reviewers approve immutable evidence bundles. |
| Pilot outcomes | 30-day candidate pilot with calibrated quality, application handoff integrity, latency, cost, recovery, and candidate-outcome metrics. |

## How to continue

A future agent should begin by reading this file, `docs/audits/jobtayari-10-confidence-evidence-matrix.md`, `docs/audits/jobtayari-standards-evidence.md`, `docs/governance/ai-system-inventory.yml`, and `docs/operations/tayari-computer-staging.md`. It should then run the deterministic validation matrix before changing code.

For external research, use the attached research brief and evidence template. Research must use primary sources first, record URLs and retrieval dates, distinguish watched/observed evidence from metadata, and never convert a vendor claim into proof. Every new provider or AI capability must receive an inventory entry, a launch state, a negative-test plan, a rollback plan, and a signed evidence bundle before enablement.

For implementation, preserve the Go/Python separation, route all frontend API calls through the Go gateway, preserve self-hosted behavior, add migrations plus self-hosted init parity, and add tests before changing the release gate. Do not weaken a failing gate to obtain a green build.
