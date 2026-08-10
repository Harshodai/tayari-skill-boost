# Moat-2 — Live Interview Copilot: streaming + Go proxy parity

Status: DRAFT (2026-08-08, awaiting user approval). Parent: `docs/superpowers/specs/2026-08-07-five-doc-reconciliation-audit.md` (V2 row, **unfrozen** by user 2026-08-07).

## Problem
The copilot's "real-time" promise is unmet: 3 plain-HTTP endpoints exist (`copilot-hint`, `copilot`, `voice-feedback`), only `copilot` is proxied by Go, and nothing streams — the candidate waits for a full LLM response instead of getting hints as they're generated.

## Design summary
1. **Go proxy parity**: add `/api/v1/interview/copilot-hint` + `/api/interview/copilot-hint` and `/api/v1/interview/voice-feedback` + `/api/interview/voice-feedback` (mirror `handleInterviewCopilot` incl. `requireFeature("interview_copilot")` gate). Fixes the frontend's 404-through-gateway path.
2. **Streaming**: new `POST /api/v1/interview/copilot/stream` (Python SSE via StreamingResponse) + Go SSE passthrough route (both trees) using the existing `sse.go` flush pattern. Events: `question_type` → `hints` (as generated) → `star` → `metrics` → `[DONE]`; error event `ai_service_unavailable` on LLMNotConfiguredError (never mock).
3. **Frontend**: InterviewBoard.tsx live mode — interviewer question textarea → EventSource/streamed hint panel (progressive render). Existing plain-HTTP hint button stays as fallback.

## Honest scope
- Text-transcript only. **No audio transcription, no WebSocket** — the "live audio overlay" claim stays out (that's the V7-adjacent heavy lift). Streaming is SSE over the existing Go gateway, keeping the self-hostable contract (Go→Python, local LLM capable).

## Backend
### Python
- `live_interview_copilot.py`: add `stream_live_copilot_hints(req)` async generator — same prompt as `generate_live_copilot_hints`, yielding progressive JSON events; reuse existing response models.
- `main.py`: `POST /api/v1/interview/copilot/stream` → StreamingResponse (mirror optimizer SSE at main.py:325-340, incl. `[DONE]` + error-event contract).

### Go
- `routes_mvp.go` (or new `routes_interview.go`): `handleInterviewCopilotHint`, `handleInterviewVoiceFeedback` proxies (requireFeature gate, PostJSON, 502 on upstream error) + `handleInterviewCopilotStream` SSE passthrough (sse.go flush pattern, forwards upstream events verbatim).
- Register all under BOTH `/api` + `/api/v1` (parity test covers).

### Tests
- Python: stream generator yields question_type→hints→star→metrics→DONE; LLMNotConfiguredError → error event; endpoint 200 text/event-stream.
- Go: 3 new proxy routes × parity (200 passthrough, alias, 502, gate 403); SSE route forwards events.
- Frontend: `src/api/ai.ts` stream helper test (mockFetch shim).

## Success criteria
1. Python suite 492+ pass / 0 fail.
2. Go `go test ./...` green incl. parity.
3. Frontend 161+ pass / 14 fail (cognee baseline); build green; lint errors unchanged (51).
4. Manual smoke (LLM configured): stream endpoint returns progressive events; unconfigured → error event, never mock.

## Out of scope
- Audio transcription, WebSocket, V7 Glass Box, V4 pricing, recruiter API.