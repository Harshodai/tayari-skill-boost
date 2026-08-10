# V7 — Glass Box live browser feed: implementation plan

Parent: `docs/superpowers/specs/2026-08-08-v7-glass-box-live-browser-feed-design.md` (APPROVED).
Executor: direct. Commit per task; gate per task.

## T1 — Python stream generator + endpoint
- `browser_automation/agent.py`: `stream_browser_agent(instruction, max_steps)` async generator — `register_new_step_callback` captures `state.screenshot` (base64 PNG) + step/url/title; yields `screenshot` events then `done` with result; `ai_service_unavailable` / `browser_agent_failed` error events (never canned).
- `main.py`: `POST /api/v1/browser/automation/stream` → StreamingResponse (SSE, Moat-2 pattern).
- `tests/test_browser_agent_stream.py`: screenshot event shape, error event on LLM config failure, done event.
- GATE: py_compile clean; targeted tests green; full suite 498+ pass / 0 fail.

## T2 — Go parity + SSE passthrough
- `backend/go/internal/api/routes_browser.go`: `handleBrowserAutomation` (plain proxy) + `handleBrowserAutomationStream` (SSE passthrough via `PostStream`, optional flusher).
- Register both under BOTH `/api` + `/api/v1` in `routes_app.go`.
- `routes_browser_test.go`: proxy parity (200/alias/502), stream passthrough (events + 503 forwarded).
- GATE: `go test ./...` green incl. parity.

## T3 — Frontend
- `src/api/browser.ts`: `streamBrowserAgent(instruction, onEvent, signal)` (SSE parse pattern from ai.ts).
- `src/api/browser.test.ts`: event parsing (mockFetch shim).
- `src/components/agent/AgentLiveView.tsx`: "Live browser feed" panel — progressive `<img>` screenshots + step counter + honest caption.
- GATE: build green; lint errors unchanged (51); `bun run test` = 163+ pass / 14 fail.

## T4 — Memory
- `lessons.md` + `.superpowers/sdd/progress.md`; commit.
- GATE: files present; working tree clean except `supabase/functions/mcp/index.ts`.

Acceptance: all gates + manual-smoke predictions (screenshot events stream; unconfigured → error event) documented in T4.