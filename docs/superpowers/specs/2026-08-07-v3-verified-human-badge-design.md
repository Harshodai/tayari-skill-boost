# V3 — "Verified by Tayari" Candidate Badge

Status: APPROVED 2026-08-07 (user). Parent: `docs/superpowers/specs/2026-08-07-five-doc-reconciliation-audit.md` (V3).

## Problem
Resumes claim skills with zero evidence. Recruiters assume AI-generated mass applications. The differentiator that survives the AI flood is a *verifiable signal*: claims checked for truthfulness + technical screening, attested by the platform.

## Design summary
A per-user verification record produced by two stateless Python AI checks (truthfulness of claims, technical screening depth), persisted by Go (authoritative per ADR-0003), surfaced as a badge + score breakdown on the Profile page. No recruiter/employer API in this MVP — badge means *exactly* "claims truth-checked + passed AI screening". UI copy states that and nothing more (claims-vs-evidence rule).

## Data model
New table `public.candidate_verification` (migration `20260807_verified_human_badge.sql`):

| column | type | notes |
|---|---|---|
| user_id | UUID PK | identity from JWT (`sub`), no FK — matches house pattern |
| status | VARCHAR(20) NOT NULL default 'unverified' | `unverified` \| `verified` |
| truthful_score | NUMERIC(5,2) | 0–100 |
| red_flags | JSONB default '[]' | per-claim flags from truthfulness moderator |
| screening_score | NUMERIC(5,2) | 0–100 |
| strengths | JSONB default '[]' | |
| gaps | JSONB default '[]' | |
| sample_questions | JSONB default '[]' | screening moderator output |
| verified_at | TIMESTAMPTZ | set on successful submission |
| updated_at | TIMESTAMPTZ NOT NULL default now() | |

Verdict rule (Go side): `verified` iff `truthful_score >= 70 AND screening_score >= 60` (constants). Re-submission upserts (ON CONFLICT (user_id) DO UPDATE) — re-verification allowed, not a lock-in.

Sync rule (Gotchas): file must ALSO land in `supabase-local/volumes/db/init/` with next `NN-` prefix AND have its individual-file volume mount added under `db:` in `supabase-local/docker-compose.yml`.

## Backend
### Python (stateless — no DB, per service separation)
New `backend/python/app/services/verification_service.py`:

- `POST /api/v1/verification/submit` in `app/api/ai_routes.py` (Go registers BOTH `/api/...` + `/api/v1/...` aliases to it — Python keeps only its `/v1` tree).
- Body: `{"resume_text": string}` (non-empty; ≤ 64k chars → 400/413).
- Stage 1 truthfulness moderator: claim extraction + per-claim LLM verdict → `truthful_score`, `red_flags[]`.
- Stage 2 screening moderator: LLM technical-depth score vs claimed experience → `screening_score`, `strengths[]`, `gaps[]`, `sample_questions[]` (up to 3 each).
- Response: `{"truthful_score": …, "red_flags": […], "screening_score": …, "strengths": […], "gaps": […], "sample_questions": […]}`.
- No LLM configured → explicit `503 {"error":"ai_service_unavailable"}` (LLMNotConfiguredError path — NEVER mock output; `build_provider()` contract).

### Go (authoritative — auth + DB)
New `backend/go/internal/api/routes_verification.go` (mirrors `routes_knowledge_hub.go` house style):

- `POST /api/v1/verification/submit` + `POST /api/verification/submit`: auth (`user.ID`) → DecodeAndValidate → `s.AI.PostJSON("/api/v1/verification/submit", …)` → compute verdict from thresholds → upsert `candidate_verification` → 200 row.
- `GET /api/v1/verification/status` + `GET /api/verification/status`: read row → 200 `{status, truthful_score, screening_score, red_flags, strengths, gaps, sample_questions, verified_at}`; no row → 200 with `status:"unverified"` + nulls (not 404 — one happy-path shape for the client).
- Both route pairs registered in `router.go` — archive `TestRouteParity` covers both trees automatically.
- nil-DB safety: guard `s.DB == nil || s.DB.Conn == nil` → 503 `database_unavailable` (loop-3 nil-DB panic lesson).

### Tests
- Python: `test_verification_service.py` — moderator JSON parsing (pass/fail shapes), endpoint via monkeypatched provider; assert 503 on LLMNotConfiguredError. Suite stays 470+ pass / 0 fail.
- Go: `routes_verification_test.go` with `fakeAIServer` pattern + `hermesMockAuth`; POST success (fake AI → verified), POST low-score → unverified, POST AI 503 passthrough, GET no-row → unverified, nil-DB guard. `go test ./...` stays green incl. parity.

## Frontend
- `src/config/features.ts`: add `verification: [true, true]` (registered gate — change-control rule).
- New `src/api/verification.ts`: `submitVerification(resumeText)`, `getVerificationStatus()` + types mirroring backend row.
- `src/pages/Profile.tsx`: "Verification" card — ShieldCheck icon; verified state shows badge + both scores + strengths/gaps; unverified state shows "Get Verified" CTA → modal: resume source (preferred: user's stored parsed resume; fallback: paste textarea) → submit → results → close. Re-run allowed.
- Copy guardrail: tooltip/caption exactly "Claims are AI-checked for accuracy and technical depth. This is a self-reported signal." — no recruiter promises.
- Tests: unit test `src/api/verification.test.ts` (payload mapping); features.test.ts extended with `verification` assertion (pattern from interviewPrep fix). Build + lint unchanged baseline.

## Honest scope / out of scope
- No recruiters, no employer API, no on-PDF badge, no expiry/certification, no V4 pricing, no Moat-1/2/V7 work here. Badge is informational only.

## Success criteria
1. Migration applies in both backends; `supabase-local` mount added.
2. Python suite: new tests green; full suite 470+ pass / 0 fail.
3. Go: new handler tests green; `go test ./...` green (incl. parity).
4. Frontend: build green; lint unchanged (51/1448); new unit tests green; full `bun run test` = 152+ pass / 14 cognee fail.
5. Manual smoke (LLM configured): POST returns scores; GET returns row; unconfigured LLM → 503.