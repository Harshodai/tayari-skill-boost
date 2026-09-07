# JobTayari Attached World-Class Gaps — Ruthless Implementation Backlog

**Review date:** 25 August 2026
**Status:** Working backlog for the next verified engineering loops

## Prioritization rule

The first priority is work that improves user value and production safety without requiring live credentials. The second priority is deterministic contracts and tests that make external staging measurable. The final priority is evidence that cannot be honestly generated inside the repository: managed infrastructure, live providers, real payment processing, signed artifacts, and disposable browser portals.

| Priority | Workstream | First implementation slice | Required evidence | Current status |
|---|---|---|---|---|
| P0 | Memory correction loop | Owner-scoped correction, source, confidence, expiry, deletion, and negative tests | Two-user persistence and purge tests | **IMPLEMENTED IN CODE** (`memory_controls.py`, `Settings.tsx`, `20260825130000_memory_correction_controls.sql`) |
| P0 | Durable swarm recipes | Map existing review-first recipes to bounded specialists with child state, replay, timeout, and approval boundaries | Worker restart/reclaim and deterministic replay | **IMPLEMENTED IN CODE** (`swarm_recipes.py`, `20260825140000_agent_task_children.sql`) |
| P0 | Billing and cost integrity | Preserve fail-closed billing, add model/provider cost envelopes, usage ceilings, and aggregate economics counters | Live Stripe test mode and provider cost samples | **PARTIALLY IMPLEMENTED** (Credit billing & operation budget in code; live Stripe pending) |
| P0 | Safety and provenance | Ensure every artifact and external callback has owner, trace, source, version, and approval state | Redacted logs and two-user negatives | **IMPLEMENTED IN CODE** (`workflow_stage_envelope.py`, `20260825_01_candidate_spine_envelope.sql`) |
| P1 | Retrieval evaluation | Versioned consent-safe relevance fixtures and NDCG/Recall@K/family precision thresholds | Labeled staging benchmark | **IMPLEMENTED IN CODE** (`retrieval_evaluation.py`, `test_retrieval_evaluation.py`) |
| P1 | Preparation outcomes | Record user-confirmed practice completion, confidence, correction, and outcome signals without raw content | Consent and retention tests | **IMPLEMENTED IN CODE** (`practice_outcomes.sql`, `20260903_02_outcome_events.sql`) |
| P1 | Connector lifecycle | Scope, consent, rotation, revoke, outage, replay, deletion contracts for one connector at a time | Real provider acceptance | **PARTIALLY IMPLEMENTED** (Gmail service hardened; OAuth configs absent) |
| P1 | Browser staging | Disposable profile install, PKCE, origin/tab grant, redaction, stop/revoke, manual handoff | Real Chrome plus disposable ATS | **PARTIALLY IMPLEMENTED** (Safety primitives in code; external portal testing held) |
| P1 | Accessibility/performance | Keyboard/screen-reader checks, slow-network profile, route-level performance budgets | Automated and manual evidence | **IMPLEMENTED IN CODE** (`TruthfulnessAccessibility.test.tsx`, `perf_check.sh`, `check_bundle_budget.mjs`) |
| P1 | Production evidence | CI secrets, immutable digests, SBOM, attestation, PITR, alert/page, rollback drills | Cloud evidence tied to one SHA | **PARTIALLY IMPLEMENTED** (All verification scripts exist; cloud runner pending) |

## Non-negotiable boundaries

No implementation in this backlog may transfer Chrome cookies or saved passwords, enter passwords or OTP/MFA/CAPTCHA values, make legal/work-authorization/salary/EEO declarations, create external accounts, or submit applications without an explicit candidate-controlled handoff. Disabled connectors remain disabled until the user provides provider authorization and the separate lifecycle tests pass.

## Completed in the codebase

The repository now includes a forward migration and owner-scoped memory-control service for learned signals (`memory_controls.py`, `Settings.tsx`). Users can inspect recent preference signals, disable or restore a signal, set confidence and expiry metadata, or delete the signal.

A pure, versioned retrieval-evaluation module now computes NDCG@K, Recall@K, and role-family precision over approved fixtures (`retrieval_evaluation.py`). Four explicit review-first specialist recipes describe bounded roles for application packets, opportunity sweeps, interview sprints, and follow-up radar (`swarm_recipes.py`), backed by durable child task persistence (`20260825140000_agent_task_children.sql`).

Practice outcome loops are durably persisted in `practice_outcomes.sql` and `20260903_02_outcome_events.sql`. Candidate-controlled stage envelopes (`workflow_stage_envelope.py`, `20260825_01_candidate_spine_envelope.sql`) and canonical state machines (`application_lifecycle.py`, `20260903_01_canonical_application_state_machine.sql`) are implemented and tested in the backend. Live cloud staging and provider credential gates remain the external prerequisite for cloud promotion.
