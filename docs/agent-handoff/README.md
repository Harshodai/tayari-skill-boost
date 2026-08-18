# JobTayari Agent-Ready Package

Load these files in order before continuing research or implementation:

| Order | File | Purpose |
|---|---|---|
| 1 | [`jobtayari-agent-handoff.md`](./jobtayari-agent-handoff.md) | Repository mission, architecture rules, completed controls, no-go boundaries, commands, and continuation instructions. |
| 2 | [`jobtayari-research-brief.md`](./jobtayari-research-brief.md) | Research questions, source hierarchy, fact-check rules, prohibited assumptions, and required deliverables. |
| 3 | [`../audits/jobtayari-10-confidence-evidence-matrix.md`](../audits/jobtayari-10-confidence-evidence-matrix.md) | Feature-by-feature implementation and evidence status. |
| 4 | [`../audits/jobtayari-standards-evidence.md`](../audits/jobtayari-standards-evidence.md) | Standards source log and control mapping. |
| 5 | [`../governance/ai-system-inventory.yml`](../governance/ai-system-inventory.yml) | Machine-readable AI-system inventory and lifecycle states. |
| 6 | [`staging-evidence-template.json`](./staging-evidence-template.json) | Redacted staging evidence schema template; replace placeholders only after real staging runs. |
| 7 | [`../operations/tayari-computer-staging.md`](../operations/tayari-computer-staging.md) | Computer, provider, tenant, privacy, and recovery staging procedure. |

## First commands

```bash
cd /home/ubuntu/tayari-skill-boost
python3 scripts/verify_ai_system_inventory.py
python3 scripts/verify_production_truth_contract.py
python3 scripts/verify_staging_evidence_bundle.py --plan
python3 scripts/verify_recovery_evidence.py --plan
bash scripts/release_contract_test.sh
```

## Handoff status vocabulary

Use only these states in research and implementation reports:

| State | Meaning |
|---|---|
| `implemented` | Code exists and deterministic tests pass. |
| `staging_required` | Code and local contracts exist, but real deployment/provider evidence is missing. |
| `configured_unverified` | Required configuration is present, but no live probe has been authorized or completed. |
| `blocked_external` | Completion depends on credentials, a real provider, a real browser, a deployment, or an independent reviewer. |
| `disabled_by_policy` | Intentionally unavailable due to launch scope or safety policy. |
| `not_implemented` | No credible implementation exists yet. |
| `contradicted` | A product claim conflicts with runtime behavior or evidence. |

Do not replace `staging_required`, `blocked_external`, or `disabled_by_policy` with “ready.”
