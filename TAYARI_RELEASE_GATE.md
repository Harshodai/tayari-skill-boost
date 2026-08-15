# Tayari Skill Boost — Release-Gate Decision

**Assessment date:** 2026-08-16
**Branch:** `main`
**Decision:** **INTERNAL DEMO ONLY**
**Permitted scope:** Controlled internal demonstrations with synthetic or disposable data. Do not enable public customer onboarding, real customer documents, autonomous external submissions, or macOS public distribution.

## Executive decision

The code-level remediation gates are green. The dependency graph was remediated, the Python audit reports no known vulnerabilities, Go and Python regression suites pass, frontend tests/typecheck/build pass, the release contract passes, observability is protected and tested, public claims and privacy disclosures were hardened, and the macOS packaging contract fails closed around artifact contents, arm64 policy, signing, Gatekeeper, and notarization evidence. The candidate journey now includes a source-locked claim ledger for zero-hallucination verification, calibrated qualitative fit representations with unranked degradation states, and directed asymmetric skill mobility graphs.

The product is **not approved for public launch** because several release proofs require real isolated infrastructure or Apple credentials that are not available in this repository-only run. The largest remaining risks are live hostile staging evidence, disposable backup-restore and rollback execution, a generated unauthenticated route inventory compared against the exposure registry, and credentialed macOS signing/notarization plus clean-machine installation tests. The appropriate current scope is internal demonstration only.

> **Release rule:** Code gates being green does not substitute for production evidence. Do not promote a public image, accept real customer documents, enable autonomous external submissions, or distribute a macOS artifact until the remaining S0 evidence is attached to the release record.

## Proof evidence

| Area | Evidence | Result | Release interpretation |
|---|---|---:|---|
| Go gateway | `go test ./...`; `go vet ./...` | Pass | Gateway regression and static-analysis gates are green. |
| Python AI engine | `pytest` | **717 passed, 4 skipped** | Security, service, observability, claim-ledger, match-quality, and lifecycle regression suite is green; deprecation warnings remain non-blocking. |
| Frontend unit suite | `npx vitest run` / `bun run test` | **35 files, 110 tests passed** | Frontend behavior, CalibratedFitCard, and truthfulness/accessibility contracts are green. |
| Frontend typecheck | `bunx tsc --noEmit` / `npm run build` | Pass | No TypeScript compilation errors. |
| Frontend lint | `bun run lint` | Pass with legacy warnings | No lint errors; legacy warning-level findings remain for later cleanup. |
| Production frontend | `npm run build` | Pass | Largest JavaScript asset is below the budget; total bundle builds cleanly in ~4s. |
| Public website | `node scripts/website_release_contract.mjs`; public-route E2E history | Pass | Routes, API boundaries, security headers, bundle conditions, and unsupported-claim scan pass. |
| Observability | Go/Python observability proofs and `infra/observability/alerts.yml` | Pass | Structured request logs, correlation IDs, protected metrics, provider/budget counters, queue age, and alert thresholds are versioned and tested. |
| Exposure safety | `backend/go/internal/api/exposure_contract_test.go`; `infra/endpoint-exposure.yml` | Targeted pass | Registered anonymous routes and representative protected routes are covered; complete generated route-to-registry comparison remains open. |
| Backup/recovery safety | `scripts/staging_recovery_contract_test.sh` | Pass for fail-closed preflight | Same-target restore, missing restore mode, rollback approval, mutable-image rejection, and provenance/dry-run checks pass; live disposable restore and rollback are not executed. |
| Migration contract | `python3 scripts/verify_self_hosted_migrations.py` | Pass | Required mirrored migrations, tenant-RLS presence, and order invariants pass. |
| Release contract | `bash scripts/release_contract_test.sh` | Pass | Lockfile, production configuration, desktop, website, observability, exposure, and staging-recovery contracts pass. |
| JavaScript dependency gate | `SECURITY_BASELINE_ENFORCE=true node scripts/security_scan.mjs` | Pass | 0 unresolved high/critical findings across RLS, grants, and client security policies. |
| Python dependency gate | `pip-audit` / requirements lockfile verification | Pass | No known vulnerabilities found. |
| macOS static release contract | `bash scripts/mac_release_contract_test.sh` | Pass | Hardened runtime, entitlements, arm64-only targets, package exclusions, runbook, and artifact verifier are enforced. |
| macOS credentialed release | `scripts/mac_artifact_contract.sh` on a signed artifact | Not executed | Developer ID signing, notarization, stapling, Gatekeeper, clean-machine install, update/downgrade, tamper, and offline-start evidence still block macOS distribution. |


## Remaining blocking risks and owners

| Risk | Severity | Owner | Required closure evidence | Scope / expiry |
|---|---|---|---|---|
| No live hostile staging flood, SSRF, prompt-injection, cross-tenant, approval-replay, kill-switch, deletion, backup-restore, or rollback evidence | S0 | Platform owner | Execute the isolated staging suite, restore into a separate disposable target, prove rollback, and attach logs plus timestamps | Blocks public beta and autonomous external submissions |
| Complete unauthenticated endpoint inventory versus the explicit exposure registry is not recorded | S1 | API security owner | Generate the route inventory from the running gateway and Python service, compare it to `infra/endpoint-exposure.yml`, and attach the diff | Close before public beta |
| Apple signing, notarization, stapling, Gatekeeper, and clean-machine distribution are not executed | S0 for macOS distribution | Desktop release owner | Produce a signed arm64 DMG/ZIP, run `scripts/mac_artifact_contract.sh`, attach `codesign`, `spctl`, `stapler`, install, downgrade, tamper, and offline evidence | Blocks every macOS public download |
| Production promotion has not been executed against a real registry and isolated cluster | S0 for public deployment | Platform/release owner | Build, scan, attest, push, render immutable digests, apply with server-side dry-run followed by promotion, wait for rollout, smoke-test, and retain rollback metadata | Blocks public production promotion |
| Clean-machine macOS install/update/downgrade/corrupted-update/offline-start tests remain open | S1 | Desktop release owner | Execute the scenarios in `docs/MACOS_RELEASE_RUNBOOK.md` on a clean Apple Silicon account | Close before macOS beta |
| Frontend lint retains a large legacy warning baseline | S2 | Frontend owner | Reduce or explicitly baseline warnings without introducing errors | Does not block internal demos; review before public beta |

## Required next release sequence

First, deploy a disposable isolated staging environment and run the hostile suite, backup restore, and rollback drills against non-customer data. Second, generate the complete route inventory and attach the registry comparison. Third, execute the credentialed macOS release runbook on a clean Apple Silicon runner and retain signed, notarized, stapled, Gatekeeper, and installation evidence. Fourth, execute immutable production promotion only after registry, backup, rollback, and observability evidence is available. Finally, rerun the full proof suite from a clean checkout and issue a fresh decision.

## Final decision

**INTERNAL DEMO ONLY.** The repository is suitable for continued engineering and controlled internal demonstrations using synthetic or disposable data. It is not approved for public beta, paid customer onboarding, real customer documents, autonomous production submissions, or macOS distribution until the remaining infrastructure and Apple release gates are closed with attached evidence.
