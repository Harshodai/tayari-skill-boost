# Tayari Skill Boost — Local Parallel Development Lessons

This document details key findings, architectural decisions, and lessons learned while configuring the local development stack of Tayari Skill Boost to run concurrently in parallel with another local self-hosted stack.

---

## 2026-08-07 — B1 loop-3 landed (generate-resume-pdf edge fn → Go/Python Typst-only) — B1 blocker closed

### What was done
- Deleted `supabase/functions/generate-resume-pdf/` (804 lines) — the last of the 3 edge fns. B1 (split-brain backend: Go/Python authoritative, edge fns removed) is now fully closed.
- New pipeline: frontend `generateResumePdf` helper (typed payload builder `buildGenerateResumePdfPayload` in src/api/resumes.ts) → Go `POST /api/resumes/generate-pdf` + `/api/v1/resumes/generate-pdf` (parity) → Python `POST /api/v1/resumes/generate-pdf`: one `llm_json` call produces an `OptimizedProfile` dict (skeleton from `parsedResume`, LLM rewrites bullets/skills per applied suggestions + missing keywords), then `generate_typst_code` + `compile_typst_to_pdf` render locally (typst v0.15.1 in the container), returns `{"pdf_base64"}` (established base64-in-JSON binary pattern). UI template map: modern→modern_tech, professional→executive_slate, creative→creative_compact, minimal→minimalist_ats, tech→faang_single_page, executive→executive.
- LaTeX surface removed from the UI (LaTeX tab, LaTeXSourceView.tsx, Download LaTeX button, `.tex` fallback, `GenerateResumeResponse`/`GenerateResumeRequest` types) — Typst-only means no LaTeX source exists. `profile_data` is Optional; when null the LLM builds the full profile from resume_text.
- **The consent gate was already dead:** no UI call site ever passed `acceptThirdPartyCompilation`, so both modal buttons 451'd — PDF download has been broken in the UI since the gate shipped. The loop fixed it rather than merely replacing it.
- Executed via subagent-driven development (4 tasks + final review + 1 fix wave): chain `8e7dcda` plan → `b4c261d` feat(python) → `c2c4a89` feat(go) → `99e8e9d` fix(go, stray revert) → `92ada2b` fix(ui) → `5846600` chore(delete) → `11735db` fix(final-review findings).
- Live-verified: unauthed 401; authed 200 with `pdf_base64` decoding to `%PDF-` (48.6KB executive, 42.4KB tech); parity tests green; all services healthy.

### Root causes
- Split-brain again: the edge fn (Lovable AI gateway) was the only PDF path; its replacement contract had to match Python's `llm_json`/typst machinery — the real bug found at final review was a camelCase↔snake_case analysis-payload mismatch (frontend sent `overallScore`/`missingKeywords`, Python read `overall_score`/`missing_keywords`) that silently dropped the analysis signal into the LLM prompt ("Overall Score: N/A/100", no missing keywords) while Python tests enshrined the wrong contract with snake_case fixtures. Also: making `parsedResume` a hard dependency of the endpoint (edge fn ignored it) created a reachable 422→502 on a null path.

### Fix applied
- Final-review fix wave (one fixer, complete findings list): typed exported payload builder mapping analysis→snake_case with an exact-wire-body unit test (recurrence guard); `profile_data: Optional[dict]` with resume-text-fallback prompt branch + null-path test; dead `GenerateResumeRequest` type deleted.

### Reusable lessons
- **A "privacy consent gate" that no UI call site ever sets is not protection, it's a silently broken feature** — before building the replacement, check whether the gate's absence means the feature is already dead (it was: 451 every time).
- **A test fixture can enshrine the wrong contract:** the Python tests built the payload with snake_case keys the frontend never sends, so the mismatch passed review until the final whole-branch review traced the wire end-to-end. Cross-service key casing is a first-class review item — verify the ACTUAL frontend runtime shape against the Python reader, not the test's version of it.
- **When one backend path becomes the only path, previously-tolerated input shapes become hard dependencies:** the edge fn ignored `parsedResume`; the new endpoint treated it as required. Optional-with-fallback beats a new 422/502 path.
- The final-review fix wave pattern worked: one fixer, full findings list, covering tests named in the dispatch, scoped re-review — cheaper than per-finding fixers.

---

## 2026-08-07 — B1 loop-2 landed (analyze-resume edge fn → Go/Python only) + found a pre-existing score-0 bug

### What was done
- Completed B1 loop-2 (second third of the split-brain-backend blocker): deleted the `analyze-resume` Supabase edge function; the Go→Python path (`POST /v1/analyze` → Go `handleAnalyzeText` → Python `analyze_text_endpoint`) is now the ONLY path — the frontend cloud branch (`supabase.functions.invoke("analyze-resume")` + the `resume_analyses` insert) is gone from `ResumeUpload.tsx`.
- **Found and fixed a pre-existing bug the edge fn was masking:** the UI normalizer (`normalizeGoAnalysis` in ResumeUpload.tsx) read a legacy shape (`raw.score`/`raw.breakdown`/`raw.keywords`) that Python stopped producing long ago (it returns `result.overall_score`/`section_scores`/`matched_keywords`/…). Every self-hosted analysis rendered **0%** with empty sections. Root-caused during plan writing: Python `analyze_resume` (llm_service.py) returns the new shape; Go forwards verbatim; the old normalizer never matched. Replaced with a pure lib module `src/lib/resumeAnalysis.ts` (`normalizeGoAnalysis` maps `section_scores.skills_match/experience_relevance/education_fit/formatting` → the 4 UI sections; `aiOptionsToFocusText` is a byte-identical port of the edge fn's `buildOptionsText`; `buildAnalyzePayload` combines custom instructions + focus text).
- Executed via subagent-driven development (3 tasks, all TDD): `d7d1328` feat(lib), `8ec3286` fix(ui), `b2c16a3` chore(supabase). Per-task reviews all clean; final whole-branch review: ready to close, 5 minors all deferred (education-filter branch unpinned, overallScore unrounded, partial section_scores untested, per_ats-absence untested, ponytail comment now accurate).
- Live-verified: `curl /v1/analyze` (real LLM, 34s) → HTTP 200, `result` carries `overall_score:35`, all 4 `section_scores`, `matched_keywords` — exactly the shape the new normalizer consumes. Route-parity tests green (no Go routes touched). All 3 services healthy post-rebuild.

### Root cause
- The split-brain: the edge fn (Lovable AI gateway, gemini-3-flash) was the DEFAULT path (`!USE_SELF_HOSTED`, and `VITE_USE_SELF_HOSTED` defaults false), so the Go/Python path was rarely exercised — and when it was, its response-shape drift was invisible because the UI was on the edge-fn contract. Two separate contracts (edge fn: `data.overallScore`; Python: `result.overall_score`) with a normalizer that matched neither new shape.

### Fix applied
- Deleted the edge fn + its only call site; moved the aiOptions steering into the frontend payload (focus-area text appended to `custom_instructions` — zero Python/Go changes); new lib normalizer pins the Python shape with discriminating tests; a static source-inspection test (`resumeUploadNoCloud.test.ts`) fails the build if anyone resurrects `functions.invoke("analyze-resume")` or the `USE_SELF_HOSTED` analysis branch.

### Reusable lesson
- When two backend paths serve one UI, the path nobody runs rots silently — and the normalizer drifts to match the *other* path. Deleting the dead path first, then auditing the survivor's response against the UI contract, surfaces shape bugs that tests can't. Port user-facing prompt controls (aiOptions) into the surviving path's payload rather than letting UI toggles die with an edge fn — the checkboxes are product surface, not implementation detail. A source-inspection test that greps for a banned call pattern (`functions.invoke`) is a cheap, import-leak-immune way to make a removal permanent.

---

## 2026-08-07 — B1 loop-1 landed (check-rate-limit edge fn → Go endpoint) + lost-work restore + test-attribution rebase

### What was done
- Completed B1 loop-1 (first third of the split-brain-backend blocker): replaced the `check-rate-limit` Supabase edge function with `GET /api/v1/auth/rate-limit` in the Go gateway. 4 SDD tasks, TDD throughout: (1) Go handler `routes_auth_ratelimit.go` (sha256-hash email to match the worker's key format; unauthenticated; fail-open on nil-DB) + both `/api`/`/api/v1` route registrations + tests; (2) frontend `src/api/auth.ts` `getAuthRateLimit` + test (test stubs `@/api/client` directly to dodge a pre-existing `mock.module("@/api")` leak from `ResumeGraph.test.tsx`); (3) `src/lib/rate-limiter.ts` rewired off Supabase (supabase import removed; `recordFailedAttempt`/`resetRateLimit` become local no-ops); (4) deleted `supabase/functions/check-rate-limit/` + dangling `[functions.check-rate-limit]` block in `supabase/config.toml`.
- Fixed a test-coupling hazard mid-branch: `routes_auth_ratelimit_test.go` used `newResumeGraphServer` (a helper defined in an uncommitted `routes_resume_graph_test.go`); if those untracked files were removed, `go test ./internal/api` would fail to build. Made the test self-contained with `NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: nil})`.
- Recovered lost resume-graph work (see root cause) and re-committed it in clean conventional commits: Go blob helpers (`GetBlob`/`DeleteNoContent`) + resume-graph proxy route registrations; Python jsonb-str decode in `load_graph`, X-User-Id rate-limit key, delete-with-DB-fallback; `PyJWT==2.10.1` in requirements.txt; `JWT_SECRET` passthrough to `python-ai` in docker-compose.yml; frontend `?format=raw` fetch.
- Rebased the 4 B1 commits so the self-contained test fix lives in Task 1 (it had been amended into Task 4). Verified post-rebase: tree byte-identical to pre-rebase, Task 1 holds the fixed test, Task 4 clean.
- Live-verified after container rebuilds: `GET /api/v1/resume-graph/{run}/?format=raw` 200, export 200 (was 502), 7 rapid GETs → 200×4 then 429×3 (per-user budget), `DELETE` 204.

### Root cause
- Two independent events: (a) an earlier checkout dance (`reflog: reset moving to HEAD`) silently dropped the uncommitted resume-graph work from the working tree — the two untracked Go files survived in `/tmp` stashes, but tracked-file edits (client.go methods, routes_mvp.go registrations, Python fixes, PyJWT, frontend) were reverted, leaving the live gateway 502ing on resume-graph with zero build errors (dead routes compile fine); (b) a `git commit --amend` on the wrong commit folded a test fix into the edge-fn-deletion commit, breaking attribution and leaving Task 1's commit with a test that wouldn't build in isolation.

### Fix applied
- Restored all reverted edits from the summary/notes, committed them in conventional commits, excluded an unrelated stray `supabase/functions/mcp/index.ts` (Lovable-synced version bump) from the branch. Fixed attribution with a targeted non-interactive rebase (`GIT_SEQUENCE_EDITOR="sed ... 1s/^pick/edit/"`), amending Task 1 with the self-contained test, then `git rebase --continue` (identical-file replay merged cleanly).

### Reusable lesson
- Dead proxy routes don't fail the build — after any `reset`/checkout dance, verify live behavior (`curl` the endpoint), not just `go build ./...`. Never `git commit --amend` casually: check `git log --oneline -1` first; if a fix lands in the wrong commit, a `pick→edit` rebase of the first relevant commit moves it cleanly (replay of the identical change merges without conflict). Untracked in-flight files + `reset --hard` = data loss; stash to `/tmp` (as done here) or commit early and often. Stray managed-file changes (Lovable-synced `supabase/functions/*`) belong outside feature commits.

---

## 2026-08-07 — Resume graph tail end (429 passthrough, per-user rate limit) + PyJWT missing from requirements.txt

### What was done
- Finished the resume-graph ruthless sweep. Two more live bugs in the same feature path, both surfaced by hammering GET through the gateway: the 6th call returned 502 `ai_service_unavailable` instead of 429.
- Go `routes_resume_graph.go` `proxyAIError`: replaced the brittle `strings.Contains(msg, " 404:")` substring hack with `extractAIStatus`, which parses the status int out of the `"AI service returned %d: ..."` error and forwards any 4xx/5xx (404 stays 404, 429 now passes through as 429). Added `TestResumeGraphGet_ForwardPython429`.
- Python `app/api/resume_graph.py` `get_resume_graph`: the `_RATE_LIMIT` bucket was keyed on `request.client.host`, but behind the Go gateway every request arrives from the gateway's container IP → the 5/min budget was **global across all users** (one user's refresh spree starved everyone). Now keyed on `X-User-Id` (Go already forwards it via `getXUserHeaders`) with IP fallback. Live-verified: 7 rapid same-user calls → calls 1–5 are 200, calls 6–7 are 429 (per-user budget, not 502).
- **PyJWT missing dependency (deployment bug, exposed by a compose recreate).** `app/auth/dependencies.py` does `import jwt` at module load (it's the shared JWT-verification dep added 2026-08-03), and `app/main.py` imports it via `app/routes/agent.py` — so the engine can't start without the `jwt` package. But `backend/python/requirements.txt` never listed PyJWT. The previously-running `python-ai` container had it only because someone pip-installed it at runtime into that ephemeral container; a `docker compose up -d --build` recreate discarded that and the fresh container crashed at startup with `ModuleNotFoundError: No module named 'jwt'`. Added `PyJWT==2.10.1` to requirements.txt, rebuilt `python-ai` (image `7338d3192962`), recreated it healthy, then rebuilt `go-backend` with the 429 fix.

### Root cause
- Rate limiter used the raw socket peer behind a proxy → global budget collapse. `proxyAIError` only special-cased 404, so any other upstream 4xx (429) became an opaque 502. PyJWT was a hard startup dependency that was never declared in requirements.txt; the only reason the stack ever ran was an undocumented manual pip-install into the live container, which a recreate silently destroyed.

### Fix applied
- `extractAIStatus` parses the upstream status from the ai.Client error and forwards 4xx/5xx verbatim; rate-limit bucket keyed on `X-User-Id` then IP; `PyJWT==2.10.1` added to `backend/python/requirements.txt` and the `python-ai` image rebuilt so the dependency is baked in, not ephemeral.

### Reusable lesson
- A reverse proxy flattens `request.client.host` to one IP — any per-IP rate limiter behind it is a global limiter; key on a forwarded identity header (`X-User-Id`) with IP fallback. Map upstream statuses through the gateway verbatim (404, 429, …) instead of substring-special-casing one code, or clients get an opaque 502 for a real 429. A package `pip install`-ed into a running container is not a declared dependency — it vanishes on the next recreate. Every `import` at module load time must appear in the lockfile/requirements, or `docker compose up --build` will hand you a container that can't start. Verify "builds from scratch" by recreating the container, not by trusting the running one.

---

## 2026-08-06 — Resume Graph "Download JSON" 404: Go gateway had no resume-graph proxy routes + Python jsonb-as-str double-encode

### What was done
- Root-caused the Resume Graph "Download JSON" red-toast failure. The phase-1/2/3 investigation showed `curl localhost:8085/api/v1/resume-graph/{runId}` returned `404 page not found` — the Go gateway registered zero `resume-graph` routes; Python's `backend/python/app/api/resume_graph.py` router only exposed bare `/v1/resume-graph/...`, unreachable through the gateway.
- Go: new `backend/go/internal/api/routes_resume_graph.go` — GET/POST/DELETE/export proxy handlers (import+delete to Python, `GetBlob` for the export byte-stream passthrough, `DeleteNoContent` for 204), plus `proxyAIError` mapping upstream `404:` to 404 and other failures to 502 `ai_service_unavailable`.
- Go route registration in `routes_mvp.go` under the auth-protected `/api/v1/resume-graph/*` + `/api/resume-graph/*` pair (route parity maintained).
- `backend/go/internal/ai/client.go` gained `GetBlob(endpoint, headers) (*http.Response, error)` and `DeleteNoContent(endpoint, headers) error`.
- Frontend `src/pages/ResumeGraph.tsx`: GET now asks Python for `?format=raw` so the response is the unwrapped `{nodes, links}` shape the viz expects (Python's default wraps in `{run_id, graph:{...}}`).
- Python `resume_graph_storage.load_graph`: asyncpg returns `jsonb` columns as `str` (default codec — the pattern `app/services/db.load_agent_run` already handles), so `load_graph` returned the raw JSON text and `get_resume_graph`/`export_resume_graph` re-serialized it into a double-encoded JSON string. Now decodes `str` → object when the codec gives one (mirrors `load_agent_run`).
- Python `resume_graph.delete_resume_graph`: previously 404'd ("Run not found") whenever the run was absent from the in-process `_autopilot_store`, so a DB-only graph (common after a restart) could never be deleted — the frontend Delete Graph button red-toasted for it. Now checks the DB fallback (`load_graph`) before 404ing, and always best-effort deletes the DB row; 204 whenever the run exists in either store, 404 only when it exists in neither.
- Tests: `backend/go/internal/api/routes_resume_graph_test.go` (GET, export blob, delete 204, POST passthrough); Python `test_resume_graph_storage.py::test_load_graph_decodes_jsonb_str` and `test_resume_graph_extended.py::test_delete_resume_graph_db_only_backed`. All Go tests + `bun run build` + ResumeGraph frontend tests + Python resume-graph tests green.
- Live-verified through the gateway: GET `?format=raw` → HTTP 200 proper `{links,nodes}` object; `/export` → HTTP 200 with `Content-Disposition: attachment; filename="resume-graph-{uuid}.json"` and a valid JSON object body.

### Root cause
- Two independent bugs stacked: (1) Go gateway never proxied `/v1/resume-graph/*` so every frontend call 404'd at the gateway; (2) the DB-fallback path in Python double-encoded the graph because asyncpg hands back `jsonb` as `str` and `load_graph` didn't re-parse it — Go's JSON client then 502'd on the JSON-string body and the export was a JSON string instead of an object. (3) A third, same-class bug: `delete_resume_graph` only consulted the in-process store, so DB-backed graphs 404'd on delete.

### Fix applied
- Register gateway proxy routes (both `/api/v1/...` and `/api/...` for parity); pass graph fetch through as `?format=raw`; add `GetBlob`/`DeleteNoContent` to the Go AI client; decode `str` jsonb in `load_graph`; make delete consult the DB fallback before 404ing.

### Reusable lesson
- The Go gateway is the only frontend entry point — never ship a Python router that the gateway doesn't proxy, and keep route parity. asyncpg's default jsonb codec returns `str`, not `dict`; any `SELECT ...::jsonb` helper must decode like `load_agent_run` does, or downstream JSON consumers will get double-encoded strings (Go's JSON decode 502s; exports contain a JSON-encoded string, not an object).

---

## 2026-08-04 — Security & correctness batch: SSRF navigation, API error codes, autopilot gates

### What was done
- `0002_tayari_core_architecture.sql`: the `saved_sources` unique-index cleanup now inspects indexes by their **key columns** (`idempotency_hash`, single-column) instead of by name, and drops both standalone legacy indexes (`DROP INDEX`) and constraint-backed ones (`DROP CONSTRAINT` on the owning constraint), so any uniquely named legacy unique index is removed before the composite `(user_id, idempotency_hash)` target is created. Verified against a scratch schema on the running Supabase Postgres.
- Go `routes_resume_extra.go` `handleAnalyzeResume`: runtime DB connection failures (`sql.ErrConnDone`) and request-context timeouts (`context.DeadlineExceeded`) now map to HTTP 503 "resume lookup unavailable" instead of 500; `sql.ErrNoRows` stays 404 and other lookup errors stay 500.
- Python `agent_engine._is_safe_code`: rejects any `ast.Attribute` whose name starts with `_` (private/dunder — `__globals__`, `_wrap_close`, `__class__`); removed `ast.Index` from `safe_nodes` (deprecated 3.9 compatibility node, never produced by Python 3.11+ parsers — a parsed tree can no longer contain it, so excluding it is a strictness win with zero false rejects).
- `browser_operator._redirect_interceptor`: wrapped `_is_safe_url` + route handling in the same fail-closed try/except as `_ssrf_route_interceptor` — any exception aborts the route; every redirect is either validated-continue or aborted.
- `main.py` export flow: final `ledger.record` is wrapped so a ledger write failure is logged and the assembled archive is still returned; `cover_letters` is marked unavailable **only** when the gateway omitted the section — a present empty list is stored as empty, not misreported as missing.
- `routes/agent.py`: `_career_engine_for`/`_job_seeker_engine_for` build per-user workspaces via new `_workspace_for(user_id)` (hashed, `0o700`), matching `run_agent_task`; import-time `AGENT_WORKSPACE_BASE` validation uses `os.lstat` to reject symlinks/non-directories/foreign-owned bases as a logged startup-validation failure.
- `autopilot_graph.py`: `_verified_contact` now requires the stripped value to appear literally in the resume first, with digit-comparison only as a fallback requiring ≥7 digits; `AutopilotState` TypedDict declares `candidate_full_name/email/phone`; `submit_ready` is True only when contact fields **and** usable (non-`[UNAVAILABLE:...]`) `tailored_resume`+`cover_letter` are present, else `PAYLOAD_COMPILED` with `submit_ready=False`; a shared `_EMPTY_RECRUITER_INTEL` shape (incl. `company_insights`) backs every fallback branch.
- `omnisave_service.py`: docstrings now describe recency-based retrieval (no vector/semantic claims); `get_pool()` moved inside `_load_user_chunks_db`'s try so DSN/pool errors fall back instead of propagating; invalid-UUID subjects log warnings (distinguishable from an unconfigured DB).
- `optimizer.py` `scrape_jd_url`: navigates the pinned `target_url` with the `Host` header and `validate_redirects=True` (matching `agent_engine.navigate_web`/`execute_form_auto_fill`), and pulls the **full** `document.body.innerText` instead of the browser's 3000-char `content_preview`, so keyword/scoring stages see the complete JD.
- `privacy_ledger.py`: in-memory buffer now holds only failed/pending writes (successful DB writes pop the entry); `query_user_log` merges pending buffer entries with DB rows (dedup by id) before sorting + limit; `clear_user_log` raises when `DATABASE_URL` is configured but no pool is available, so a false "wiped" success is impossible, and only evicts the buffer after a successful delete.
- `sandbox_executor.py`: TIN/EIN pattern accepts an optional separator between the first two and remaining seven digits (`12-3456789`, `12 3456789`); hyphen excluded from the label separator class so the in-identifier separator is captured by the number pattern.
- Tests: `test_omnisave_agent_reach.py` now uses a valid UUID `TEST_USER_ID` (shared with `test_autopilot_system.py`), seeds the foreign user's saved source + a chunk containing the query term so isolation (not source/relevance filtering) is what's asserted, and exercises the real `_load_user_chunks_db` with the `get_pool` mock active through the RAG call.
- Frontend: `AutonomousCareerConsole` gained a `negotiationError` state (clears `aiNegotiationResult` before the request, sets the error on failure, displays it in the negotiate panel); `handleCopilot` clears `copilotResult` before the fetch; `InterviewVoiceCoach` treats a `null`/malformed health payload as not-configured so the error path covers unreachable health endpoints.
- `supabase/functions/mcp/index.ts` (+ `src/lib/mcp/index.ts` source): `projectRef` parses `SUPABASE_URL` with `new URL` and requires a `*.supabase.co` hostname before extracting the ref; missing/malformed/unexpected-hostname values leave it empty.

### Root cause
- Index cleanup by name missed legacy installs with differently named single-column unique indexes. DB connection/timeout errors were mislabeled as server faults (500) instead of transient unavailability (503). `_is_safe_code` allowed private/dunder attribute access and an obsolete AST node. The redirect interceptor could leave a redirect unresolved on error. A ledger write failure aborted the whole export, and an empty `cover_letters` list was reported unavailable. Engines shared one workspace base across users. Contact verification trusted digit substrings over literal presence, and `submit_ready` ignored unavailable generated documents. The JD scraper fed the optimizer a truncated 3000-char preview and navigated the original hostname (DNS-rebinding window). The privacy buffer held every entry (duplicating persisted rows) and deletion could report a false wipe. The TIN regex missed separator-formatted EINs. Test identities were non-UUIDs, breaking DB paths.

### Fix applied
- Column-based index inspection + constraint-aware drop; 503 classification for connection/timeout; AST private-attr rejection + `ast.Index` removal; fail-closed redirect interceptor; non-blocking ledger write + present-empty-list handling; per-user workspace derivation + `lstat`-based base validation; literal-first contact verify + document-availability gate + unified empty intel shape; recency-true docstrings + pooled-fallback loader + invalid-UUID warnings; pinned+redirect-validated navigation and full-text JD extraction; pending-only buffer with merge-on-query and configured-no-pool error; optional-separator TIN pattern; valid-UUID test identity and isolation-first fixtures; frontend error-state and health-null handling; validated `projectRef` extraction.

### Reusable lesson
- Name-based index cleanup is fragile across legacy installs — key-column inspection is authoritative, and constraint-backed indexes must be dropped via their constraint. "Server fault" and "service unavailable" are different HTTP semantics; classify driver/context errors as 503. Static guards fail open when an attribute-name prefix is allowed — reject `_`-prefixed attributes wholesale, and prune obsolete AST node types from allow-lists. Fail-closed (abort) beats fail-open (continue) for security interceptors. Never let a non-critical side effect (ledger write) abort the primary result. Distinguish "section missing" from "section empty" in exports. Per-user resources need per-user directories, validated at startup with `lstat` not `exists`. Contact verification must be literal-first; digit fuzz is a last resort with a realistic minimum. `submit_ready` is a contract: verify every artifact it depends on. Feed scoring pipelines full documents, never previews. Buffers should hold only what the DB doesn't. A "wipe" that can silently fail is worse than a loud error.

---

## 2026-08-03 — Batch 2: shared auth dependency, honest export/delete, agent hardening

### What was done
- Added `backend/python/app/auth/dependencies.py` — the single JWT verification dependency used by `main.py` and `routes/agent.py`. It fail-fasts at import when `JWT_SECRET` is unset (no baked-in fallback), rejects non-symmetric `JWT_ALGORITHM` values for shared-secret verification, and maps `jwt.PyJWTError` to 401 while logging unexpected exceptions separately (never converting server faults to 401).
- `main.py`: removed the local `get_current_user` + hardcoded JWT secret; routed all auth-guarded handlers through the shared dependency; deduplicated the `privacy_check_endpoint` (single handler registering GET+POST on `/api/v1/privacy/check`).
- `main.py` `export_user_data_endpoint`: pulls profile/resumes/applications/cover_letters from the Go gateway's `/api/v1/account/export` instead of placeholders; any section the gateway doesn't return is marked in `unavailable_sections`, never fabricated.
- `main.py` account deletion: generic client-facing 502 detail; full exception text stays in logs + privacy ledger.
- `routes/agent.py`: restored the authenticated-user dependency on every handler, passed the subject to `_career_engine_for`/`_job_seeker_engine_for` (per-user isolation), added `min_length=1/max_length=10` on `UniversalApplyRequest.job_urls`, and made `run_agent_task` use `AGENT_WORKSPACE_BASE`.
- `autonomous_career_engine.py`: `generate_interview_copilot_response` now propagates `LLMNotConfiguredError` (route maps to 503 `{"error":"ai_service_unavailable"}`) and only falls back for other exceptions; fixed the pre-existing single-arg `llm_complete(prompt)` calls (function requires `system_message` + `user_message`).
- Go `routes_resume_extra.go`: stable client-safe import message (keeps upstream status mapping + detailed `log.Printf`); `handleAnalyzeResume` guards `s.DB`/`s.DB.Conn` and returns 404 only for `sql.ErrNoRows`, otherwise 500/503.
- `agent_engine.py` + `browser_operator.py`: `navigate_web` navigates the pinned-IP `target_url` with the original hostname carried in the `Host` header (so TLS/SNI still targets the real peer); `write_file_tool` opens with `O_NOFOLLOW` and catches filesystem errors; IPv6 pinned URLs are bracketed; Step 3 records true success/failure; the REPL snippet has no imports; `browser_operator.navigate` no longer passes the unsupported `headers=` to `page.goto`.
- Frontend: `AutonomousCareerConsole`, `JobSeekerAgentDashboard`, `InterviewVoiceCoach`, `PrivacyReadiness`, and `Settings` now use the configured `apiFetch` helpers, remove fabricated fallbacks, validate response shapes, and gate AI output on the health `active_engine`.

### Root cause
- Auth was duplicated with a hardcoded fallback secret and a `except (jwt.PyJWTError, Exception)` that converted server faults to 401. Export data and RAG answers fabricated content instead of querying real sources. Agent code executed untrusted LLM output, wrote files with a symlink TOCTOU gap, and navigating the original hostname let DNS rebinding re-point the URL at a private address. `browser_operator` passed an invalid `headers=` param to `page.goto`.

### Fix applied
- Single shared auth dependency with fail-fast secrets and precise error classification; gateway-backed export with explicit `unavailable_sections`; generic client errors with server-side detail; O_NOFOLLOW writes, IPv6 bracket pinning, original-URL navigation, import-free REPL snippets, valid Playwright `goto` args; `apiFetch`-based frontend flows with controlled error states.

### Reusable lesson
- Authentication and JWT policy belong in exactly one module; a baked-in secret default is worse than a startup failure. Never fabricate data in API responses — mark sections unavailable instead. `except (jwt.PyJWTError, Exception)` is a bug: it hides server faults as client errors. Verify every third-party SDK argument against the pinned SDK version (Playwright `goto` has no `headers=`). Pin IPs only at the routing layer and preserve the original hostname for TLS certificate and SNI verification — but do it via the `Host` header on the pinned-IP URL, never by navigating the original hostname.


## 2026-08-03 — Agent engine: DNS-rebinding-safe navigation, AST code guard, descriptor-safe writes

### What was done
- `navigate_web` now navigates to the validated `target_url` (pinned IP literal + port) WITH the original hostname in the `Host` header, instead of `original_url`. This closes the DNS-rebinding TOCTOU window while keeping TLS correct: the URL preserves the original hostname's IP pin while the `Host` header presents the real hostname to the server for TLS certificate/SNI verification and virtual-host routing.
- Integration-test evidence: `app/tests/test_agent_engine.py` asserts `browser.navigate` is called with the pinned `target_url` (`https://93.184.216.34:443`), `headers={"Host": "example.com"}` and `validate_redirects=True` (DNS-rebinding redirect + pinned-target tests); `test_resolve_and_validate_url_*` pin the resolved public IP and preserve `original_hostname` in the returned metadata.
- `browser_operator.navigate(url, headers=None, validate_redirects=False)` gained per-navigation extra headers (set before `goto`, reset in `finally`) and a `validate_redirects` mode that installs a route interceptor re-checking every redirect hop against `_is_safe_url` (blocks redirects to private/re-bound addresses), removed after the navigation.
- `_is_safe_code` replaced the raw `for token in code.split()` token scan with an AST Name-load check: a `ast.Name` with `Load` ctx whose `id` is in `disallowed_imports | disallowed_builtins` is rejected. String literals are `ast.Constant` nodes, so filenames like `open.py`/`os` embedded in generated code no longer false-reject.
- `write_file_tool` enforces the workspace boundary descriptor-atomically: open the workspace dir (`os.O_RDONLY | O_DIRECTORY`), then open each path component with `dir_fd` + `O_NOFOLLOW | O_DIRECTORY` (creating missing intermediate dirs via `os.mkdir(..., dir_fd=...)`), and create/open the final file `dir_fd=`-relative. No `realpath`/`makedirs`/final-only `O_NOFOLLOW`. All fds closed in a `finally`.
- `execute_task` Step 2: `os.listdir(self.workspace_path)[:5]` wrapped in try/except `OSError` → structured failed-step result; `max_steps` validated at the top (`ValueError` if not a positive int) and sliced directly with the validated value.
- Tests added to `app/tests/test_agent_engine.py`: DNS-rebinding redirect block, pinned target_url+Host-header navigation, `_is_safe_code` string-literal vs name-load cases, descriptor write (escape via `..`, symlink block, nested-dir create), listdir OSError, non-positive max_steps.

### Root cause
- Navigation used the original hostname after validation, so a DNS-rebinding attacker could re-point it at a private address post-check; `browser_operator` dropped the `Host` header needed for pinned-IP TLS. `code.split()` token scan false-rejected string contents (`'os'` filename). `realpath`-based workspace checks + final-only `O_NOFOLLOW` left a symlink TOCTOU. `os.listdir` could raise and crash the task. `steps_log[:max(1, max_steps)]` silently coerced non-positive steps.

### Fix applied
- See "What was done" — pinned target + Host header + redirect revalidation; AST-only name guard; dir-fd walk with O_NOFOLLOW on every component; structured listdir failure + validated slicing.

### Reusable lesson
- Pinning IPs must happen at the routing layer and be paired with the correct Host header, and redirect hops are a second, independent resolution surface that must be revalidated. Never tokenize source by `split()` for security — parse the AST. `realpath` is not atomic; `dir_fd` + `O_NOFOLLOW` is. Validate bounds before slicing/looping, and convert expected OS errors into structured results rather than letting them propagate.


## 🏗 Parallel Stack Port Remapping & Bind Conflicts

When running multiple containerized architectures that rely on heavy self-hosted middleware (such as Supabase, Kong API Gateway, and custom Go/Python backends), port binding collisions on host adapters will prevent startups.

### Remapping Strategy

To enable simultaneous execution with your active **Mukthi Guru** containers, we successfully isolated and mapped all exposed host ports of Tayari Skill Boost to unoccupied alternatives:

| Service | Container Name | Host Port | Internal Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Vite Frontend** | `tayari-frontend` | **4175** | `4173` | React static site preview |
| **Go Backend** | `tayari-backend-go` | **8085** | `8080` | Core API logic |
| **Python AI** | `tayari-backend-ai` | **8002** | `8001` | Resume optimizer & mock interviews |
| **Supabase Kong** | `supabase-kong` | **8008** | `8000` | API gateway / Reverse Proxy |
| **Supabase Studio** | `supabase-studio` | **3005** | `3000` | Local Supabase DB admin panel |
| **Supabase Postgres** | `supabase-db` | **54326** | `5432` | Self-hosted database |

### Architectural Insights
1. **Host Port vs Internal Network**: Containers inside their respective isolated Docker Compose networks communicate using default internal service names and ports (e.g. `db:5432` or `kong:8000`) without collision; only host-exposed port mappings conflict.
2. **Supabase Gotrue Redirects**: GoTrue manages OAuth callbacks and redirect URLs. When remapping the Kong gateway port (`8000` -> `8008`), all callback URLs (e.g. Google/Github/LinkedIn redirects, `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`) defined in `docker-compose.yml` MUST be updated to point to the new port (`http://localhost:8008`) instead of the defaults.
3. **Environment Alignment**: Frontend and backend `.env` variables must strictly match the remapped host ports (`VITE_SUPABASE_URL=http://localhost:8008`, `VITE_API_URL=http://localhost:8085/api`, and `FRONTEND_URL=http://localhost:4175` with matching CORS origins) to ensure smooth client connections and prevent preflight CORS check failures.

---

## ⏱ Database Migration Healthcheck Latency on First Boot

On the first-ever startup of a self-hosted Supabase DB instance, the database container boots and the GoTrue/Auth container runs a massive list of core database migrations (65 migrations in our case) to set up tables and functions.

### The Gotcha
* Running these migrations took about **26.7 seconds** to complete.
* Under strict healthcheck rules (e.g. `retries: 3`, `interval: 5s` = 15 seconds max), the container is prematurely flagged as unhealthy before migrations complete.
* This causes Docker Compose to abort the startup of downstream services that list the Auth service as a dependency.

### The Remedy
1. Allow more generous healthcheck grace periods or retries inside `docker-compose.yml`.
2. Or, run `docker compose up -d` a second time. Since database tables are already initialized, subsequent container startups are immediate, passing the health checks instantly and spinning up all downstream dependencies seamlessly.

---

## 🛠 React ESLint, useCallback & TypeScript Refactoring

When adding interactive pages like `AgentPanel` and expanding pages like `ReviewQueue`, TypeScript strict rules and react-hooks lint rules can cause compilation failures.

### The Problem
* Prototyping features using `any[]` or `any` triggers `no-explicit-any` ESLint errors.
* Running asynchronous data-fetching hooks (e.g. `fetchQueue()`, `fetchTasks()`) inside `useEffect` without including them in dependencies throws `react-hooks/exhaustive-deps` warnings.

### The Remedy
1. **Define typed interfaces**: Always declare clear schemas (e.g., `AgentTask`, `AgentEvent`, `RuntimeApproval`) for API objects instead of relying on `any`.
2. **Memoize fetching handlers**: Wrap any functions called inside `useEffect` with `useCallback` to avoid trigger-loops and keep dependency arrays stable.

---

## 🧹 Keyword Gap Analysis — Stopword Pollution is Invisible but Deadly

The original `_tokenize()` function used only 17 stopwords. The gap analysis reported words like `'ll'`, `'re'`, `'if'`, `'one'`, `'put'` as "skill gaps", making the output completely unusable.

### The Lesson
- **Never trust a keyword extractor without a proper stopword list.** The Python `nltk.corpus.stopwords` English set has 179 words and removes all grammar words automatically. Supplement it with a curated `TECH_SKILL_WHITELIST` for terms like `python`, `sql`, `go`, `r` that are short enough to be filtered by a naive length check but are real skills.
- **Always filter "missing keywords" by a `_is_meaningful()` guard** — only surface bigrams, whitelist tech terms, and tokens ≥ 4 chars that don't end in common non-skill suffixes (`-tion`, `-ness`, `-ful`).
- **A heuristic ATS score of 91% can be achieved purely from grammar word overlap** — this tells you nothing real. Always validate that `matched_keywords` looks like actual skills, not function words.

### The Fix (in `ats_engine.py`)
```python
STOPWORDS = _build_stopwords()  # 216 words via NLTK + base list
TECH_SKILL_WHITELIST = {"python", "sql", "go", "r", "spark", "kafka", ...}  # 86 terms

def _is_meaningful(kw: str) -> bool:
    if kw in TECH_SKILL_WHITELIST: return True
    if ' ' in kw: return True  # bigrams always meaningful
    if len(kw) < 4: return False
    ...
```

---

## 📐 Semantic Similarity vs Heuristic ATS Score — They Measure Different Things

After fixing stopwords, two distinct metrics are needed:

| Metric | What it measures | When to use |
|---|---|---|
| **Heuristic ATS score** | Structural compliance (sections, bullets, dates, format) | Diagnosing format problems |
| **Semantic similarity (TF-IDF cosine)** | Language alignment — does your resume *talk like* the JD? | Diagnosing terminology gaps |

### The Lesson
- A resume can score 80%+ on ATS heuristics (great structure) but only 30% on semantic similarity (completely different vocabulary from the JD). Both numbers are needed.
- **TF-IDF cosine similarity requires zero new packages** — implement it with Python's `math` stdlib and `collections.Counter`. No `scikit-learn` needed, which avoids adding ~50MB to the Docker image.
- The formula: tokenize both docs → compute TF × smoothed IDF per term → dot product / (magnitude_A × magnitude_B).

---

## ⭐ STAR Method Scoring — Heuristic Scoring Works Without an LLM

The cv-tailor SKILL.md defines STAR (Situation / Task / Action / Result) as the gold standard for resume bullets. A lightweight heuristic can score 0–4 without an LLM call:

| Element | Heuristic signal |
|---|---|
| **Action** | Bullet starts with a known action verb |
| **Result** | Contains `\d+%`, `$\d`, `\d+[kKmM]`, or any 2+ digit number |
| **Task** | Mentions `team`, `system`, `platform`, `service`, `pipeline`, `model` |
| **Situation** | Contains `across`, `within`, `for`, `during`, `supporting`, `serving` |

Score 0–1 bullets are the ones to flag. **Never fabricate metrics** — use `~20-30% [ESTIMATE]` ranges instead, which is honest and still passes ATS.

---

## 🤖 Humanization Pass — Two-LLM Pipeline Prevents AI-Sounding Resumes

When an LLM rewrites a resume, it often:
- Repeats the same action verbs multiple times
- Inserts keywords unnaturally ("Leveraged Apache Spark to facilitate Apache Kafka-driven Apache Flink pipelines")
- Uses overly formal structures that don't sound like a real human wrote them

### The Fix
Run a **second, separate LLM call** after the optimization pass with a dedicated humanization system prompt:
```
You are a professional resume editor. Make this text sound natural and human-written.
Remove AI patterns: overly formal phrasing, repetitive sentence structures, awkward keyword
insertions. Keep ALL facts and metrics. Output only the improved resume.
```
Use `temperature=0.4` (slightly higher than the optimizer's `0.3`) to allow more natural variation.

### Guard against failure
Wrap in `try/except` and fall back to the pre-humanization text if the LLM call fails — humanization is a polish step, not a critical path.

---

## ⚡ NVIDIA NIM Provider — Auto-Detection + Exponential Backoff Pattern

From the `askmukthiguru` project, the reliable pattern for NVIDIA NIM in production:

1. **Auto-detect**: If `NVIDIA_NIM_API_KEY` is set and `LLM_PROVIDER` is unset, automatically use NIM. Don't require users to set `LLM_PROVIDER=nvidia_nim` explicitly.
2. **3-attempt exponential backoff**: On 429 (rate limit), 500, 502, 503 — wait `2^attempt` seconds (1s, 2s, 4s) before retrying.
3. **Pass `stream: False` explicitly** — the NIM API sometimes defaults to streaming, which breaks synchronous `httpx` parsing.
4. **Model default**: `meta/llama-3.1-70b-instruct` via `https://integrate.api.nvidia.com/v1`

```yaml
# docker-compose.yml — pass-through pattern
- NVIDIA_NIM_API_KEY=${NVIDIA_NIM_API_KEY:-}
- NVIDIA_NIM_MODEL=${NVIDIA_NIM_MODEL:-meta/llama-3.1-70b-instruct}
- NVIDIA_NIM_BASE_URL=${NVIDIA_NIM_BASE_URL:-https://integrate.api.nvidia.com/v1}
```

---

## 📋 cv-tailor Skill Integration — 5-Phase Pipeline Is the Right Structure

The cv-tailor SKILL.md defines a 5-phase SOP that maps cleanly onto a code pipeline:

| Phase | Code function | Output |
|---|---|---|
| Phase 1: Baseline | `_baseline_parse()` | sections, word_count, format_type |
| Phase 2: Keyword matrix | `_phase2_keyword_matrix()` | hard/soft/domain coverage % |
| Phase 3: STAR rewrite | LLM call + `_analyze_star_scores()` | per-bullet STAR grades |
| Phase 4: ATS + humanize | `heuristic_ats_score()` + `_humanize_pass()` | format score + natural prose |
| Phase 5: Final output | `optimization_summary` dict | before/after dashboard |

**Key rule from cv-tailor**: Required keyword coverage ≥ 80% = passing. ≥ 90% = excellent. Always categorize into hard skills (tech stack), soft skills (competency), domain keywords (industry terms) — never dump them all in one flat list.

---

## 🔬 Confidence Rating — Be Honest About Score Meaning

After Phase 2:

| Component | Confidence | Why |
|---|---|---|
| Keyword gap analysis | **9/10** | NLTK stopwords + whitelist = real signal |
| Semantic similarity (TF-IDF) | **7/10** | No sentence-transformers; TF-IDF misses synonyms |
| STAR scoring (heuristic) | **7/10** | Regex is good enough for flagging; misses nuance |
| Humanization quality | **8/10** | Depends on NIM output; has safe fallback |
| NIM provider reliability | **9/10** | 3-attempt backoff handles transient failures |
| Heuristic ATS score | **7/10** | Structural only; not a real Greenhouse/Workday score |

---

## 🛡 Redirect-Based SSRF — `follow_redirects=True` Silently Opens Internal Networks

When using `httpx.AsyncClient` to fetch external URLs, `follow_redirects=True` lets an attacker bypass `assert_safe_public_url` by providing a URL that 302-redirects to `http://169.254.169.254/` or other internal services.

### The Fix
Set `follow_redirects=False` and manually follow redirects, calling `assert_safe_public_url` on each resolved hop:

```python
async def _safe_redirect_get(client, url, **kwargs):
    max_redirects = 5
    current = url
    for _ in range(max_redirects):
        res = await client.get(current, follow_redirects=False, **kwargs)
        if res.status_code in (301, 302, 303, 307, 308):
            location = res.headers.get("Location", "")
            assert_safe_public_url(urljoin(current, location))
            current = urljoin(current, location)
            continue
        return res
    return await client.get(current, follow_redirects=False, **kwargs)
```

---

## 🔄 `CandidateAnswerBank.tsx` Load/Save Round-Trip — Truthy Checks Lose Empty Strings

Using `if (parsed.field)` to restore form state from localStorage silently drops intentionally cleared fields. If a user clears a text input and saves, the empty string is not restored because `""` is falsy.

### The Fix
Replace truthy checks with explicit type checks: `typeof parsed.field === "string"`. This preserves empty strings and still rejects non-string values like `null`/`undefined`.

Also: **every field that is loaded must be saved**. If diversity fields are loaded from saved state but omitted from the save payload, they disappear on the next save+reload.

---

## 🧩 `CustomQA` Shape Validation — Guard Against Corrupt localStorage

When restoring `customQAs` from `localStorage`, a direct `if (parsed.customQAs) setCustomQAs(parsed.customQAs)` silently passes non-array or malformed data, causing a runtime crash in the `.map()` render path.

### The Fix
Define a type guard that validates both the array wrapper and the shape of each element:

```typescript
const isCustomQAArray = (v: unknown): v is CustomQA[] =>
  Array.isArray(v) && v.every(item =>
    typeof item === "object" && item !== null &&
    typeof item.id === "string" &&
    typeof item.question === "string" &&
    typeof item.answer === "string"
  );
```

---

## 🎯 Success Toast Outside Conditional — Toast Fires Even on Failure

If `toast.success(...)` sits outside a `if (data.pdf_available && data.pdf_data)` block, the user sees "Compiled Successfully!" even when the backend returns `pdf_available: False`.

### The Fix
Move the success toast *inside* the conditional. Add an `else` branch with a descriptive error toast so the user always gets honest feedback.

---

## 🗄 File-Backed Persistence for In-Memory Dicts — `candidate_answer_bank.py`

The `_answer_banks` dict was in-memory only — data lost on every restart. For a service that manages candidate screening answers, this effectively made it a toy.

### The Fix
Add JSON file persistence with `ANSWER_BANK_STORAGE_PATH` env var (defaults to `data/answer_banks.json`). The `get_answer_bank()` function loads from disk on first access and persists after creating a new bank. Also: remove the `default_user` fallback and require a valid `user_id` with `ValueError` on empty.

---

## 🏷 Response Key Renames Require Downstream Audit — `verified_email_patterns`

Renaming a response key from `verified_email_patterns` to `inferred_email_patterns` changes the contract with every consumer. Even though no consumer was using the key by the old name in this round, the rename must be flagged: search all `find_recruiter_intel` call sites and the frontend `RecruiterOutreach` page to confirm they don't destructure the old key name.

### Lesson
Before renaming any response key, `grep` the entire codebase for both the old key name and the function that produces it.

---

## 📁 Postgres Entrypoint Ignores Subdirectories — `migrations/` Silently Skipped on Fresh Init

After `docker compose down -v`, the fresh Postgres container ran `init.sql` and `mvp_additions.sql` but silently ignored `backend/db/migrations/`. The Go backend hit `relation "tenants" does not exist` on every request, and resume creation returned 500.

### The Problem
Postgres's official Docker entrypoint only runs `.sql`/`.sh` files directly in `/docker-entrypoint-initdb.d/`. Subdirectories are logged as `ignoring /docker-entrypoint-initdb.d/migrations` and skipped. All 14 migration files were never executed.

### The Fix
Created `backend/db/init.sh` that runs `init.sql`, `mvp_additions.sql`, then iterates over all `migrations/*.sql` in sorted order via `psql -f`. Also inserts default tenant rows for `localhost` and `127.0.0.1`.

Since `.sh` runs before `.sql` in the entrypoint, the script creates everything first. The entrypoint's `.sql` phase re-runs `init.sql` and `mvp_additions.sql` — harmless due to `IF NOT EXISTS`.

### Verifying
```bash
# Count tables after fresh init — should be 51, not 17
docker compose exec postgres psql -U tayari -d tayari -c "\dt" | wc -l

# Check init.log for the critical line
docker compose logs postgres | grep "running /docker-entrypoint-initdb.d/init.sh"
```

---

## 🎯 Auth Redirect via `window.location.href` Bypasses React Router — Use CustomEvent

When the Go backend returned 401, `handleUnauthorized()` did `window.location.href = "/auth?expired=true"` — a hard navigation that bypasses React Router, losing all routing state and context.

### The Problem
- Hard redirect forces a full page reload, destroying React state
- URL param `?expired=true` was only visible on the auth page after reload, never consumed
- The redirect happened even on anonymous landing page visits, creating an unwanted bounce

### The Fix
Replace hard redirect with a `CustomEvent` dispatch:
```typescript
// In handleUnauthorized() — src/api/index.ts
window.dispatchEvent(new CustomEvent("auth:unauthorized"));
```

Then listen in `AuthContext.tsx` and let `ProtectedRoute` handle the navigation naturally:
```typescript
// AuthContext.tsx
useEffect(() => {
  const handler = () => { setUser(null); setSession(null); };
  window.addEventListener("auth:unauthorized", handler);
  return () => window.removeEventListener("auth:unauthorized", handler);
}, []);
```

### The Lesson
- `window.location.href` is an escape hatch, not a routing strategy — it tears down the entire SPA
- CustomEvent lets your auth layer signal React without coupling to a specific router version
- Anonymous root visits should never redirect to `/auth` — `ProtectedRoute` handles that per-route

---

## 💰 Vaporware Products Stay Visible with "Soon" Badge — Don't Hide Them

Sprint A removed "STAR mock interview prep" from Pro features in the pricing page and disabled `interviewPrep`/`interviewAI`/`voiceCoach` feature flags. But Mock Interview, Clash of Code, and Practice Problems remained in `ProductsSection.tsx` with `available: false`.

### The Fix
- Keep vaporware cards visible but disabled — users see the roadmap and know what's coming
- `ProductsSection.tsx` guards CTA buttons with `disabled={!product.available}` and shows a "Soon" badge
- `settings.showFullProductsSection` depends on `features.interviewPrep` (now `false`) — this hides the ProductsSection from the landing page entirely, so the "Soon" cards are only visible via direct nav or if the flag flips back
- Never remove nav entries from `features.ts` that are referenced by `getNavLinks()` — the `interviewPrep` flag already gates them; removing the entries breaks the nav entirely

### The Lesson
Don't hide unshipped features — mark them honestly. Users prefer "coming soon" over "missing" when evaluating a platform. But gate their routes via feature flags so they can't be navigated to.

---

## 🐘 Migrating Off Bare Postgres to Self-Hosted Supabase — Three Silent Traps

`docker-compose.yml`'s `postgres` service (a plain `postgres:16-alpine` image, self-hosted-JWT auth only) was replaced with the full self-hosted Supabase stack in `supabase-local/` (Postgres + GoTrue + PostgREST + Kong + Realtime + Storage + Studio + Supavisor), merged in via Compose's `include:` so `docker compose --profile dev up` still brings up everything in one command. Three bugs would have made this look broken even though the merge itself was correct:

### Trap 1 — `migrate.sh` globs `migrations/*.sql` non-recursively
The `supabase/postgres` image's own `/docker-entrypoint-initdb.d/migrate.sh` runs `for sql in "$db"/migrations/*.sql` — a flat glob. Mounting a host directory as a *subdirectory* under `migrations/` (e.g. `./volumes/db/init:/docker-entrypoint-initdb.d/migrations/tayari`) is silently invisible to it — zero tables get created, zero errors logged. Fix: mount each schema file individually as its own file (`./volumes/db/init/00-x.sql:/docker-entrypoint-initdb.d/migrations/zz-00-x.sql:Z`), same pattern the stack's own `realtime.sql`/`roles.sql`/etc. mounts already use. Prefix with something that sorts after every baked-in migration (dbmate-style timestamps like `20250417190610_*`) so `auth.users` and the `anon`/`authenticated`/`service_role` roles exist first.

### Trap 2 — `${VAR:?err}` in Compose interpolation isn't scoped by profile
Tried making `FLOWER_USER`/`FLOWER_PASSWORD` "required" via `${FLOWER_USER:?must be set}` in celery-flower's environment block. Compose interpolates `${VAR}` for every service in the file at parse time, regardless of which `--profile` is active — so this broke `docker compose --profile prod up` even though celery-flower (`profiles: ["dev"]`) never runs in prod. Fix: check for the value inside the container's own `command:` (`sh -c 'if [ -z "$$FLOWER_USER" ]; then exit 1; fi; exec ...'`) instead — that only fails when the service actually starts.

### Trap 3 — Supabase auth mode never bridged the session token to the REST client
`AuthContext.tsx`'s self-hosted-JWT branch wrote `localStorage.setItem('auth_token', ...)` on login, which `src/api/index.ts`'s `apiFetch` reads on every call to the Go backend. The Supabase branch (`supabase.auth.onAuthStateChange` / `getSession()`) only ever set React state and never wrote that key — so every `apiFetch` call in real Supabase mode went out with no `Authorization` header and 401'd, even though the user was genuinely signed in and `supabase.auth.getSession()` had a valid token. This was invisible because the project's actual default had always been self-hosted-JWT mode until now; flipping `USE_SUPABASE=true` by default was what first exercised the dead code path. Fix: write/clear `localStorage['auth_token']` from `session?.access_token` in both the `onAuthStateChange` callback and the initial `getSession()` call.

### The Lesson
When two auth strategies share one HTTP client but only one strategy was ever the default, the untaken branch can be broken for a long time with zero symptoms — the same class of bug as an untested `except` clause. Actually driving the untaken code path (real signup → real dashboard load, not just curling the API with a hand-copied token) is what surfaced all three traps; none of them would show up in a unit test or a backend-only smoke check.

---

## 🔧 51-Issue Remediation Sprint — Cross-Layer Hardening Lessons

This section documents the systematic fix of 51 issues across Go, Python, TypeScript/React, SQL, and test files in a single pass. Each issue was verified against current code, fixed minimally, and validated. All work performed on **2026-08-02**.

### 1. Go Gateway — Error Handling & Auth Consistency

| Date | Root Cause | Fix | Lesson |
|---|---|---|---|
| 2026-08-02 | `handleImportJobDescription` swallowed upstream error body and status, returning generic 502 | Inspect `result["error"]` and HTTP status; propagate 4xx detail upstream, map 5xx/transport/nil to 502 | **Never swallow upstream error bodies** — the import service returns actionable messages (e.g., "URL not publicly routable") that the client needs |
| 2026-08-02 | `user.ID` (UUID) vs `user.ID.String()` (text) used inconsistently in queries against `resumes.user_id` (UUID) and `job_descriptions.user_id` (text) | Confirmed column types; unified both queries to use `.String()` for text columns | **Schema drift happens** — always verify column types when binding owner IDs; don't assume consistency |
| 2026-08-02 | Test HTTP handlers used `t.Fatalf` which terminates the handler goroutine, not the test | Changed to `t.Errorf` + early `return` so failures report safely without killing the fake server | **`t.Fatalf` in HTTP handler closures terminates the handler, not the test** — use `t.Errorf` + early return |

### 2. Python AI Engine — Auth, Charset, JWT, Scraping, Fallbacks

| Date | Root Cause | Fix | Lesson |
|---|---|---|---|
| 2026-08-02 | `import_job_description` lacked auth and rate limiting despite being an outbound-fetch endpoint | Added `get_current_user` dependency + `limiter.limit("30/minute")` | **Outbound-fetch endpoints need auth + rate limiting** — they're SSRF vectors and cost money |
| 2026-08-02 | `_extract_imported_job_description` hardcoded UTF-8 decode, ignoring `charset` parameter | Parse `charset` from `Content-Type`; `HTTPException(422)` on missing/invalid/undecodable | **HTTP bodies aren't always UTF-8** — respect `charset` or reject explicitly |
| 2026-08-02 | `JWT_SECRET` had literal fallback `"tayari-super-secret-jwt-key-2026"` in `main.py` | Removed fallback; added startup check raising `RuntimeError` if neither `JWT_SECRET` nor `SUPABASE_JWT_SECRET` set | **Silent fallback secrets are security holes** — fail fast at startup, not at first auth request |
| 2026-08-02 | `scrape_jd_url` returned fabricated sentence "Job Description content scraped from {url}" on failure | Return `None`; caller raises `ValueError` to stop pipeline | **Never fabricate data on failure** — downstream logic treats it as real content |
| 2026-08-02 | `ResumeParser().parse()` fell back to "Candidate Professional Profile Resume" on parse failure/empty | Raise `ValueError` on parse failure/empty; no default resume text | **Fabricated fallback resumes pollute the optimizer** — surface the error, don't mask it |
| 2026-08-02 | `heuristic_before` referenced in `except` block but only defined in `try` block | Pre-compute `heuristic_before = heuristic_ats_score(resume_text, jd)` before try block | **Variables used in except blocks must exist before try** — compute fallbacks upfront |
| 2026-08-02 | `optimize_resume_with_options` called async `optimize_with_reflection` without `await` | Added `await` to return actual result dict instead of coroutine | **Async functions return coroutines** — missing `await` is a silent bug returning a promise, not a result |

### 3. Frontend — Accessibility, State, Real APIs

| Date | Root Cause | Fix | Lesson |
|---|---|---|---|
| 2026-08-02 | Onboarding form state (currentTitle, targetLevel, etc.) was only local placeholder, discarded on navigation | POST to `/api/v1/profile/onboarding` before navigation | **Placeholder state is not saved data** — persist through API before route change |
| 2026-08-02 | Step indicator circle hardcoded "1" instead of reading `step` state | Use `step` state variable in JSX | **DRY: if state exists, use it** — don't duplicate in JSX |
| 2026-08-02 | Track selector cards were clickable `<div>`s without keyboard/screen-reader semantics | Added `role="radio"`, `tabIndex`, `onKeyDown` for Enter/Space, `aria-checked` | **Clickable divs ≠ accessible controls** — need radio semantics, focus management, keyboard activation |
| 2026-08-02 | URL input had only placeholder, no associated `<Label>` | Added `<Label htmlFor="job-post-url" className="sr-only">` + `id` on Input | **Placeholder is not a label** — screen readers need explicit association |
| 2026-08-02 | `ApprovalDrawer` set `actionStatus` and removed item before API call; no rollback on failure | Await API, then update state; on error, show toast and preserve item | **Optimistic UI without rollback is broken UX** — await the write, handle failure |
| 2026-08-02 | Field label underscore replacement used `.replace('_', ' ')` (first match only) | Changed to `.replace(/_/g, ' ')` (global regex) | **String replace defaults to first match** — use global regex for all |
| 2026-08-02 | `editableFields` initialized once from `selectedApproval`, not updated when selection changed | `useEffect` syncing from `selectedApproval`; include in approval payload | **Derived state needs effects** — initial state isn't enough when selection changes |
| 2026-08-02 | `GmailConnectModal` used simulated timeout instead of real OAuth; missing dialog accessibility | Real `/auth/gmail/authorize` call; validate email first; Radix Dialog with proper semantics | **Simulated auth flows hide real integration bugs** — wire the real endpoint, add proper dialog accessibility |
| 2026-08-02 | `TayariComputerControlRoom` rendered hardcoded "live" data instead of subscribing to SSE | Subscribe to SSE `/api/v1/autopilot/stream/{runId}`; preview badge when disconnected | **Hardcoded "live" data is misleading** — either connect to real stream or label as preview |
| 2026-08-02 | Read-only URL input in control room lacked accessible name and label | Added `id`, `aria-label`, `readOnly`, associated `<label>` | **Read-only fields still need labels** — users need to know what they're viewing |
| 2026-08-02 | `/pricing` nav link rendered unconditionally; `App.tsx` redirect missing for pricing | Conditional render via `features.pricing`; redirect in `App.tsx` | **Nav and routes must share the same flag** — inconsistent gating = 404s |
| 2026-08-02 | Billing toggle was visual-only; missing `role="switch"` and `aria-checked` | Added `role="switch"`, `aria-checked`, `aria-label` | **Visual toggles ≠ semantic switches** — AT needs `role="switch"` and `aria-checked` |
| 2026-08-02 | Omnisave search input/button lacked accessible names; button didn't reflect loading state | `sr-only` label + `id`/`aria-label`; dynamic button `aria-label` for loading | **Loading state changes button meaning** — update accessible name, not just visual |
| 2026-08-02 | `handleAskRAG` used hardcoded answer/citations instead of calling backend | Call `/v1/knowledge-hub/query`; populate from response; error handling | **Hardcoded responses in components = untested integration** — wire the real API |

### 4. Database — Composite Unique Constraint

| Date | Root Cause | Fix | Lesson |
|---|---|---|---|
| 2026-08-02 | `idempotency_hash` had global `UNIQUE`, preventing different users from saving same source | Drop column `UNIQUE`; add `UNIQUE(user_id, idempotency_hash)` | **Per-user deduplication ≠ global deduplication** — composite keys allow cross-user sharing |

### 5. SSE Handler — Real State Polling

| Date | Root Cause | Fix | Lesson |
|---|---|---|---|
| 2026-08-02 | SSE emitted hardcoded timer-driven steps instead of actual run state | Poll `public.autopilot_runs.current_stage`; emit on change; keepalive frames; absolute deadline | **SSE must reflect actual backend state** — timers drift, state doesn't |
| 2026-08-02 | No authorization check that run belongs to authenticated user | Load run, verify `candidate_id == user.id` before streaming | **SSE streams need authorization per-resource** — not just auth header |
| 2026-08-02 | Handler set manual `Access-Control-Allow-Origin`, overriding middleware | Remove; rely on `cors.Handler` | **Middleware owns CORS** — handler overrides break credentialed EventSource |

### 6. Validation Middleware — Body Limits & Field Names

| Date | Root Cause | Fix | Lesson |
|---|---|---|---|
| 2026-08-02 | `io.ReadAll` read unbounded request body into memory | `io.LimitReader(r.Body, 1<<20)` (1MB); 413 on overflow | **Always bound request body reads** — unbounded = OOM vector |
| 2026-08-02 | Validation errors used Go struct field names (e.g., `CandidateID`) not JSON keys (`candidateId`) | Register `validator.SetTagNameFunc` to derive JSON names (strip `omitempty`) | **API errors must match request keys** — `candidateId` not `CandidateID` |

### 7. Python Agent — DNS Rebinding & Header Scope

| Date | Root Cause | Fix | Lesson |
|---|---|---|---|
| 2026-08-02 | `_resolve_and_validate_url` computed `pinned_ip` but didn't enforce it for navigation | Replace hostname in URL with validated IP; preserve `Host` header for virtual hosting | **DNS rebinding defense requires IP pinning at dial time** — validation alone is insufficient |
| 2026-08-02 | `BrowserOperator.set_extra_http_headers` applied headers context-wide across navigations | Use `page.goto(url, headers={})` per-request; remove silent `try/except` | **Global headers leak across navigations** — scope to the request, surface errors |

### 8. Autopilot Graph — Real Services, Persistence, Failure Handling

| Date | Root Cause | Fix | Lesson |
|---|---|---|---|
| 2026-08-02 | Five stages (tailor_resume, generate_cover_letter, prepare_auto_apply, gather_recruiter_intel, compile_interview_kit) returned hardcoded mock outputs | Call real services (`optimizer`, `CoverLetterGenerator`, etc.); add `simulated: true` if gated | **Hardcoded stage outputs = fake pipeline** — wire real services or explicitly mark simulated |
| 2026-08-02 | Checkpoints accumulated in `self.checkpoints` dict, lost on restart | Persist via `public.autopilot_runs.state_payload` per documented PostgresSaver | **In-memory checkpoints don't survive restarts** — use the documented PostgresSaver table |
| 2026-08-02 | `execute_run` had no failure handling; node exceptions bubbled up silently | Catch exceptions, set `stage: "FAILED"`, log error, persist, return failed state | **Silent success on node failure hides broken runs** — explicit failure state enables retry/debug |

### 9. Omnisave — UUIDs, User Isolation

| Date | Root Cause | Fix | Lesson |
|---|---|---|---|
| 2026-08-02 | Sequential `len()`-based IDs for sources/chunks race under concurrent writes | `uuid.uuid4()` for sources + chunks | **Sequential IDs race in concurrent writes** — UUIDs are collision-resistant |
| 2026-08-02 | In-memory dedup/insert didn't serialize; race between check and insert | Atomic DB insert with `ON CONFLICT (user_id, idempotency_hash) DO NOTHING` | **Race conditions need DB constraints** — app-level checks don't serialize |
| 2026-08-02 | `query_knowledge_rag` didn't filter by `user_id`; cross-user leakage | Filter `source_chunks` and `saved_sources` by `user_id` before `top_k` | **Multi-tenant RAG must filter by tenant** — cross-user leakage is a security bug |

### 10. Sandbox Executor — Lifecycle, Field Mapping, No Fabrication, Redaction

| Date | Root Cause | Fix | Lesson |
|---|---|---|---|
| 2026-08-02 | `execute_form_auto_fill` navigated without validating URL first | Call `_resolve_and_validate_url` before `browser.navigate` | **Reuse the SSRF validator** — don't duplicate or skip |
| 2026-08-02 | Missing `__aenter__`/`__aexit__`/`close`; browser not closed on all paths | Implement delegating to `self.browser`; call in `finally` | **Resource cleanup needs context manager protocol** — matches `GeneralistAgentEngine` |
| 2026-08-02 | Generic `textbox`/`searchbox` matched "Company name" → personal name field | Role→field map with specific tokens (`email`, `phone`, `company`) before generic `name` | **Label-based field matching needs specificity ordering** — "Company name" ≠ personal name |
| 2026-08-02 | Fabricated "Simulated Submit Button Click" action claimed success without real operation | Call `browser.fill` per field; track `any_real_action`; `simulated: true` flag | **Reporting fake actions as success = false confidence** — only real ops count |
| 2026-08-02 | `SENSITIVE_PATTERNS` over-redacted broad uppercase tokens (`POSTGRES`, `REQ12345`) | Narrow `[A-Z0-9]{8,9}` → `[A-Z]{1,2}[0-9]{6,7}`; apply to all string values; recurse into lists | **Secret patterns need precision** — broad uppercase matching catches false positives; key-based guards miss values in unexpected keys |

### 11. Tests — Assertions & Isolation

| Date | Root Cause | Fix | Lesson |
|---|---|---|---|
| 2026-08-02 | `warning_alert` test only checked key presence, not expected value | Assert exact value (`False`) and `action` (`needs_review`) | **Presence checks miss logic bugs** — assert the expected outcome |
| 2026-08-02 | `query_knowledge_rag` test didn't pass `user_id` to both ingest and query | Explicit `user_id` to both; assert citation includes ingested source | **Multi-tenant tests must isolate by tenant** — shared state = false positives |
| 2026-08-02 | E2E test used hardcoded `TEST_PASS` fallback credential | Read from `E2E_TEST_PASSWORD` env; generate unique email per run (`timestamp@`) | **Hardcoded credentials in tests = rotation nightmares** — use CI secrets + per-run isolation |
| 2026-08-02 | Registration `beforeAll` didn't assert status; 409 path didn't verify credentials | Assert 200 or 409; on 409, verify login succeeds | **Silent registration failures poison subsequent tests** — fail fast on setup |

---

## 🚀 5W Analysis & Master Architectural Adaptations (Phases 1 – 18)

This section documents the end-to-end 5W Analysis (Who, What, Where, When, Why) and technical learnings from integrating 57 architectural capabilities across 18 phases from `cognee`, `ai-job-search`, `TencentDB-Agent-Memory`, `anakin`, Vimal's Ontology architecture, and Erfan's System Design.

### 📊 5W Strategic Analysis

#### 1. WHO (Actors, Agents & Role Protocols)
* **Autonomous Multi-Agent Squad**: `Scout` (web scraping & research), `Builder` (resume bullet tailoring & cover letters), `Reviewer` (ATS compliance & hallucination-check critique), `Memory` ($L0 \rightarrow L3$ distillation & knowledge graph updates).
* **Candidates & Recruiters**: Candidates targeting specific technical roles (e.g., Data Engineer); recruiters communicating across email/InMail evaluated by Sentiment & Tone Analyzers.
* **AI Models & Frameworks**: Gemini 2.5 / Llama 3.1 70B Instruct / NetworkX Directed Graph / Cross-Encoder Vector Embedding Re-Ranker / PyPDF2 / AST CodeGraph.

#### 2. WHAT (Core Delivered Capabilities - 57 Modules across 18 Phases)
* **Scraper & Anti-Bot Infrastructure**: Headless Playwright Provider (`playwright_local.py`), Unified Batch Scraper (`batch_scraper.py`), Thompson Sampling Proxy Sampler (`thompson_proxy_sampler.py`), Domain CAPTCHA Rules (`domain_rules.py`), Stealth Cookie Jar (`stealth_cookie_jar.py`), Scraper Rate Limiter (`rate_limit_controller.py`), Smart DOM Cleaner (`dom_cleaner.py`).
* **Graph Memory & Ontology Systems**: NetworkX Candidate Knowledge Graph (`knowledge_graph.py`), $L0 \rightarrow L3$ Memory Distillation (`memory_distillation.py`), Semantic Ontology Guardrails (`ontology_guard.py`), Truth Subspace Vector Alignment (`truth_subspace.py`), `.tayarisave` Memory Exporter (`memory_exporter.py`), Memory Cleaner (`memory_cleaner.py`), Sub-Graph Visualizer (`graph_visualizer.py`), Skill Graph Community Detector (`graph_communities.py`), Multi-Hop Graph Traversal Engine (`graph_traversal.py`), Relational Graph Storage Adapter (`relational_graph_adapter.py`), Entity Disambiguator (`entity_disambiguator.py`).
* **Fit Evaluation & Career Intelligence**: 5D Fit Evaluator (`ats_engine.py`), Drafter-Reviewer Resume Tailoring (`drafter_reviewer.py`), STAR Interview Prep (`interview_prep.py`), Profile Expander (`profile_expander.py`), Follow-Up Generator (`followup_generator.py`), ATS PDF Validator (`ats_pdf_validator.py`), Portal Scaffolder (`portal_scaffolder.py`), Custom Template Registry (`template_registry.py`), Salary Negotiation Copilot (`negotiation_engine.py`), Answer Bank Pre-populator (`answer_bank_service.py`), HyDE Expander (`hyde_engine.py`), Recruiter Cold Outreach (`recruiter_outreach.py`), iCal Event Exporter (`calendar_exporter.py`), Ghost Job Detector (`legitimacy_checker.py`), Style Delta Logger (`style_delta_logger.py`), Response Sentiment Analyzer (`response_sentiment_analyzer.py`), Keyword Density Optimizer (`keyword_density_optimizer.py`), Mock Interview Simulator (`mock_interview_simulator.py`), Career Trajectory Predictor (`career_trajectory_predictor.py`), Multi-Modal Resume Parser (`multimodal_resume_parser.py`), Offline HTML Dashboard (`pipeline_dashboard_generator.py`).
* **Agent Squad & Code Intelligence**: AST CodeGraph Indexer (`codegraph_service.py`), Skill Library (`skill_library.py`), Agent Squad Protocol (`agent_squad.py`), Token Compressor (`token_compressor.py`), Agent Audit Logger (`agent_audit_trail.py`), Session Snapshotter (`session_snapshotter.py`), Agent Consensus Protocol (`agent_consensus.py`).
* **Advanced Hybrid Search & Semantic Retrieval**: LLM Dynamic Title-to-Description Intent Matcher (`semantic_role_matcher.py`), Cross-Encoder Vector Embedding Re-Ranker (`vector_embedding_reranker.py`), Graph RAG 2-Hop Sub-Graph Context Retriever (`graph_rag_retriever.py`), Reciprocal Rank Fusion Engine (`rrf_hybrid_fusion.py`), Unified Hybrid Search Engine (`hybrid_job_search_engine.py`), End-to-End Application Pipeline Engine (`end_to_end_pipeline.py`).
* **Advanced Go Concurrency Systems**: Go Reverse Proxy AI Client (`client.go`), Go Worker Pool (`worker_pool.go`), Go Token Bucket Rate Limiter (`rate_limiter.go`), Go Multi-Tier Cache Router (`cache_router.go`), Go Pub/Sub Event Bus (`event_bus.go`).

#### 3. WHERE (Architectural Placement & Component Boundaries)
* **Python AI Engine (`backend/python/`)**: AI inference, NLP, NetworkX graph distillation, vector search, scraper infrastructure, and REST adaptation routes.
* **Go API Gateway (`backend/go/`)**: Reverse proxying, high-concurrency worker pools, token bucket rate limiters, multi-tier memory cache, and pub/sub event bus.
* **Frontend SPA (`src/`)**: Feature flag registration (`adaptationsPortal`) and local-first self-hosted Supabase compatibility.

#### 4. WHEN (Lifecycle Execution & Triggers)
* **Job Search Phase**: User inputs role queries (e.g. `Data Engineer`); system matches postings using dynamic LLM title-to-description intent matching without static signature arrays.
* **Scraping Phase**: Scraper accesses job portals; Playwright renders dynamic JS content when anti-bot triggers occur.
* **Application Phase**: End-to-end pipeline assesses Ghost Job risk, evaluates 5D ATS fit score, generates tailored bullets via Drafter-Reviewer loop, verifies factual claims against NetworkX candidate graphs using Ontology Guard, and outputs submission-ready packages.

#### 5. WHY (Rationale & Business Impact)
* **Hallucination Mitigation**: Generated bullets are cross-checked against verified candidate skills before output; best-effort verification reduces fabricated claims rather than guaranteeing their absence.
* **Non-Standard Job Title Resilience**: Searching for target roles like `Data Engineer` successfully matches and ranks postings titled *"Analytics Platform Wrangler"* or *"Data Platform Architect"* via dynamic LLM + Vector + Graph RAG intent matching.
* **Local-First / Self-Hosted High Performance**: Concurrent Go worker pools and rate limiters keep the gateway fast on self-hosted infrastructure, while LLM inference (e.g. Gemini 2.5) still calls a hosted provider.

---

### 💡 Key Technical Lessons & Patterns Learned

1. **LLM Role Intent Classification Beats Hardcoded Signature Arrays**:
   - Static lists of job titles break when facing startup titles (e.g., *"Data Wrangler"*, *"Analytics Infrastructure Ninja"*).
   - Prompting LLMs to extract core technical competencies from the job description body and evaluate semantic intent substantially reduces manual rule churn for non-standard titles.

2. **NetworkX Directed Graphs Provide Local Zero-Dependency RAG Expansion**:
   - Vector search alone misses multi-hop relationships (`Candidate -> Skill -> Domain -> Target Role`).
   - Using NetworkX directed graphs (`nx.DiGraph`) allows 2-hop sub-graph context expansion locally in Python with zero external graph database dependencies (Neo4j/Memgraph).

3. **Reciprocal Rank Fusion (RRF) Combines Heterogeneous Retrieval Scores Cleanly**:
   - Cosine similarity scores, BM25 text relevance scores, and LLM confidence metrics have different distributions and scales.
   - Merging them via mathematical Reciprocal Rank Fusion ($RRF\_Score(d) = \sum \frac{1}{k + r_i(d)}$ with $k=60$) produces robust, balanced hybrid rankings.

---

## 2026-08-03 — Security and correctness fixes across env, DB, Go, Python, and frontend

### What was done
- Applied 20 requested fixes across the repo: `.env.example` E2E password placeholder, migration unique-constraint cleanup, Go float-to-int ID bounds, Python agent sandboxing/caching/persistence bounds, frontend error handling, and TypeScript type safety.
- Reverted unrelated pre-existing changes that had accumulated in the working tree so the diff stays focused on the requested issues.

### Root cause
- Several files had drifted: unsafe float-to-int conversion could overflow, agent code executed untrusted LLM output without a static guard, per-user engine caches and privacy buffers were unbounded, and frontend failure paths populated synthetic data or swallowed errors.

### Fix applied
- Added exactly-representable float64 bounds (`2^53-1`) before `int(v)` in `parsePositiveID`.
- Added an allow-list AST guard (`_is_safe_code`) before `self.repl.execute` for both initial and reflected code.
- Switched agent engine caches, privacy ledger buffers, and omnisave deduplication to bounded LRU behavior with explicit eviction.
- Wrapped export-data privacy-ledger queries and agent execute_task steps in structured exception handling.
- Replaced synthetic fallback scores/coaching in `InterviewVoiceCoach` with retryable error toasts; separated Settings delete/sign-out error handling; reset `PrivacyReadiness` fetch errors on successful wipe.

### Reusable lesson
- Keep requested fixes minimal by reverting unrelated working-tree drift before integrating; validate each subsystem independently; and always leave a dated `lessons.md` entry per project convention.

## 2026-08-03 — Settings: replace direct fetch with configured api/client helpers

### What was done
- `src/pages/Settings.tsx`: `handleExportData` now calls `exportUserData()` (from `@/api`, wraps `apiFetch` with `asBlob: true` → `/v1/user/export-data`) instead of a raw relative `fetch("/api/v1/user/export-data")` with manual `Authorization` headers and a fabricated demo fallback payload on non-OK. The returned Blob is downloaded directly.
- `handleDeleteAccount` now calls `deleteUserAccount()` (`apiFetch` DELETE → `/v1/user/account`, throws `ApiError` on non-OK) instead of the raw fetch with manual headers.

### Root cause
- Raw fetches duplicated auth-token plumbing and bypassed `apiFetch`'s configured base URL, `checkResponse` (401 → `handleUnauthorized` token clearing + redirect), and error handling. The demo fallback payload fabricated export data on failure, silently masking backend errors.

### Fix applied
- Deleted the manual token/header construction and the fallback payload; a non-OK export now throws into the existing `catch`, surfacing the "Export Failed" toast. Delete preserves the success toast, the independent sign-out try/catch (sign-out rejection clears the token, does not trigger "Deletion Failed"), and the deletion-failed toast.

### Reusable lesson
- Prefer the shared `@/api` helpers over raw `fetch`; they centralize the API base URL, `Authorization` header from `localStorage['auth_token']`, and 401 handling. Never fabricate fallback payloads on non-OK — let the error reach the UI's existing failure path.


## 2026-08-03 — Omnisave: DB-first idempotent ingest, real-LLM RAG answer, LLM-gated tests

### What was done
- `backend/python/app/services/omnisave_service.py`:
  - Added `_find_existing_source_db()` — looks up `public.saved_sources` by `(user_id, idempotency_hash)` via `app.services.db.get_pool()` (None-safe). `ingest_source` now short-circuits to an idempotent success (`{"success": True, "source_id": <existing id>, "chunks_created": 0, "source": <persisted row>}`) before minting a new UUID. The old in-memory dedup loop remains as supplemental handling only (guards within-process duplicates when DB is down).
  - `query_knowledge_rag` no longer fabricates `"Based on indexed knowledge [Source 1], ..."` — it calls `app.services.llm_service.llm_complete` with a grounding prompt built from the query + `rag_context_snippets`. `LLMNotConfiguredError` propagates (no swallow).
- `backend/python/app/api/knowledge_hub.py`: `/api/v1/knowledge-hub/query` now maps `LLMNotConfiguredError` → `JSONResponse(503, {"error": "ai_service_unavailable"})` (it previously caught all `Exception` → 502, so a missing LLM would have become a misleading 502).
- `backend/python/app/tests/test_omnisave_agent_reach.py`: split RAG exercise behind a `require_live_llm` fixture that asserts `is_llm_configured()` and `active_engine() != "unconfigured"` — hard-fails (not skip) when no real provider is configured. Non-LLM ingest assertions still run un-gated.
- `backend/python/app/tests/test_autopilot_system.py`: `test_omnisave_rag_engine` gates the RAG-answer assertions behind `is_llm_configured()` (skip) so the ingest assertions still run and no fabricated-answer assertion survives.

### Root cause
- `ingest_source` only deduped in-memory, so a fresh process could persist a second row (mitigated post-hoc by `ON CONFLICT DO NOTHING`). `query_knowledge_rag` returned fake AI text; tests asserted that fake text, so "green" meant nothing about real LLM output.

### Fix applied
- DB becomes the dedup source of truth; RAG answer comes from the configured LLM provider or an explicit 503; tests that require a live model fail fast or skip rather than assert fabricated output.

### Reusable lesson
- Idempotency keys must be checked against durable storage, not just process-local state. "Green" tests that assert fabricated LLM text are worse than a red test — they certify fiction. Always gate LLM-dependent tests on `is_llm_configured()`/`active_engine()`.


## 2026-08-03 — Autopilot graph: real-LLM content stages, honest tracker status, bounded checkpoints

### What was done
- `backend/python/app/services/autopilot_graph.py`:
  - `tailor_resume` / `generate_cover_letter` / `gather_recruiter_intel` / `compile_interview_kit` no longer emit hardcoded fabricated content. They call `app.services.llm_service.llm_complete` via a new guarded helper `_llm_or_unavailable` (wraps sources in an `<<<UNTRUSTED_USER_DATA>>>` prompt-injection delimiter).
  - `prepare_auto_apply` strips before the source check (`_has_required_sources`); `PAYLOAD_COMPILED` only when `full_name`/`email`/`phone` survive `_verified_contact` against the resume, else `MISSING_SOURCES` + `submit_ready: False`. Contact fields are taken from new `candidate_full_name/candidate_email/candidate_phone` state slots.
  - `update_tracker` no longer sets `APPLIED_AND_TRACKED` unconditionally — it only claims that when the payload records `submitted`/`submission_reference`; otherwise `SUBMISSION_PENDING` (stage stays `COMPLETED`).
  - `_save_checkpoint` is LRU-bounded to `_MAX_CHECKPOINTS = 200` via `collections.OrderedDict` (`move_to_end` on re-save, `popitem(last=False)` eviction).
  - `_claims_supported` now actually validates contact numbers, employer names (at/with …), and credentials (CISSP/AWS/PMP/MBA/Ph.D…) against `resume_text`/`job_description`.
  - `execute_run` honors stop-on-unavailable: when `provider_unavailable` is set, it halts before `gather_recruiter_intel`/`compile_interview_kit` and records `STOPPED_UNAVAILABLE` instead of fabricating dependent output.

### Root cause
- Content stages were pure string templates asserting skills/employers/recruiter names that existed nowhere in the sources (fabrication). `PAYLOAD_COMPILED` was claimed with empty contact fields. Tracker claimed `APPLIED_AND_TRACKED` with no submission. Checkpoints grew unbounded. `_claims_supported` was a marker-substring check that ignored the sources.

### Fix applied
- Provider-gated LLM generation with explicit `[UNAVAILABLE: …]` markers and a `provider_unavailable` flag the executor honors; verified-contact gating of the apply payload; honest `SUBMISSION_PENDING` vs `APPLIED_AND_TRACKED`; LRU checkpoint cap; grounding checks actually consult the sources.

### Reusable lesson
- A "guard" that only looks for placeholder substrings is theater — real grounding checks must diff generated claims against the source corpus. When a pipeline fabricates data, gate the content stages behind the configured LLM and stop downstream stages rather than emit invented output; and never mark a submission as applied until a submission is actually recorded. Beware the LRU-eviction test trap: mutating `_MAX_CHECKPOINTS` after construction on a class already has saved checkpoints is fine, but always assert against a fresh engine instance.


## 2026-08-03 — Agent engine fd ownership, redirect-handler scoping, omnisave conflict handling

### What was done
- `agent_engine.py` `write_file_tool`: `os.fdopen` now owns the final file descriptor; it is removed from the `opened` list once ownership transfers, and if `os.fdopen` raises the fd is closed explicitly and removed from `opened`, so the `finally` cleanup can never double-close a reused descriptor.
- `browser_operator.py`: `_install_redirect_validator` returns the per-navigation handler and `_uninstall_redirect_validator(handler)` takes it as an argument — the shared `self._redirect_validator` state is gone. `navigate` passes the local handler through its cleanup path, so overlapping navigations cannot clobber each other's handler, and `unroute(handler=...)` only removes the redirect interceptor, never the base `_ssrf_route_interceptor`.
- `omnisave_service.py`: DB-hit rehydration now also loads and stores the existing source's chunks into `self.source_chunks` so `query_knowledge_rag` can serve them from memory when the Postgres chunk lookup returns nothing. `_persist_source_db` returns an outcome (`inserted` + canonical source or provisional source + chunk count) and `ingest_source` discards provisional source/chunk state on a lost `ON CONFLICT` race, returns the canonical row, and reports `chunks_created: 0`. `_answer_is_grounded` validates every `[Source N]` citation against `sources_reference` (or accepts an explicit insufficiency answer) and replaces hallucinated citations with an insufficiency response.
- `test_agent_engine.py` `test_write_file_blocks_escape_via_symlink`: rewritten to create a symlink inside the workspace pointing to `outside.txt` and assert the write fails without modifying the external target.

### Root cause
- `opened` kept the final fd after `os.fdopen` took ownership, so the `finally` loop double-closed it. Redirect-validator handlers were stored on shared instance state, so overlapping navigations could unroute the wrong (or a stale) handler. Omnisave rehydration loaded only the source row, not its chunks, and a lost `ON CONFLICT` race left provisional state in memory while the DB held the canonical row. The RAG answer was returned verbatim, so hallucinated `[Source N]` citations could reach callers. The old symlink test never actually tested symlink escape.

### Fix applied
- See "What was done": fd-ownership transfer, per-navigation redirect handlers, chunk rehydration + conflict-outcome handling, citation grounding, and a real symlink-escape test.

### Reusable lesson
- When passing raw fds to `os.fdopen`, the file object owns the descriptor — remove it from any cleanup list before the `with` block closes it, and close explicitly only on the fdopen-failure path. Route handlers should be owned by the caller (returned and passed back), not stored as shared mutable state. `ON CONFLICT DO NOTHING` without `RETURNING` is a race signal: reconcile by unique key and discard provisional state. Validate LLM citations against the actual source set before returning them to users.


## 2026-08-03 — Omnisave chunk rehydration user_id, strict RAG citation grounding

### What was done
- `omnisave_service.py` `_load_source_chunks_db`: rehydrated chunks now carry `user_id` (selected from the DB and set on each returned chunk dict), so both rehydration paths in `ingest_source` (DB-hit dedup and lost `ON CONFLICT` race) append chunks the in-memory RAG fallback can find — it filters `self.source_chunks` by `user_id`. ID-based dedup preserved.
- `omnisave_service.py` answer validation: replaced the marker-substring insufficiency check with an exact-match insufficiency response constant (`_INSUFFICIENT_ANSWER_RESPONSE`). `_answer_is_grounded` now accepts ONLY the exact fixed insufficiency response without citations; every other nonempty answer must cite at least one `[Source N]` tag present in `sources_reference` and reject unknown tags. Mixed-insufficiency-substantive answers still require citations.
- `test_agent_engine.py` `test_write_file_blocks_escape_via_symlink`: assertion tightened to the stable `"Error: Failed to write file 'escape.txt'"` prefix so an unrelated handler failure cannot satisfy it.
- Added regression tests: chunk rehydration with DB pool disabled → in-memory RAG fallback returns them; lost-race discard of provisional state; citation-grounding unit cases (uncited, mixed-insufficiency, valid cited, unknown-tag, empty); uncited LLM answer replaced with the insufficiency response.

### Root cause
- `_load_source_chunks_db` returned chunk dicts without `user_id`, so rehydrated chunks were invisible to `query_knowledge_rag`'s user-filtered in-memory fallback. The old insufficiency check treated any answer containing "not enough" as insufficient even with citations, and accepted uncited substantive answers. The escape test asserted only the `"Error:"` prefix.

### Fix applied
- See "What was done": user_id on rehydrated chunks; exact-match insufficiency response + require-citation grounding; specific-failure assertion in the symlink test.

### Reusable lesson
- Rehydrated in-memory state must carry the same identity keys the fallback filters on, or it silently never matches. Grounding checks should be exact about the insufficiency contract — a marker substring is not a contract. Assertions should target stable error identity, not a generic prefix, or they can pass for the wrong reason.


## 2026-08-03 — Omnisave rehydration test: verify in-memory RAG user isolation

### What was done
- `app/tests/test_omnisave_agent_reach.py::test_ingest_rehydrates_chunks_with_user_id`: before the DB-disabled `query_knowledge_rag` fallback call, seeded `self.source_chunks` with a foreign user's chunk carrying distinguishable content ("FOREIGN SECRET…") and metadata (title "Foreign Top Secret Article", author, url). Assertions now check the RAG result contains no foreign content in `context_snippets`, no foreign citation, and still returns exactly the expected `TEST_USER_ID` citation (`Rehydrated Article`).

### Root cause
- The rehydration regression test proved chunks were loaded with `user_id`, but did not prove the in-memory fallback actually isolates per user — a leak of another user's chunks into the context would not have been caught.

### Fix applied
- See "What was done": foreign chunk seeded before the fallback call; assertions on snippet content, citation count, and citation titles.

### Reusable lesson
- A test that verifies data is stored with the right identity key is not the same as a test that verifies the consumer isolates by that key. Seed adversarial same-store entries and assert they never leak into results.


## 2026-08-06 — Guardrail truthfulness could report a pass it never performed; heuristic scorer invented a keyword match

### What was done
- `app/guardrails/gate.py` `PipelineGate`: when `original_text` is absent the truthfulness result is now `{"passed": False, "verified": False, ...}` instead of `{"passed": True, ...}`. Verified runs carry `"verified": True`. Added `require_truthfulness: bool = True` to `__init__` as the only opt-out, documented for surfaces that explicitly render "not verified" to the user.
- `app/main.py` `/api/v1/guardrails/check`: `GuardrailsCheckRequest` gained an optional `original_text`, passed through to the gate, so the endpoint can perform a real truthfulness check instead of structurally never having one.
- `app/services/predictive_scorer.py`: `keyword_score` is `None` when no job description is supplied (was a hardcoded `75`), and the overall score renormalizes over the remaining three components (`/0.60`) instead of absorbing a stand-in through a 40% weight. Removed the `min(max(keyword_score, 20), 100)` floor so a genuine zero overlap reports `0`, not `20`. Return dict gained `jd_provided` and `scoring_method: "heuristic"`; class docstring now states plainly that it is not a trained model and its output is not a callback probability.

### Root cause
- The gate treated "cannot verify" as "verified clean." Callers read `all_passed` as permission to auto-submit, and `/api/v1/guardrails/check` never sent an original, so that surface reported a truthfulness pass on 100% of requests without ever running the check. `automation_engine.py` and `optimizer.py` both do pass an original, so the exploitable path was the public endpoint — but the default made the safe behavior depend on every future caller remembering.
- The scorer's no-JD branch existed to keep `overall_score` on a familiar scale, but it did so by feeding a fabricated value into the highest-weighted term rather than by changing the weighting.

### Fix applied
- See "What was done": unverifiable truthfulness fails closed and is labeled `verified: False`; the keyword component is dropped and the weights renormalized when there is no JD.

### Reusable lesson
- A guardrail that cannot run must fail closed, not default to pass. "Skipped" and "passed" are different states and need different fields — collapsing them into one boolean makes the absence of a check indistinguishable from a clean check at every call site downstream.
- When a scoring component has no input, drop it and renormalize the weights. Substituting a placeholder keeps the number on scale by making it a different, unstated quantity — and the higher that component's weight, the more the placeholder dominates the result.


## 2026-08-07 — Frontend rate-limit helper; bun:test mock.module cross-file leak

### What was done
- Added `src/api/auth.ts` exporting `getAuthRateLimit(email)` — a thin wrapper over `apiFetch` hitting the new Go endpoint `GET /v1/auth/rate-limit?email=…` (Task 1, commit 2c7f0ec). Returns `{allowed, remainingAttempts, blockedUntil}`.
- Added `src/test/RateLimiter.test.ts` with two unit tests (encoded-email call shape + blockedUntil ISO passthrough).

### Root cause
- The brief's test stubbed `global.fetch` and called the real `apiFetch`. In isolation the test passed, but in the full `bun run test` run `ResumeGraph.test.tsx`'s `mock.module("@/api", …)` leaks across files and replaces the whole `@/api` barrel (re-exported by `index.ts`) with a mock whose `apiFetch` returns resume-graph data — so `getAuthRateLimit` got `{nodes, links}` instead of `{allowed, …}`. `mock.module` in bun:test persists for the whole process, not the file.

### Fix applied
- The test mocks `@/api/client` directly (via `mock.module`) with a minimal `apiFetch` that delegates to a `mockFetch` and parses JSON. This isolates the test from the cross-file barrel leak while still exercising the real `getAuthRateLimit` (the code under test) end-to-end through its `encodeURIComponent` + path construction.

### Reusable lesson
- `bun:test`'s `mock.module` is process-global, not file-scoped — a `mock.module("@/api", …)` in one test file silently replaces the barrel for every later file in the same `bun run test` invocation. When testing a module that imports from a barrel that another test file mocks, mock the leaf submodule (`@/api/client`) in your own test so you control the contract, or your "passes alone, fails in suite" test will be a flake nobody trusts.
- `mock.mockReset()` in bun also clears the default implementation; `mock.mockClear()` only clears call history. Use `mockClear` in `beforeEach` when you want to keep the default `mock(() => …)` impl and just add `mockResolvedValueOnce` per test.

## 2026-08-07 — Python resume generate-pdf endpoint (LLM optimize → local Typst render)

### What was done
- Added `POST /api/v1/resumes/generate-pdf` (+ `/api/resumes/generate-pdf` alias) to `backend/python/app/main.py` (Task 1 of the generate-resume-pdf edge-fn removal plan, commit b4c261d): `GenerateResumePdfRequest` → `llm_json(..., response_model=OptimizedProfile)` (single self-correcting LLM call) → `_map_profile_keys` (UI parsedResume → exporter dict) → LLM overlay (non-empty values only) → `generate_typst_code` + `compile_typst_to_pdf` → `{"pdf_base64": ...}`. UI template map (`modern/professional/creative/minimal/tech/executive` → exporter names; unknown → `executive_slate`), size guards (resume_text ≤50k, job_description ≤20k, applied_suggestions ≤50 → 400), 503 `ai_service_unavailable` on `LLMNotConfiguredError`.
- Added `backend/python/tests/test_resume_generate_pdf.py` (8 tests, TDD: wrote first, watched them fail on missing symbols, then implemented). Full suite 389 passed, 2 skipped; `py_compile` clean.

### Root cause
- N/A (new feature). Two notable discovery points: `app.main` import requires `JWT_SECRET` (existing suite convention — run pytest with it set); pydantic-typed FastAPI handlers called directly in tests receive the raw dict (no FastAPI coercion), so tests must pass `GenerateResumePdfRequest.model_validate({...})` — the existing `typst_compile_endpoint` direct-call pattern works only because that handler takes a plain dict.

### Fix applied
- N/A.

### Reusable lesson
- When mocking `llm_json`/`llm_complete` for a handler that imports them at module level, `monkeypatch.setattr("app.main.llm_json", ...)` works — but only if the handler references the module global. A local `from ... import` inside the handler body bypasses the mock silently; keep the import at module top.
- Handlers that lazily import subprocess-running modules (typst exporter) are trivially testable: `monkeypatch.setattr` on the module attribute resolves at call time.

## 2026-08-07 — Go resume generate-pdf proxy route (B1 loop-3, Task 2)

### What was done
- Added `handleGenerateResumePdf` to `backend/go/internal/api/routes_mvp.go` (after `handleExportResume`): unmarshals body into a struct (`resume_text`, `profile_data`, `analysis`, `applied_suggestions`, `job_description` *string, `template`), validates size guards BEFORE forwarding (resume_text ≤50k, job_description ≤20k, applied_suggestions ≤50 → 400 with Python's exact detail strings), forwards via `s.AI.PostJSON("/api/v1/resumes/generate-pdf", req)`, returns JSON passthrough `{"pdf_base64": ...}` (frontend decodes client-side). 502 BadGateway on AI failure, 500 on empty pdf_base64 (docx pattern).
- Registered both parity routes in `routes_app.go`: `POST /api/v1/resumes/generate-pdf` (protected group, after `{id}/export`) and `POST /api/resumes/generate-pdf` (legacy aliases).
- Added `backend/go/internal/api/routes_resume_pdf_test.go` (5 tests, TDD red→green: 405 before registration, then PASS): 200 passthrough + upstream path/method/body, alias route, 400 oversized resume_text (no upstream call), 400 oversized job_description (no upstream call), 502 on upstream 500. Full `go test ./...` green.

### Root cause
- N/A (new feature).

### Fix applied
- N/A.

### Reusable lesson
- chi prioritizes static segments over `{id}` params at the same position (already proven by `analyze-text` vs `{id}/optimize`), so a `resumes/generate-pdf` route is safe alongside `resumes/{id}/...` — no ordering trap.
- The `ai.Client` composes `BaseURL + endpoint` verbatim: the upstream path IS whatever you pass to `PostJSON` (config `PythonAIURL` = httptest server URL in tests). Assert `r.URL.Path` for the full `/api/v1/...` path, not a stripped variant.
- Go-side pre-validation of Python's size guards turns silent upstream 400s (which PostJSON surfaces as errors → 502) into clean client-facing 400s and avoids paying the forwarding round trip for obviously-invalid payloads.

## 2026-08-07 — Restore version-docx download filename (review fix, commit 99e8e9d)

### What was done
- Reverted a stray, undocumented change in `backend/go/internal/api/routes_mvp.go` (`handleDownloadVersionDocx`, line 1770): Content-Disposition filename restored from `tayari-resume-%d.docx` back to `tayari-resume-version-%d.docx`, matching the other version-aware handlers' style. One line, nothing else.

### Root cause
- Commit c2c4a89 carried an unrelated one-line edit (regression of download-name specificity for the version-docx endpoint).

### Fix applied
- One-line revert to the fmt.Sprintf form: `w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"tayari-resume-version-%d.docx\"", id))`. Verified: `go test ./internal/api -run 'TestResumeGeneratePdf|TestRouteParity' -v` PASS (8/8), diff shows only that line.

### Reusable lesson
- When carrying a commit through a strict parity/review pipeline, re-read the FULL diff before merging — a single unrelated Content-Disposition edit can silently slip into a feature commit and regress download-name specificity.

## 2026-08-07 — B1 loop-3 final-review fixes: snake_case generate-pdf payload + null profile_data

### What was done
- Fixed the analysis payload key mismatch in the generate-resume-pdf flow (removal of the edge fn → Go→Python Typst pipeline). `ResumePreviewModal.tsx` sent the UI's camelCase `ResumeAnalysisResult` as `analysis`, but Python reads snake_case (`overall_score`/`missing_keywords`/`summary_recommendation`) — the LLM prompt rendered "Overall Score: N/A/100" with no keywords, so analysis-guided optimization silently never happened. Added typed, exported builder `buildGenerateResumePdfPayload` in `src/api/resumes.ts` that maps the analysis to exactly the 3 snake_case keys; the modal now builds its payload through it. Added pure unit test `src/api/resumeGeneratePdfPayload.test.ts` (imports the api module directly — safe: `client.ts` has no react/dom imports at module scope).
- Made `profile_data: Optional[dict] = None` in `GenerateResumePdfRequest` (main.py). Previously `profile_data: null` from the UI (genuinely optional, `ResumeTemplates.tsx` passes `parsedResume || null`) was a Pydantic 422 before the handler's 400 branch → Go surfaced 502 to the user. Now when `profile_data` is None/empty, the LLM prompt instructs constructing the full profile from `resume_text` alone (no skeleton to merge onto; the LLM output IS the profile). Added pytest `test_generate_pdf_null_profile_builds_from_resume_text`.
- Deleted dead `GenerateResumeRequest` type (`src/types/resume.ts`) — zero consumers (grep-verified).

### Root cause
- Frontend analysis type is camelCase (`ResumeAnalysisResult`), Python request contract is snake_case, and nothing mapped between them — the earlier edge fn happened to have its own serialization, so the mismatch was introduced during the edge-fn removal.
- `profile_data` was declared required (`dict`, no default) even though the flow legitimately runs without a parsed profile.

### Fix applied
- `buildGenerateResumePdfPayload({resumeText, profileData, analysis, appliedSuggestions, jobDescription, template})` in `src/api/resumes.ts`; `GenerateResumePdfPayload.profile_data` tightened to `ParsedResume | null` and `analysis` to `GenerateResumePdfAnalysis` (3 snake_case keys).
- Python: `profile_data: Optional[dict] = None`; 400 check now requires only `resume_text` + `analysis`; prompt gains a "no parsed profile — construct the complete resume profile from the resume text alone" branch; merge becomes `_map_profile_keys(profile_data) if profile_data else {}` then overlay LLM output.
- Verified: 17/17 bun tests (incl. 2 new), `bun run build` OK, lint at pre-existing baseline (51 err/1448 warn, none new), Python 9/9 (incl. 1 new), Go 7/7 (`TestResumeGeneratePdf|TestRouteParity`).

### Reusable lesson
- When a frontend passes an analysis/result object to a Go/Python endpoint, the serialization boundary is a contract: always funnel request-body construction through a single typed builder (one mapping location) rather than building bodies inline in components — the edge-fn removal was the third occurrence of a shape mismatch silently degrading AI output to "N/A".
- Pydantic's 422 happens BEFORE your handler's validation branch: any field the UI can legitimately omit must be `Optional[...]` with a default, or the user-facing error is the proxy's generic 502 instead of your intended 400/fallback path.

## 2026-08-07 — B1 sweep: ResumeTemplates.tsx stale LaTeX-era surface removed

### What was done
- Rewired `ResumeTemplates.tsx`'s `handleDownload` from a dead `fetch` POST to `/v1/export/pdf` (no Go gateway route exists — every download since B1 loop-3 404'd with an error toast) to the shared `generateResumePdf` + `buildGenerateResumePdfPayload` helpers (`src/api/resumes.ts`), byte-matching the `ResumePreviewModal.tsx` flow from loop-3 (atob → Blob → `{stem}_optimized.pdf`).
- Deleted the fake compilation-step theater (`compilationSteps` state, `updateStepStatus`/`resetSteps`/`getStepIcon`, the "Optimizing content → Converting to LaTeX → Compiling PDF → Preparing download" progress card) and the unused lucide imports (AlertTriangle, FileCode, CheckCircle2, CircleDot, Circle, later useEffect).
- Deleted `src/lib/latex-templates.ts` (180 lines, zero importers — grep-verified across src).
- Extended `src/pages/resumePreviewNoEdgeFns.test.ts` with a ResumeTemplates describe block (static readFileSync: no `/v1/export/pdf`, no `compilationSteps`, no "Converting to LaTeX"; requires `generateResumePdf`/`buildGenerateResumePdfPayload`).

### Root cause
- The B1 loop-3 plan removed the edge fn and rewired the modal but missed the page-level download button; the LaTeX-era progress UI and `latex-templates.ts` survived as dead, misleading surface. The `/v1/export/pdf` POST was unreachable through the gateway (Python's `/export/pdf` PDFExporter was never proxied), so the page's Download buttons were broken while looking healthy.

### Fix applied
- Commits `a6f2671` (rewire + progress-card removal + dead module deletion + static tests) and `aac1a14` (unused import). Reviewer verdict: APPROVED with minors; both commits exclude the stray Lovable-synced `supabase/functions/mcp/index.ts`. Build green; tests 149 pass / 15 fail — exactly the pre-existing baseline (cognee + features.test.ts); lint 51 err/1448 warn, none new.

### Reusable lesson
- Deleting a feature means deleting its entry points, not just its primary path: after the edge-fn removal, two frontend call sites existed (modal + page), and the plan only rewired one. Grep for the OLD contract (`/v1/export/pdf`, `functions.invoke`) across the whole frontend after every removal, and give dead modules (`latex-templates.ts`) a zero-importer check — they rot silently and the UI keeps advertising the dead path.
- Static readFileSync tests are the cheapest regression lock for deletions: assert the dead string cannot return, not just that the new path exists.

### Open follow-ups (ledger)
- Python `main.py:250`/`ai_routes.py:325` still expose POST `/api/v1/export/pdf` (old PDFExporter) — unreachable via Go gateway, no route to proxy; e2e scripts (`comprehensive_e2e.py:476`, `user_perspective_e2e.py:271`) tolerate 404; `IMPLEMENTATION_SUMMARY.md:13` now doc-drift.

## 2026-08-07 — Failed-task restart: stale tests, dead /export/pdf routes, doc-drift

### What was done
- Fixed `src/config/features.test.ts` — asserted `interviewPrep === false` ("cut feature"), but the flag is `[true, true]` and rendered in Header.tsx:200/463 + Footer.tsx:12. Test was the lie; config was the intent.
- Removed the dead duplicate `POST /api/v1/export/pdf` routes: `main.py` (~:250, returned a JSON stub — never a PDF) and `ai_routes.py` (~:325, returned real bytes). Neither is proxied by the Go gateway since B1; the product PDF path is `/api/v1/resumes/generate-pdf`. `PDFExporter` class itself STAYS — it is the binary-missing fallback inside `typst_exporter.py:321-325` (loop-3's Typst pipeline depends on it). Dropped the now-unused imports; deleted `test_export_pdf_returns_binary_stream`; converted the two e2e tolerant checks (accept 200/404/500/502) into a 404 invariant.
- Fixed pre-existing `test_delete_resume_graph_not_found` failure: DELETE /v1/resume-graph 404 detail was "Resume graph not found" while the canonical message (hermes_routes.py:294, main.py:429, resume_graph.py:153) is "Run not found". Aligned the DELETE handler only — the GET handler keeps its own message because `test_resume_graph_endpoint.py::test_get_resume_graph_not_found` asserts it (two tests contradict; changing both messages to one canonical would have broken the other).
- Updated `IMPLEMENTATION_SUMMARY.md:13` (claimed POST to /api/v1/export/pdf — now generate-pdf) and added `docs/adr/0003-b1-go-python-authoritative-backend.md` (the B1 decision previously existed only in the codebase-memory MCP store).

### Root cause
- Three flavors of rot after B1: (1) a test frozen against a pre-cut feature flag; (2) Python routes that duplicated each other, predated the gateway, and were unreachable but still advertised; (3) a 404-message inconsistency where the failing test was right and the handler was the deviant.

### Fix applied
- Commits `8592173` (test), `95a4459` (python), `39b64b5` (e2e), `dc2f355` (docs). Verification: py_compile gate passed; full Python suite **470 passed, 0 failed** (was 469+1 — the baseline itself had a fixable failure); frontend 150 pass / 14 fail = exactly the vendored-cognee baseline; build green; lint unchanged 51/1448.

### Reusable lesson
- When a test and a message string disagree, find the codebase's canonical message by counting all raise sites, and check BOTH directions' tests before editing either side — two tests can assert contradictory strings on the same conceptual error (GET vs DELETE here).
- After deleting a route, grep the whole repo (including repo-root tests/, docs/, research/) for the old path — `export/pdf` had six refs classes: two route registrations, one unit test, two e2e scripts, one doc row.
- A "dead" exporter may not be dead: `PDFExporter` is the fallback for the Typst binary — deleting the route is safe, deleting the class would silently break resilience.

## 2026-08-07 — V6 branding: converge on AutoPilot

### What was done
- Converged the three-name product branding on **AutoPilot** (user decision; the audit's V6 originally proposed renaming Auto-Apply, and my first design suggested "Apply Assist" — the user flipped it to keep AutoPilot as present). All 35 user-visible "Apply Assist" instances across 15 files → "AutoPilot". URLs (`/jobs/autopilot`), file names, and "Auto-Apply" action phrases (verbs, not product names) untouched.
- Added `src/config/branding.test.ts`: recursive readFileSync scan of src/ asserting zero "Apply Assist" in non-test files + nav-label check. Commit `f542e4b`; design spec `docs/superpowers/specs/2026-08-07-v6-autopilot-branding-design.md`.

### Root cause
- The half-finished VT rename campaign left three concurrent names (page "AutoPilot", nav "Apply Assist", copy "Auto-Apply") — worse than any single name.

### Fix applied
- Deterministic rule: product name = AutoPilot; verb phrases stay; mechanical swap + static guard. Verified: 152/14 frontend tests (2 new), build green, lint unchanged, 0 residual grep.

### Reusable lesson
- A branding sweep is a 5-minute decision + a mechanical replace + a recursive static test. The guard test matters more than the replace: without it, the next feature-writer re-introduces a second name (the original sin). Test the INVARIANT (one name in src), not the diff.
- When a user says "keep X as present", they mean converge ONTO X — the smallest true reading of "don't rename X".

### Program status (commercial-viability sub-projects)
- V6: DONE. V3 (verified-human badge): next. Moat-1 (referral engine), Moat-2 (interview copilot, unfrozen), V7 (glass box): pending spec → plan → implementation.

## 2026-08-07 — V3 verified-human badge (full-stack, delivered)

### What was done
- New `candidate_verification` table (migration `20260807_verified_human_badge.sql` + `supabase-local/volumes/db/init/21-...` + `zz-21-` volume mount).
- Python: `verification_service.py` — two stateless LLM moderators (truthfulness 0-100 + red flags; screening 0-100 + strengths/gaps/sample questions); `POST /api/v1/verification/submit`; LLM-not-configured → explicit 503 (never mock).
- Go: `routes_verification.go` — POST submit (validation → Python proxy → verdict via pure `computeVerification` → upsert with ON CONFLICT) + GET status (no row → 200 unverified shape); both routes registered in `/api` AND `/api/v1` trees (parity test green).
- Frontend: `verification: [true, true]` flag + features.test; `src/api/verification.ts` + tests (mockFetch shim pattern from RateLimiter.test.ts); Profile.tsx badge card + Get-Verified dialog (prefills latest resume, paste fallback), honest caption.
- Gates: Python 475/0 (before: 470/0), Go `go test ./...` green + parity, frontend 155/14 (14 = cognee baseline), lint errors unchanged 51, build green.

### Root cause
- Differentiators are only real if a verifiable signal exists; claims had zero verification anywhere.

### Fix applied
- Per ADR-0003: Go authoritative (auth + DB), Python stateless AI; verdict = threshold rule (truth ≥70 AND screening ≥60) computed in a pure, unit-testable function.

### Reusable lessons
1. Units are testable even when the DB is nil in unit tests: extract the pure computation, position DB guards after validation+upstream, assert 503-after-upstream in tests to prove the proxy round-trip happened (`database.DB{Conn:nil}` is the codebase norm — no happy-path persist tests exist).
2. In ai_routes tests, `pytest.importorskip("pydantic")` + monkeypatch `llm_json` per-test; route models live beside the route (house style).
3. Full Python suite = whole-repo `pytest` (479 collected) — `pytest tests/` collects only 396; don't read the wrong number. Frontend suite = `bun run test` (src/ + preload), NOT bare `bun test` (that sweeps Playwright specs into collection and inflates failures).
4. "Verified" badge copy discipline: say exactly what the signal is (self-reported claims check), never more.

### Program status
- V3: DONE. Remaining: Moat-1 referral engine, Moat-2 interview copilot (unfrozen), V7 Glass Box — each needs design spec → approval → plan → implementation.

## 2026-08-08 — Moat-1 referral draft engine (full-stack, delivered)

### What was done
- New stateless Python engine `referral_service.py`: one LLM moderator drafts dual-channel (email + LinkedIn) personalized outreach with subject + fit_score + rationale, grounded ONLY in the contact's stated relationship/notes and the user's own proof points (honesty contract enforced in prompt; `kind` ∈ intro/referral/followup/thanks).
- `POST /api/v1/referral/draft` in ai_routes; Go proxy `routes_referral.go` with both `/api` + `/api/v1` trees (parity green); no DB on either side (pure proxy like generate-pdf).
- Frontend: `referralDrafts` flag; `src/api/referral.ts` + test; Networking.tsx `draft()` rewired from the Supabase edge function to the Go→Python engine; fit-score badge + rationale shown after drafting.

### Root cause
- The Networking page drafted outreach through `supabase.functions.invoke("draft-outreach")` — a Supabase edge function that calls Lovable's CLOUD AI directly. That silently broke the self-hostable/local-LLM architecture contract: AI must flow through Go→Python so an unconfigured/cloud-only path can never pretend to be the engine. Discovered during T3 recon, not in the design phase.

### Fix applied
- Engine matches the edge function's exact response contract (`{email, linkedin, subject}` + kinds + proof_points) so the UI rewire was mechanical. The edge function remains deployed but is dead code from the UI; Go/Python is now the only drafting path.

### Reusable lessons
1. Recon the FRONTEND CALL SITES before writing a design — the design's "user-supplied contact + job" abstraction missed that a live edge-function contract already existed. The audit's stub inventory said "stubs exist"; the call site said otherwise.
2. When replacing a cloud edge function with the self-hosted engine, keep the response contract identical — it makes the UI change a one-line-ish swap and avoids frontend redesign churn.
3. Honesty anchoring via prompt contract is testable: assert the relationship string reaches the prompt, and that unknown kinds are rejected BEFORE llm_json is called.
4. Gates: Python 483/0 (+8), Go suite green incl. parity, frontend 157/14 (cognee-only) with lint errors flat at 51.

### Program status
- V3: DONE. Moat-1: DONE. Remaining: Moat-2 interview copilot (unfrozen), V7 Glass Box — each needs design spec → approval → plan → implementation.

## 2026-08-08 — Moat-2 live interview copilot (streaming + parity, delivered)

### What was done
- Fixed two **broken-at-runtime** endpoints: `copilot-hint` and `voice-feedback` imported names (`CopilotHintRequest`, `generate_interview_hint`, `VoiceAnalysisRequest`, `analyze_candidate_speech`) that did not exist in `live_interview_copilot.py` — every call 500'd. Implemented them (hint = thin wrapper over the existing generator; voice = deterministic cadence/filler/STAR analysis, no LLM).
- New SSE stream: `stream_live_copilot_hints` async generator (question_type → hints → star → metrics → done; error events for unconfigured LLM / invalid output — never canned) + `POST /api/v1/interview/copilot/stream` (StreamingResponse).
- Go: `PostStream` on the AI client + `routes_interview.go` (hint/voice proxies + SSE passthrough with optional flusher) registered under BOTH `/api` + `/api/v1` (parity green).
- Frontend: `streamInterviewCopilotHints` SSE helper (fetch + ReadableStream parse, no EventSource since POST) + Live Copilot tab in InterviewBoard (progressive render, abort button, honest error states).

### Root cause
- The audit's "3 endpoints exist" was wrong: only `copilot` worked. The other two were declared in main.py against a service file that never defined them — a silent 500 path the frontend's `fetchInterviewCopilotHint` (itself dead code, no callers) would have hit.

### Fix applied
- Implemented the missing service pieces to match the frontend contracts (`{interviewer_transcript, target_role}` and `{transcript, duration_seconds, target_role}`), then added the stream on top.

### Reusable lessons
1. "Endpoint exists" claims must be verified by importing the module, not by grepping route decorators — main.py's lazy imports (`from app.services... import X`) fail at request time, not at startup, so the suite stayed green while the routes 500'd.
2. `httptest.ResponseRecorder` does not implement `http.Flusher` — SSE passthrough handlers must treat the flusher as optional or unit tests can't exercise the write path.
3. SSE over POST (EventSource can't send bodies) = fetch + ReadableStream + `\n\n` frame split; keep the parser in the api layer so the UI stays dumb.
4. Gates: Python 498/0 (+6), Go suite green incl. parity, frontend 163/14 (cognee-only), lint errors flat 51.

### Program status
- V3: DONE. Moat-1: DONE. Moat-2: DONE. Remaining: V7 Glass Box (WebSocket live browser feed — heaviest infra, separate design cycle).
