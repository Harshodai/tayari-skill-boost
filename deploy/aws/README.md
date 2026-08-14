# Job Tayari on AWS: low-cost manual-submit canary

## Recommended operating boundary

The cheapest responsible AWS deployment is a **single Ubuntu EC2 canary host** running Docker Compose. The host runs the Go gateway, Python API, Celery worker, Redis, frontend, and Caddy. PostgreSQL and authentication remain on the existing Supabase project initially, because self-hosting the complete Supabase Auth/PostgREST/storage stack on the same small host would increase memory pressure and operational risk. Redis is self-hosted on the EC2 volume because it is small, required by Celery, and managed ElastiCache would add another billable service.

This is a **manual-submit canary**, not a high-availability production system. Browser automation must pause for login, OTP/MFA, CAPTCHA, legal/terms declarations, work authorization, sponsorship, salary, EEO, and any other sensitive answer. `AUTONOMOUS_SUBMIT_ENABLED=false` is enforced by the deployment template and by the shared server-side submission guard.

## Cost options

| Option | Typical shape | Cost posture | Trade-off |
|---|---|---:|---|
| EC2 canary, recommended | One Free-Tier-eligible `t3.micro` or `t4g.micro`; external Supabase; Redis on host | Lowest AWS spend; potentially covered by current credits/offer | One host, no HA; Chromium and Celery compete for memory |
| Lightsail VM | One $5 or $7 Linux VM; external Supabase; Redis on host | Predictable approximately $5–$7/month after applicable trial/credits | Less flexible than EC2; still one host; memory is tight for Playwright |
| Lightsail containers | Nano or Micro container service plus external DB | Starts around $7–$10/month for the container node before other services | Multiple containers and browser worker memory are difficult on the smallest node |
| ECS/Fargate + RDS/ElastiCache | Separate managed services | Better operations and scaling, but not a Free-Tier-first design | Load balancers, NAT, RDS, cache, logs, and task-hours can exceed credits |

AWS currently advertises up to $200 in credits for a new Free Tier account, with a Free account plan that ends after six months or credit depletion; terms and eligible services are account-specific. Treat all estimates as planning figures and set billing alerts before deployment. See the official sources in the AWS research note under `/home/ubuntu/tayari-audit/aws-research-2026-08-14.md`.

## 1. Prepare the AWS account

Create or use an AWS account, select a region close to the intended users, and choose the account plan deliberately. Create a monthly AWS Budget with alerts at a small threshold such as $5, $10, and $20. Enable Cost Anomaly Detection if the account supports it. Do not create a NAT Gateway, Application Load Balancer, managed Redis cluster, or always-on RDS instance for the first canary; each is unnecessary for this topology.

Use the default VPC only if its public subnet has an Internet Gateway route. Determine the VPC, public subnet, and the current public IP address that will be allowed for administration. Use SSM Session Manager when possible; the CloudFormation template still restricts SSH to `AdminCidr` rather than opening port 22 to the world.

## 2. Provision one host

From a machine with AWS CLI credentials and an Ubuntu 24.04 AMI ID for the selected region, run:

```bash
cd /path/to/tayari-skill-boost
AWS_REGION=us-east-1 \
VPC_ID=vpc-xxxxxxxx \
SUBNET_ID=subnet-xxxxxxxx \
AMI_ID=ami-xxxxxxxx \
ADMIN_CIDR=203.0.113.10/32 \
PUBLIC_DOMAIN=jobs.example.com \
./deploy/aws/provision.sh
```

The template creates one encrypted 30 GB gp3 root volume, an instance profile for SSM, a security group allowing only HTTP/HTTPS publicly and SSH from the supplied CIDR, and a public IP. It deliberately does not create a load balancer or NAT Gateway.

The instance must be labeled as a canary. If the workload needs more than one concurrent browser session, use a larger instance or move the worker to a separate host; do not silently overload a micro instance.

## 3. Install the repository and secrets

Copy the repository to `/opt/tayari` through an authenticated private Git checkout, SSM, or an operator-controlled transfer. Do not put provider keys in GitHub Actions logs, cloud-init, the frontend build, or Docker image layers.

On the host:

```bash
sudo mkdir -p /opt/tayari
sudo chown -R ubuntu:ubuntu /opt/tayari
cd /opt/tayari
cp deploy/aws/.env.example deploy/aws/.env
chmod 600 deploy/aws/.env
openssl rand -hex 32
```

Edit `deploy/aws/.env` with the existing Supabase URL, publishable key, PostgreSQL connection string, JWT secret contract, internal service token, approval signing key, Tayari API key, public domain, and Caddy email. Keep `AUTONOMOUS_SUBMIT_ENABLED=false`. Check the file before every release:

```bash
./deploy/aws/deploy.sh config
```

## 4. Configure DNS and deploy

Create an `A` record for `jobs.example.com` pointing to the instance public IP. If the IP may change, use an Elastic IP only after confirming its pricing and lifecycle implications. Once DNS resolves:

```bash
cd /opt/tayari
./deploy/aws/deploy.sh up
./deploy/aws/deploy.sh status
PUBLIC_ORIGIN=https://jobs.example.com curl --fail https://jobs.example.com/health
```

Caddy obtains and renews TLS certificates automatically. The public surface is the frontend and `/api/*` through the Go gateway. Python and Redis are not published to the Internet.

## 5. Apply database migrations safely

The migration in `supabase/migrations/20260815100000_reconcile_runtime_contracts.sql` must be applied to a disposable staging database first. Verify that existing `agent_runs`, `agent_questions`, and `applications` records map to the runtime contract. Confirm RLS policies, grants, ownership predicates, answer expiry, and handoff state transitions with two test users. Only then apply the migration to the production Supabase project through its normal migration pipeline.

Do not use the EC2 host as the only database backup. Export encrypted backups of the Supabase project according to its plan and verify a restore into a disposable project before enabling real user data.

## 6. CI/CD

The repository includes `.github/workflows/aws-canary.yml`. Every push to `main` runs frontend, Go, Python, and production security checks. Deployment is manual through GitHub Actions `workflow_dispatch` and requires the `deploy` input to be true. The workflow uses GitHub OIDC to assume an AWS role and SSM to run the tested commit on the EC2 host.

Configure a narrowly scoped GitHub OIDC role with permissions limited to `ssm:SendCommand`, `ssm:GetCommandInvocation`, and read-only discovery for the specific instance. Configure repository/environment variables `AWS_REGION` and `TAYARI_INSTANCE_ID`, and the secret `AWS_ROLE_ARN`. Keep the production environment protected by required reviewers.

The workflow is intentionally blocked until the production security gate passes. Do not bypass that check by accepting new baseline findings.

## 7. Backups and rollback

Before each release, record the Git commit, Compose configuration hash, migration version, and image build timestamp. Keep the previous repository commit available on the host. To roll back application code, stop new traffic, check out the previous known-good commit, run `./deploy/aws/deploy.sh config`, and bring the stack up again. Do not roll back a database migration by editing production tables manually; use a forward-compatible corrective migration after verifying backups.

At minimum, back up the Redis append-only volume only for queue recovery, not as the system of record. The system of record is PostgreSQL/Supabase. Test a restore of answer-bank versions, queue rows, run state, and audit metadata.

## 8. Observability and cost controls

Use the Go health endpoint, Python health endpoint, Docker health checks, and Caddy logs. Send only redacted application logs to Sentry or CloudWatch. Do not log answer values, tokens, OTPs, CAPTCHA text, session cookies, credentials, full resume content, or raw accessibility snapshots. Add alerts for repeated 5xx responses, queue persistence failures, worker liveness, disk utilization above 70%, and Redis memory pressure.

Use a small CloudWatch log retention period, such as 7 or 14 days, rather than indefinite retention. Prune unused Docker images and build cache. Set an EC2 stop schedule for non-production development hosts. Never leave test stacks, NAT gateways, load balancers, RDS instances, or unattached EBS volumes running after an experiment.

## 9. Launch gates

The canary is not launch-ready until the following gates pass: the production security gate reports zero unresolved critical/high findings or the affected feature is removed from the launch surface; migrations pass against a disposable PostgreSQL/Supabase environment; two-user negative ownership tests pass through the public Go gateway; queue outages return explicit failure rather than an empty queue; sensitive fields pause durably and resume only with an owner-bound expiring handoff token; browser submission remains server-disabled; manual submission is displayed as candidate-confirmed but externally unverified; backup restore succeeds; logs are redacted; and a human reviewer approves the first controlled release.
