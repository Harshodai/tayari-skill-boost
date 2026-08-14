# Tayari Skill Boost — Release-Gate Decision

**Assessment date:** 2026-08-14  
**Branch:** `main`  
**Decision:** **NO-GO for public launch**  
**Permitted scope:** Controlled internal demos only, with no real customer documents, credentials, or autonomous production submissions.

## Executive decision

The remediation program materially reduced the highest-risk exposure paths. Voice routes are authenticated and rate-limited; the Python AI service is protected by an internal gateway token; approval, final-action signing, prompt-injection blocking, kill-switch, tenant isolation, and account-erasure controls have proof tests; release and production-Compose contracts are enforced; the Electron bridge and website have dedicated security contracts.

The product is **not safe to expose publicly yet**. The blocking reason is not a missing polish item: the JavaScript release scanner reports **25 new high-severity dependency findings**. In addition, the connected Mac could not resolve the pinned `browser-use==0.1.34` requirement through pip-audit, live staging flood/SSRF/restore/rollback evidence was not run, and Apple signing/notarization was configured but not executed. These conditions prevent a defensible public-beta or production release decision.

## Proof evidence

| Area | Evidence | Result | Release interpretation |
|---|---|---:|---|
| Go gateway | `go test ./...`; `go vet ./...` | Pass | Gateway regression and static-analysis gates are green. |
| Python AI engine | `pytest app/tests tests -q` | **685 passed, 4 skipped** | Security and service regression suite is green; 38 deprecation warnings remain. |
| Frontend | Typecheck, lint, 32 Vitest files / 95 tests | Pass | Frontend build gates are green; lint retains a legacy warning baseline. |
| Production frontend | Disposable Supabase/API values; Vite build | Pass | Largest JavaScript asset was approximately 798 KiB, below the 900 KiB budget. |
| Public browser routes | Playwright `e2e/public_routes.spec.ts` | **7 passed** | Public routes and `/free-ats-scan` redirect work without credentials. |
| Release contract | `bash scripts/release_contract_test.sh` | Pass | Pinned actions, Bun lockfile, container configuration, desktop contract, and website contract pass. |
| Migration contract | `python3 scripts/verify_self_hosted_migrations.py` | Pass | Required mirrored migrations, tenant-RLS presence, and order invariants pass. |
| Backup safety | Same-target restore refusal path | Pass | Destructive same-target restore is refused; live disposable restore was not run. |
| Secret scan | Gitleaks history scan | Pass | No secrets detected in the scanned history. |
| JavaScript dependency gate | `bun run security:scan` | **Fail: 25 high findings** | Blocking. Findings include `minimatch`, `brace-expansion`, `js-yaml`, `flatted`, `fast-uri`, `ws`, `picomatch`, `nanoid`, `lodash`, `ip-address`, `glob`, and `form-data`. |
| Python dependency gate | `python3 -m pip_audit -r backend/python/requirements.txt` | Inconclusive | The connected Mac’s package index could not resolve pinned `browser-use==0.1.34`; this is not a clean pass. |
| macOS signing | Electron hardened-runtime/notarization configuration | Not executed | Developer ID signing, notarization, stapling, Gatekeeper, update, and clean-machine evidence remain release gates. |

## Blocking residual risks and owners

| Risk | Severity | Owner | Required closure evidence | Expiry / scope |
|---|---|---|---|---|
| 25 new high JavaScript dependency findings | S0 | Frontend/release owner | Upgrade or replace affected dependency chains; rerun `bun run security:scan` with zero new high/critical findings; review any unavoidable exception in writing | Blocks every public release; no baseline acceptance without security review |
| Python dependency audit cannot resolve `browser-use==0.1.34` on the connected Mac | S1 | Python/release owner | Run pip-audit in the same Linux image used by CI, resolve or explicitly document the package source and vulnerability status | Must close before staging promotion |
| No live staging flood, SSRF, rollback, or disposable backup-restore evidence | S0 | Platform owner | Execute hostile staging suite against an isolated environment, restore to a separate disposable target, and prove rollback | Must close before public beta |
| Apple signing and notarization not executed | S0 for macOS distribution | Desktop release owner | Produce signed arm64 artifact, notarization result, stapled ticket, Gatekeeper verification, update and downgrade tests | Blocks macOS public distribution |
| M5 truthfulness/privacy/accessibility follow-ups remain open | S1 | Product/privacy owner | Audit claims, document resume/browser-session/screenshot/provider retention and deletion behavior, and run accessibility conversion-path checks | Must close before public beta |
| Complete unauthenticated endpoint inventory versus an explicit exposure registry is not yet recorded | S1 | API security owner | Generate route inventory, compare with the registry, and attach the diff to the release record | Must close before public beta |

## Required next release sequence

First, remediate the dependency graph rather than baselining the findings. The remediation must be performed against production-relevant dependencies, followed by a fresh lockfile install and a clean security scan. Second, run the Python audit in the CI/Linux image with the exact locked requirements and resolve the `browser-use` source mismatch. Third, deploy an isolated staging environment and execute the hostile tests and disposable restore/rollback drills. Fourth, execute Developer ID signing and notarization on a controlled macOS runner, then verify the artifact on a clean Apple Silicon machine. Finally, close the endpoint-inventory, privacy/retention, claims, and accessibility gates.

> **Release rule:** Do not promote a public image, enable autonomous external submissions, or distribute a macOS artifact until all S0 gates are green and the remaining S1 risks have an owner, evidence, and expiry.

## Final decision

**NO-GO for public launch.** The remediation work is suitable for continued engineering and controlled internal demonstrations, but not for public beta, paid customer onboarding, real customer documents, or production autonomous submissions. The next release candidate must carry forward this report and replace the failed or inconclusive evidence with fresh passing artifacts.
