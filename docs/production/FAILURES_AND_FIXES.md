# FAILURES AND FIXES — 2026-09-07

## F1 — Cross-tenant IDOR on push send (High)

- **Symptom**: any authenticated user could POST `/api/v1/push/send` with another user's `user_id`.
- **Root cause**: `PushSendRequest.UserID` was taken from the request body and used directly as the SQL predicate; the authenticated user in context was never compared against it (`backend/go/internal/api/routes_push.go`).
- **Impact**: cross-tenant existence/enumeration leak today (subscription match count returned to the caller); a full "push as another user" primitive once Web Push delivery is wired.
- **Fix**: reject with 403 when `targetUserID != user.ID`. Cross-user delivery must go through the internal-service-token path, matching `resolveCreditSubject` in `routes_billing.go`.
- **Verification**: `go build ./...` exit 0. **Residual risk**: no live request-level test was run (Go gateway not deployed here) — a regression test in `routes_push_test.go` is still owed (P1 in `NEXT_STEPS.md`).

## F2 — Contact form submissions unreadable (Warn)

- **Symptom**: `contact_messages` had insert-only policies; nobody, including admins, could read submissions.
- **Fix**: forward migration adding an admin-only read policy via `has_role(auth.uid(),'admin')` plus the matching grant.
- **Verification**: security scan rerun target; policy applied successfully.

## F3 — Four advertised URLs returned 404

- **Symptom**: `/resume-optimizer`, `/career-roadmap`, `/interview-prep`, `/job-search-autopilot` rendered the 404 page.
- **Root cause**: the real routes are `/resume`, `/roadmap`, `/interview/prep`, `/jobs/autopilot`; the descriptive aliases were never registered.
- **Fix**: alias redirects added in `src/App.tsx`.
- **Verification**: live Playwright run confirms each now lands on the real page (or `/auth` when the target is protected).

## F4 — Contacts/outreach writes relied solely on RLS

- **Symptom**: `.delete().eq("id", id)` / `.update().eq("id", id)` with no owner predicate in `src/pages/Networking.tsx`.
- **Impact**: not exploitable today (RLS policies are correct), but a single misconfigured migration would turn these into cross-tenant primitives.
- **Fix**: explicit `.eq("user_id", auth.user.id)` plus a signed-in guard on all three call sites.
- **Verification**: typecheck clean; behaviour unchanged for the owner.

## F5 — Misleading failure message leaked internal architecture

- **Symptom**: `InterviewBoard` told end users "Make sure Python AI engine is running."
- **Fix**: uses `isBackendUnavailable(e)` and reports an honest, user-facing unavailable state that also states nothing was saved.

## Found but NOT fixed (documented, tracked)

- `src/api/ai.ts` calls `/v1/communications/{id}/response`; the Go router registers `/api/v1/communication/response` (singular, no id). Likely a dead call → P1.
- `src/api/ai.ts` calls `/v1/saves/{id}/highlights/{id}`; no matching Go registration found → P1.
- `useBackendHealth` / `BackendUnavailableBanner` exist but are imported by **zero** pages → P2 inconsistency in degradation UX.
- Several feature flags (`negotiationCopilot`, `companyRadar`, `portfolioGenerator`, `coverLetter`, `communicationHub`, `typstStudio`, `candidateAnswerBank`, `agentReach`) are declared in `src/config/features.ts` but never read in `src/App.tsx`, so their routes mount unconditionally → P2.
- `automationControl` is `[false,false]`; `/automations` always redirects to `/resume` — dead code path → P3.
