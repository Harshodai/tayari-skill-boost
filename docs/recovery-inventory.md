# Tayari Recovery Domain Inventory

> **Document owner**: Platform Operations  
> **Last reviewed**: 2026-08-25  
> **Related runbook**: `docs/Disaster_Recovery.md`  
> **Related script**: `scripts/backup-restore-smoke.sh`

---

## Purpose

This document enumerates every durable user-state domain in the Tayari platform, states the backup owner and objectives for each, and **explicitly calls out domains that have no automated backup/restore path today**. It is the authoritative reference for understanding what `scripts/backup-restore-smoke.sh` proves and, equally importantly, what it does **not** prove.

---

## Scope limitation of `backup-restore-smoke.sh`

> **SCOPE: This drill covers `public` schema only.**

`scripts/backup-restore-smoke.sh` runs `pg_dump --schema=public` against the source database, restores the dump into a disposable target, and verifies that all 14 expected application tables are present. It also:

- Confirms the restore target already has `auth.users` (Supabase Auth dependency).
- Installs required extensions (`pgcrypto`, `pg_trgm`, `uuid-ossp`, `vector`).

**What it PROVES**:
- The portable dump captures the 14 application tables in `public`.
- `pg_restore` replays the dump cleanly into a Supabase-compatible target.
- The restore target satisfies managed-Auth and extension dependencies.
- The RLS policy count on restored tables is > 0 (explicit check added 2026-08-25).

**What it does NOT prove**:
- Auth identities and sessions are recoverable (`auth.*` schemas — Supabase managed, not in dump).
- Uploaded files (resumes, receipts) are recoverable — object storage is not a SQL schema.
- Redis/Celery queue state is recoverable — not a PostgreSQL domain.
- Secrets/environment config are present and correct in the restored environment.
- OAuth client credentials survive a platform migration.
- Stripe webhook key and endpoint configuration survive.
- Container image digests and release artifacts are available for the restored application version.

---

## Domain Inventory

### 1. Application Database — `public` schema

| Attribute | Detail |
|-----------|--------|
| **Owner** | Operator (via `scripts/backup-hosted.sh` → `pg_dump --schema=public`) |
| **What's stored** | All 14 app tables: `tenants`, `cohorts`, `memberships`, `profiles`, `resumes`, `saved_jobs`, `application_approvals`, `submission_receipts`, `agent_questions`, `agent_runs`, `run_events`, `run_controls`, `delivery_ledger`, `push_subscriptions`, `agent_tasks`, `agent_router_events`, `stripe_webhook_events` |
| **RPO** | ≤ 15 minutes (target; actual depends on backup schedule configured in cron — not yet automated) |
| **RTO** | ≤ 4 hours (target; depends on dump size and network throughput) |
| **Backup mechanism** | `scripts/backup-hosted.sh`: custom-format `pg_dump --schema=public`, stored in `backups/tayari_hosted_*.dump`, retention default 14 days |
| **Restore mechanism** | `scripts/restore-drill.sh` (full drill with safety gates) or `scripts/backup-restore-smoke.sh` (CI smoke) |
| **Validation query** | `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY[...14 tables...])` — must return 14 |
| **RLS validation** | `SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public'` — must return > 0 |
| **Coverage status** | ✅ **Covered** by `backup-restore-smoke.sh` |
| **Intentionally excluded from portable dump?** | N/A — this is the portable scope |

**Gap**: No automated cron schedule for `backup-hosted.sh` is deployed. Until scheduled, RPO of 15 minutes is aspirational only. **Launch blocker** if not configured before production.

---

### 2. Auth Identities and Sessions — `auth.*` schema

| Attribute | Detail |
|-----------|--------|
| **Owner** | Supabase (platform-managed schema) |
| **What's stored** | `auth.users` (all registered user accounts and OAuth identities), `auth.sessions`, `auth.refresh_tokens`, `auth.identities`, `auth.mfa_*`, `auth.audit_log_entries` |
| **RPO** | Determined by Supabase platform backup policy (self-hosted: operator responsibility; cloud: Supabase SLA) |
| **RTO** | Determined by Supabase restore capability |
| **Backup mechanism** | **Self-hosted**: must configure WAL-based streaming backup or logical replication including `auth` schema. `pg_dump --schema=public` explicitly excludes these tables. No operator-owned backup script currently covers `auth.*`. |
| **Restore mechanism** | Self-hosted: restore from full-database dump (all schemas). Cloud Supabase: use Supabase dashboard PITR. |
| **Validation query** | `SELECT COUNT(*) FROM auth.users;` (must match pre-failure count) |
| **Coverage status** | ❌ **NOT covered** by `backup-restore-smoke.sh` |
| **Intentionally excluded?** | ✅ Yes — `auth.*` contains extension-owned functions not portable into disposable targets under the application database owner. The drill explicitly requires the target to already have `auth.users` before restore. |

**Gap**: For self-hosted deployments, no automated backup of `auth.*` exists. If the Supabase container data volume is lost, all user accounts and sessions are unrecoverable unless a full-database dump (including `auth`) is taken separately. **This is a launch blocker for self-hosted production deployments**.

---

### 3. File Storage — Uploaded Resumes and Documents

| Attribute | Detail |
|-----------|--------|
| **Owner** | Operator (Supabase Storage backed by local disk or S3-compatible object store) |
| **What's stored** | Resume files uploaded by candidates, any documents or artifacts attached to agent runs |
| **RPO** | Not defined — no backup configuration documented |
| **RTO** | Not defined — no restore procedure documented |
| **Backup mechanism** | ❌ **None documented**. Supabase Storage in self-hosted mode writes to the `supabase-local` volume by default. No S3 bucket backup, no periodic `aws s3 sync`, no volume snapshot procedure exists in this repo. |
| **Restore mechanism** | ❌ **None documented**. |
| **Validation query** | `SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'resumes';` |
| **Coverage status** | ❌ **NOT covered** by any backup script |
| **Intentionally excluded?** | Not intentionally — this is an operational gap |

**Gap**: File uploads are user-critical data. If the storage volume is lost, uploaded resumes cannot be recovered. **This is a launch blocker**.

---

### 4. Database Migrations and RLS Policies

| Attribute | Detail |
|-----------|--------|
| **Owner** | Operator (Git-controlled) |
| **What's stored** | Supabase migration SQL files (`supabase/migrations/*.sql`), RLS policies, extension definitions, and seed data |
| **RPO** | N/A — source of truth is Git; no data loss possible as long as the Git repo is intact |
| **RTO** | ≤ 30 minutes to apply all migrations to a fresh Supabase target with `supabase db push` or direct `psql` |
| **Backup mechanism** | Git repository (same as application source) |
| **Restore mechanism** | `supabase db push` or replay of migration files in order against the target database |
| **Validation query** | `SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';` — must be > 0 |
| **Coverage status** | ✅ **Covered** by Git. Not dependent on `backup-restore-smoke.sh`. |
| **Intentionally excluded?** | Yes — migrations are source-controlled, not data-backed |

**Note**: `backup-restore-smoke.sh` verifies that RLS policies survive the restore (count > 0 in `pg_policies`). This confirms that policies embedded in the `pg_dump` are replayed correctly.

---

### 5. Secrets and Configuration

| Attribute | Detail |
|-----------|--------|
| **Owner** | Operator |
| **What's stored** | `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `REDIS_URL`, `SENDGRID_API_KEY`, all values in `supabase-local/.env` and production `.env` |
| **RPO** | N/A — secrets are not data; they are re-derived or rotated, not recovered from a database backup |
| **RTO** | Operator must hold secrets in a managed secret store (1Password, AWS Secrets Manager, Vault, etc.). Recovery time depends on operator process. |
| **Backup mechanism** | Operator-owned secret manager. **No secret values should ever be in Git or in the dump file.** `backup-hosted.sh` uses `--no-owner --no-acl` which does not include credentials. |
| **Restore mechanism** | Re-inject from secret manager into environment before starting services. |
| **Validation query** | N/A — application startup will fail fast if required secrets are absent. |
| **Coverage status** | ⚠️ **Not in scope** for database backup — by design. Operator must manage separately. |
| **Intentionally excluded?** | ✅ Yes — secrets must never be in backup artifacts |

**Gap**: No secret store is configured in the repo. Secrets are managed via `.env` files. Operators must document which secret manager holds production keys and verify the break-glass rotation procedure before launch.

---

### 6. Queue State — Redis / Celery

| Attribute | Detail |
|-----------|--------|
| **Owner** | Operator |
| **What's stored** | Celery task queue (pending agent run tasks, delivery tasks), Celery result backend (task outcomes), Redis pub/sub channels |
| **RPO** | **Treat as non-durable** unless Redis persistence (AOF or RDB snapshots) is explicitly configured |
| **RTO** | Queue drain completes upon Redis restart if persistence is enabled; if not, in-flight tasks are lost |
| **Backup mechanism** | Redis RDB/AOF persistence — not currently configured or documented in this repo |
| **Restore mechanism** | Redis RESTORE from RDB snapshot; Celery tasks are re-queued by the application if idempotent |
| **Validation query** | `redis-cli LLEN celery` (pending queue depth); application-level — check `agent_runs` for tasks stuck in `queued` state |
| **Coverage status** | ❌ **NOT covered** by any backup script |
| **Intentionally excluded?** | Partially intentional — `docs/Disaster_Recovery.md` calls queue state reconstructable only where task idempotency is demonstrated. Browser automation tasks must NOT be auto-replayed. |

**Gap**: No Redis persistence configuration is in the repo. Loss of the Redis container results in silent loss of pending tasks. Operator must verify idempotency policy before declaring tasks recoverable. **Not a hard launch blocker if the app handles task re-submission**, but requires documented policy.

---

### 7. External OAuth Client Settings

| Attribute | Detail |
|-----------|--------|
| **Owner** | Operator (Google Cloud Console, LinkedIn Developer, etc.) |
| **What's stored** | OAuth client IDs, client secrets, authorized redirect URIs registered with each identity provider |
| **RPO** | N/A — these are configuration values in external systems, not replicated data |
| **RTO** | Minutes — re-enter in Supabase Auth dashboard and respective provider consoles |
| **Backup mechanism** | Document client IDs (not secrets) in ops runbook. Secrets are stored in secret manager. |
| **Restore mechanism** | Manual re-registration if lost; rotate secrets if compromised |
| **Validation query** | `SELECT provider, enabled FROM auth.providers;` (Supabase internal) |
| **Coverage status** | ⚠️ **Out of scope** for portable dump — provider config lives in Supabase and external systems |
| **Intentionally excluded?** | ✅ Yes — external config, not database row data |

**Gap**: No documented runbook for re-registering OAuth credentials from scratch. **Low priority launch item** — mitigated by the fact that client IDs are not secret and can be documented.

---

### 8. Release Artifacts and Image Digests

| Attribute | Detail |
|-----------|--------|
| **Owner** | CI/CD pipeline (GitHub Actions or equivalent) |
| **What's stored** | Docker image digests for `go-backend`, `python-backend`, `frontend`; Electron/desktop build artifacts; Kubernetes/Compose rendered manifests; SBOM |
| **RPO** | N/A — images are immutable; the registry is the backup |
| **RTO** | Minutes — pull from registry using known digest |
| **Backup mechanism** | Container registry (GitHub Container Registry or Docker Hub). `scripts/build-images.sh` records digests. |
| **Restore mechanism** | `docker pull <image>@<digest>` or re-run CI build pipeline |
| **Validation query** | `docker inspect <image>@<digest>` or `verify_staging_evidence_bundle.py` |
| **Coverage status** | ✅ **Covered** by CI pipeline and registry retention |
| **Intentionally excluded?** | ✅ Yes — registry serves as the artifact backup |

---

## Summary: No-backup-path domains (launch blockers)

| Domain | Severity | Action required |
|--------|----------|-----------------|
| `auth.*` schema (self-hosted) | 🔴 **Launch blocker** | Configure full-DB dump (all schemas) in addition to public-schema dump; document Supabase volume backup for self-hosted. |
| File storage (resumes, uploads) | 🔴 **Launch blocker** | Configure S3-compatible storage backend with versioning, OR add automated volume snapshot procedure. |
| `backup-hosted.sh` cron schedule | 🔴 **Launch blocker** | Automate execution before production goes live; otherwise RPO is undefined. |
| Redis queue persistence | 🟡 **Must document before launch** | Enable AOF/RDB persistence; document idempotency policy; prohibit auto-replay of browser automation tasks. |
| Secret store | 🟡 **Must document before launch** | Choose and configure a managed secret store; document rotation procedure. |
| OAuth client runbook | 🟢 **Low priority** | Document client IDs and re-registration steps in the ops runbook. |

---

## See also

- `docs/Disaster_Recovery.md` — recovery decision flow and drill acceptance criteria
- `scripts/backup-hosted.sh` — application (public schema) backup script
- `scripts/backup-restore-smoke.sh` — CI smoke test (public schema only)
- `scripts/restore-drill.sh` — full restore drill with production safety gates
- `scripts/staging_backup_restore_drill.py` — staging-level restore + fault injection drill
- `scripts/check_public_table_rls.sh` — RLS gate for public tables
