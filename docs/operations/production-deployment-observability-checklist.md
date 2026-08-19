# JobTayari Production Deployment and Observability Checklist

**Document status:** Release-operations baseline
**Repository baseline:** `main` at `170f27a` when this checklist was prepared
**Audience:** Engineering, platform, security, data, support, and incident commanders
**Purpose:** Define the evidence required to deploy JobTayari safely and operate it with measurable reliability, tenant isolation, privacy, and recovery controls.

> **Release principle:** A green build is not a production launch. JobTayari may be promoted only when the code, database, provider, worker, privacy, observability, and recovery gates have evidence attached to the exact immutable release identifier.

## 1. Launch decision and evidence standard

Every checklist item must be recorded as `PASS`, `FAIL`, `BLOCKED`, or `NOT APPLICABLE`. `BLOCKED` is not equivalent to `PASS`. A production approval must identify the release SHA, image digests, migration set, operator, timestamp, environment, and links to the evidence artifacts.

| Launch mode | Permitted scope | Required evidence | Stop-ship conditions |
|---|---|---|---|
| Internal development | Local or disposable environments | Unit tests and basic smoke checks | No production credentials or real candidate data |
| Controlled beta | Invited tenants, candidate-controlled actions, providers disabled or explicitly allowlisted | Full local suites, staging isolation, recovery proof, protected observability, support owner | Any unverified tenant isolation, unsafe external write, missing rollback, or unbounded provider |
| Public production | Real tenants and production providers | All mandatory gates below plus live provider, staging hostile, worker restart, backup restore, rollback, and monitoring evidence | Any mandatory item marked `FAIL` or `BLOCKED` |

### Mandatory launch blockers

The following are non-negotiable for public production:

- `scripts/release_contract_test.sh` passes with 46/46 checks, including the security scanner, release asset checks, health/readiness checks, RLS checks, and observability contract.
- The exact release SHA is built into immutable image tags or digests; mutable tags such as `latest` are not accepted.
- `DATABASE_URL`, `JWT_SECRET`, Supabase URL, publishable key, service-role key, allowed origins, frontend URL, LLM configuration, and approval-signing configuration are environment-specific and fail closed when absent.
- A migration dry run and a forward-only production migration review are complete. RLS is enabled and ownership policies are verified for every public tenant-owned table, including `saved_jobs` and `external_research_runs`.
- Two-tenant staging tests prove that reads, writes, run control, approvals, artifacts, provider jobs, Gmail/Google records, and deletion paths cannot cross tenant or user ownership boundaries.
- At least one worker kill/restart test proves lease expiry, reclaim, idempotency, heartbeat behavior, and no duplicate external side effect.
- A backup is restored into a distinct throwaway database and key-table integrity is checked. A rollback rehearsal proves that unapproved rollback is refused and an approved rollback is executable.
- Live provider verification is run for every enabled provider. Disabled providers must remain blocked and must not report a false green status.
- Protected metrics, logs, traces, alert routing, on-call ownership, dashboards, and incident runbooks are live before traffic is admitted.
- External submission remains disabled unless exact candidate approval, artifact, job, portal, expiry, and server signature checks are all enabled and independently evidenced.

## 2. Repository and release integrity

### Before creating a release candidate

- [ ] Confirm the working tree is clean: `git status --short`.
- [ ] Confirm the branch and release SHA: `git rev-parse HEAD`.
- [ ] Confirm the proposed SHA is the intended `origin/main` commit.
- [ ] Review all changed files, migration order, generated bundles, and deployment manifests.
- [ ] Confirm no secrets, credentials, password-shaped examples, local cookies, dumps, or personal data are present in the diff.
- [ ] Confirm no workflow-file change is being pushed without the required GitHub permission and review.
- [ ] Record the release SHA in the deployment ticket and evidence bundle.

### Required automated checks

```bash
cd /home/ubuntu/tayari-skill-boost

git status --short
git diff --check

cd backend/go
go test ./...

cd ../python
JWT_SECRET=ci-test-jwt-secret-not-production PYTHONPATH=. pytest -q

cd ../..
pnpm test -- --run
pnpm build

python3 scripts/verify_rls_contract.py
python3 scripts/verify_external_provider_config.py
python3 scripts/verify_observability_contract.py
bash scripts/staging_recovery_contract_test.sh
bash scripts/release_contract_test.sh
```

The release record must capture command, exit status, duration, test count, skipped count, and log location. Warnings may be accepted only when documented; a test warning must never be silently converted into a passing production gate.

### Build and supply-chain controls

- [ ] Build frontend, Go, Python API, worker, and proxy images from the exact release SHA.
- [ ] Use `pnpm` for frontend validation; do not introduce Bun-only commands or lockfiles into the release path.
- [ ] Set a unique immutable `IMAGE_TAG`, preferably the 40-character commit SHA.
- [ ] Record every image digest after build and after registry push.
- [ ] Scan dependencies and container images for critical or high vulnerabilities; document accepted exceptions with expiry and owner.
- [ ] Generate SBOMs and retain them with the release evidence.
- [ ] Verify the frontend contains no loopback URLs, development endpoints, demo fixtures, or disabled feature claims.
- [ ] Verify generated Supabase MCP output is derived from the authoritative `src/lib/mcp` source and that write governance survives a frontend build.
- [ ] Verify container images run as the intended non-root user where supported and expose only required ports.

## 3. Environment and secret management

### Required configuration review

The deployment operator must compare the environment manifest against the target environment without printing secret values. Presence, format, ownership, rotation date, and source are recorded; secret contents are never copied into tickets or logs.

| Area | Required controls |
|---|---|
| Database and auth | `DATABASE_URL`, `JWT_SECRET`, Supabase URL, publishable/anon key, and service-role key point to the same environment. JWT signing secrets match the actual GoTrue/Supabase instance. |
| Application routing | `AI_SERVICE_URL`, `APP_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, service ports, and reverse-proxy routes are environment-specific. No localhost values are accepted in production. |
| LLM | `LLM_PROVIDER`, approved model, endpoint, and provider key are present only when AI features are enabled. Unapproved providers fail closed. |
| Approvals | `APPROVAL_SIGNING_KEY` or the approved internal signing mechanism is present, rotated, and inaccessible to frontend code. |
| Billing | Stripe secret and webhook signing secret are present only when billing is enabled; webhook events are idempotent and signature-verified. |
| Providers | Firecrawl and Apify credentials, Actor allowlist, capability flags, timeouts, budgets, and endpoint policy are explicitly configured. Missing credentials produce `blocked` or `ProviderNotConfigured`, never an empty success. |
| Google | OAuth client, redirect URI, scopes, Pub/Sub verification token, token encryption, and tenant mapping are reviewed. Gmail sync remains bounded by candidate-selected query/date scope. |
| Notifications | SMTP, WhatsApp, or other delivery providers are configured and verified before approval notifications are enabled. A missing delivery provider must not present a delivered status. |
| Observability | `SENTRY_DSN`, protected metrics token, log sink, trace exporter, alert receiver, and paging integration are present and tested. |
| Operations | Redis URL, Celery result/broker settings, lease durations, backup storage, image registry, and deployment credentials are available to the intended operator only. |

### Secret controls

- [ ] Store secrets in a managed secret system, not in Git, Docker images, frontend bundles, task payloads, or ordinary logs.
- [ ] Use separate credentials for development, staging, and production.
- [ ] Rotate credentials before the first public tenant and after any suspected exposure.
- [ ] Verify service-role and provider tokens are never accepted from candidate-controlled request bodies.
- [ ] Test missing, malformed, expired, and wrong-environment credentials in staging; every case must fail closed with a bounded error.
- [ ] Verify redaction for authorization headers, OAuth tokens, cookies, email bodies, resume text, provider payloads, and webhook signatures.

## 4. Database, schema, RLS, and migrations

### Migration preparation

- [ ] Generate an ordered migration manifest from `backend/db/migrations/`.
- [ ] Confirm every migration has been reviewed for lock duration, transaction behavior, indexes, backfill cost, and rollback implications.
- [ ] Confirm the self-hosted mirror under `supabase-local/volumes/db/init/` includes the same required schema contract.
- [ ] Run migrations against a disposable copy of the target schema before staging.
- [ ] Verify extensions required by the application, including pgvector and pg_trgm where used.
- [ ] Confirm migration ownership and database role privileges; do not run a migration under an accidental application role.
- [ ] Capture pre-migration and post-migration schema fingerprints.

### RLS and tenant isolation

- [ ] Run `python3 scripts/verify_rls_contract.py`.
- [ ] Verify RLS and FORCE RLS for public tenant-owned tables.
- [ ] Verify authenticated owner predicates for profiles, resumes, resume analyses, saved jobs, applications, artifacts, approvals, provider runs, automation runs, and notification records.
- [ ] Verify server-only tables such as Gmail tokens, Google tokens/events, OAuth state, Stripe webhook events, computer grants, and AI model/application configuration reject public-role access.
- [ ] Run a two-user negative matrix through the real API/Data API path: read, insert, update, delete, status lookup, cancellation, approval, artifact access, export, and deletion.
- [ ] Verify an unavailable durable store fails closed rather than falling back to another tenant’s memory or a guessed owner.
- [ ] Confirm every new table has a migration, RLS policy, verifier assertion, and at least one negative test.

### Migration execution

1. Announce a migration window and freeze unrelated schema changes.
2. Take and verify a backup before applying the migration.
3. Run the migration with statement and lock timeouts appropriate to the database.
4. Monitor connection saturation, lock waits, replication/WAL, API error rates, and queue age.
5. Validate table existence, indexes, policies, grants, triggers, and representative queries.
6. Run a read/write smoke test with two disposable users.
7. Keep the previous application version compatible until migration validation completes.
8. Record migration start/end time, operator, schema fingerprint, and validation results.

## 5. Deployment topology and runtime controls

### Services

| Service | Responsibility | Production controls |
|---|---|---|
| Frontend | Candidate-facing React application | CDN/HTTPS, immutable asset release, CSP, no secret exposure, `/healthz` static probe, error tracking, source maps controlled |
| Go gateway | Auth, tenant routing, OAuth, integrations, API gateway, billing, metrics | `/healthz` and `/readyz`, database readiness, auth middleware, request IDs, rate limits, protected `/metrics`, graceful shutdown |
| Python API | AI, provider adapters, provenance, run-control, browser and automation APIs | `/healthz` and `/readyz`, fail-closed provider gates, bounded request bodies, timeouts, structured errors, database/LLM readiness |
| Celery worker | Apify/Firecrawl lifecycle, automation, AgentSpace, scheduled jobs | Separate worker deployment, queue isolation, leases, heartbeats, retry budgets, graceful termination, no public ingress |
| Redis | Celery broker/result and transient coordination | Private network, authentication/TLS where supported, persistence policy, memory limits, eviction policy, queue-age monitoring |
| Supabase/Postgres | Auth, database, storage, realtime, PostgREST | Managed backups/PITR or off-host backups, RLS, extensions, connection pool limits, audit logging, restricted service roles |
| Reverse proxy | TLS, routing, headers, rate limits | HSTS, secure cookies, request-size limits, upstream timeouts, access-log redaction, health routing |

### Health and readiness

- [ ] `/healthz` means process liveness only and does not claim dependencies are healthy.
- [ ] `/readyz` fails when required database, LLM, queue, or configuration dependencies are unavailable.
- [ ] Container health checks use `/readyz` for dependency-aware admission and `/healthz` for liveness.
- [ ] The load balancer removes instances that fail readiness and does not restart-loop on a dependency outage.
- [ ] Startup and graceful shutdown timeouts are long enough for in-flight persistence but short enough to avoid stuck deploys.
- [ ] A readiness failure is observable and routed to the owning team.

### Deployment sequence

1. Confirm change approval, release SHA, image digests, migration manifest, backup status, and on-call coverage.
2. Deploy database migrations using the migration procedure above.
3. Deploy backward-compatible Go and Python services.
4. Deploy the worker with the new task registry and queue configuration.
5. Deploy frontend assets and invalidate only the intended CDN paths.
6. Verify health, readiness, authenticated login, tenant context, representative candidate journey, and protected metrics.
7. Enable provider capabilities gradually, beginning with read-only or dry-run modes.
8. Admit a small canary tenant cohort and observe error rate, latency, queue age, provider outcomes, and approval delivery.
9. Expand traffic only after the canary window completes without a stop-ship alert.

## 6. Provider and connector launch gates

### Firecrawl and Apify

- [ ] Run `python3 scripts/verify_external_provider_config.py`.
- [ ] Verify approved endpoint and URL policy, timeouts, retries, `Retry-After` handling, response-size limits, and private URL removal.
- [ ] Firecrawl: verify search, crawl, batch-scrape, status polling, pagination, normalization, webhook signature plan, and job cancellation behavior.
- [ ] Apify: verify Actor allowlist, run creation, remote run ID persistence, terminal polling, dataset item pagination, normalization, remote abort, and durable job reclaim.
- [ ] Verify provenance artifacts are created for successful and failed research outcomes without storing provider secrets.
- [ ] Verify provider cost and quota budgets; budget exhaustion must block rather than silently downgrade to unbounded calls.
- [ ] Run the live read-only provider verifier with `--require-providers firecrawl,apify` in staging before enabling the capability flags.

### Google, Gmail, and notifications

- [ ] Complete OAuth redirect, state nonce, token refresh, tenant mapping, disconnect, and deletion tests.
- [ ] Verify Gmail sync uses the candidate-selected bounded query/date window; reject `in:anywhere`, unbounded history, and excessive result counts.
- [ ] Verify Gmail/Pub/Sub webhook authentication, duplicate delivery handling, history cursor behavior, and no-address refusal.
- [ ] Verify imported applications carry provenance and cannot be mistaken for candidate-submitted actions.
- [ ] Verify Calendar and Drive scopes are read-only or prepare-only until separate approval evidence exists.
- [ ] Verify email/WhatsApp approval delivery reports `sent`, `failed`, and `blocked` accurately and supports retry without duplicate messaging.

### Stripe and billing

- [ ] Verify webhook signatures, idempotency keys, event replay handling, subscription state transitions, and tenant ownership.
- [ ] Run staging-only test events; never use production payment instruments in development or test.
- [ ] Confirm billing-disabled mode does not expose paid capability claims.

## 7. Security, privacy, and external action controls

- [ ] Verify authentication rejects invalid, expired, wrong-issuer, wrong-audience, and wrong-tenant tokens.
- [ ] Verify CSRF/state protection for OAuth and destructive actions.
- [ ] Verify SSRF protections for every URL fetch, including redirects, DNS rebinding defense, private IP ranges, link-local addresses, metadata endpoints, and non-HTTP schemes.
- [ ] Run prompt-injection hostile tests against resumes, job pages, email, provider results, browser pages, and external instructions.
- [ ] Ensure untrusted provider/page/email content is data only and cannot redefine tools, approval boundaries, system policy, or destination URLs.
- [ ] Verify candidate approval is bound to exact job URL, resume artifact, cover letter, form fields, user, run, expiry, policy version, and server signature.
- [ ] Verify approval is single-use or idempotently consumed and cannot be replayed after expiry or content mutation.
- [ ] Keep autonomous ATS submission disabled until live browser, portal, receipt, cancellation, and audit evidence is complete.
- [ ] Verify desktop/browser grants are short-lived, origin-bound, tenant-bound, and revokeable.
- [ ] Verify account export and deletion, including the documented behavior that backups/PITR may retain deleted data for their retention window.
- [ ] Verify privacy audit logs are append-only, access-controlled, redacted, and never contain raw tokens or unnecessary resume/email content.

## 8. Worker, queue, and automation reliability

- [ ] Separate queues by risk and workload: provider research, browser/external actions, AI inference, notifications, and scheduled maintenance.
- [ ] Configure task time limits, soft shutdown, retry limits, exponential backoff, and dead-letter or failed-task review.
- [ ] Verify every durable run has owner, tenant, status, idempotency key, lease owner, lease expiry, heartbeat, reclaim count, and last error.
- [ ] Verify a worker can be killed during provider polling, database persistence, and external action preparation without duplicate side effects.
- [ ] Restart a worker and prove expired leases are reclaimed exactly once.
- [ ] Verify cancellation sets durable intent, invokes remote provider abort where applicable, acknowledges cancellation, and does not claim success when the remote abort failed.
- [ ] Verify scheduled automation cannot carry application-submission consent and that all risky actions pause for candidate approval.
- [ ] Monitor queue age, task failure rate, retry volume, lease-expiry/reclaim rate, task duration, and dead-letter count.
- [ ] Ensure task payloads contain identifiers and references rather than raw secrets, full mailbox contents, or unnecessary resumes.

## 9. Observability implementation checklist

### Protected telemetry endpoints

- [ ] Go and Python services expose `/metrics` only through an internal/protected route.
- [ ] Metrics access requires `X-Internal-Token` or the approved equivalent; tokens are never logged.
- [ ] `scripts/verify_observability_contract.py` passes.
- [ ] The scraper stores endpoint, authentication, scrape result, and schema version without storing the token.
- [ ] Metric names and labels are versioned; tenant/user IDs are not high-cardinality labels.

### Required telemetry fields

Every request, task, provider job, approval, automation event, and external action should include, where applicable:

| Field | Rule |
|---|---|
| `timestamp` | UTC, synchronized clocks |
| `environment` | `staging` or `production`, never inferred from a user payload |
| `release_sha` | Immutable application version |
| `service` | Go, Python, worker, frontend, proxy, or database |
| `trace_id` / `request_id` | Propagated across gateway, Python, worker, and provider calls |
| `tenant_id` | Redacted or hashed in shared telemetry; never exposed to unauthorized viewers |
| `user_id` | Avoid in metrics; restricted in audit logs |
| `run_id` / `task_id` | Stable correlation identifier |
| `provider` | Firecrawl, Apify, Gmail, Stripe, Google, or internal |
| `outcome` | success, blocked, failed, cancelled, timed_out, retried |
| `failure_code` | Stable bounded taxonomy, not raw exception text |
| `duration_ms` | Measured at the relevant boundary |
| `policy_version` | Required for approvals, provenance, and external action decisions |

### Minimum metrics

- HTTP request count, error count, latency histogram, timeout count, rate-limit count, and readiness state by service and route class.
- `queue_age_seconds`, queue depth, task failures, task retries, task duration, lease expiry, reclaim count, heartbeat failures, and cancellation outcomes.
- Provider request count, latency, 429/5xx count, timeout count, blocked count, budget rejection count, run terminal status, dataset item count, and truncation count.
- Approval requested, delivered, viewed, approved, denied, expired, replay-rejected, and action-executed counts.
- RLS/authorization denial count, SSRF rejection count, prompt-injection rejection count, token-refresh failure count, and account-deletion outcome.
- Database connection-pool saturation, query latency, lock waits, deadlocks, replication/WAL health, backup age, restore drill age, and storage pressure.
- Frontend JavaScript errors, route load failures, API error rate, web-vitals baseline, and release asset mismatch.

## 10. SLOs and alerting

The repository currently versions these baseline alerts in [`infra/observability/alerts.yml`](../../infra/observability/alerts.yml): queue age above 300 seconds for five minutes, provider/LLM errors above five increases in five minutes, budget rejections above ten in five minutes, and task failures above three in five minutes. Production should add the following service objectives and alert policy around that baseline.

| Objective | Suggested target | Page/ticket behavior |
|---|---:|---|
| API availability for authenticated candidate reads/writes | 99.9% monthly | Page on sustained 5xx or readiness loss; ticket for burn-rate warning |
| Readiness recovery after deploy | < 5 minutes | Page if a canary never becomes ready |
| Candidate API latency | p95 < 800 ms excluding long-running jobs | Ticket on sustained breach; page on severe saturation |
| Provider research completion | p95 within provider-specific budget | Ticket for degradation; block provider on repeated unsafe failures |
| Queue age | < 300 seconds for normal work | Page using existing `TayariQueueAgeHigh` |
| Worker task failure rate | < 1% excluding explicit blocked outcomes | Page using existing `TayariTaskFailures` when sustained |
| Approval notification delivery | 99% accepted by configured provider | Page if approvals are pending without delivery or status is misleading |
| Backup freshness | within declared RPO | Page when backup age exceeds RPO |
| Restore drill freshness | quarterly maximum | Ticket before expiry; launch blocker when overdue for public production |
| Tenant isolation | zero confirmed cross-tenant events | Immediate security incident and automatic capability freeze |

Alerts must have an owner, severity, runbook URL, deduplication key, escalation policy, maintenance suppression procedure, and evidence that the receiver actually paged or ticketed the intended channel.

## 11. Logs, traces, dashboards, and privacy

### Logging rules

- [ ] Emit structured JSON logs with stable event names and severity.
- [ ] Redact authorization headers, cookies, OAuth codes, access/refresh tokens, provider keys, webhook signatures, raw resumes, email bodies, form fields, and full job descriptions unless explicitly required for a restricted audit record.
- [ ] Do not log full URLs when query strings may contain tokens or personal data.
- [ ] Keep error messages bounded and map raw exceptions to stable failure codes.
- [ ] Attach trace/request/run IDs so an incident can be reconstructed without searching by email address or token.
- [ ] Set retention by data class: operational logs, security audit events, provider evidence, and compliance records should not share an unbounded retention policy.

### Required dashboards

1. **Release health:** version, readiness, request rate, error rate, latency, active instances, and deploy annotations.
2. **Worker health:** queue depth/age, running tasks, retry rate, leases, reclaims, cancellations, dead letters, and worker heartbeat.
3. **Provider health:** Firecrawl/Apify request volume, status, latency, 429/5xx, blocked, budget, terminal run state, and result counts.
4. **Tenant safety:** authorization denials, RLS failures, SSRF blocks, prompt-injection blocks, approval replay rejections, and deletion outcomes.
5. **Data protection:** backup age, WAL/archive status, restore-drill date, storage capacity, replication lag, and migration status.
6. **Frontend experience:** JavaScript errors, route failures, API latency, authentication failures, and canary cohort health.

## 12. Incident response

### Severity model

| Severity | Example | Initial response | Required action |
|---|---|---:|---|
| SEV-0 | Confirmed cross-tenant access, unauthorized submission, leaked secret, destructive data event | Immediate | Disable affected capability, revoke credentials, preserve evidence, engage security and incident commander |
| SEV-1 | Production-wide outage, database corruption, queue stuck, provider causing unsafe behavior | 15 minutes | Freeze deploys, page on-call, fail closed, restore or rollback decision |
| SEV-2 | Material degradation, repeated provider failures, notification backlog, single-region issue | 30 minutes | Assign owner, mitigate, ticket follow-up, monitor recovery |
| SEV-3 | Localized defect, non-critical dashboard or documentation issue | Business hours | Fix in normal release cycle |

### First 15 minutes

1. Declare the incident and appoint incident commander, communications lead, and technical lead.
2. Record UTC start time, release SHA, affected services, tenant scope, first alert, and current hypotheses.
3. Freeze unrelated deployments and capability enables.
4. Preserve relevant logs, traces, metrics snapshots, database status, queue state, and provider response metadata without copying secrets.
5. If security or privacy is suspected, disable the affected provider/automation/browser capability immediately.
6. Decide whether the correct mitigation is traffic reduction, feature kill switch, provider disablement, worker pause, rollback, or database recovery.
7. Communicate known facts separately from hypotheses; do not promise data safety until verified.

### Incident evidence

Retain the incident timeline, alert payload, dashboard snapshots, release/image digests, migration state, sampled trace IDs, sanitized logs, actions taken, approvals, provider status, customer impact, and follow-up owners. Security incidents require restricted access and chain-of-custody notes.

## 13. Backup, restore, deletion, and rollback

### Backup and recovery

- [ ] Choose Supabase managed backups/PITR or self-hosted pgBackRest/off-host storage; document RPO and RTO.
- [ ] For self-hosted Postgres, verify `wal_level`, `archive_mode`, `archive_command`, archive success/failure counters, off-host durability, and a full restart after postmaster settings.
- [ ] Run `scripts/backup-hosted.sh` or the approved managed backup process and record artifact checksum, size, timestamp, and retention class.
- [ ] Restore into a distinct throwaway target using `scripts/restore-drill.sh` or `scripts/backup-restore-smoke.sh`; never restore over the source database.
- [ ] Validate key tables, RLS policies, extensions, auth references, application rows, artifacts, approvals, provider runs, and webhook idempotency records.
- [ ] Run the restore drill quarterly and before a major schema change.

### Rollback

- [ ] Keep the previous image digests and compatible migration state available.
- [ ] Confirm the rollback target SHA and image digests before execution.
- [ ] Use `scripts/rollback.sh <staging|production> [revision]` with explicit approval variables.
- [ ] Verify `ROLLBACK_APPROVED=true`, `PRODUCTION_CHANGE_APPROVED=true` for production, and a named operator.
- [ ] Confirm rollback does not silently reverse an irreversible migration; use expand/contract migrations for schema changes.
- [ ] Drain or pause workers safely, record active leases, and verify no duplicate external action after rollback.
- [ ] Re-run readiness, auth, RLS, provider-blocked, queue, and representative candidate smoke checks.
- [ ] Keep the rollback incident open until metrics stabilize and a post-rollback backup is taken.

## 14. Post-deployment canary and sign-off

### First 15 minutes

- [ ] All services report healthy and ready.
- [ ] No crash loops, readiness flaps, migration errors, connection saturation, or queue growth.
- [ ] Login, tenant resolution, resume read, job search, saved-job ownership, and approval read paths work for a disposable canary tenant.
- [ ] Frontend assets match the release SHA and browser error rate is normal.
- [ ] Protected metrics scrape succeeds and dashboard annotations identify the release.

### First hour

- [ ] Observe request, task, provider, approval, and database dashboards continuously.
- [ ] Verify one safe read-only provider operation if the capability is enabled.
- [ ] Verify one candidate-controlled draft/approval path; do not execute external submission as a canary.
- [ ] Confirm logs are redacted and trace correlation works across Go → Python → worker/provider.
- [ ] Confirm alert routing by executing a documented synthetic alert or approved notification test.

### First 24 hours

- [ ] Review error budgets, provider budget consumption, queue reclaims, worker restarts, approval delivery, and account-deletion requests.
- [ ] Confirm backup completed after deployment and artifact is readable.
- [ ] Review tenant-isolation and authorization-denial telemetry for anomalies.
- [ ] Record final canary decision: expand, hold, rollback, or disable a capability.

### Sign-off record

A production sign-off must contain:

| Field | Value to record |
|---|---|
| Release SHA | Exact commit |
| Image digests | Frontend, Go, Python, worker, proxy, Redis if managed |
| Migration manifest | Ordered filenames and schema fingerprint |
| Environment | Production identifier and region |
| Approvers | Engineering, platform, security/privacy, product owner |
| Gate summary | Pass/fail/block for every mandatory gate |
| Canary window | Start/end UTC and tenant cohort |
| Alerts | Test alert result and dashboard links |
| Backup | Timestamp, checksum, retention, restore-drill age |
| Rollback | Target revision and approval path |
| Known limitations | Explicitly documented blockers and expiry dates |

## 15. Current repository-specific blockers to clear before public launch

Based on the latest repository evidence, the following must be treated as open until executed in the target environment:

1. **Credentialed live-provider proof:** Enable Firecrawl and Apify only in staging, run the read-only verifier with required providers, and attach sanitized results.
2. **Staging hostile suite:** Provide `TARGET_BASE_URL`, `PYTHON_BASE_URL`, two disposable authenticated tenants, an interruptible Redis worker, and an alert receiver; run the full suite rather than plan mode.
3. **Worker restart proof:** Kill a worker during provider polling and automation execution; verify lease reclaim, idempotency, no duplicate side effect, and final status.
4. **Backup/restore proof:** Restore a current production-shaped backup to a distinct throwaway database and validate schema, policies, auth references, and key rows.
5. **Rollback proof:** Execute the approved staging rollback and verify traffic, readiness, queues, migrations, and audit evidence after rollback.
6. **External-action proof:** If browser/ATS submission is ever enabled, verify the exact approval receipt, portal origin, artifact binding, cancellation, and real submission receipt in a disposable or explicitly authorized environment.
7. **Observability proof:** Configure Sentry, protected metrics, logs, traces, dashboards, and pager routing with real staging credentials; synthetic failures must reach the intended owner.
8. **Documentation drift:** Correct deployment documentation that still shows Bun commands where the repository’s release validation requires pnpm.

## References

[1]: ../../DEPLOYMENT.md "JobTayari deployment and backup documentation"
[2]: ../../TAYARI_RELEASE_GATE.md "JobTayari release gate"
[3]: ../../scripts/release_contract_test.sh "Master release contract"
[4]: ../../scripts/production_promotion_gate.sh "Production promotion gate"
[5]: ../../scripts/verify_rls_contract.py "RLS contract verifier"
[6]: ../../scripts/verify_observability_contract.py "Observability contract verifier"
[7]: ../../infra/observability/alerts.yml "Versioned observability alerts"
[8]: ../../scripts/live_provider_verify.py "Live provider verification runner"
[9]: ../../scripts/run_staging_hostile_suite.py "Staging hostile verification suite"
[10]: ../../scripts/restore-drill.sh "Throwaway database restore drill"
[11]: ../../scripts/rollback.sh "Controlled deployment rollback script"
[12]: ../../docs/operations/backup-and-recovery.md "Backup and recovery operations"
