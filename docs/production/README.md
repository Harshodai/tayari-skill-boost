# Tayari Skill Boost — Production Documentation

This directory contains the second-pass productionization artifacts requested by the production mission. Every document must describe the current implementation and must distinguish **verified**, **locally measured**, **staging measured**, **estimated**, **target**, and **not verified** claims.

## Current release position

> **STAGING-CANDIDATE — NOT PRODUCTION-APPROVED.**

The repository-level gates, security contracts, local browser suite, local backup/restore drill, failure injection, deployment contracts, and disposable Kubernetes structural canary provide a strong release candidate baseline. They do not prove a real AWS canary, managed dependency readiness, external provider acceptance, live DNS/TLS/ingress behavior, paging delivery, cloud recovery, or production traffic safety.

The shared issue register is [`../../PRODUCTION_ISSUES.md`](../../PRODUCTION_ISSUES.md). The prior detailed readiness report and release matrix remain under `.ruthless-evidence/` because they are evidence artifacts generated during the release gate.

## Artifact index

| Artifact | Purpose | Current status |
|---|---|---|
| `ARCHITECTURE.md` | Service boundaries, trust boundaries, dependency graph, and operating topology | Created; repository-aligned |

| `PRODUCT_SPEC.md` | Public release scope, target users, critical product goals, and explicit internal-only surfaces | Created; public scope explicit |
| `FEATURE_MATRIX.md` | Feature-by-feature success, failure, permission, accessibility, and E2E coverage | Created; live gaps explicit |
| `USER_JOURNEYS.md` | Critical journey matrix with happy, invalid, failure, expiry, refresh, and concurrent cases | Created; live gaps explicit |
| `SECURITY.md` | OWASP/ASVS-oriented implementation-to-test-to-evidence matrix | Created; local controls verified |
| `THREAT_MODEL.md` | Trust boundaries, abuse cases, AI threats, data exposure, and mitigations | Created; live gaps explicit |
| `PERFORMANCE.md` | Measured performance and load results, with measured/estimated labels | Local measurements; representative load NOT VERIFIED |
| `SCALABILITY.md` | Capacity assumptions, bottlenecks, scaling strategy, and limits | Model created; production scale NOT VERIFIED |
| `OBSERVABILITY.md` | Logs, metrics, traces, dashboards, alerts, and ownership | Contract PASS; live delivery NOT VERIFIED |
| `METRICS.md` | Technical and product event definitions | Technical contract and target taxonomy created |
| `SLO.md` | SLI, SLO, window, error budget, and alert definitions | Targets documented; owner/live history pending |
| `COST_MODEL.md` | Fixed, variable, per-user, per-action, AI, storage, and observability costs | Cost drivers documented; live pricing NOT VERIFIED |
| `FINOPS.md` | Budgets, anomaly detection, unit-cost controls, and cost review cadence | Static controls documented; live telemetry pending |
| `DATA_GOVERNANCE.md` | Data classification, retention, deletion, export, logging, and third-party sharing | Created; cloud policy gaps explicit |
| `DEPLOYMENT.md` | Reproducible AWS and Kubernetes deployment contracts | Static contracts PASS; live target BLOCKED |
| `DUAL_TRACK_DEPLOYMENT_ROADMAP.md` | AWS canary, Kubernetes production, and minimal Minikube execution plan | Plan created; AWS/Kubernetes live targets BLOCKED; Minikube startup BLOCKED |
| `ROLLBACK.md` | Rollback procedure and evidence requirements | Dry-run/approval contracts PASS; live rollout NOT VERIFIED |
| `BACKUP_RECOVERY.md` | Backup frequency, retention, restore, RPO/RTO, and cloud recovery acceptance | Local restore PASS; cloud recovery NOT VERIFIED |
| `INCIDENT_RESPONSE.md` | Severity, ownership, communication, mitigation, recovery, and postmortems | Created; live ownership pending |
| `RUNBOOKS.md` | Operator procedures for the main incident classes | Created; live rehearsal pending |
| `TEST_STRATEGY.md` | Test layers, critical behavior, failure injection, and regression policy | Created; scale/live gaps remain |
| `PRODUCTION_READINESS.md` | Category-by-category readiness matrix | Created; verdict NOT READY |
| `FINAL_PRODUCTION_READINESS.md` | Evidence-indexed final report with blockers and verdict | Created; second-pass verdict NOT READY |
| `DOCKER_E2E_VERIFICATION_20260823.md` | Current local Docker topology, health, schema, API, worker, security, and E2E verification | Local Docker PASS after repairs; production NOT VERIFIED |
| `REMAINING_PRODUCTION_GAPS.md` | Prioritized P1/P2 gaps, closure evidence, and release sequence | Current blockers reviewed; verdict NOT READY |
| `WHATSAPP_APPROVALS.md` | Candidate-controlled WhatsApp approval channel, Meta setup, security, and staging acceptance | Implemented locally; live Meta acceptance blocked |

## Evidence conventions

The current evidence is split between repository-owned logs and generated local artifacts. File paths in this directory must point to reproducible commands or committed implementation files. Raw logs can remain under `.ruthless-evidence/`; production documents should summarize them and state their scope.

Use these labels consistently:

- **VERIFIED:** directly demonstrated by a reproducible test or real environment evidence.
- **LOCALLY MEASURED:** demonstrated against the local Compose or disposable target only.
- **STAGING MEASURED:** demonstrated against a real staging environment with real staging dependencies.
- **ESTIMATED:** model-based value with explicit assumptions.
- **TARGET:** desired threshold, not an observed result.
- **NOT VERIFIED:** required evidence does not yet exist.
- **BLOCKED:** verification could not proceed because a required external target, credential, or dependency was unavailable.

## Review discipline

A document is not complete because it exists. Before release approval, each artifact must match the current code and deployment manifests, include the exact command or test used, identify its owner, distinguish actual from estimated metrics, and link to the evidence that another engineer can independently inspect. Obsolete or contradictory instructions must be removed rather than left as parallel truth.
