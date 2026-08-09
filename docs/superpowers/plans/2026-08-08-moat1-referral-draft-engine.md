# Moat-1 — Referral Draft Engine: implementation plan

Parent: `docs/superpowers/specs/2026-08-08-moat1-referral-draft-engine-design.md` (APPROVED).
Executor: direct. Commit per task; gate per task.

## T1 — Python referral service
- `backend/python/app/services/referral_service.py`: `ReferralDraftVerdict` model + `run_referral_draft(contact, job, user_context)` with single `llm_json` call; honesty prompt contract; ValueError on blank/missing fields (→ 400).
- `POST /api/v1/referral/draft` in `app/api/ai_routes.py` (ReferralDraftRequest with pydantic limits).
- `tests/test_referral_service.py`: verdict parse, honesty divergence (two relationships → different bodies), missing relationship → 400, 503 on unconfigured.
- GATE: `py_compile` clean; targeted tests green; whole-repo suite 475+ pass / 0 fail.

## T2 — Go proxy routes
- `backend/go/internal/api/routes_referral.go`: POST draft + size guards; proxy passthrough; 502 on upstream error; NO DB access.
- Register `/api/v1/referral/draft` + `/api/referral/draft` in `routes_app.go`.
- `routes_referral_test.go`: 200 passthrough, alias 200, 502 upstream 503, 400/422 without upstream call.
- GATE: `go test ./...` green incl. parity.

## T3 — Frontend
- `features.ts`: `referralDrafts: [true, true]` + features.test.ts assertion.
- `src/api/referral.ts` + `src/api/referral.test.ts` (mockFetch shim).
- `src/pages/Networking.tsx`: per-contact "Draft referral request" → dialog (job title/company/JD) → fit score + subject + body + Copy + reuse existing outreach save path (supabase table flow).
- GATE: build green; lint errors unchanged (51); `bun run test` = 155+ pass / 14 fail.

## T4 — Memory
- `lessons.md` + `.superpowers/sdd/progress.md`; commit.
- GATE: files present; working tree clean except `supabase/functions/mcp/index.ts`.

Acceptance: all gates + manual-smoke predictions (relationships change drafts; 503 without LLM) documented in T4.