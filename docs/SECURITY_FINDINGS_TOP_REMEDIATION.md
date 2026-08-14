# Job Tayari — Top Security Findings Remediation and AWS EC2 Canary Walkthrough

**Date:** 14 August 2026
**Repository:** `Harshodai/tayari-skill-boost`
**Current gate:** 113 critical/high findings remain in the production baseline: **41 critical database findings and 72 high database findings**. The scan also reports one low edge-function CORS finding. The findings are not 113 unrelated vulnerabilities: most are repeated migration-contract findings across the same classes of database controls.

## 1. Finding inventory

| Finding class | Severity | Count | Meaning |
|---|---:|---:|---|
| Public tables created without RLS | Critical | 41 | A table may be reachable without a row-ownership policy. This is the highest-risk class for user-owned data. |
| Public tables created without explicit grants | High | 68 | The migration does not declare the intended Data API privileges. Add least-privilege grants after RLS policies. |
| Policies containing `USING (true)` | High | 4 | These are safe only for tightly restricted roles such as `service_role`; they must never be used for `anon` or general `authenticated` access. |
| Other scanner-specific database repeats | High | Included above | The same table can produce both an RLS and a grant finding across multiple migration files. |
| Edge-function CORS | Low | 1 | `supabase/functions/mcp/index.ts` lacks the scanner’s expected CORS header marker. This is currently an unrelated pre-existing working-tree change and was not included in the AWS package. |

The report includes sensitive or security-relevant tables such as `agent_runs`, `application_attempts`, `user_sessions`, `tailored_resumes`, `platform_configs`, `agent_action_approvals`, `agent_task_attempts`, `review_queue_history`, `saved_sources`, `password_reset_tokens`, `api_keys`, `communications`, `connections`, `interview_scores`, `user_job_feedback`, `candidate_agent_audit_logs`, and `runtime_approvals`. The exact migration file and finding title are emitted by `bun run security:scan --json`.

## 2. Top remediation 1 — RLS for user-owned tables

For every table that contains user-owned data, enable RLS and create policies keyed to `auth.uid()`. Do this in a forward migration after verifying the actual primary owner column. Do **not** use a blanket policy that lets every authenticated user read every row.

For a table whose owner column is `user_id uuid`, the safe pattern is:

```sql
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_runs_owner_select ON public.agent_runs;
CREATE POLICY agent_runs_owner_select
  ON public.agent_runs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS agent_runs_owner_insert ON public.agent_runs;
CREATE POLICY agent_runs_owner_insert
  ON public.agent_runs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS agent_runs_owner_update ON public.agent_runs;
CREATE POLICY agent_runs_owner_update
  ON public.agent_runs FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS agent_runs_owner_delete ON public.agent_runs;
CREATE POLICY agent_runs_owner_delete
  ON public.agent_runs FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

Apply the same structure to `application_attempts`, `user_sessions`, `tailored_resumes`, `platform_configs`, `agent_task_attempts`, `review_queue_history`, `saved_sources`, `communications`, `connections`, `interview_scores`, and `user_job_feedback`, after confirming each table’s owner column. For secret-bearing tables such as `password_reset_tokens` and `api_keys`, the preferred policy is **service-role only**; do not expose them to the browser’s `authenticated` role.

Validation must use two distinct test users and the real Data API or PostgREST path, not only a service-role connection:

```sql
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '<user-a-uuid>', true);
SELECT count(*) FROM public.agent_runs;

SELECT set_config('request.jwt.claim.sub', '<user-b-uuid>', true);
SELECT count(*) FROM public.agent_runs;
```

The test must prove that user B cannot read, update, delete, or transition user A’s rows.

## 3. Top remediation 2 — least-privilege grants

After RLS policies exist, declare the intended privileges. Grants do not replace RLS; they define which operations are possible, while RLS defines which rows are visible.

For ordinary user-owned records:

```sql
REVOKE ALL ON public.agent_runs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_runs TO authenticated;
```

For secrets and internal audit data:

```sql
REVOKE ALL ON public.api_keys FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO service_role;
```

For public reference content such as an intentionally public blog table, use the narrowest possible grant and an explicit read-only policy:

```sql
REVOKE ALL ON public.blog_posts FROM anon, authenticated;
GRANT SELECT ON public.blog_posts TO anon, authenticated;
CREATE POLICY blog_posts_published_read
  ON public.blog_posts FOR SELECT TO anon, authenticated
  USING (published = true);
```

The migration must include grants for every table it creates, or the repository scanner will continue to flag the migration. The existing reconciliation migration already adds explicit grants for the new candidate-answer tables; the remaining historical tables need a separate audited migration based on their actual schema.

## 4. Top remediation 3 — replace unrestricted policies

The scanner reports four high findings for `USING (true)`. In `supabase/migrations/20260121000000_security_hardening.sql`, the shown `auth_attempts` policy is restricted to `service_role`; that policy is not equivalent to public access. The scanner should be improved to recognize role-restricted service policies, while any `USING (true)` policy granted to `anon` or `authenticated` must be removed.

The correct policy for a service-only table is:

```sql
DROP POLICY IF EXISTS "Service role only" ON public.auth_attempts;
CREATE POLICY auth_attempts_service_only
  ON public.auth_attempts FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
REVOKE ALL ON public.auth_attempts FROM anon, authenticated;
```

The scanner should also be updated so that it flags `USING (true)` only when the policy role includes `anon`, `authenticated`, `public`, or no explicit restrictive role. That removes a false positive without weakening the production gate.

## 5. Top remediation 4 — fix migration/scanner contract drift

The historical migrations mix `supabase/migrations` and `backend/db/migrations`, and the scanner evaluates each `CREATE TABLE` block against grants/RLS in the same file. A safe cleanup sequence is:

1. Freeze the historical migrations; do not rewrite already-applied migration files.
2. Generate a forward migration for each table with verified owner-column mappings.
3. Add RLS, policies, grants, indexes, and a migration test for each table.
4. Update the scanner to recognize forward hardening migrations and to avoid false positives from malformed `CREATE TABLE IF NOT EXISTS` matches.
5. Run the scanner against a disposable database and the application’s two-user negative test suite.
6. Only then change `security:production` from blocked to passing.

## 6. Top remediation 5 — edge-function CORS and service-role isolation

The low finding is in `supabase/functions/mcp/index.ts`. The function should return CORS headers on `OPTIONS` and every normal response, while still verifying the caller before using a service-role key. Never solve the scanner finding by allowing `Access-Control-Allow-Origin: *` for credentialed requests. Use the deployed frontend origin and explicit allowed methods/headers.

## 7. AWS EC2 canary provisioning walkthrough

The repository now contains `deploy/aws/ec2-canary.yaml`, `deploy/aws/provision.sh`, `docker-compose.aws.yml`, `deploy/aws/deploy.sh`, `deploy/aws/.env.example`, and `deploy/aws/Caddyfile`. These files are **not yet committed at the time this guide was written**.

### Step A — select region and account settings

Create or select an AWS region, confirm the account’s Free Tier/credit status, and create a monthly budget first. From a workstation with AWS CLI credentials, run:

```bash
aws configure
aws sts get-caller-identity
export AWS_REGION=us-east-1
export ADMIN_CIDR="$(curl -fsS https://checkip.amazonaws.com)/32"
```

The AWS account must have a public subnet with an Internet Gateway route. Identify the VPC, subnet, and Ubuntu 24.04 amd64 AMI in the selected region. Do not use an unrestricted SSH CIDR.

### Step B — create a budget

From the repository root:

```bash
ALERT_EMAIL=ops@example.com \
LIMIT_USD=10 \
AWS_REGION="$AWS_REGION" \
./deploy/aws/create-budget.sh
```

Confirm the email subscription and verify the budget in the AWS Billing console.

### Step C — provision the EC2 canary

```bash
cd /path/to/tayari-skill-boost
AWS_REGION="$AWS_REGION" \
VPC_ID=vpc-xxxxxxxx \
SUBNET_ID=subnet-xxxxxxxx \
AMI_ID=ami-xxxxxxxx \
ADMIN_CIDR="$ADMIN_CIDR" \
PUBLIC_DOMAIN=jobs.example.com \
./deploy/aws/provision.sh
```

The CloudFormation stack creates one encrypted 30 GB gp3 root volume, one EC2 instance, an SSM instance profile, and a security group allowing public ports 80/443 plus port 22 only from `ADMIN_CIDR`. It does not create a NAT Gateway, load balancer, RDS instance, or managed cache.

### Step D — point DNS at the host

Read the public IP from the CloudFormation output and create an `A` record for `jobs.example.com`. Wait for DNS propagation before deploying because Caddy needs the domain to resolve to obtain TLS.

### Step E — install code and secrets

Copy the repository to `/opt/tayari` through a private Git checkout, SSM transfer, or operator-controlled SCP. On the host:

```bash
cd /opt/tayari
auth="$(id -un)"
cp deploy/aws/.env.example deploy/aws/.env
chmod 600 deploy/aws/.env
openssl rand -hex 32
nano deploy/aws/.env
```

Set `PUBLIC_DOMAIN`, `PUBLIC_ORIGIN`, `CADDY_EMAIL`, Supabase URL/key/project ID, `DATABASE_URL`, `JWT_SECRET`, `AI_INTERNAL_TOKEN`, `APPROVAL_SIGNING_KEY`, and `TAYARI_API_KEY`. Keep `AUTONOMOUS_SUBMIT_ENABLED=false`.

### Step F — validate and deploy

```bash
cd /opt/tayari
./deploy/aws/deploy.sh config
./deploy/aws/deploy.sh up
./deploy/aws/deploy.sh status
./deploy/aws/deploy.sh logs
curl --fail https://jobs.example.com/health
```

The script builds the four application images, starts the stack, and waits for the public health endpoint. Python and Redis remain private inside the Compose network.

### Step G — rollback

The deployment is manual and commit-based. Before each deployment record `git rev-parse HEAD`, the migration version, and the Compose config hash. To roll back application code, check out the last known-good commit on the host and run `./deploy/aws/deploy.sh config && ./deploy/aws/deploy.sh up`. Do not manually reverse database migrations; use a forward corrective migration after restoring to a disposable database.

## 8. Deployment readiness decision

The AWS files can deploy a **canary**, but they do not override the production security gate. The GitHub Actions workflow intentionally runs `bun run security:production` before an SSM deployment. With 41 critical and 72 high findings, that job should fail until the RLS/grant/policy migration work is complete or the affected features are explicitly removed from the launch surface. The first live release should be manual-submit only, with human-controlled login, OTP/MFA, CAPTCHA, terms, legal declarations, and final submission.
