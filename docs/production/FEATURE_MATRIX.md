# Tayari Skill Boost — Feature Matrix

Statuses use the repository’s evidence vocabulary: **VERIFIED**, **LOCALLY MEASURED**, **PARTIAL**, **BLOCKED**, and **NOT VERIFIED**. A feature is not public-production complete merely because its route renders.

| Feature | Entry point | Core success | Loading/empty/error | Persistence & permissions | Accessibility/mobile/E2E | Release status |
|---|---|---|---|---|---|---|
| Resume optimizer | `/resume` | Bounded role-specific optimization with truthful candidate data | Local browser suite covers loading/error behavior; provider acceptance pending | Owner-scoped resume/application data | Local E2E and screenshot coverage; representative mobile/performance measurement pending | PARTIAL — live provider/dependency evidence open |
| Job search / triage | `/jobs` | Search and inspect bounded opportunities | Provider tiers and circuit breakers exist; live provider budgets pending | Owner-scoped saved jobs and feedback | Local route/E2E evidence; live provider acceptance pending | PARTIAL |
| Cover letter | `/cover-letter` | Generate a reviewable draft without fabricated facts | Controlled API errors and retry states required | Owner-scoped draft persistence | Local validation; full live provider acceptance pending | PARTIAL |
| Career roadmap | `/roadmap` | Persisted roadmap and skill-gap result | Controlled loading/empty/error behavior | Owner-scoped roadmap progress | Local route coverage; scale/performance evidence pending | PARTIAL |
| Candidate answer bank | `/answer-bank` | Review and confirm versioned answers for a current application | Fail-closed when storage is unavailable; stale answers must not silently autofill | Owner, provenance, sensitivity, application context, expiry | Contract and local browser evidence; real staging dependency evidence pending | PARTIAL |
| Tay Workspace | `/tay` | Review a plan and observe durable task state | Error/paused/handoff states must be explicit | Owner-scoped durable task/control state | Local tests exist; production worker/provider evidence pending | PARTIAL / INTERNAL RISK |
| Communication hub | `/communication` | Prepare reviewable message templates | Provider/network failures must be visible | Owner-scoped records | Local route evidence; provider evidence pending | PARTIAL |
| Pricing/subscription | `/pricing` | Show truthful plans and billing state | Payment failures must be visible; no fake success | Authenticated/account-scoped billing state | Local route/E2E evidence; live billing verification not performed | NOT VERIFIED for live billing |
| Account deletion/privacy purge | Settings/profile flow | Durable deletion request and privacy purge behavior | Storage failures must not appear as successful deletion | Owner-scoped audit and purge records | Hostile privacy suite passes synthetically; real staging evidence pending | PARTIAL |
| Browser/computer control | `/control-room`, `/desktop` | No public autonomous external submission | Cancellation and human handoff must be durable | Owner-scoped run and approval state | Local cancellation contracts; real portal isolation not verified | DISABLED / PREVIEW-ONLY |
| Google Calendar/Drive | Direct connector surfaces | Connector action only after provider and user authorization | Provider failure must be explicit | OAuth state and owner scope | Provider configuration absent | DISABLED |

## Cross-feature acceptance rules

Every public feature must be covered by authenticated and unauthenticated boundary tests, two-user ownership negatives where data is user-owned, duplicate submission behavior, session expiry, refresh/back-forward behavior, mobile viewport checks, and visible non-2xx error states. Expensive AI or external-provider features must additionally have request budgets, timeout/retry limits, cost attribution, and a safe disabled state.

## Current evidence boundary

The local Playwright suite completed 39 tests with 14 intentional skips, and the hostile suite completed 34/34 synthetic checks. These results are valuable local evidence but do not prove live provider behavior, production billing, managed dependency reachability, or production traffic safety. See [`PRODUCTION_ISSUES.md`](../../PRODUCTION_ISSUES.md).

## References

- `src/config/features.ts` — current feature flags and routes.
- `README.md` — public release focus and internal evaluation surfaces.
- `.ruthless-evidence/security/final_playwright_e2e_hardened.log` — final local browser result.
- `.ruthless-evidence/security/staging_hostile_evidence_final.json` — synthetic hostile evidence bundle.
