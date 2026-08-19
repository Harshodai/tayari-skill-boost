# JobTayari End-to-End Verification Report

**Date:** 2026-08-19
**Environment:** Ubuntu sandbox, Dockerized local Supabase, temporary CI-only credentials, no production provider credentials
**Repository:** `Harshodai/tayari-skill-boost`
**Purpose:** Determine whether the current platform is worth the hype by testing behavior rather than relying on source inspection or green unit tests alone.

## Executive verdict

> **Verdict: the platform is a strong, unusually well-hardened internal/staged product, but it is not yet a fully proven production platform.**

The core engineering claims are substantially credible. The Go gateway, Python worker/API, frontend, durable automation event path, approval surfaces, A2A safeguards, MCP governance, migration parity, and release contracts all passed their repository-level checks. The Docker-backed local Supabase run also demonstrated real database connectivity, Go readiness, Python readiness, Supabase auth, authenticated gateway requests, idempotent automation event ingestion, and truthful draft/run boundaries.

The test campaign also found material gaps that a purely internal test run would hide. The live Docker schema showed that `public.saved_jobs` has RLS disabled and no owner policy, and a two-user probe demonstrated that each authenticated user could see both users’ seeded saved-job rows. This is a **real tenant-isolation failure for that legacy table**, even though the newer automation tables passed the live owner/tenant isolation probe. The repository’s backup/restore smoke script also failed on a disposable target because its clean restore attempts to drop policies before their tables exist; broader restore attempts additionally hit Supabase-managed `vault` permissions, missing `pgvector`/`pg_trgm` extension prerequisites, and auth-schema dependencies. These failures prevent a 10/10 or “safe to launch without further work” conclusion.

## Verification summary

| Area | Result | Evidence |
|---|---|---|
| Go gateway tests | **PASS** | `go test ./...` completed successfully in the final matrix |
| Python tests | **PASS** | `864 passed, 4 skipped, 2 warnings` |
| Frontend tests | **PASS** | `43 test files, 151 tests passed` |
| Frontend production build | **PASS** | Vite build completed in 6.25 seconds after authoritative MCP fix |
| Frontend lint | **PASS** in the earlier full matrix | No blocking lint failure recorded |
| Production truth contract | **PASS** | All truthfulness assertions passed |
| AI-system inventory | **PASS** | Inventory contract passed |
| RLS static contract | **PASS** | Static required-table and policy contract passed |
| Self-hosted migration parity | **PASS** | 10 required mirrored migrations verified |
| MCP governance | **PASS after repair** | Source-of-truth and generated-bundle contract passed |
| Master release contract | **PASS** | 46 promotion checks passed, 0 failed; hostile route suite passed 4/4 |
| Docker engine | **PASS after installation** | Docker daemon and Compose became operational |
| Supabase `db` | **PASS** | Healthy; initialized schema loaded |
| Supabase `auth` | **PASS** | Healthy |
| Supabase `rest` and `kong` | **PASS** | Running and serving local requests |
| Python `/healthz` | **PASS** | HTTP 200 |
| Python `/readyz` without DB | **PASS fail-closed** | HTTP 503 `database_unavailable` |
| Python `/readyz` with Docker DB | **PASS** | HTTP 200 |
| Go `/healthz` with Docker DB | **PASS** | HTTP 200 |
| Go `/readyz` with Docker DB | **PASS** | HTTP 200 |
| Authenticated automation list | **PASS** | HTTP 200, empty tenant-scoped list |
| Authenticated approvals/preferences | **PASS** | HTTP 200, empty/explicit defaults |
| Draft automation creation | **PASS** | HTTP 201 with `approval_required: true`, `status: draft` |
| Draft run boundary | **PASS** | HTTP 409; inactive workflow could not run |
| Durable event ingestion | **PASS** | First event HTTP 202; duplicate HTTP 202 with `duplicate: true`; invalid type HTTP 400 |
| New automation-table tenant isolation | **PASS** | Each user saw only their own automation run and event |
| Legacy `saved_jobs` tenant isolation | **FAIL** | RLS disabled; each user saw both seeded rows |
| Repository backup/restore smoke | **FAIL** | Clean restore ordered policy drops before table creation |
| Full final matrix after source fix | **PARTIAL** | Go, Python, and frontend tests passed; build process was later SIGTERM/OOM-interrupted in the combined run, but the build had already passed separately after the source fix |

## What was tested in the Dockerized computer

The repository’s local Supabase stack was started from `supabase-local/docker-compose.yml` using temporary, non-production values and a separate Compose project. The minimal services were `db`, `auth`, `rest`, and `kong`. The database initialized the repository schema, including `automation_event_inbox`, `automation_runs`, migrations, and RLS policies. The temporary users and all probe rows were deleted at the end of the campaign; cleanup verified zero remaining probe users, events, and automation drafts.

The Go gateway was run against the Docker database with `USE_SUPABASE=true`, the local Supabase URL, and the local JWT secret. Its readiness probe returned HTTP 200. A real GoTrue access token was accepted by the gateway after the process was restarted cleanly with the correct Supabase configuration. The authenticated endpoints returned truthful empty states, draft creation returned an approval-required response, and an inactive draft could not be executed.

The durable event path behaved correctly through the live gateway. A supported `pipeline.sweep_due` event was accepted with HTTP 202. Replaying the same event ID returned HTTP 202 with `accepted: false` and `duplicate: true`. An unsupported event type returned HTTP 400. This confirms the live idempotency boundary, not merely a unit-test approximation.

## Critical failure found: legacy saved-job isolation

The live database query returned the following state for the legacy table:

| Table | RLS enabled | Force RLS | Authenticated SELECT grant | Owner policy |
|---|---:|---:|---:|---:|
| `automation_event_inbox` | Yes | Yes | Yes | Yes |
| `automation_runs` | Yes | Yes | Yes | Yes |
| `profiles` | Yes | No | Yes | Yes |
| `saved_jobs` | **No** | **No** | Yes | **No** |

Two temporary authenticated users were seeded with one saved job each. User one saw both rows, and user two also saw both rows. The probe rows were then removed. This is not an acceptable production result for a multi-tenant platform. The next remediation must add a forward migration enabling and forcing RLS on `saved_jobs`, revoke broad authenticated access as appropriate, and add an owner policy based on `auth.uid() = user_id`, followed by a repeat of this live two-user gateway/Data API probe.

This finding also demonstrates why repository-level static RLS contracts are insufficient by themselves: the live initialized schema exposed drift that the static gate did not catch for this legacy table.

## Critical failure found: backup/restore contract

The repository smoke script was run against the live local Supabase PostgreSQL source and a separate disposable database. It failed during `pg_restore --clean` because the dump attempts to drop a policy on `public.waitlist_leads` before that table exists in the empty target. Attempts to isolate the public schema exposed additional real restore prerequisites: `vault` permissions, the `vector` extension, the `pg_trgm` extension, and the `auth.users`/`auth.uid()` dependencies referenced by public constraints and policies.

The dry-run recovery contract correctly states that a plan is not evidence. However, the real restore drill remains incomplete until the backup script uses a supported target initialization strategy, explicitly handles Supabase-managed schemas and extensions, and verifies post-restore tenant-negative tests, deletion, audit reconciliation, rollback, RPO, and RTO.

## Important source-of-truth repair found during testing

The first MCP governance patch edited `supabase/functions/mcp/index.ts`, but the file is generated by the Vite MCP plugin from `src/lib/mcp/*`. Every frontend build could erase the generated-file-only patch. The end-to-end build exposed this drift. The governance helper was moved into the authoritative `_client.ts` source and applied to all five mutating source tools. The bundle was regenerated, the MCP contract passed, and the frontend build passed afterward.

This source-of-truth repair is currently uncommitted and must be committed before the repository is considered clean. It is a genuine production-hardening result of this end-to-end campaign.

## Environment-dependent items not proven

The sandbox did not provide live Firecrawl, Apify, Stripe, Gmail, Google Calendar, Google Drive, email, WhatsApp, or production Supabase credentials. Their provider adapters were not represented as successfully delivered merely because local routes or mocks exist. Browser takeover, CAPTCHA/MFA, external ATS submission, real WhatsApp templates/webhooks, external provider outage drills, and production backup/restore were not claimed as verified.

The Docker stack was stopped after evidence collection to reduce memory pressure. The Docker runtime had to be installed into the sandbox because it was not initially present. The combined final test command was SIGTERM/OOM-interrupted during a later frontend build after Go, Python, and frontend tests had already passed; a separate build immediately after the authoritative MCP fix completed successfully.

## Worth-the-hype assessment

JobTayari is **worth the hype as a serious governed automation platform candidate**. It is not merely a UI prototype: it has durable events, worker leases, approval boundaries, tenant-aware automation tables, real auth, release gates, provenance-aware provider architecture, and adversarial security testing. The live Docker run validated meaningful parts of that claim end to end.

It is **not yet worth claiming as production-complete** because the live legacy `saved_jobs` cross-user leak is a release-blocking security defect, and the backup/restore path is not operationally proven. The correct rating after this campaign is **strong staged/internal readiness with two release-blocking remediation tracks**, not 10/10 production readiness.

## Required next actions before launch

1. Ship and live-verify a forward RLS/grants migration for `saved_jobs` and audit every other legacy user-owned table through the Dockerized gateway.
2. Repair the backup/restore drill for empty disposable targets and Supabase-managed schemas, then execute real post-restore RLS-negative, delete, audit, rollback, RPO, and RTO assertions.
3. Commit and push the authoritative MCP source-of-truth repair; rerun the build and MCP governance contract from a clean checkout.
4. Repeat the Dockerized two-user probe after the RLS migration and add it to the release gate so future initialization drift cannot pass silently.
5. Perform authenticated staging provider evidence for Firecrawl, Apify, Stripe, Google Workspace, email, and WhatsApp before enabling any corresponding capability.
