# Tayari Skill Boost — Production-Readiness Audit and Hardening Report

**Audit date:** 24 August 2026  
**Audited baseline:** `b32840d` on `main`, plus the pre-existing working tree and the audit changes described below.  
**Assessment:** **Conditional release approval only after the database migration is applied to every existing environment and the release checklist passes.**

## Executive Summary

Tayari has meaningful production foundations: a React/TypeScript client, a Go gateway, a FastAPI AI service, a self-hosted Supabase option, route inventory tooling, unit and end-to-end suites, dependency/security checks, health probes, and a clear candidate-control design intent. The production bundle builds, strict TypeScript checking passes, the full Go suite and vet pass, focused Python security regression tests pass, and the repository’s source security gate reports no newly introduced findings.

However, the audit found a **confirmed critical authorization flaw** in the running self-hosted Supabase stack. Thirty-seven public tables had RLS disabled while retaining `anon` and/or `authenticated` privileges. Non-destructive anonymous PostgREST probes returned HTTP 200 for `api_keys`, `applications`, `saved_sources`, and `password_reset_tokens`; response bodies were deliberately discarded. This was a real cross-tenant confidentiality and integrity boundary failure, not a theoretical scanner warning. It has been remediated in the repository and in the local validation database. The same probes now return HTTP 401, and an explicit CI release gate prevents recurrence.

The product should not claim an unconditional production launch until deployed databases are migrated, backed up, and checked. In addition, the public Apply Agent was shown to depend on an incompatible legacy data contract: its frontend and edge function expect columns and tables absent from the canonical durable-agent schema. The audit therefore makes that surface **preview-only** and redirects the production route to supported job search, rather than presenting a workflow that can silently fail or misrepresent state.

## Audit Scope and Method

The review covered the public product flow, source architecture, route exposure, runtime health, unit/build checks, database authorization, AI integration boundaries, CI/CD, deployment material, accessibility automation, dependency posture, and competitive product patterns. The repository’s existing agent guidance and lessons were followed. No user content, credentials, or database-row bodies were exposed during the audit.

| Area | Evidence collected | Outcome |
|---|---|---|
| Product/runtime | Public `/free-scan` journey, health/readiness requests, composed local stack | Landing and form rendering worked; the scan submission exposed shared rate-limit collapse. |
| Frontend quality | Unit suite, `tsc --noEmit`, production build, lint inventory | Tests and typecheck passed; lint has **400 warnings** and needs a managed reduction plan. |
| Go/Python services | Full Go tests and vet; focused Python exposure-gate tests | Passed after the hardening changes. |
| Data security | Live Postgres catalog/grant queries; anonymous PostgREST HTTP status probes | Critical flaw confirmed, remediated, and re-probed. |
| CI/CD and operations | CI workflow review, Compose validation, migration-bundle integrity check | New blocking RLS gate added; existing-volume migration remains a release procedure. |
| Product-market fit | Official competitor pages plus a first-hand product demonstration | Organized workflow, capture, tailoring, review, and manual final submission are market table stakes. [1] [2] [3] [4] |

## Critical Findings and Disposition

| Priority | Finding | Evidence | Disposition | Release implication |
|---|---|---|---|---|
| **P0** | Public tables were directly exposed through self-hosted PostgREST without RLS. | 37 RLS-disabled public tables; anonymous HTTP 200 for sensitive/user-owned tables. | **Fixed in source and local validation DB.** | Every deployed existing DB must receive the migration before release. |
| **P1** | Anonymous ATS scanning collapsed all callers into the Go-container IP at Python, producing unfair 429s. | `/free-scan` failed with a rate-limit state; Go did not propagate canonical client identity. | **Fixed in source and covered by Go/Python regression tests.** | Rebuild/redeploy Go and Python services; execute live canary test. |
| **P1** | Apply Agent depends on a legacy, incompatible schema and edge-function contract. | UI expects `agent_runs.id`, job-title fields, `agent_run_steps`, and edge writes absent canonical fields. | **Production surface gated off; preview retained.** | Do not re-enable until a single gateway-backed contract is implemented end-to-end. |
| **P1** | Existing self-hosted volumes do not automatically replay new mounted initialization SQL. | Compose initialization is volume-creation-only; the vulnerable local DB reflected an existing volume. | **Documented mandatory migration procedure and gate.** | Add a real versioned migration runner before an unattended production rollout. |
| **P2** | PR CI built the frontend but did not run strict TypeScript checking there. | `tsc --noEmit` existed elsewhere but was absent from frontend PR job. | **Fixed.** | Type errors now block the main CI frontend job. |
| **P2** | Frontend lint debt remains high. | `pnpm lint`: 400 warnings, no errors; concentration in API/data modules and agent dashboards. | Open. | Establish an enforced warning budget and reduce by ownership area. |
| **P2** | Automated accessibility coverage is contract-level, not full-page audit-level. | ARIA-oriented tests exist; no axe/Pa11y/Lighthouse gate found. | Open. | Add automated axe checks for public, auth, resume, job, and pricing routes. |
| **P2** | One low-severity production dependency advisory remains. | `esbuild 0.27.7` through `@lovable.dev/mcp-js`; Windows dev-server arbitrary-file-read advisory. | Open. | Upgrade to patched `esbuild >=0.28.1` after compatibility verification. |

## Implemented Production Hardening

### 1. Self-hosted database authorization boundary

A new canonical migration, `backend/db/migrations/20260824_02_public_data_access_hardening.sql`, now makes the PostgREST boundary fail closed. It enables RLS on all public tables found without it, removes browser-role grants by default, provides narrowly scoped authenticated owner-read policies where browser access is required, preserves owner-controlled notification subscription writes, protects tenant relationships through membership policies, permits public reads only for published blog content, and leaves sensitive/operational tables without browser policies or grants.

The migration is mirrored to `supabase-local/volumes/db/init/51-20260824_public_data_access_hardening.sql`, mounted explicitly in the self-hosted Compose configuration, and byte-checked by `scripts/verify_self_hosted_migrations.py`. A new `scripts/check_public_table_rls.sh` gate checks for any public table without RLS, direct browser-role grants on critical sensitive tables, and required authenticated owner policies. This gate is now a blocking step in the full-stack GitHub Actions job.

> **Observed before remediation:** anonymous PostgREST probes returned HTTP 200 for `api_keys`, `applications`, `saved_sources`, and `password_reset_tokens`.
>
> **Observed after remediation:** the exact non-destructive probes returned HTTP 401; the database catalog reported zero public ordinary tables without RLS.

The local validation database received the migration using the actual table-owning role, `supabase_admin`. `DEPLOYMENT.md` now states that this migration must be explicitly applied to every existing self-hosted volume after a verified backup; mounting initialization SQL only protects newly created volumes.

### 2. Fair client-scoped ATS rate limits

The production Python service sees the Go gateway/container as its TCP peer. Its anonymous rate-limit key therefore previously grouped all public users into a single bucket. The Go gateway now resolves the client address through its existing trusted-proxy resolver and forwards the canonical value in `X-Tayari-Client-IP` to Python. Python validates the forwarded value as an IP before using it; malformed or absent values fall back to the TCP peer. In production, the Python internal-token boundary prevents arbitrary internet callers from supplying this internal header.

Regression coverage verifies both sides: a Go test proves public analyze requests forward the canonical client IP upstream; Python tests prove different forwarded client addresses produce different anonymous rate-limit keys and malformed header values safely fall back. The focused Go and Python suites pass.

### 3. Truthful production surface for the Apply Agent

The audit found that the production Apply Agent page and its Supabase edge function do not match the canonical durable-agent schema. The canonical `agent_runs` relation uses `run_id`, `run_type`, `config`, `result`, and durable task/event structures; it does not have the UI’s expected `id`, `job_title`, `company`, `job_url`, `outcome`, `submitted_at`, or `agent_run_steps` contract. Exposing it as a supported production journey would conflict with the product’s own truthful-UI standard.

A dedicated `applyAgent` feature flag now leaves the workflow preview-only. Production navigation no longer advertises it and `/apply-agent` redirects to `/jobs`. This is intentionally conservative: the product continues to offer supported job search rather than expose an unreliable automation path. Re-enable only after replacing the direct browser/edge-function persistence path with a tested Go gateway contract and a single schema.

### 4. Release-gate and documentation improvements

The primary frontend CI job now runs `pnpm exec tsc --noEmit` before the production build. The full-stack CI job now runs the new database RLS/grant gate after the stack becomes healthy. Deployment documentation includes the live-database migration procedure and makes the difference between fresh-volume initialization and production upgrades explicit.

## Verification Performed

| Validation | Result |
|---|---|
| `python3 scripts/verify_self_hosted_migrations.py` | Passed; 15 required mirrors verified. |
| `scripts/check_public_table_rls.sh` | Passed after migration application. |
| Anonymous PostgREST probes for four previously exposed tables | All returned HTTP 401 after hardening. |
| `go test ./...` and `go vet ./...` | Passed. |
| Python `app/tests/test_exposure_gates.py` | Passed: 15 tests. |
| `pnpm exec tsc --noEmit` | Passed. |
| Full frontend unit suite and `pnpm build` | Passed. |
| `pnpm security:production` | Passed with no new security findings. |
| `git diff --check` | Passed. |

A Docker rebuild of `go-backend`, `python-ai`, and `frontend` was attempted to execute a final live rate-limit canary. The host Docker command stalled without useful output and was stopped after bounded waits. This does not invalidate the source-level Go/Python forwarding tests, but it remains a **must-complete release check** on the target deployment environment.

## Product Direction: What to Build, What Not to Copy

The competitive research shows that the baseline job-search product is a connected workflow rather than an isolated AI writer. Simplify advertises form autofill across employer sites and tracker saving; Teal combines job capture, tailoring, tracking, and recommendations; Huntr combines Kanban, activity timelines, contacts, documents, interviews, metrics, and browser capture. [1] [2] [3] In a Simplify product demonstration, the extension starts only after an explicit user trigger, leaves final submission to the candidate, and pauses around custom/voluntary self-identification fields. [4]

> “Our extension automatically fills in your job applications.” — Simplify product demonstration, analyzed as a claim, not independently verified. [4]

Tayari should not compete on indiscriminate mass application. It should differentiate on **candidate control, evidence-backed claims, and visible accountability**. Every generated resume assertion or screening answer should be traceable to an approved source artifact; uncertain claims should appear as open questions rather than hallucinated content; sensitive answers should have per-field approval; and every preparation/fill action should result in a candidate-visible receipt. That position is both more defensible and more consistent with the current project language than opaque “one-click apply” automation.

| Product decision | Recommended direction | Rationale |
|---|---|---|
| Application automation | Prepare, prefill low-risk facts, and require manual final submission. | Preserves user agency and reduces erroneous or unauthorized submissions. |
| AI claims | Require source mapping and an “unsupported / needs your input” state. | Improves truthfulness and makes review fast. |
| Job record | One canonical opportunity record containing job source, contacts, materials, timeline, and status. | Matches the core workflow buyers already expect. [2] [3] |
| Sensitive data | Default voluntary self-ID, work authorization, salary, and legal questions to explicit review. | High consequence and poor fit for automatic inference. |
| Metrics | Show funnel quality, response rate, stage aging, and follow-up queue—not vanity application volume. | Encourages thoughtful job search execution instead of mass submission. |

## Required Release Checklist

1. **Take and verify a recoverable backup** for every production self-hosted database.
2. **Apply `20260824_02_public_data_access_hardening.sql` as `supabase_admin`** to every existing self-hosted database; do not assume mounted init SQL will run on an existing volume.
3. **Run `scripts/check_public_table_rls.sh`** in each environment and treat any failure as a release blocker.
4. **Deploy/rebuild Go and Python together**, with `TRUSTED_PROXY_CIDRS` set for the real edge/reverse-proxy network.
5. **Run a live two-client ATS canary**: two distinct client IPs must not consume one shared Python limiter bucket; malformed/untrusted forwarded values must fall back safely.
6. **Confirm direct anonymous PostgREST requests receive denial responses** for `api_keys`, `password_reset_tokens`, `applications`, and `saved_sources`; do not retrieve or log row bodies.
7. **Verify the production `/apply-agent` redirect and absence from navigation** until the schema/API consolidation project is complete.
8. **Resolve or formally accept the remaining low-severity esbuild advisory**, then record the dependency version and verification result.

## Prioritized Follow-Up Roadmap

### Next 72 hours

Complete the release checklist in a production-like environment, especially the live migration and post-deploy two-client rate-limit canary. Add a deployment migration runner with a schema-version ledger; a manually documented SQL command is safer than the old state but not sufficient for repeatable unattended releases. Establish an incident playbook for RLS failures, including detection, rollback criteria, and customer communication review.

### Next two weeks

Reduce lint warnings by ownership domain, beginning with `src/api/dashboard.ts`, the agent consoles, job search, interview surfaces, and API type modules. Add browser-level axe checks for public landing, authentication, resume upload, free scan, jobs, pricing, and account pages. Upgrade the transitive esbuild advisory after test verification. Consolidate the public endpoint surface: the route inventory found hundreds of exposed routes, which makes a narrow release boundary harder to defend and document.

### Next 30–60 days

Replace the Apply Agent’s legacy Supabase-edge-function path with a single Go gateway API contract backed by durable runs, typed task events, explicit approvals, and a source/evidence ledger. Add evaluation datasets and release thresholds for claim fidelity, schema validity, prompt injection resistance, latency, provider outage behavior, and cost. Introduce a product information architecture that emphasizes the narrow, verified workflows and de-emphasizes experimental consoles until each has operational evidence.

## Files Changed by This Audit

The audit deliberately did not alter unrelated user working-tree changes. The production-hardening changes are limited to the following areas: database migration and self-hosted mirror/mount; RLS CI gate and migration verifier; Go/Python rate-limit identity propagation and regression tests; production feature gating for Apply Agent; frontend TypeScript CI; deployment runbook; and audit evidence/report files.

## References

[1]: [Simplify Copilot — official product page](https://simplify.jobs/copilot)

[2]: [Teal — official product page](https://www.tealhq.com/)

[3]: [Huntr Job Application Tracker — official product page](https://huntr.co/product/job-tracker)

[4]: [Simplify Copilot product demonstration on YouTube](https://www.youtube.com/watch?v=eoKXmdF57Os)
