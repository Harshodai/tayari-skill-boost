# Tayari Skill Boost — Product Specification

## Product definition

Tayari is a reviewable job-application workspace that turns a candidate’s resume and a target role into evidence-backed, candidate-approved application materials. The product’s trust promise is visible provenance: users can distinguish what was generated, what they reviewed, what they approved, and what is externally verified.

## Current public release scope

| Capability | User goal | Success condition | Current status |
|---|---|---|---|
| Resume optimizer | Tailor a resume to a target role | User receives a bounded, truthful optimization result with source context and clear error handling | Enabled; local/E2E evidence exists |
| Opportunity triage | Find and rank relevant jobs | User can search/filter and inspect bounded job results with provider-aware failure behavior | Enabled; live provider acceptance pending |
| Cover-letter drafting | Create a role-specific draft | User receives a reviewable draft without fabricated candidate facts | Enabled; production provider readiness pending |
| Career roadmap | Understand skill gaps and next steps | User sees a persisted, owner-scoped roadmap result | Enabled; real production dependency readiness pending |
| Candidate-controlled review | Review and approve generated artifacts | User can edit/confirm content and see its provenance/status | Enabled; manual-submit boundary mandatory |
| Tay Workspace | Review natural-language task plans and durable task state | User sees a reviewable plan and explicit transitions; no autonomous final submission | Enabled in current configuration; operational evidence pending |

## Explicitly excluded from the public promise

Interview AI, voice coaching, autonomous computer control, desktop agent execution, Google Calendar/Drive connectors, and automation workspace behavior remain disabled or preview/internal-only until their provider, isolation, cancellation, cost, and real-environment evidence gates are closed. Browser automation may exist in the repository, but it is not a license to perform autonomous external submissions.

## Non-functional product requirements

The system must preserve verified identity and owner scope; must present understandable loading, empty, and error states; must avoid fabricated profile/application data; must make irreversible external actions human-approved; must show external verification separately from candidate confirmation; and must fail closed when durable state, approval, or critical dependencies are unavailable.

## Acceptance criteria

A public workflow is complete only when its happy path, invalid input, empty state, large input, duplicate action, slow dependency, backend failure, provider failure, expired session, permission failure, refresh, back/forward navigation, and mobile layout are deterministic and user-understandable. The feature must have owner-scoped persistence, a meaningful regression test, accessibility coverage, and documented evidence.

## Current gaps

The repository has strong local functional and security evidence, but live managed dependency readiness, provider acceptance, public ingress, cloud recovery, measured scale, and product-value metrics remain blocked or not verified. Those are tracked in [`PRODUCTION_ISSUES.md`](../../PRODUCTION_ISSUES.md).

## References

- `README.md` — product description and current release focus.
- `src/config/features.ts` — current feature flags and navigation.
- `.agents/AGENTS.md` — truthfulness and human-control rules.
- `.ruthless-evidence/PRODUCTION_READINESS_REPORT.md` — verified release scope and blockers.
