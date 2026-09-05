# Tayari Documentation Repository

This directory serves as the centralized, canonical documentation hub for the **Tayari Skill Boost** platform. The documentation is organized into five canonical pillars designed for production clarity, auditability, and engineering velocity.

---

## 🏛️ The 5 Pillars of Tayari Documentation

```
docs/
├── architecture/         # Pillar 1: System design, entity graphs, topologies, protocols
├── operations/           # Pillar 2: Operational procedures, status, recovery inventories
│   └── runbooks/         #           Executable release, recovery, and performance runbooks
├── compliance/           # Pillar 3: Security specifications, remediation, data handling, AI policy
├── research/             # Pillar 4: Competitive research, deployment benchmarks, intelligence
│   └── deployment/       #           Infrastructure benchmarks, provider evaluations
├── audits/               # Pillar 5: Formal verification, safety benchmarks, evidence matrices
└── archive/              #           Historical audits, remediation logs, and legacy wave reports
```

---

### 1. Architecture (`docs/architecture/`)
System topologies, agent interfaces, data contracts, and design specifications.
- [`Job_Tayari_Entity_Card.md`](./architecture/Job_Tayari_Entity_Card.md) — Canonical entity definitions and core domain models.
- [`MANUS_STYLE_OPEN_CORE_ARCHITECTURE.md`](./architecture/MANUS_STYLE_OPEN_CORE_ARCHITECTURE.md) — Open-core architecture and automation execution engine.
- [`api_resume_graph.md`](./architecture/api_resume_graph.md) — Resume knowledge graph schema and API contract.
- [`extension-agent-expansion.md`](./architecture/extension-agent-expansion.md) — Browser companion extension integration and expansion architecture.
- [`worker-topology.md`](./architecture/worker-topology.md) — Worker concurrency, queue topology, and async processing contracts.

### 2. Operations & Runbooks (`docs/operations/`, `docs/operations/runbooks/`)
Production operations, deployment infrastructure, environment configurations, and step-by-step procedures.

#### Operations
- [`DESKTOP_STATUS.md`](./operations/DESKTOP_STATUS.md) — Desktop client packaging, runtime status, and hardening posture.
- [`recovery-inventory.md`](./operations/recovery-inventory.md) — Comprehensive recovery domain inventory (application DB, auth, storage, secrets, Redis).
- [`backup-and-recovery.md`](./operations/backup-and-recovery.md) — Automated backup mechanisms and restore validation procedures.
- [`production-deployment-observability-checklist.md`](./operations/production-deployment-observability-checklist.md) — Production readiness and telemetry verification checklist.
- [`staging-external-integrations.md`](./operations/staging-external-integrations.md) — External provider staging setup and verification.
- [`tayari-computer-staging.md`](./operations/tayari-computer-staging.md) — Computer-use staging environment specifications.

#### Runbooks (`docs/operations/runbooks/`)
- [`MACOS_RELEASE_RUNBOOK.md`](./operations/runbooks/MACOS_RELEASE_RUNBOOK.md) — macOS desktop packaging, notarization, codesigning, and release gate verification.
- [`CROSS_PLATFORM_DESKTOP_RELEASE_RUNBOOK.md`](./operations/runbooks/CROSS_PLATFORM_DESKTOP_RELEASE_RUNBOOK.md) — Multi-platform desktop build and distribution guidelines.
- [`Synthetic_Performance_Runbook.md`](./operations/runbooks/Synthetic_Performance_Runbook.md) — Synthetic load testing, latency benchmarking, and performance regressions.
- [`restore.md`](./operations/runbooks/restore.md) — Database backup restoration drill and schema verification procedures.

### 3. Compliance & Security (`docs/compliance/`)
Data handling boundaries, human-in-the-loop security constraints, and compliance policies.
- [`Security_and_Data_Handling.md`](./compliance/Security_and_Data_Handling.md) — Human-in-the-loop (HITL) boundaries, credential governance, and PII lifecycle.
- [`SECURITY_FINDINGS_TOP_REMEDIATION.md`](./compliance/SECURITY_FINDINGS_TOP_REMEDIATION.md) — Prioritized security remediation log and mitigation tracking.
- [`ai-provenance-policy.md`](./compliance/ai-provenance-policy.md) — AI inference attribution, watermarking, and generation provenance standards.
- [`ai-provenance-ontology.md`](./compliance/ai-provenance-ontology.md) — Semantic ontology for tracking AI agent reasoning and generation steps.

### 4. Research & Intelligence (`docs/research/`)
Market intelligence, provider comparisons, technical feasibility studies, and deployment research.
- [`deployment/AWS_FREE_TIER_RESEARCH.md`](./research/deployment/AWS_FREE_TIER_RESEARCH.md) — Low-cost AWS infrastructure research, free tier boundaries, and EC2 canary budgets.
- [`manus_architecture_sources.md`](./research/manus_architecture_sources.md) — Primary source notes and architecture references for autonomous operator models.
- [`apify-firecrawl-evidence-2026-08.md`](./research/apify-firecrawl-evidence-2026-08.md) — Web scraping provider benchmarks (Apify vs Firecrawl vs Hermes).
- [`claude_cowork_primary_source_notes_2026.md`](./research/claude_cowork_primary_source_notes_2026.md) — Comparative notes on collaborative agent workflows.
- [`hermes_reference_implementation_notes_2026.md`](./research/hermes_reference_implementation_notes_2026.md) — Multi-tiered job board extraction notes and circuit breaker behavior.

### 5. Audits & Archive (`docs/audits/`, `docs/archive/`)
Verification evidence, third-party benchmarks, and historical progression logs.
- [`audits/END_TO_END_AUDIT_INDEX.md`](./audits/END_TO_END_AUDIT_INDEX.md) — Master index of all formal security, architecture, and readiness audits.
- [`audits/jobtayari-10-confidence-evidence-matrix.md`](./audits/jobtayari-10-confidence-evidence-matrix.md) — 10/10 confidence criteria and verification proof.
- [`audits/jobtayari-ruthless-external-audit.md`](./audits/jobtayari-ruthless-external-audit.md) — External third-party assessment and hardening findings.
- [`archive/`](./archive/) — Historical wave reports, superseded audit plans, and previous migration milestones.

---

## 📂 Additional Specialized Directories

- [`docs/business/`](./business/) — Commercial storytelling, market positioning, and investor readiness.
- [`docs/reports/`](./reports/) — Automated and manual verification reports, parity assessments, and test logs.
- [`docs/production-readiness.md`](./production-readiness.md) — *(Release Gate Invariant)* Evaluated directly by CI gate tests (`scripts/release_contract_test.sh`).

---

## 🔗 Backward Compatibility Symlinks

For toolchains, CI workflows, and legacy links that expect paths at previous locations:
- `docs/MACOS_RELEASE_RUNBOOK.md` → `operations/runbooks/MACOS_RELEASE_RUNBOOK.md`
- `docs/runbooks/restore.md` → `../operations/runbooks/restore.md`
- `docs/recovery-inventory.md` → `operations/recovery-inventory.md`
