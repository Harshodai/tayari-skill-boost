# Tayari Skill Boost — Dual-Track Deployment Roadmap

**Document status:** Evidence-backed execution plan
**Current decision:** **NOT READY FOR PRODUCTION**
**Scope:** AWS canary path, Kubernetes production path, and minimal local Minikube validation

## Purpose and release boundary

This roadmap separates the two viable production deployment tracks while preserving a narrow local validation loop. It is an operator plan, not evidence that either cloud target is available. The release remains blocked until the exact external prerequisites are supplied and the required staging evidence is attached to the reviewed immutable release SHA.

The product must remain candidate-controlled. `AUTONOMOUS_SUBMIT_ENABLED=false` is mandatory throughout development, staging, canary, and production until a separately approved external-action program has exact approval, artifact, origin, expiry, signature, cancellation, receipt, and audit evidence. No step below authorizes an external application submission, payment, account creation, credential entry, OTP/CAPTCHA handling, or irreversible provider action.

## Current evidence boundary

| Track | Current state | What is verified | What is not verified |
|---|---|---|---|
| Local Docker Compose | Running/validated in the attached desktop during this pass | Repository gates, local liveness, browser flows, synthetic recovery and security contracts | Production-like scale, managed dependencies, public ingress, live providers, live paging |
| Minikube | **BLOCKED** on clean profile startup | Earlier disposable structural Kubernetes evidence is preserved separately | A new clean-profile render, canary, readiness path, or workload convergence |
| AWS | **BLOCKED** before cloud mutation | Static deployment, immutable-image, origin/proxy, and fail-closed configuration contracts | AWS account/network/AMI, image pull, managed services, DNS/TLS, canary, rollback, cloud recovery |
| Production Kubernetes | **BLOCKED** at admission | Manifest and deployment-contract validation | Protected context, secret manager, signed images, rollout/rollback, ingress, network policy, approval |

The Minikube startup result is recorded in `.ruthless-evidence/productionization/minikube_start_second_pass.log`. The shared issue register is [`PRODUCTION_ISSUES.md`](../../PRODUCTION_ISSUES.md).

## Track A — AWS image-only canary

### Target topology

Use the repository’s AWS image-only deployment contract: a narrow public edge on the approved domain, the frontend and Go gateway as public-facing application components, the Python API and worker services private, and managed database/Auth/Redis/storage where approved. Redis, internal service ports, secrets, and administrative interfaces must not be publicly exposed.

The first AWS environment should be a staging or canary environment with separate credentials, separate data, explicit budget alarms, and a small allowlisted tenant cohort. It must not point at development Supabase, development Redis, development provider accounts, or production data.

### Prerequisites owned outside this repository

| Prerequisite | Required evidence before mutation |
|---|---|
| AWS identity and account | Approved role/account identity and operator authorization, recorded without tokens |
| Region and network | Region, VPC, private/public subnets, security groups, egress policy, and narrow admin CIDR |
| Compute | Approved AMI/instance profile, sizing decision, patching plan, and SSH-free or key-controlled access path |
| Registry | Private registry access and immutable image digests for frontend, Go, Python/worker, and proxy |
| Data plane | Environment-separated managed Postgres/Supabase/Auth/Storage and Redis endpoints with tested network reachability |
| Domain and TLS | Approved DNS zone, certificate ownership, public origin, and OAuth redirect URLs |
| Secret manager | Named secret paths, rotation owners, environment separation, and materialization policy |
| Providers | Launch-approved LLM/provider set, non-production credentials, quotas, budgets, and read-only verification plan |
| Operations | On-call owner, dashboards, alert receiver, backup/PITR policy, restore target, and rollback approver |

### Safe execution sequence

1. Review the exact release SHA, migration manifest, image digests, change approval, and backup plan. Run the AWS preflight and configuration validation without printing secret values.
2. Provision only the approved AWS network and compute resources. Do not create a public endpoint until security groups, IAM, logging, and budget controls are in place.
3. Materialize staging secrets from the approved secret manager. Verify presence, format, source, environment, and rotation metadata without logging values.
4. Deploy the immutable image set. Confirm the frontend has cloud mode, the proxy has a strict allowlist, and `AUTONOMOUS_SUBMIT_ENABLED=false`.
5. Verify `/healthz`, `/readyz`, authenticated login, owner-scoped reads/writes, protected metrics, queue health, and redacted logs through the real ingress.
6. Run read-only provider probes only for explicitly enabled providers. Keep all Google, browser, desktop, WhatsApp, and external-submission capabilities disabled unless separately approved.
7. Execute the staging hostile suite with two disposable tenants, then perform a worker restart/reclaim test and a rollback rehearsal.
8. Run the throwaway cloud restore drill and capture measured RPO/RTO. Test the alert receiver with an approved synthetic alert.
9. Admit a small canary cohort only after every mandatory gate is `PASS`. Hold or roll back on readiness loss, tenant-isolation anomaly, unsafe provider behavior, queue growth, or misleading approval status.

### AWS stop conditions

The wrapper must remain blocked if the AWS CLI/identity, private environment file, immutable image digests, public origin, managed dependencies, approval inputs, or secret source is absent. A static preflight pass is not a canary pass. No AWS resource, DNS record, certificate, provider credential, or production secret should be created by this validation environment.

## Track B — Kubernetes production

### Target topology

Use separate staging and production namespaces or clusters with distinct secret sources, service accounts, image digests, ingress configuration, network policies, resource requests/limits, PodDisruptionBudgets where justified, and rollback permissions. Frontend and Go ingress are public through the approved ingress controller; Python, Celery worker, Celery beat, Redis, and database connections remain private. Worker and beat are separate workloads, uploads use the declared persistent storage contract, and beat scheduling uses a single authoritative schedule.

### Admission prerequisites

| Control | Required condition |
|---|---|
| Cluster context | Protected, explicitly named production context; no accidental current-context deployment |
| Image supply chain | Registry images pinned by digest, release SHA recorded, signature/attestation and vulnerability review retained |
| Secrets | External secret manager or approved sealed-secret process; no raw values in manifests, Git, logs, or task payloads |
| Network | Ingress allowlist/TLS, default-deny network policy, private service paths, egress policy, and DNS verification |
| Workloads | Readiness/liveness probes, resource requests/limits, graceful termination, worker lease/reclaim settings, and queue isolation |
| Data | Migration review, backup before migration, RLS/grant verification, connection pool limits, and restore target |
| Observability | Protected metrics, structured redacted logs, traces/correlation IDs, dashboards, alert routing, and page rehearsal |
| Governance | Approved change, two-person or equivalent production approval, rollback revision, and named incident owner |

### Safe execution sequence

1. Render the selected Kustomize overlay and compare the output against the release manifest. Fail if image tags are mutable, production namespace values are missing, or secrets are inline.
2. Validate the cluster context and admission variables. Refuse deployment when the context is absent, unexpected, or not explicitly approved.
3. Apply external secrets and namespace policy first. Verify that the workload service accounts receive only required permissions.
4. Apply migrations using the approved database procedure, then deploy backward-compatible gateway, Python API, frontend, worker, and beat revisions.
5. Wait for dependency-aware readiness, then verify service-to-service identity, owner scoping, protected telemetry, queue lease behavior, and graceful shutdown.
6. Run a two-tenant staging matrix, provider-blocked checks, worker kill/restart, cancellation/reclaim, backup restore, and rollback. Do not use real candidate data.
7. Record the canary window, metrics snapshots, alert delivery, release digests, migration fingerprint, and decision. Promote only if all mandatory blockers are closed.

### Kubernetes stop conditions

Do not apply production manifests from a local workstation when the context, secret manager, immutable registry, approval, or rollback evidence is absent. Minikube can validate structure and process behavior only; it cannot establish managed production dependency readiness, production isolation, public TLS, provider acceptance, or production recovery.

## Minimal Minikube recovery plan

The clean profile attempt used Docker with 2 CPUs, 2 GB memory, 20 GB disk, and Kubernetes v1.35.1. It stalled after the cached base image and Kubernetes preload reported completion, and no profile/container was created. The stopped disposable profile was deleted before recreation; local Compose was not intentionally changed.

The next operator action on the attached desktop is diagnostic, not a production deployment:

```bash
minikube status --profile minikube
minikube logs --profile minikube --last-start
Docker Desktop: inspect resource, disk, and I/O activity
minikube start --profile minikube --driver=docker --cpus=2 --memory=2048 --disk-size=20g --kubernetes-version=v1.35.1 --wait=apiserver
```

If startup converges, capture `minikube status`, `kubectl get nodes`, the rendered Kustomize output, and a disposable namespace canary using synthetic non-secret configuration. Do not inject development or production database/auth/provider secrets. A synthetic or unreachable database must leave `/readyz` red; bypassing readiness would invalidate the test. If startup stalls again, retain `PROD-011` as `BLOCKED` and rely only on the previously preserved structural evidence.

## Release evidence checklist

| Evidence artifact | Owner | Gate |
|---|---|---|
| Exact SHA, image digests, migration manifest | Release/DevOps | Required before any canary |
| Environment and secret presence report | Platform/Security | No values or tokens |
| Real ingress health/readiness and auth smoke | SRE | Required for staging |
| Two-tenant hostile matrix | Security/Backend | Required before production |
| Provider read-only acceptance | Integrations | Required only for enabled providers |
| Worker restart/reclaim and cancellation | SRE/Backend | Required before production |
| Backup restore with RPO/RTO | Data/SRE | Required before production |
| Protected telemetry and page test | Observability | Required before production |
| Rollback rehearsal and post-rollback health | Release/SRE | Required before production |
| Final approval record | Engineering/Platform/Security/Product | Required for public traffic |

## Final decision rule

A green local suite, successful manifest render, or successful static preflight does not authorize production. The release remains **NOT READY FOR PRODUCTION** until AWS or Kubernetes external blockers are closed with reproducible evidence tied to the exact immutable release identifier. Any missing evidence remains `BLOCKED` or `NOT VERIFIED`, never implicitly `PASS`.

## References

- [`PRODUCTION_ISSUES.md`](../../PRODUCTION_ISSUES.md)
- [`FINAL_PRODUCTION_READINESS.md`](FINAL_PRODUCTION_READINESS.md)
- [`DEPLOYMENT.md`](../../DEPLOYMENT.md)
- [`infra/k8s/SECRETS.md`](../../infra/k8s/SECRETS.md)
- [`scripts/deploy-environment.sh`](../../scripts/deploy-environment.sh)
- [`deploy/aws/deploy.sh`](../../deploy/aws/deploy.sh)
- [`docs/operations/production-deployment-observability-checklist.md`](../operations/production-deployment-observability-checklist.md)
- [Minikube startup evidence](../../.ruthless-evidence/productionization/minikube_start_second_pass.log)
