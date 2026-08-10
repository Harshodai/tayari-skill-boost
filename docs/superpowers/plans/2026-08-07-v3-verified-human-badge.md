# V3 — Verified-Human Badge: implementation plan

Parent: `docs/superpowers/specs/2026-08-07-v3-verified-human-badge-design.md` (APPROVED).
Executor: direct (no subagents). All tasks carry a verification gate; commit per task.

## T1 — Migration + supabase-local sync
- `backend/db/migrations/20260807_verified_human_badge.sql`: `candidate_verification` per spec.
- Copy → `supabase-local/volumes/db/init/21-20260807_verified_human_badge.sql`.
- Add individual-file volume mount under `db:` in `supabase-local/docker-compose.yml` (next `zz-21-` slot).
- GATE: sql applies (syntax check); compose config valid (`docker compose config -q`).

## T2 — Python stateless scorers
- `backend/python/app/services/verification_service.py`: truthfulness moderator + screening moderator (LLM JSON via house llm helper; LLMNotConfiguredError propagates → 503).
- `POST /api/v1/verification/submit` in `app/api/ai_routes.py` (+ input validation).
- `backend/python/tests/test_verification_service.py`: JSON parsing shapes, endpoint 200, 503 on unset LLM.
- GATE: from the `backend/python` working directory, `.venv/bin/pytest tests/test_verification_service.py` green; full suite still 470+ pass / 0 fail.

## T3 — Go authoritative routes
- `backend/go/internal/api/routes_verification.go`: POST submit (proxy → verdict → upsert), GET status (no-row → unverified shape), nil-DB guard.
- Register both `/api/...` + `/api/v1/...` pairs in `internal/api/router.go`.
- `routes_verification_test.go`: fakeAIServer + hermesMockAuth; verified/unverified/503/no-row/nil-DB cases.
- GATE: `go test ./...` green (incl. route-parity test).

## T4 — Frontend
- `src/config/features.ts`: `verification: [true, true]`; extend `src/config/features.test.ts`.
- `src/api/verification.ts` + `src/api/verification.test.ts`.
- `src/pages/Profile.tsx`: Verification card + Get-Verified modal (stored resume text preferred, paste fallback), honest caption.
- GATE: `bun run build` green; `bun run lint` unchanged 51/1448; `bun run test` = zero failures in changed tests, with the pre-existing cognee baseline (14 failures in `external_repos/cognee`) unchanged — no new failures beyond that baseline.

## T5 — Memory
- `lessons.md` entry (what/root-cause/fix/lesson), `.superpowers/sdd/progress.md` ledger entry.
- GATE: both files present; working tree clean except `supabase/functions/mcp/index.ts` (never commit).

Acceptance: all gates + manual smoke prediction (scores map to status; 503 without LLM) documented in T5.