# Infrastructure Architecture & Unified Layout

This directory unifies all infrastructure, orchestration, containerization, routing, security, and deployment assets for Tayari Skill Boost across local, canary, Kubernetes, and cloud environments.

## Directory Structure

```
infra/
├── containers/        # Dockerfiles and container configurations
├── k8s/               # Kubernetes manifests (base, overlays, optional)
├── helm/              # Helm chart definitions for Kubernetes deployments
├── routing/           # Reverse proxy, ingress, and routing definitions
├── observability/     # Metrics, Prometheus alerting rules, and monitors
├── security/          # Security baselines, scanner baselines, and policies
├── aws/               # AWS deployment automation (symlink to deploy/aws)
└── endpoint-exposure.yml # Exposure definitions and API routing policy
```

---

## Component Overviews

### 1. Containers (`infra/containers/`)
Houses container images and specifications for all stack tiers:
- `frontend.Dockerfile`: Multi-stage build for the Vite/React SPA frontend.
- `go-gateway.Dockerfile`: Minimal Alpine-based image for the Go API gateway (`backend/go`).
- `python-api.Dockerfile`: Python 3.11 environment with dependencies for NLP, inference, and scraping (`backend/python`).
- `worker.Dockerfile`: Celery worker image executing background workflows, resume processing, and scraping.
- `nginx.conf`: Container-internal reverse proxy and routing configuration.

### 2. Kubernetes (`infra/k8s/`)
Declarative Kubernetes orchestration organized with Kustomize:
- `base/`: Canonical deployment definitions, services, configmaps, and resource limits.
- `overlays/`: Environment-specific patches (`production`, `staging`).
- `optional/`: Addons and auxiliary cluster services.
- `SECRETS.md`: Secret injection, SOPS/SealedSecret management protocols, and runtime credential hydration.
- `README.md`: Detailed operations manual for cluster operators.

### 3. Helm (`infra/helm/`)
Helm packaging for standardized cluster releases:
- `tayari/`: The core application chart with parameterized `values.yaml` and modular templates.
- **Root Compatibility**: `helm -> infra/helm` symlink preserves backward compatibility with legacy automation and deployment scripts.

### 4. Routing (`infra/routing/`)
Unified gateway and ingress configuration layer:
- `Caddyfile -> ../../Caddyfile`: Canonical reverse proxy specification with automatic TLS and path-based routing (`/api/*` to Go gateway, `/` to frontend).
- `nginx.conf -> ../../nginx.conf`: Nginx reverse proxy configuration.
- **Preserved Invariant**: The repository root files (`Caddyfile`, `nginx.conf`) remain authoritative so that Docker Compose volume mounts and container build contracts function without modification.

### 5. Observability (`infra/observability/`)
System health and operational telemetry:
- `alerts.yml`: Prometheus alerting rules covering 5xx error budgets, latency SLOs, Redis queue backlog thresholds, and worker crash loops.

### 6. Security (`infra/security/`)
Automated security posture, compliance rules, and static analysis:
- `baseline.json`: Canonical findings baseline enforced by `bun run security:production` (`scripts/security_scan.mjs`). Ensures zero unresolved critical or high severity vulnerabilities.
- **Root Compatibility**: `security/baseline.json -> ../infra/security/baseline.json` preserves the scanner contract.

### 7. AWS Deployment (`infra/aws/` -> `../deploy/aws`)
Low-cost AWS single-node canary and deployment scripts:
- `ec2-canary.yaml`: CloudFormation template for provisioning the single EC2 canary host.
- `provision.sh` & `deploy.sh`: Provisioning and deployment orchestration with SSM, volume encryption, and strict operator CIDR boundaries.
- `create-budget.sh`: Strict billing alert enforcement before launch.
- `backup.sh`: PostgreSQL/Supabase snapshot automation.
- **Preserved Invariant**: `deploy/aws/` remains the canonical source directory to ensure release promotion gates and release contract assertions pass.
