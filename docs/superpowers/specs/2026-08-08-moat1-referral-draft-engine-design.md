# Moat-1 — Personalized Referral Draft Engine

Status: APPROVED 2026-08-08 (user). Parent: `docs/superpowers/specs/2026-08-07-five-doc-reconciliation-audit.md` + `docs/superpowers/specs/2026-08-07-v3-verified-human-badge-design.md` (architecture precedent).

## Problem
Referrals are the strongest application channel, yet users send generic "refer me pls" asks that fail. The existing `recruiter_intelligence.py` produces only templated heuristics; nothing personalizes the ask to a specific human connection.

## Design summary
A stateless Python LLM endpoint that drafts a personalized referral-request message for ONE user-supplied contact, grounded in (a) the contact record's stated relationship/notes and (b) the target job. Go proxies and validates; the frontend saves drafts through the existing Networking-page outreach flow (Supabase-managed tables — Go stays out of that ownership, same as generate-pdf being a pure proxy). Honest-scope rule: the draft may ONLY reference the relationship as stated in the record — the LLM is never allowed to invent shared history.

## Data model
**None.** Pure proxy (mirrors `/api/v1/resumes/generate-pdf`): no new table, no migration, no supabase-local sync. Storage remains the Networking page's existing `outreach_messages` flow.

## Backend
### Python (stateless)
New `backend/python/app/services/referral_service.py`:

- `POST /api/v1/referral/draft` in `app/api/ai_routes.py`.
- Body:
  - `contact`: `{name, title?, company?, relationship, notes?}` (relationship required — the honesty anchor)
  - `job`: `{title, company, description?}`
  - `user_context`: `{full_name, headline?, skills[]}`
- One LLM moderator call → `ReferralDraftVerdict {fit_score (0–100), subject, body, rationale}`.
- Prompt contract: reference ONLY `relationship`/`notes`; never invent shared employers/history/familiarity; ≤2-paragraph body; subject ≤10 words.
- No LLM → explicit `503 {"error":"ai_service_unavailable"}` (never mock — `build_provider()` contract).
- Validation: empty contact name, missing relationship, or non-JSON-safe payload → 400.

### Go (auth + validation only — no DB)
New `backend/go/internal/api/routes_referral.go`:

- `POST /api/v1/referral/draft` + `POST /api/referral/draft` (parity, registered in `routes_app.go` like generate-pdf).
- Auth → DecodeAndValidate → size guards (contact.name ≤ 200, relationship ≤ 200, notes ≤ 2000, description ≤ 8000, skills ≤ 30) → proxy `s.AI.PostJSON` → passthrough 200; upstream error → 502.
- No DB access at all — nil-DB guard not needed (PDF handler precedent).

### Tests
- Python: `tests/test_referral_service.py` — verdict parsing, relationship-injection honesty check (two drafts with different relationships must differ), blank/oversized input, LLMNotConfiguredError → 503 on endpoint.
- Go: `routes_referral_test.go` — 200 passthrough (+alias), 502 on upstream 503, 400/422 validation without upstream call.
- Parity: archive `TestRouteParity` covers both trees automatically.

## Frontend
- `src/config/features.ts`: `referralDrafts: [true, true]`; features.test.ts assertion added.
- New `src/api/referral.ts` + `src/api/referral.test.ts` (mockFetch shim pattern from RateLimiter.test.ts / verification.test.ts).
- `src/pages/Networking.tsx`: per-contact "Draft referral request" button → dialog (job context: title + company + optional JD paste, prefilled from AutoPilot job selection when available) → "Generate" → shows fit score badge + subject + body + Copy button + "Save as outreach message" (reuses the page's existing save path).
- Copy honesty: caption under dialog — "Draft references only the relationship you recorded. Review before sending."

## Honest scope / out of scope
- No LinkedIn scraping, no cold-email scraping, no auto-send. No changes to `recruiter_intelligence.py`. No persistence by Go. V3/V4/V7/Moat-2 untouched.

## Success criteria
1. Python: new tests green; full suite stays 475+ pass / 0 fail.
2. Go: new tests green; `go test ./...` green incl. parity.
3. Frontend: 155+ pass / 14 fail (cognee); build green; lint errors unchanged (51).
4. Manual smoke (LLM configured): two contacts with different relationships produce visibly different drafts; unconfigured LLM → 503.