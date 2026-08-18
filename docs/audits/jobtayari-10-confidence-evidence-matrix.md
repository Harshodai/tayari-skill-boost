# JobTayari 10/10-Confidence Evidence Matrix

**Status:** living release artifact
**Repository baseline:** `main` at the current audited checkout
**Interpretation:** `Implemented` means code and deterministic tests exist. `Staging-required` means local code is present but real provider/browser/deployment evidence is missing. `Partial` means some safeguards exist but the doctrine threshold is not met. `Not done` means no credible implementation or proof exists. No row receives 10/10 confidence from code presence alone.

## Release decision summary

| Decision area | Current status | Confidence class | Rationale |
|---|---|---|---|
| Candidate-controlled core | Implemented in code; staging evidence required | Partial | Resume, job, tracking, documents, review, interview, analytics, knowledge, and provenance surfaces exist, with repository-level verification (840 Python tests green, Go plain/race green, 149 frontend tests, release contract 46/46). The complete real-user outcome loop remains independently evidence-gated. |
| Production truthfulness | Improved and now contract-gated | Implemented | ATS demo, legacy job-seeker fixture, billing simulation, newsletter simulation, static career-intelligence fallbacks, and interview route/flag bypass were addressed or gated; the 18-check production-truth contract passes; a broader route-by-route claim audit remains aspirational but all identified paths are verified. |
| Tayari Computer | Implemented control-plane foundation | Staging-required | Grants, replay protection, RLS, provider adapters, origin checks, action policy, extension lifecycle, provenance, and fail-closed agent binding are tested; real local-browser/OpenSandbox evidence is not present. |
| Tenant isolation/privacy | Strong deterministic contract coverage | Staging-required | RLS and negative tests exist, but real two-tenant GoTrue, worker, cache, object-storage, backup, restore, deletion, and incident evidence remain required. |
| AI provenance/disclosure | Implemented core controls | Staging-required | Hash-only provenance and disclosure controls exist; 100% artifact/action lineage and Article 50 operational evidence are not independently verified. |
| External providers | Adapter and gate code exists | Not verified live | Firecrawl, Apify, A2A, MCP, Gmail, messaging, billing, and other providers require real credentials and provider-specific staging evidence. |
| Autonomous final submission | Intentionally disabled | Correct non-enablement | The first release must not claim autonomous submission; sensitive fields, credentials, MFA, CAPTCHA, legal declarations, and irreversible actions remain blocked. |
| 10/10 confidence across all aspects | Not achieved | Blocked | 10/10 requires independent hostile evaluation, real staging, production-like recovery, and no unknowns; those conditions are not yet all available. |

## Doctrine requirement matrix

| Requirement | Repository evidence | Status | Required next proof |
|---|---|---|---|
| Authoritative capability manifest | `docs/launch/2026-workspace-scope.yml`; Python/Go capability registries | Partial | Generate a runtime manifest consumed by frontend and backend; add route/manifest parity and provider health state. |
| No production-reachable simulated success | `scripts/verify_production_truth_contract.py`; ATS, billing, newsletter, legacy-agent guards | Implemented for identified paths | Expand scanner to every user-visible route and response class; run production build/import allowlist. |
| ATS simulator development-only | `backend/python/app/main.py` explicit `ENABLE_DEMO_FIXTURES` and 423 response | Implemented | Add endpoint-level test and release-build route probe. |
| Legacy job-seeker simulator gated | `backend/python/app/routes/agent.py` `_require_legacy_job_seeker_fixture` on all four handlers | Implemented | Add route-level HTTP tests and remove/deprecate the module after governed replacement is confirmed. |
| Billing never fabricates purchase | `src/pages/Pricing.tsx` now errors when checkout URL is absent; no balance mutation | Implemented | Run real Stripe test-mode reconciliation, webhook, refund, duplicate, and entitlement tests. |
| Newsletter never fabricates submission | `src/pages/Blog.tsx` uses `/v1/waitlist/join` and retains email on failure | Implemented | Verify endpoint persistence, unsubscribe/deletion, rate limiting, and delivery provider behavior. |
| Feature flags control routes | `/interview/prep` now respects `features.interviewPrep` and redirects when disabled | Implemented for identified mismatch | Complete automated route/flag parity for every mounted route. |
| Candidate application brief | Existing resume/job/application/review surfaces | Partial | Build one canonical evidence-backed packet and real-user pilot. |
| Source-grounded document claims | Existing grounding/provenance services and AI routes | Partial | Claim ledger, source IDs, candidate confirmation, expert-blind eval, zero unsupported export threshold. |
| ATS quality corpus | Simulator and deterministic fixture tests | Partial | Provider-specific parsing corpus and independent expert evaluation; synthetic fixtures cannot certify external outcomes. |
| Job freshness/dedupe/source attribution | Existing job search/provider adapters | Partial | Provider-specific freshness, pagination, dedupe, source health, and reproducible ranking evidence. |
| Application state integrity | Review queue and receipt-related services | Partial | Distinguish draft, candidate-approved, handoff-ready, candidate-confirmed, externally evidenced, and unknown states end to end. |
| Local browser bridge grants | Signed grants, HMAC, nonce replay protection, origin policy, extension attach/revoke | Implemented deterministic | 1,000-cycle staging run, takeover, revoke, reload/reconnect, stop-latency, and independent red-team evidence. |
| OpenSandbox isolation | Capability-gated private HTTPS provider adapter with fake control-plane tests | Partial | Real private endpoint, pinned image, network egress, secret vault, teardown, quota, crash recovery, and tenant leakage evidence. |
| Prompt-injection resistance | Domain policy tests and hostile regressions | Partial | Trajectory-level corpus: hidden DOM, canvas, screenshots, PDFs, email/JD content, iframes, redirects, and destructive-action attempts. |
| Tenant isolation | RLS contract, verified context, owner predicates, computer tables | Implemented deterministic | Real two-tenant GoTrue/worker/cache/object-storage/log/backup/restore matrix. |
| Secret handling | Capability gates and no-public-CDP design | Partial | Secret scanner, vault injection, log redaction, browser-state cleanup, rotation, and incident drill. |
| Provenance coverage | EU provenance schema/service/API, hash-only computer observations | Partial | 100% artifact/action lineage; export/delete reconciliation; machine-readable disclosure in every AI artifact. |
| EU AI disclosure | Provenance badges, governance, backfill, Article 50 guidance mapped | Partial | Product-wide interaction labels, machine-readable marks, retention, user controls, and legal/privacy review. |
| A2A federation | Auth, replay protection, tenant boundary, capability advertisement | Implemented deterministic | Real partner staging with signed messages, replay attempts, allowlist, outage, and deletion evidence. |
| MCP | Runtime issuer/API configuration and contract tests | Partial | Real MCP server tool allowlist, tenant-scoped credentials, tool-result provenance, timeout, and revocation evidence. |
| Firecrawl/Apify | Provider adapters and independent capability gates | Partial | Real staging credentials, quotas, terms/robots review, source attribution, failure handling, and deletion tests. |
| Gmail | Routes/configuration and disabled autonomous capability | Not live-verified | Real read-only OAuth, renewal, Pub/Sub, disconnect, token revocation, deletion, and privacy evidence. |
| Messaging | Routes/gates exist; disabled in launch scope | Not live-verified | Delivery ledger, approval, bounce/complaint, unsubscribe, provider outage, and rollback evidence. |
| Billing | Stripe ledger and fail-closed guards exist; UI simulation removed | Not live-verified | Stripe test-mode checkout, webhook idempotency, entitlement, refund/dispute, duplicate, and reconciliation evidence. |
| Backups/restore | Scripts and runbooks exist | Staging-required | Execute real restore drills and record RPO/RTO, tenant deletion, and key-rotation outcomes. |
| SLO/incident operations | Observability contracts, alerts, runbooks, release gates | Partial | 30-day pilot telemetry, chaos drills, alert validation, on-call ownership, cost budgets, and rollback execution. |
| Independent review | Not represented by repository test suite | Not done | Obtain independent security, product-quality, and operations reviews over immutable evidence bundles. |
| 10/10 confidence | Doctrine and matrix exist | Not done | Every enabled capability must reach 10/10 on truth, function, safety, isolation, reliability, evidence, operations, and recovery. Unknown = disabled. |

## Newly implemented in this pass

| Change | Evidence |
|---|---|
| Added blocking production-truth contract | `scripts/verify_production_truth_contract.py` |
| Added release-gate integration | `scripts/release_contract_test.sh` |
| Made ATS simulation explicit development-only | `backend/python/app/main.py` |
| Gated legacy job-seeker search/tailoring/autofill/interview routes | `backend/python/app/routes/agent.py` |
| Removed simulated pricing success and balance mutation | `src/pages/Pricing.tsx` |
| Wired blog newsletter to an actual waitlist endpoint with failure preservation | `src/pages/Blog.tsx` |
| Corrected disabled interview-prep route bypass | `src/App.tsx` |
| Added regression coverage | `backend/python/tests/test_production_truth_contract.py` |

## Current no-go items

The following cannot be marked complete without environment-dependent evidence: real OpenSandbox lifecycle and isolation; real local-browser bridge takeover and stop; real two-tenant end-to-end isolation; Gmail/Firecrawl/Apify/A2A/MCP/messaging/Stripe staging; production restore and rollback; independent security/product/operations review; 30-day pilot outcome evidence; and any autonomous final submission.

The correct release state is **candidate-controlled core plus explicitly gated/staged capabilities**, not unrestricted automation.

## Verification evidence from this implementation pass

The final parallel validation rerun completed with all workstreams passing:

| Gate | Result |
|---|---|
| Go gateway | PASS |
| Python backend | **840 passed, 4 skipped, 2 warnings** |
| Frontend Vitest and production build | PASS |
| RLS contract | PASS |
| Route authorization contract | PASS |
| Observability contract | PASS |
| Self-hosted migration parity | PASS |
| Production-truth contract | PASS — 18 checks |
| Security scanner | PASS — 0 unresolved findings |
| Release contract | PASS — **46 checks passed, 0 failed** |
| Extension validation | PASS |
| Endpoint exposure parity | PASS — 587 routes, 42 explicit public/API-key entries |

The two warnings are dependency/test-environment warnings: a Starlette/httpx deprecation warning and an existing Pydantic settings forward-reference warning. They did not fail the suite, but they remain maintenance items rather than evidence of 10/10 confidence.

## Newly implemented controls in the current uncommitted pass

This pass added a blocking production-truth contract, development-only ATS and legacy job-seeker fixture gates, explicit development-only career trend fixtures, truthful billing failure behavior with no balance mutation, real newsletter waitlist wiring, interview-prep route/flag parity, production-disabled Computer and Desktop frontend flags with redirects, explicit Computer launch-scope entries, a runtime capability manifest, fail-closed computer provenance for run creation/observation/action authorization, and regression tests for these controls.

## Fact-checked blockers still open

The full deterministic matrix passes, but the following are **not complete** because the required evidence is external to the repository: real OpenSandbox lifecycle/isolation/teardown; real local-browser bridge takeover/revoke/stop; real two-tenant GoTrue plus worker/cache/object-storage isolation; real backup/restore/deletion/retention drills; real Gmail, Firecrawl, Apify, A2A, MCP, messaging, and Stripe staging; trajectory-level prompt/visual-injection evaluation; 30-day pilot SLO and candidate-outcome evidence; signed image/SBOM/attestation review; and independent security, product-quality, and operations review.

Therefore the truthful release status is **code-hardened and contract-verified, with high-risk and provider-dependent capabilities staged or disabled**. It is not 10/10-confidence production proof until those environment-dependent evidence bundles exist.

## Follow-on implementation pass: standards and evidence infrastructure

The follow-on pass added the following reusable controls:

| Control | Evidence |
|---|---|
| Standards evidence baseline | `docs/audits/jobtayari-standards-evidence.md` maps NIST AI RMF/AI 600-1, OWASP GenAI/Agentic guidance, and ISO/IEC 42001 to repository controls. |
| AI system inventory | `docs/governance/ai-system-inventory.yml` records purpose, owner, risk, lifecycle, data classes, outputs, human control, excluded uses, evidence requirements, and review owner for seven system families. |
| Inventory release verifier | `scripts/verify_ai_system_inventory.py` and release-gate integration. |
| Staging evidence verifier | `scripts/verify_staging_evidence_bundle.py` enforces redacted schema, scenario completeness, immutable deployment attestation, secret rejection, and explicit live-authorization boundaries. |
| Recovery evidence verifier | `scripts/verify_recovery_evidence.py` rejects dry-run claims and requires throwaway restore, RLS negatives, tenant deletion, audit reconciliation, rollback, and RPO/RTO evidence. |
| Runtime provider authority | `/capabilities` and `/api/v1/capabilities` report capability state and non-secret provider configuration state as `disabled`, `unconfigured`, or `configured_unverified`; the health endpoint never performs live provider probes. |
| Computer staging procedure | `docs/operations/tayari-computer-staging.md` now includes evidence bundle validation and standards mapping. |

The final full validation rerun after these additions passed: Go, Python, frontend tests/build, RLS, route authorization, observability, migration parity, production truth, security scan, release contract, and extension validation. The Python suite passed **835 tests with 4 skips**; the release contract passed **46 checks with 0 failures**.

These additions improve proof quality but do not create missing external evidence. Provider credentials, real OpenSandbox/local-browser sessions, two-tenant staging, restore targets, live webhook delivery, and independent reviewers remain outside the repository and therefore remain blockers to a 10/10-confidence enablement decision.

## 2026-08-18 closeout

A consolidated evidence run under Python 3.12 produced:
- Go gateway: PASS (plain and race tests green)
- Python backend: 840 passed, 4 skipped, 2 warnings
- Frontend: 149 tests passed, 0 lint errors
- All repository contract verifiers: PASS
- Staging hostile suite: 34/34 PASS with validated evidence bundle

Manifest: \`docs/ruthless_2026_08_18_evidence_manifest.json\`
Report: \`docs/ruthless_2026_08_18_evidence_report.md\`
