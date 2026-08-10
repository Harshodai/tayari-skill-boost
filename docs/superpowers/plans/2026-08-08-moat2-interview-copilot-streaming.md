# Moat-2 — Interview Copilot streaming + parity: implementation plan

Parent: `docs/superpowers/specs/2026-08-08-moat2-interview-copilot-streaming-design.md` (APPROVED).
Executor: direct. Commit per task; gate per task.

## T1 — Python stream generator + endpoint
- `live_interview_copilot.py`: `stream_live_copilot_hints(req)` async generator — same prompt as `generate_live_copilot_hints`, yields `question_type` → `hints` → `star` → `metrics` → `[DONE]` events; LLMNotConfiguredError → error event.
- `main.py`: `POST /api/v1/interview/copilot/stream` → StreamingResponse (mirror optimizer SSE contract).
- `tests/test_live_copilot_stream.py`: event sequence, error event, endpoint 200 text/event-stream.
- GATE: py_compile clean; targeted tests green; full suite 492+ pass / 0 fail.

## T2 — Go proxy parity + SSE passthrough
- New `backend/go/internal/api/routes_interview.go`: `handleInterviewCopilotHint`, `handleInterviewVoiceFeedback` (requireFeature gate + PostJSON + 502), `handleInterviewCopilotStream` (SSE passthrough, sse.go flush pattern).
- Register all under BOTH `/api` + `/api/v1` in `routes_app.go`.
- `routes_interview_test.go`: parity ×3 routes (200 passthrough, alias, 502, gate), SSE forwards events.
- GATE: `go test ./...` green incl. parity.

## T3 — Frontend
- `src/api/ai.ts`: `streamInterviewCopilotHints(payload, onEvent)` helper (fetch + ReadableStream SSE parse).
- `src/api/ai.test.ts` (or extend existing): stream helper parses events (mockFetch shim).
- `src/pages/InterviewBoard.tsx`: live mode — question textarea → streamed hint panel (progressive render); plain-HTTP hint button stays as fallback.
- GATE: build green; lint errors unchanged (51); `bun run test` = 161+ pass / 14 fail.

## T4 — Memory
- `lessons.md` + `.superpowers/sdd/progress.md`; commit.
- GATE: files present; working tree clean except `supabase/functions/mcp/index.ts`.

Acceptance: all gates + manual-smoke predictions (stream yields progressive events; unconfigured → error event) documented in T4.