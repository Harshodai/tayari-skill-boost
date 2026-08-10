# V7 — Glass Box: live browser feed into AgentLiveView

Status: DRAFT (2026-08-08, awaiting user approval). Parent: `docs/superpowers/specs/2026-08-07-five-doc-reconciliation-audit.md` (V7 row).

## Problem
The audit's V7 gap: AgentLiveView renders a step list + log but **no live browser feed** — "Glass-Box accurate only in the step-list+log sense, not the Manus live-browser sense". The browser agent (`browser-use 0.1.34`) already captures a base64 screenshot per step via `register_new_step_callback` (`BrowserState.screenshot`) — it's just never surfaced.

## Design summary
Stream the browser agent's per-step screenshots live into AgentLiveView over SSE (the existing Go→Python streaming path from Moat-2 — zero new dependencies; WebSocket would require a new Go WS library, which the no-new-deps rule forbids). Also close the parity gap: `POST /api/v1/browser/automation` has no Go route today.

## Backend
### Python
- `browser_automation/agent.py`: new `stream_browser_agent(instruction, max_steps)` async generator — runs the agent with `register_new_step_callback` capturing `state.screenshot` (base64 PNG) + step index/url/title; yields `{"type":"screenshot","data":...,"step":n,"url":...}` then `{"type":"done","result":...}`; error events (`ai_service_unavailable` on LLM config error, `browser_agent_failed` on run error) — never canned output.
- `main.py`: `POST /api/v1/browser/automation/stream` → StreamingResponse (SSE, mirror Moat-2 stream endpoint).

### Go
- `routes_browser.go`: `handleBrowserAutomation` (plain proxy — closes the parity gap) + `handleBrowserAutomationStream` (SSE passthrough via `PostStream`, optional-flusher pattern from Moat-2).
- Register both under BOTH `/api` + `/api/v1` (parity test covers).

### Tests
- Python: stream yields screenshot events with base64 data; error event on LLM config failure; done event carries result.
- Go: plain proxy parity (200/alias/502), stream passthrough (events forwarded, 503 forwarded).

## Frontend
- `src/api/browser.ts`: `streamBrowserAgent(instruction, onEvent, signal)` — same SSE parse pattern as `streamInterviewCopilotHints`.
- `src/api/browser.test.ts`: event parsing (mockFetch shim).
- `src/components/agent/AgentLiveView.tsx`: new "Live browser feed" panel — renders streamed screenshots as `<img src="data:image/png;base64,...">` progressively (latest screenshot + step counter), with an honest caption ("What the agent sees, per step — not a video stream"). Existing step list/log stay.

## Honest scope
- Per-step screenshots over SSE — **not** a video/WebSocket stream (no new deps; the audit's "live-browser sense" is closed by showing the agent's actual view at each step).
- The `apply-agent` edge function's packet flow is untouched (separate feature); V7 only adds the live feed + the browser-automation parity gap.

## Success criteria
1. Python suite 498+ pass / 0 fail.
2. Go `go test ./...` green incl. parity.
3. Frontend 163+ pass / 14 fail (cognee baseline); build green; lint errors unchanged (51).
4. Manual smoke (LLM + browser configured): stream yields base64 screenshot events; unconfigured → error event, never mock.

## Out of scope
- WebSocket, video streaming, audio, V4 pricing, recruiter API, apply-agent packet flow changes.