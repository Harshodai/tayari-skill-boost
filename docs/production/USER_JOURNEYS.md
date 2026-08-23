# Tayari Skill Boost — Critical User Journeys

This matrix is the second-pass acceptance model for the public release. `LOCALLY VERIFIED` means the behavior was exercised against the local stack or disposable canary; it does not mean production approval.

| Journey | Happy path | Required adverse cases | Deterministic end state | Evidence status |
|---|---|---|---|---|
| First visit | User understands the product and public scope | Slow load, missing API, narrow viewport, console errors | Public page renders with truthful scope and usable navigation | LOCALLY VERIFIED; production edge NOT VERIFIED |
| Signup | User creates an account through the configured Auth path | Weak password, duplicate email, malformed input, network failure, refresh | Visible validation/error; no partial account claim | LOCALLY VERIFIED; real production Auth NOT VERIFIED |
| Login/session | User logs in, refreshes, and resumes authenticated navigation | Wrong password, expired session, `401`, back/forward, browser restart | Session is either valid or visibly cleared; no synthetic identity | LOCALLY VERIFIED; production Auth NOT VERIFIED |
| Resume upload | User uploads a valid resume and receives processing state | Unsupported type, oversized file, empty file, slow OCR, storage failure | Upload is bounded; failure is visible; no silent data loss | PARTIAL; production storage NOT VERIFIED |
| Resume optimization | User selects a target role and receives a reviewable result | Provider timeout, malformed output, retry, duplicate click, budget exceeded | Result or controlled error; no fabricated candidate facts | LOCALLY VERIFIED; live provider acceptance BLOCKED |
| Job search/triage | User searches, filters, saves, and reviews a job | Empty results, provider outage, rate limit, duplicate save, stale page | Empty/error/retry state is explicit; saved state is owner-scoped | LOCALLY VERIFIED; live provider acceptance BLOCKED |
| Cover letter | User generates and edits a draft | Missing role, provider error, repeated request, session expiry | Reviewable draft or actionable error; no false success | PARTIAL; live provider acceptance BLOCKED |
| Roadmap/skill gaps | User views a persisted roadmap and progress | Empty profile, stale data, dependency outage, unauthorized ID | Owner-scoped result or visible unavailable state | LOCALLY VERIFIED; scale/production dependency NOT VERIFIED |
| Candidate answer bank | User reviews and confirms an answer for a current application | Database outage, expired answer, changed application, cross-user ID | Safe pause/error; no automatic sensitive answer reuse | LOCALLY VERIFIED by contracts; real staging NOT VERIFIED |
| Task/plan review | User reviews a plan and observes durable task state | Duplicate creation, cancellation, worker outage, lease expiry | Paused/failed/completed state is durable and understandable | LOCALLY VERIFIED; production worker/provider NOT VERIFIED |
| External handoff/submission | User explicitly approves a handoff and later inspects evidence | Missing approval, cancellation, portal failure, duplicate retry | No autonomous submission; candidate-confirmed and externally-verified remain distinct | Manual-submit boundary verified; real external portal NOT VERIFIED |
| Settings/privacy | User edits profile, exports/deletes account data | Unauthorized ID, deletion outage, retry, stale session | Owner-scoped, auditable result; failure is not presented as deletion success | Synthetic hostile privacy evidence; managed staging NOT VERIFIED |
| Pricing/billing | User views truthful plan/billing state | Payment decline, duplicate action, webhook replay, provider outage | No fake payment success; visible retry/support path | NOT VERIFIED for live billing |
| Mobile/accessibility | User operates public journey at narrow viewport with keyboard | Focus loss, dialog navigation, touch overlap, long text | Keyboard and touch operation remain usable | Local E2E/screenshot evidence; full device matrix NOT VERIFIED |

## Acceptance procedure

For each journey, run the happy path, invalid input, empty input, large input, duplicate submission, slow network, backend failure, third-party failure, session expiry, permission failure, refresh, back button, browser restart, and concurrent-activity cases where applicable. Capture the request/response behavior, visible UI state, persisted state, logs/metrics, and cleanup result.

## Current high-risk journeys

The most sensitive paths are resume upload and optimization, candidate answer confirmation, task cancellation, external handoff, account deletion, and billing. Their release status depends on durable owner scope, explicit error states, idempotency, data lifecycle controls, and live dependency evidence. They must not be upgraded from local evidence to production-ready by inference.

## References

- `README.md` — public release focus and service topology.
- `src/config/features.ts` — current route and feature inventory.
- `.agents/AGENTS.md` — user identity, sensitive answer, and manual-submit rules.
- `.ruthless-evidence/security/final_playwright_e2e_hardened.log` — local browser evidence.
- `.ruthless-evidence/security/staging_hostile_evidence_final.json` — synthetic adversarial evidence.
- `PRODUCTION_ISSUES.md` — unresolved live-environment issues.
