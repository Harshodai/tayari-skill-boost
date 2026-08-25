# JobTayari Attached World-Class Gaps — Ruthless Implementation Backlog

**Review date:** 25 August 2026
**Status:** Working backlog for the next verified engineering loops

## Prioritization rule

The first priority is work that improves user value and production safety without requiring live credentials. The second priority is deterministic contracts and tests that make external staging measurable. The final priority is evidence that cannot be honestly generated inside the repository: managed infrastructure, live providers, real payment processing, signed artifacts, and disposable browser portals.

| Priority | Workstream | First implementation slice | Required evidence | Current decision |
|---|---|---|---|---|
| P0 | Memory correction loop | Owner-scoped correction, source, confidence, expiry, deletion, and negative tests | Two-user persistence and purge tests | Implement now |
| P0 | Durable swarm recipes | Map existing review-first recipes to bounded specialists with child state, replay, timeout, and approval boundaries | Worker restart/reclaim and deterministic replay | Implement now |
| P0 | Billing and cost integrity | Preserve fail-closed billing, add model/provider cost envelopes, usage ceilings, and aggregate economics counters | Live Stripe test mode and provider cost samples | Implement now, live gate later |
| P0 | Safety and provenance | Ensure every artifact and external callback has owner, trace, source, version, and approval state | Redacted logs and two-user negatives | Implement now |
| P1 | Retrieval evaluation | Versioned consent-safe relevance fixtures and NDCG/Recall@K/family precision thresholds | Labeled staging benchmark | Implement now |
| P1 | Preparation outcomes | Record user-confirmed practice completion, confidence, correction, and outcome signals without raw content | Consent and retention tests | Implement now |
| P1 | Connector lifecycle | Scope, consent, rotation, revoke, outage, replay, deletion contracts for one connector at a time | Real provider acceptance | Contract first; provider later |
| P1 | Browser staging | Disposable profile install, PKCE, origin/tab grant, redaction, stop/revoke, manual handoff | Real Chrome plus disposable ATS | External gate |
| P1 | Accessibility/performance | Keyboard/screen-reader checks, slow-network profile, route-level performance budgets | Automated and manual evidence | Implement checks now |
| P1 | Production evidence | CI secrets, immutable digests, SBOM, attestation, PITR, alert/page, rollback drills | Cloud evidence tied to one SHA | External gate |

## Non-negotiable boundaries

No implementation in this backlog may transfer Chrome cookies or saved passwords, enter passwords or OTP/MFA/CAPTCHA values, make legal/work-authorization/salary/EEO declarations, create external accounts, or submit applications without an explicit candidate-controlled handoff. Disabled connectors remain disabled until the user provides provider authorization and the separate lifecycle tests pass.

## Completed in the current loop

The repository now includes a forward migration and owner-scoped memory-control service for learned signals. Users can inspect recent preference signals, disable or restore a signal, set confidence and expiry metadata, or delete the signal. Preference learning excludes inactive and expired rows, and the Settings surface exposes these controls with visible success and failure feedback. The implementation is covered by Python tests and is routed through the authenticated Go gateway.

A pure, versioned retrieval-evaluation module now computes NDCG@K, Recall@K, and role-family precision over approved opaque-ID fixtures. Four explicit review-first specialist recipes now describe bounded roles for application packets, opportunity sweeps, interview sprints, and follow-up radar, with credential and external-write permissions denied in each child input. These contracts are tested, but real benchmark labels, durable child persistence, worker replay, and staging evidence remain open.

## Recommended loop order

Begin with memory corrections and durable swarm child state because they directly improve trust, personalization, and advanced-agent value. Follow with evaluation and preparation outcomes so quality and retention can be measured. Then add provider-cost envelopes and accessibility/performance contracts. Use the resulting artifacts to drive live staging, connector, browser, billing, backup, and capacity evidence rather than claiming those gates are closed from local tests.
