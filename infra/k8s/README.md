# Job Tayari Kubernetes Deployment Architecture

## Purpose and operating boundary

This package translates Job Tayari’s current React frontend, Go gateway, Python AI API, Celery worker, Celery beat, Redis, PostgreSQL/Supabase-compatible database, and desktop integration model into a **provider-neutral Kubernetes application layer**. It does not provision a cluster, create a public DNS record, enable billing, or move customer data. Those changes remain explicit environment-owner decisions.

The desktop app remains a local-first client and keeps its existing narrow native bridge. Cloud deployment is an opt-in service-plane profile, not a silent replacement for local Compose. This distinction matters because the desktop runtime is designed around loopback-only local services, candidate-selected files, visible review state, and explicit start/stop controls.

## Runtime topology

| Workload | Kubernetes form | Scaling approach | Dependencies | Customer-safety design |
|---|---|---|---|---|
| Frontend | Two-replica `Deployment` and `ClusterIP` Service | CPU HPA | Go gateway through ingress `/api` route | Health endpoint; zero-unavailable update; no privileged filesystem. |
| Go gateway | Two-replica `Deployment` and `ClusterIP` Service | CPU HPA | PostgreSQL/Supabase, Python API, auth, optional notification providers | API health gates; secret-only credentials; reversible stateless rollout. |
| Python AI API | Two-replica `Deployment` and `ClusterIP` Service | CPU HPA | PostgreSQL, Redis, AI providers, object storage where configured | Separate capacity from web/API traffic and staged rollout. |
| Celery worker | One-replica `Deployment` | Fixed one-process concurrency initially | Redis, PostgreSQL, AI providers, browser runtime | Dedicated browser-capable process, queue-specific limit, long graceful shutdown. |
| Celery beat | Single-replica `Deployment` with `Recreate` strategy | No horizontal scale | Redis, PostgreSQL | Prevents duplicate scheduled enqueueing during routine rollout. |
| PostgreSQL/Supabase and Redis | Managed services outside the manifest package | Managed-service capacity and backups | Private network and workload identity | No stateful database or queue pod is introduced before provider and recovery controls are chosen. |

> Kubernetes rolling updates reduce risk only when readiness accurately represents the application’s ability to serve traffic. The package therefore uses startup, readiness, and liveness checks instead of relying on pod process status alone. [1]

## Environment model

| Environment | Namespace | Purpose | Public ingress state | Required release control |
|---|---|---|---|---|
| Development | `tayari-development` | Structural validation and internal experimentation. | Placeholder hostname only. | Placeholder images are permitted only for manifest rendering. |
| Staging | `tayari-staging` | Full integration, synthetic candidate workflow, security-policy, and rollout validation. | Placeholder hostname until DNS/certificates are configured. | Immutable images, external secrets, smoke test, and change review. |
| Production | `tayari-production` | Controlled customer release. | Placeholder hostname until explicit DNS, TLS, WAF, and owner approvals are supplied. | Immutable images, production change approval, staging proof, release and rollback evidence. |

Each environment must use separate database, Redis, OAuth, AI-provider, telemetry, and payment credentials. Shared credentials between staging and production are prohibited because they undermine incident containment and invalidate test evidence.

## Deployment and rollback strategy

The package starts with staging-first rolling updates for the frontend, Go gateway, and Python API. Each deployment keeps at least one currently available replica during voluntary rollout, is protected by a PodDisruptionBudget, and has a revision history. PodDisruptionBudgets constrain voluntary disruptions such as node drains; they do not replace capacity planning or application health checks. [2]

Browser-capable workers use a different strategy. They run one process at a time and must be drained before scale-down because a browser action can interact with an external job site and may not be safely replayable. The worker-drain script first halts scheduled enqueueing, prints active Celery work for review, and requires an explicit confirmation before worker scale-down. The rollback script deliberately excludes database migrations, Celery beat, and worker replay.

| Change type | Initial strategy | Promotion requirement | Rollback boundary |
|---|---|---|---|
| Frontend | Rolling update | Build, test, rendered-manifest, visual smoke, HTTP health. | Previous deployment revision. |
| Go gateway | Rolling update after staging | Contract tests, authenticated synthetic path, latency/error review. | Previous deployment revision; database compatibility must remain intact. |
| Python AI API | Rolling update after staging | Synthetic non-sensitive workflow, queue/receipt/cancellation verification. | Previous deployment revision after pausing new work if needed. |
| Celery worker | Drain then replace | Active work reviewed; no unsafe replay. | Recreate prior worker image and resume after queue inspection. |
| Schema change | Expand–migrate–contract release sequence | Verified backup, compatibility, migration validation. | Recovery runbook, not a destructive automatic down-migration. |

## Security baseline

The manifests use restricted pod-security labels, non-root execution, dropped Linux capabilities, disabled privilege escalation, runtime-default seccomp, resource constraints, and disabled service-account-token mounting by default. Kubernetes security contexts and network policies are native mechanisms for workload privilege and traffic control; the exact enforcement behavior depends on the chosen cluster and network-policy provider. [3] [4]

Ingress is denied by default within the application namespace, and only the defined frontend, gateway, and Python API paths are opened. Outbound allowlisting is intentionally not made deployable in the provider-neutral base because managed PostgreSQL, Redis, object-storage, identity, AI-provider, and browser-egress addresses must be verified for the selected cloud. Production deployment is blocked until the environment owner supplies and tests a default-deny egress policy with explicit private-service and controlled browser-egress destinations.

## Secret and data boundary

The logical key contract for all sensitive configuration is documented in [`SECRETS.md`](./SECRETS.md), which defines the required and conditional keys across services rather than prescribing a single aggregate Kubernetes Secret. The manifests deliberately create no Kubernetes `Secret` resources with values. Production deployments must materialize separately named per-workload Kubernetes Secrets (e.g., `tayari-gateway-secrets`, `tayari-python-secrets`, `tayari-worker-secrets`) or explicitly key-limited external-secret projections; application service accounts and workloads are strictly prohibited from mounting or reading any Secret containing unrelated credentials. Secret management must enforce workload identity and a managed secret store, with namespace and service-account access strictly limited to the minimum required keys under least-privilege principles.

The package treats résumés, candidate-profile data, job descriptions, authentication material, browser artifacts, application answers, and audit receipts as potentially sensitive. Logs and telemetry must exclude those values. Before customer launch, the data map, retention/deletion workflow, incident communications process, and subprocessor record must be completed.

## Images and supply chain

The build script creates four images—frontend, gateway, Python API, and worker—with Buildx provenance and SBOM generation. Releases must promote the same image **digest**, not a mutable tag, from staging to production. Container scanning, SBOM retention, dependency review, and release provenance should be enforced in the organization’s CI and registry policy before a public rollout.

## Operator run sequence

1. Select the managed Kubernetes provider, region, managed PostgreSQL/Redis, ingress/WAF, registry, observability, and secret-management integrations.
2. Configure separate environment secret paths and materialize separately named per-workload Secrets or key-limited projections for the target namespace, satisfying the logical key contract in SECRETS.md.
3. Build signed or otherwise attestable images, resolve image digests, render the staging overlay, and validate it in CI.
4. Deploy staging with `scripts/deploy-environment.sh staging`, then run `scripts/smoke-test.sh staging` and the isolated staged E2E suite.
5. Record the release evidence, including test results, image digests, rendered manifest, security scan results, and owner approval.
6. Run a controlled production canary only after the production release checklist passes. Keep checkout disabled until the pricing, entitlement, and webhook acceptance gate has independently passed.

## References

[1]: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/ "Kubernetes documentation: Deployments"
[2]: https://kubernetes.io/docs/concepts/workloads/pods/disruptions/ "Kubernetes documentation: Disruptions"
[3]: https://kubernetes.io/docs/tasks/configure-pod-container/security-context/ "Kubernetes documentation: Security Context"
[4]: https://kubernetes.io/docs/concepts/security/ "Kubernetes documentation: Security"
