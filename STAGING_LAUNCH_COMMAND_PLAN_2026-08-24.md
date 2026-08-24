# Tayari Staging Launch Command Plan

**Version:** 1.0 — 24 August 2026
**Decision standard:** This document governs whether Tayari may enter a **controlled staging environment**. It is not permission to launch to public production.
**Rule:** Any failed, missing, ambiguous, or manually waived **red gate** is a **no-go**. There is no “we will fix it after staging” exception for authorization, secret handling, data integrity, or truthful user-facing claims.

## 1. Definition of “Ready for Staging”

Tayari is ready for staging only when a specific immutable release candidate has been deployed into a **separate, non-production environment**, every red gate below has evidence attached, and the environment demonstrates safe failure—not merely happy-path success. Staging is intended to prove deployment, authorization, observability, rollback, and limited real-workflow behavior before any production promotion decision.

The first staging scope must remain narrow. It includes the supported job-search, resume, public ATS scan, authenticated profile, and candidate-controlled AI preparation paths. It explicitly excludes the Apply Agent, autonomous browser/computer control, unattended external submissions, production payments, and any feature not enabled for production in `src/config/features.ts`.

> **Launch principle:** If a candidate could lose data, see another candidate’s data, be told an AI action happened when it did not, have an application submitted without explicit review, or receive fabricated career advice, staging has failed.

## 2. Non-Negotiable Stop-Ship Gates

| Gate | Required evidence | Pass condition | Automatic no-go / escalation trigger | Accountable owner |
|---|---|---|---|---|
| **Release identity** | Release SHA, signed/tagged build artifact, generated change list, reviewer sign-off | One immutable SHA; only approved changes; no unreviewed emergency edits | Deployment from a dirty workstation, floating branch, or unverifiable artifact | Engineering lead |
| **Source health** | CI URLs/logs for frontend tests/build/typecheck, Go tests/vet, Python tests, security gate | All listed jobs green on the exact SHA | Any test failure, `tsc` failure, new security finding, or skipped job | Engineering lead |
| **Database authorization** | Verified backup reference, migration output, `scripts/check_public_table_rls.sh` output, negative PostgREST probes | Migration applies as `supabase_admin`; RLS gate passes; anonymous probes are denied | Any public table lacks RLS; direct anonymous/authenticated access to sensitive data; migration error | Data/security owner |
| **Secrets and environment isolation** | Secret inventory, staging-only credentials, secret scanner result, environment-variable review | No production secrets copied unnecessarily; no secrets in client build/logs; staging has separate DB/keys | Production database/key used by staging without explicit approval; placeholder/blank required secret; leaked secret | Security owner |
| **Network and trust boundaries** | Config snapshot with redacted values; reverse-proxy config; `TRUSTED_PROXY_CIDRS` review | TLS terminates at known proxy; canonical client IP cannot be spoofed; Python AI is not publicly reachable | Direct AI service exposure; wildcard CORS with credentials; missing/incorrect trusted proxy CIDRs | Platform owner |
| **Safe user flows** | Timestamped smoke-test evidence using synthetic accounts/data | Core supported paths work, error safely, and reflect true status | Cross-account data, unexpected real-world side effect, broken sign-in, misleading success state | Product + QA owner |
| **AI integrity** | Provider/config check, injected adversarial test cases, unavailable-provider test, sampled output review | No fabricated fallback; source gaps are surfaced; provider failure is explicit and recoverable | Fabricated results, prompt-injection-induced behavior change, silent fallback, unsafe automation | AI owner |
| **Operational readiness** | Dashboards, alerts, runbook links, named on-call owner, rollback rehearsal | Errors, latency, auth failures, rate limits, and migration failures are observable; rollback works | No alert path; no rollback owner; no way to determine whether users are harmed | Engineering + platform |

A human may choose to defer a yellow/amber quality issue only if it is documented with an owner, deadline, user impact, and reason it cannot violate the safety principles above. A red gate cannot be deferred.

## 3. Pre-Deployment Entry Criteria

### 3.1 Freeze the candidate and prove what is being deployed

Create a release branch or annotated tag from one reviewed commit. Record its SHA, pull-request links, reviewers, dependency-lockfile checksum, database migration list, container/image digests, and feature-flag snapshot. The audit was run against baseline `b32840d` plus hardening changes; staging must be tested from a committed SHA that includes those changes, not from an uncommitted local state.

The change list must include the RLS hardening migration, self-hosted migration mirror/mount, RLS CI gate, canonical-client-IP rate-limit propagation, tests, TypeScript CI gate, Apply Agent production gate, and deployment-runbook update. Any unrelated uncommitted edit must either be committed and reviewed independently or excluded from the staging candidate.

### 3.2 Staging must not be disguised production

Use a separate database, a separate Supabase/Auth project or isolated self-hosted stack, separate Redis/Celery namespaces, separate object-storage bucket/prefix, separate Stripe test-mode keys, and separate LLM/provider keys or a hard spend/usage cap. Use synthetic candidate data by default. If production-like data is necessary, it must be minimized, anonymized, encrypted, access-controlled, and covered by written approval.

Do not point staging at production DNS, SMTP delivery, browser-automation credentials, OAuth callback origins, billing webhooks, or employer-facing integrations. Staging must have its own subdomain, TLS certificate, allowed origins, OAuth redirect URIs, and telemetry environment label.

### 3.3 Required configuration review

| Configuration area | Required staging value or proof | Reject if |
|---|---|---|
| `ENV` / environment label | Explicit `staging`; visible in logs and error tracking | It is blank, `development`, or indistinguishable from production |
| Database | Separate staging database, backup location, restore test plan | Production database is reused or migration target is ambiguous |
| `AI_INTERNAL_TOKEN` / `APPROVAL_SIGNING_KEY` | Fresh staging secrets; present on every required service | Missing, shared accidentally, logged, or frontend-exposed |
| `TRUSTED_PROXY_CIDRS` | Exact CIDRs for the staging edge proxy/load balancer | Empty, overly broad, or unverified |
| `CORS_ALLOWED_ORIGINS` | Only the staging HTTPS origin(s) | `*` with credentials, production origin added by default, HTTP public origin |
| AI provider | Explicit provider, model, timeout, quota, and failure behavior | Mock/fabricated mode, unbounded spend, or no error path |
| Sentry / telemetry | Staging environment set; scrubbers verified | Missing environment label, sensitive resume/JD content logged |
| Billing and communications | Test mode, sandbox recipients, no real customer charge/send capability | Live Stripe or live outbound email/WhatsApp without explicit test guard |

## 4. Deployment Sequence — No Reordering

### Step 0: Create a rollback point

Take a verified, timestamped database backup before any migration. For self-hosted Postgres, record the backup command, storage location, checksum, and restore owner. Do not accept “the platform probably backs it up” as evidence. Confirm the application artifact currently serving staging can be re-deployed, and preserve its image digest.

**Stop immediately** if the backup cannot be located, read, or restored to a disposable database.

### Step 1: Validate the candidate before changing staging

Run these checks against the exact release SHA and archive the outputs:

```bash
pnpm install --frozen-lockfile
pnpm test -- --run
pnpm exec tsc --noEmit
pnpm build
pnpm security:production

cd backend/go && go test ./... && go vet ./...
cd ../python && PYTHONPATH=. .venv/bin/pytest app/tests/test_exposure_gates.py -q
cd ../..

python3 scripts/verify_self_hosted_migrations.py
docker compose --profile prod config --quiet
```

The only acceptable outcome is zero failing commands. Existing lint warnings are not a red gate for this staging candidate, but the current count must be recorded and no new warnings may be introduced by the release.

### Step 2: Apply the database migration before exposing application traffic

For every **existing self-hosted** staging database, apply the authorization hardening migration using the table-owning role:

```bash
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres \
  < backend/db/migrations/20260824_02_public_data_access_hardening.sql

scripts/check_public_table_rls.sh
```

Then perform only non-destructive denial probes. Use the public anonymous key only as an unauthenticated client would, request at most one row, discard response bodies, and record only HTTP status codes:

```bash
# Expected: 401 or 403, never 200.
for table in api_keys applications saved_sources password_reset_tokens; do
  # Supply staging ANON_KEY through the deployment secret store; do not print it.
  curl -sS -o /dev/null -w "%{http_code}\n" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    "${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1"
done
```

**Stop immediately** if the RLS gate fails, any migration partially applies, any denial probe returns 200, or a table returns unexpected data. Revoke public traffic, restore/roll back only under the incident owner’s direction, and investigate before attempting the migration again.

### Step 3: Deploy services in dependency order

Deploy the database first; then Python AI; then Go gateway; then frontend. Do not update the frontend before the gateway and AI versions that enforce the same rate-limit and auth contract are healthy. Use immutable image digests or versioned artifacts. Verify the Python AI service is private/internal and accepts its internal token path as designed; verify the Go gateway is the intended public API boundary.

Keep production-only feature flags disabled in staging initially. Specifically confirm `applyAgent` remains false in production mode and that the user-facing Apply Agent page redirects to `/jobs` in the staging production-like build.

### Step 4: Health, readiness, and contract smoke tests

Run the following after each service becomes healthy, not only once at the end:

| Check | Pass condition | Red failure condition |
|---|---|---|
| Go health/readiness | 2xx health/ready response and dependency status is healthy | Any service dependency is degraded/unknown |
| Python health | 2xx health response and configured provider state is explicit | Mock/fabricated provider state, direct public access, or repeated 5xx |
| Authentication | Synthetic user sign-up/sign-in/sign-out and protected-route rejection | Token bypass, cross-user state, or an unclear auth failure |
| RLS | Gate passes and denial probes are denied | Any sensitive/user-owned table readable through anonymous PostgREST |
| Rate limit | Two clients with different trusted IPs do not share a Python limiter bucket | Shared 429 bucket, spoofable forwarded IP, missing `Retry-After` behavior |
| Public ATS scan | Valid synthetic scan returns a measurable result or an honest configured-provider failure | False success, unbounded response, data persistence without disclosure, or cross-user leakage |
| AI outage | Disable provider/revoke test key in a controlled test and receive explicit recoverable failure | Invented scan/optimization output, raw provider secrets, request hangs |
| Apply Agent | Production navigation omits it and direct route redirects to `/jobs` | Broken agent UI remains publicly accessible |
| Error reporting | A controlled synthetic error is tagged `staging` with sensitive fields scrubbed | Resume/JD/credential content appears in logs or no alert is emitted |

## 5. Staging Abuse and Failure Tests

Happy-path checks are insufficient. Complete the following tests using synthetic accounts, synthetic resumes, and approved test job descriptions.

| Test | Procedure | Expected safe behavior |
|---|---|---|
| Anonymous data access | Use only the staging anonymous key to call selected REST tables. | Denial response; no record body or metadata exposure. |
| Cross-account isolation | Create Candidate A and Candidate B. Attempt to read/update A’s applications, saved sources, resume analysis, and agent runs from B. | Empty/denied response; no update; no timing clue that leaks data existence. |
| Prompt injection | Insert hostile instructions in a synthetic resume/JD, such as instructions to reveal system prompts or ignore evidence. | Output treats content as data; no system data disclosure; task does not change. |
| Oversized input | Send maximum and over-maximum resume/JD payloads. | Bounded rejection; no 5xx; no memory/CPU exhaustion. |
| AI provider failure | Use a test invalid key or provider outage simulation. | Clear 503/controlled error; no fabricated result; no stuck run. |
| Rate fairness | Generate requests from two trusted client IPs and one malformed forwarded header. | Separate valid buckets; malformed header falls back; no spoofing bypass. |
| Duplicate/concurrent writes | Double-submit resume, application, and webhook-like actions. | Idempotent or clear conflict response; no duplicate billing/application state. |
| External side effects | Attempt browser automation, email, billing, or employer-submit paths. | Disabled, sandboxed, or requires explicit human action; never acts externally without approval. |

A failed abuse test is not merely a bug ticket. It is a launch blocker until the root cause, exploitability, fix, regression test, and retest evidence are recorded.

## 6. Observability, SLOs, and Staging Soak

Staging must run for at least **24 hours** after all initial smoke tests pass, with scheduled synthetic checks every 15 minutes. This is a minimum soak period for a candidate-facing AI product because auth, rate-limit, background work, provider quotas, and deployment configuration commonly fail after initial startup.

| Signal | Staging target | Immediate response threshold |
|---|---|---|
| Gateway/API 5xx rate | `< 0.5%` over 15 minutes for synthetic traffic | `>= 1%` or any security-path 5xx: freeze promotion and investigate |
| Public ATS p95 latency | `< 20 seconds` with configured provider | `> 30 seconds` twice consecutively or widespread timeouts |
| Unauthorized access controls | 100% denial for negative tests | Any unexpected 2xx on a protected table/route: remove public traffic and declare security incident |
| Background job failure | `< 1%` on synthetic jobs | Any data-loss, duplicate-action, or approval-bypass signal |
| Provider configuration | Explicitly configured; zero fabricated fallback events | Mock/fabricated response or unbounded cost event |
| Error reporting | Every synthetic fault visible within 5 minutes, scrubbed | Missing alert, wrong environment tag, or sensitive data exposure |
| Database migration health | Zero pending/failed migration anomalies | Mismatch between deployed schema and artifact expectations |

The on-call owner must inspect the dashboard at least at the beginning, midpoint, and end of the soak. Automated checks do not replace human review of unexpected log patterns, abnormal 429s, and candidate-visible errors.

## 7. Rollback and Kill-Switch Rules

Rollback must be rehearsed in staging before staging is declared ready. A rollback is not only a Git revert: it includes application artifacts, feature flags, external integration isolation, and the data migration decision.

| Incident | Immediate containment | Rollback decision |
|---|---|---|
| RLS bypass or unexpected 2xx data read | Remove public access to REST/API edge, rotate exposed keys if needed, preserve evidence, open security incident | Do not blindly reverse RLS. Restore service only after corrected least-privilege policy and negative retest. |
| AI fabricated output or prompt-injection success | Disable affected AI feature flag/provider route, retain request metadata without sensitive body logging | Redeploy validated prompt/guardrail fix and regression test. |
| Shared/incorrect rate limit | Throttle public scan route or temporarily disable it; preserve request IDs | Redeploy gateway/Python identity fix and re-run multi-client canary. |
| Broken feature UI or false success | Disable the feature flag/route immediately | Re-enable only after API contract, test, and honest empty/error states are validated. |
| Elevated 5xx/latency | Freeze promotion; scale/revert only after cause is known | Revert artifact if fault is release-specific; retain database migration unless it is proven causal and safely reversible. |
| Migration failure | Stop deploy; restrict traffic; restore only with named database owner approval | Use backup/restore plan; never hand-edit production rows under time pressure. |

## 8. Evidence Ledger Template

Complete this table before the staging go/no-go meeting. A blank cell is a failure, not a future task.

| Gate | Command or test ID | Executor | UTC timestamp | Artifact/log URL or file | Result | Approver | Notes / exception |
|---|---|---|---|---|---|---|---|
| Release SHA fixed |  |  |  |  | Pass / Fail |  |  |
| Frontend test + build |  |  |  |  | Pass / Fail |  |  |
| Go test + vet |  |  |  |  | Pass / Fail |  |  |
| Python exposure tests |  |  |  |  | Pass / Fail |  |  |
| Security gate |  |  |  |  | Pass / Fail |  |  |
| Backup verified |  |  |  |  | Pass / Fail |  |  |
| RLS migration applied |  |  |  |  | Pass / Fail |  |  |
| RLS release gate |  |  |  |  | Pass / Fail |  |  |
| Anonymous-denial probes |  |  |  |  | Pass / Fail |  |  |
| Two-client rate-limit canary |  |  |  |  | Pass / Fail |  |  |
| Cross-account isolation |  |  |  |  | Pass / Fail |  |  |
| AI outage / no-fabrication |  |  |  |  | Pass / Fail |  |  |
| Apply Agent production gate |  |  |  |  | Pass / Fail |  |  |
| Telemetry scrubbing + alert |  |  |  |  | Pass / Fail |  |  |
| 24-hour soak |  |  |  |  | Pass / Fail |  |  |
| Rollback rehearsal |  |  |  |  | Pass / Fail |  |  |

## 9. Final Staging Go/No-Go Decision

The decision meeting has only three valid outcomes:

| Outcome | Meaning | Required action |
|---|---|---|
| **GO — controlled staging** | Every red gate has concrete passing evidence and the soak/rollback criteria are complete. | Open staging to the planned internal/limited cohort only. Continue monitoring. |
| **NO-GO — remediate** | One or more red gates failed or evidence is missing. | Do not deploy or expand access. Create an incident/defect record with owner and retest plan. |
| **HOLD — evidence incomplete** | No known failure, but proof is missing or ambiguous. | Treat identically to no-go until evidence is produced. Do not allow optimism to substitute for evidence. |

The go/no-go approver should sign only this statement:

> “I have reviewed the evidence ledger for release SHA `________`. All red gates passed in the isolated staging environment. No unresolved test demonstrates cross-account access, secret exposure, fabricated AI output, unauthorized external action, or unobservable rollback risk. I authorize controlled staging access only.”

If that sentence cannot be signed sincerely, Tayari is not ready for staging.
