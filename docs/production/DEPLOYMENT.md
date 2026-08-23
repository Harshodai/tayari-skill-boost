# Tayari Skill Boost — Deployment

## Release artifact

Deploy only a reviewed commit with provenance-backed, signed immutable image digests for Redis, Python API, worker, Go gateway, frontend, and Caddy. Host builds, mutable tags, local images, and unreviewed configuration are rejected by the release contracts.

## AWS EC2 canary

The intended low-cost path is a single EC2 canary with Caddy as the only public edge, Go behind `/api`, private Python/Redis, and external managed PostgreSQL/Auth. The operator must create a budget, choose the region/VPC/subnet/AMI, restrict SSH to a narrow CIDR or prefer SSM, encrypt the root volume, materialize `deploy/aws/.env` outside Git with mode `0600`, and provide the six immutable image digests.

Run `deploy/aws/provision.sh` only after reviewing its plan and budget guard. Then run `deploy/aws/deploy.sh config`, inspect the rendered non-secret configuration, and run `deploy/aws/deploy.sh up`. Validate public TLS, health/readiness, authenticated smoke workflows, metrics access, provider probes, worker/queue behavior, backup freshness, rollback, and cleanup. The current environment has no AWS target or credential context, so this procedure is documented but not live-verified.

## Kubernetes

Use the staging overlay before production. The operator must supply a real cluster context, namespace, secret-manager integration, private registry pull permissions, immutable digests, Caddy/ingress/DNS/TLS configuration, network policy, autoscaling limits, PodDisruptionBudget, and production approval evidence. Readiness must include real managed DB/Auth/Redis reachability; process liveness is insufficient.

The disposable Minikube structural canary validated manifest/runtime behavior and found the expected unresolved database dependency. It did not constitute managed staging readiness or production approval.

## Environment separation

Staging and production credentials, domains, databases, Auth projects, Redis instances, provider accounts, signing keys, and telemetry destinations must not be shared. Secret values must never be committed or copied into evidence logs. The exact release SHA and image digests must be attached to the environment evidence.

## References

- `deploy/aws/README.md` — AWS runbook.
- `deploy/aws/provision.sh` and `deploy/aws/deploy.sh` — AWS gates.
- `infra/k8s/SECRETS.md` — Kubernetes secret contract.
- `docs/Deployment_Architecture.md` — workload topology and rollout model.
- `.ruthless-evidence/productionization/stage_a_external_blockers.log` — AWS blocker evidence.
- `.ruthless-evidence/productionization/stage_b_admission_blockers.log` — Kubernetes blocker evidence.
