# Handoff — Anthropic-pattern adoption thread

**Written:** 2026-08-13. **Scope:** the "adopt Anthropic's shipped agent patterns" thread only — the
fabrication audit, the two published plan documents, and Phase 1 of the resulting engineering plan.
The repo has other in-flight work outside this thread; see [Out of scope](#out-of-scope-do-not-touch-blindly) before touching anything not listed below.

**Read this whole file before starting.** The next agent's job is to finish the sequence below,
verify continuously, and never leave the tree in a state where `pytest` / `tsc` / `go build` fail.

---

## 0. Orientation — the two durable planning documents

Two design documents drive this thread. Both are checked into the repo (not just published as
ephemeral claude.ai artifacts, which expire with the session that made them):

- **[`../anthropic-adoption/tayari-adoption-plan.html`](../anthropic-adoption/tayari-adoption-plan.html)**
  — the ranked, file-cited engineering plan. **This is the plan to execute.** Open it in a browser.
  It has: a corrections section, a ranked adoption table (10 items), the extension-vs-owned-browser
  verdict, a "what not to adopt" section, and Phases 1/2/3 sequenced by dependency (not calendar).
- **[`../anthropic-adoption/anthropic-shipped-inventory.html`](../anthropic-adoption/anthropic-shipped-inventory.html)**
  — the reference inventory of what Anthropic has actually shipped (Cowork, Claude Code, the two
  browser surfaces, Agent SDK/Managed Agents, MCP 2026-07-28, Skills, Artifacts), with every claim
  labelled first-party / press-sourced / unverified. Consult when a plan item references an
  Anthropic mechanism and you need the primary detail.

Both were also published as Claude Artifacts this session (private, not shared):
- Plan: `https://claude.ai/code/artifact/1bae89a9-481e-4e85-a46a-422094303fb0`
- Inventory: `https://claude.ai/code/artifact/fca5d331-ec37-459e-9c00-bfa1bada4de7`
Treat the **repo copies as canonical** — the artifact URLs are a convenience mirror and may not survive
indefinitely; the HTML files in `docs/anthropic-adoption/` are the source of truth.

---

## 1. Verified state as of this handoff

Run this block before doing anything else, to confirm the tree is exactly where this document claims:

```bash
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd backend/python && .venv/bin/python -m pytest app/tests/ -q            # expect: 213 passed, 2 skipped, 0 failed
cd ../.. && npx tsc --noEmit -p tsconfig.json                             # expect: no errors
cd backend/go && go build ./... && go vet ./... && go test ./...         # expect: clean build, all packages ok, zero FAIL
```

**Not covered by the above:** a real `docker build`/`docker compose up`. Three deployment fixes
landed late in this session (Chromium install in `backend/python/Dockerfile`, the `UVICORN_RELOAD`
prod/dev split, Go DB pool bounds — see §6.0/§6.2) were verified by inspection and offline config
validation only — Docker Desktop's engine backend was unresponsive throughout this session. Run
`docker compose --profile dev up -d --build` and confirm before trusting these further; see §6.2 for
exactly what was and wasn't checked.

If any of these fail, **stop and diagnose before proceeding** — do not layer new work on a red tree.

Confirmed independently, not assumed:
- Python suite is **stable across repeated runs** (checked 3x in a row) — a prior import-order flake
  in `test_omnisave_rag_engine` is genuinely fixed, not just no-longer-reproducing. Root cause: a
  module-level `load_dotenv()` in `browser_automation/agent.py` was mutating process-wide
  `os.environ` on import, so whichever test files pytest happened to collect first decided whether
  `OPENROUTER_API_KEY` was visible to `is_llm_configured()`. Fixed by removing the `load_dotenv()`
  call (env must come from the process launcher — docker-compose already does this explicitly) and
  by making the affected test's skip condition also check `is_db_enabled()`, since
  `query_knowledge_rag` fails closed on no DB by design. See `backend/python/app/tests/conftest.py`
  and `backend/python/app/services/browser_automation/agent.py` diffs, and the `lessons.md` entries
  dated 2026-08-13.
- `backend/python/app/services/form_filler.py` has been rewritten to address elements via the
  `ref_N` handles from `BrowserOperator.observe()` instead of reconstructing CSS selectors from
  accessible names (this was plan item **1.2** — it is DONE, see §2 below). New coverage in
  `backend/python/app/tests/test_form_filler_observation.py` proves the ref path is used and that a
  ref-less observation fails closed rather than falling back to selector-matching.

---

## 2. Plan progress — Phase 1 (observation correctness)

Cross-reference against the plan doc's §05 "Sequence" table for the authoritative item descriptions.

| Item | What | Status | Evidence |
|---|---|---|---|
| **1.1** | Resolve the Playwright version split; make snapshot failure loud instead of a swallowed warning | **Partially done** | `form_filler.py` and `browser_operator.py` now probe for both the legacy `Page.accessibility` API and the current `Locator.aria_snapshot()`, and treat a failed/empty read as `observation_error` → fail-closed `needs_human: True`. **NOT done:** `requirements.txt:40` still pins `playwright==1.49.1` while the local `.venv` has `1.62.0` installed — this drift is still live, just no longer silently dangerous. See §4 for why this is left to you. |
| **1.2** | Ref-map addressing in `form_filler` — delete selector reconstruction | **Done** | `form_filler.py` `execute_form_auto_fill` uses `self.browser.observe()` → `_ref_for_node()` → `self.browser.fill(ref, value)` throughout, including the sensitive-field escalation path. `_extract_input_roles`/`_selector_for_node` remain in the file only as legacy helpers for the older accessibility-tree shape — **check on pickup whether they're still called anywhere**; if not, delete them (see §5, "quick wins"). |
| **1.3** | Regression test for the escalation queue | **Done** | `backend/python/app/tests/test_form_filler_observation.py` — 11 tests total (8 original + 3 added when 1.2 landed): parser correctness, reader-shape equivalence, sensitive-field escalation, the blind-run case, and three tests proving the fill path uses observed refs and fails closed on an unaddressable observation. |
| **1.4** | Fence page-derived text through `prompt_safety.untrusted()` | **Done** | `browser_operator.py` `navigate()` wraps `content_preview` (the text `navigate_web`'s MCP tool feeds the model) in `untrusted()`. `title` is deliberately left unfenced — nothing feeds it to a model. Added `prompt_safety.strip_untrusted()` for the display path and applied it in `optimizer.py` `scrape_jd_url`, which returns `content_preview` as user-visible JD text — without the strip, the delimiter markers would have leaked into the UI. |
| **1.5** | Honest `BrowserOperator` — `observe()`/`screenshot()`, ref-first `click`/`fill`, truthful docstring | **Done** | `browser_operator.py` now has `observe()` (accessibility tree → `{ref, role, name}` list, backed by a live `Locator` per ref), `screenshot()` (base64 PNG, documented as the fallback), and `click`/`fill` that accept a `ref_N` or a raw CSS selector — a stale/unknown ref errors explicitly rather than silently falling through to selector matching. The class docstring no longer claims capabilities it doesn't have. **Not yet covered by a live-browser test** — the suite never drives a real Playwright browser, so `observe()`'s tree-parsing regex is tested via `test_form_filler_observation.py`'s shared parser tests, but the `ref → Locator` binding itself is only exercised through the `_ObservedBrowser` test double in `test_form_filler_observation.py`, not against a real page. If you want confidence here, that's the next testing investment, not a blocker. |
| **1.6** | Delete `computer_use.py` and every caller | **Done** | File deleted. Removed from `agent_engine.py` (import, instance, the fake "MCP Tool & Spatial Vision Inspection" step), `job_seeker_agent.py` (`center_coords`/`click_cmd`/`spatial_click_cmd` and the log line asserting a submit button had been "located"), `ruthless_engine.py` (`click_coordinate`), the frontend `AgentConsole.tsx` (the "🎯 Spatial Vision Computer Use Click Coordinate" display block), and `test_advanced_agent.py`. Verified no residual references anywhere (`grep -rn "ComputerUseDriver\|computer_use"` across `app/` and `src/` returns nothing except the deleted-file's own git history). |

**Phase 1 is functionally complete.** The only open item is the `requirements.txt` pin (1.1), which is
explicitly left to a human decision — see §4.

---

## 3. Plan progress — Phase 2 and Phase 3 (not started)

Full item descriptions are in the plan doc's §05. Do not re-derive them from scratch — read the doc.
Summary of what's ahead, in dependency order:

### Phase 2 — set the trust boundary (depends on Phase 1)
- **2.1** Provision Browserbase (`BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`) — **paid account,
  external dependency, not something an agent can do autonomously.** Flag to the user; do not block
  on it. Code path already exists at `backend/python/app/services/browser_automation/session.py:74-128`
  (`BrowserbaseProvider`). Until keys exist, `get_provider()` silently returns `LocalPlaywrightProvider`,
  which emits no `live_view_url`, so the interactive pane wired into `AgentLiveView.tsx` never renders
  and the kill switch degrades to a cooperative in-process flag instead of a real remote terminate call.
- **2.2** Encode the identity split (server-side agent for identity-free work, the browser extension
  for identity-bearing submission) as an actual routing function, not an implicit convention. See the
  plan doc §03 for the full argument — **read it before implementing**, the reasoning about *why* the
  risk profiles are inverted (server path = high injection likelihood + bounded blast radius; extension
  = near-zero injection likelihood + unbounded blast radius) is load-bearing for getting this right.
- **2.3** Extend `_guard_credential_entry` in `browser_automation/agent.py` beyond `input_text` — its
  own comment (`agent.py:130-132` as of last read) admits clicks and navigation are unguarded, and
  those are exactly the injection surface, not credential fills.
- **2.4** CI check asserting the extension stays LLM-free (no model call in `extension/`).
- **2.5** Tighten `extension/manifest.json`: `externally_connectable` wildcards `*.lovable.app` /
  `*.lovableproject.com` (any page on that shared multi-tenant domain can message the extension —
  narrow to the exact production origin), and `all_frames: true` runs content scripts inside
  third-party iframes on Workday/LinkedIn (scope to top frame unless a specific ATS needs it).
- **2.6** Per-run cost/budget ceiling with a distinct `budget_reached` stop reason, surfaced in
  `AgentLiveView.tsx` beside the existing `blocked_origin_guard` state.

### Phase 3 — leverage (optional, independently orderable)
- **3.1** Route `browser_automation/agent.py`'s separate LLM provider ladder (`get_llm()`,
  `agent.py:177-246` as of last read) through `llm_service.build_provider(tier="fast")` instead of
  its own ORQ→OpenRouter→OpenAI→Anthropic→generic chain — the fast/smart tiering built this session
  (`llm_service.py`, `_tier_model`) does not currently reach the highest-volume LLM caller in the
  product (up to 50 calls per browser run).
- **3.2** A per-application "run receipt" page — what the agent saw, filled, escalated, the final
  URL/screenshot, the origin-guard verdict. `final_screenshot`/`final_url` are already captured in
  `agent.py:152-154` and currently dropped at the API boundary (`main.py:841-853`). Static page,
  no connectors, no shared storage — see plan doc §04 item 3.2 for why (Anthropic's connector-backed
  artifacts require becoming a credential broker; this doesn't need that).
- **3.3** Progressive disclosure for `app/plugins/resume_optimizer/` — description-only in the router
  prompt, body loaded on selection.
- **3.4** `agent/subagent_orchestrator.py`'s `Subagent.execute` currently prints a string and returns
  `status: "completed"` unconditionally — no LLM, no tools, always "succeeds". **Fix or delete it; a
  stub that always reports success is actively worse than not having the feature**, because callers
  will trust the result.
- **3.5** Consolidate the two MCP tool registries (`agent/mcp_manager.py`, a 78-line non-spec
  implementation, duplicates the real FastMCP server at `app/mcp/server.py`) — pick one, and sort
  `list_tools()` deterministically for prompt-cache hits while you're in there.
- **3.6** Track MCP 2026-07-28 (stateless core, MRTR, `server/discover`) via SDK upgrades when
  available — explicitly **do not hand-roll this**; see plan doc §04 "what not to adopt".

### What NOT to adopt (plan doc §04 — read before proposing any of these)
An LLM classifier as the permission boundary, a JS dynamic-workflow orchestration runtime, a second
agents-control-plane daemon, plugin marketplaces/distribution machinery, pixel-based computer use
(just deleted — do not reintroduce it), MCP statelessness as a hand-rolled rewrite, Artifact-style
connector-backed runtime capabilities. Each has a one-paragraph reason in the plan doc; the shared
theme is "cheap at Anthropic's scale, a trap or pure duplication at Tayari's."

---

## 4. External dependencies flagged — not actionable by an agent alone

| Need | Status | Blocks |
|---|---|---|
| **Browserbase** (`BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`) | Paid, code complete, keys absent | Phase 2.1, and the whole "server path is primary" verdict in practice |
| **`langchain-anthropic`** | Installed locally (0.3.3), absent from `requirements.txt`; the `ChatAnthropic` branch in `browser_automation/agent.py`'s `get_llm()` is inside a bare `try/except ImportError: pass`, so it silently no-ops in Docker | Phase 3.1, if Anthropic models are wanted in the browser agent's own provider chain (moot if 3.1 routes through `llm_service` instead, which is the recommendation) |
| **Playwright version** (`requirements.txt` 1.49.1 vs installed 1.62.0) | Not an account/cost issue — a decision about which version to standardize on and whether the Docker image needs rebuilding/testing against it | Phase 1.1 completion. **This is a human decision** (which version, and whether to test the Docker image build against it before flipping the pin) more than an agent task — flag it, don't silently pick one. |

---

## 5. Also fixed this session — outside the Anthropic-plan sequence, but load-bearing

A separate fabrication audit (not part of the adoption plan) found and fixed five places where a
degraded/failed code path produced output shaped exactly like success, defeating the disclosure
mechanism built to catch it. All verified fixed, all covered by `lessons.md` entries dated 2026-08-13.
Listed here because a future agent auditing "is anything still fabricated" should know this ground
was already covered and not re-litigate it without new evidence:

1. `analytics_service.calculate_conversion_funnel` — an empty application list no longer back-fills a
   synthetic 11-application funnel; returns all-zeros with `health_status: "NO_DATA"`.
2. `ApplicationAnalytics.tsx` — now fetches the user's real applications instead of always posting
   `{applications: []}`; the "Sample Data" suppression bug (a types-only validity check passing on
   fabricated data) is gone.
3. `optimizer.validate_master_alignment` — a parser exception no longer returns
   `{is_aligned: True, confidence_score: 1.0}`; now fails closed with `verified: False`.
4. `voice_stream.py` — with no Deepgram key, receiving audio no longer substitutes a fixed sentence
   and scores it as if the user had said it; emits `transcription_unavailable` instead.
5. `routes_push.go` `handlePushSend` — no longer reports `"status": "sent"` for log lines with no
   actual Web Push transport wired up; returns 503 `push_delivery_unconfigured`.
6. (Same session, most safety-critical) The human-escalation gate in `form_filler.py` was failing
   open: a Playwright API removal (`Page.accessibility` gone in 1.62.0) silently produced an empty
   node list, which `classify_fields([])` turned into zero questions, which reported
   `needs_human: False` — the all-clear — exactly when the agent had gone blind. This is what
   motivated Phase 1.1/1.2/1.3 above. Fixed and regression-tested.

Also removed this session, unrelated to fabrication but found in passing: the fake "spatial vision
click coordinate" theatre (see Phase 1.6 above) — every job on every portal was reporting the
identical hardcoded coordinate as if a vision inspection had located a submit button.

7. (Found by the quality-eval research agent in §6, verified and fixed directly)
   `BanditService.select_variant` — the implementation behind `POST /api/v1/predictive/bandit/select`,
   whose docstring and own error message both say "Thompson Sampling" — read `conversion_rate`/`score`
   keys the request schema (`VariantStat`: variant_id/pulls/conversions) never populates. Every arm
   scored an identical default, so the function always returned `variants[0]`'s ID regardless of real
   performance: an A/B test that never explored and never adapted, silently. Replaced with a real
   `Beta(1+conversions, 1+failures)` posterior draw per arm. Zero test coverage before; now 7 tests
   including distributional checks (equal arms don't always tie the same way, a strong arm wins most
   but not all draws, an unpulled arm can still win). See `lessons.md` 2026-08-13 for the full writeup.
   The separate, real epsilon-greedy implementation in the same file (`select_strategy`, with an
   honest cold-start gate) still has zero callers — worth wiring up or removing, not done this
   session, not blocking.

---

## 6. Deployment, observability, and quality-measurement research — in progress

Per the request that produced this handoff, three research agents are running (or have completed —
**check for their output files before re-running anything**) to answer: where should this stack
deploy, how do we build shadow/ghost-user testing and a performance-metrics stack, and how do we
measure LLM/agent output quality in production so a future fabrication bug can't hide again. Their
reports land at:

- `docs/deployment-research/platform-recommendation.md` — ranked hosting platforms for this exact
  stack (the Playwright/Chromium hosting decision is the crux; also covers self-hosted-Supabase
  viability), with 2026 pricing and sourced claims.
- `docs/deployment-research/shadow-testing-and-observability.md` — shadow/ghost-user testing
  architecture for an agent that takes real-world browser actions (not generic canary-traffic
  mirroring — that pattern doesn't map cleanly onto "fills a real job application"), a concrete
  Prometheus/OpenTelemetry metric schema keyed to this repo's actual pipeline stages, an
  observability stack recommendation (minimum-viable cut and target cut), and a CPU/memory/latency
  tuning playbook (headless Chromium concurrency limits, FastAPI async tuning, Celery
  concurrency/prefetch, Postgres pool sizing) with concrete starting numbers.
- `docs/deployment-research/quality-and-llm-eval.md` — LLM-as-judge evaluation design for resume/cover-letter
  quality, closing the loop from resume variant → real outcome (interview/offer) using the existing
  `bandit_service.py` and `resume_variants` schema, guardrail/drift monitoring, and a minimal
  weekly dashboard spec so a fabrication regression is visible immediately instead of discovered
  by audit.

**If these files don't exist yet when you pick this up**, the agents are either still running or
were interrupted — check, and either wait for completion or re-launch with the same briefs (this
handoff's author's prompts are recoverable from this session's history if needed, but re-reading the
resulting `.md` files first is faster than re-deriving the brief).

**These are research inputs, not yet a plan.** Once all three land, the next step is synthesizing
them into a prioritized, phased execution plan the way §2/§3 of this document did for the Anthropic
adoption work — do not start implementing infrastructure changes straight from the raw research
without that synthesis pass, especially for anything cost-bearing (a platform migration, a paid
observability tier, provisioning Browserbase).

### 6.0 `platform-recommendation.md` — landed, and it found a live production bug

This report surfaced a **currently-live correctness bug**, independent of any hosting decision,
which I verified directly and fixed:

**The browser-automation endpoints in `main.py` (`/api/v1/browser/automation`,
`/api/v1/browser/automation/stream`) run headless Chromium inline inside the `python-ai` FastAPI
process** — `await run_browser_agent(...)` at `main.py:840`, not dispatched to Celery. So do
`form_filler.py`'s `execute_form_auto_fill` and `optimizer.py`'s `scrape_jd_url`, both touched this
session. But `backend/python/Dockerfile` (the image `python-ai` actually builds from —
`docker-compose.yml:25-27`) **never ran `playwright install --with-deps chromium`**; only
`Dockerfile.worker` (the Celery image, which none of these routes use) did. As shipped, every one of
these code paths threw a missing-executable error the first time it ran in any Docker deployment.
**Fixed:** added the same `RUN python -m playwright install --with-deps chromium` line to
`backend/python/Dockerfile`, mirroring `Dockerfile.worker`'s working pattern exactly.
**Verification status:** the container build was still in progress when this handoff was last
edited — see the top of this file for the exact command to confirm before trusting this fix
further; if a build log isn't visible in this session's history, run it yourself before deploying.

The same report found a second, separate gap in the identical code path, which I verified
(`grep -rn "Semaphore\|MAX_CONCURRENT\|concurrency" backend/python/app/services/browser_automation/
backend/python/app/main.py` returns nothing) but deliberately **did not fix**: there is no
concurrency limiter on these endpoints, so N simultaneous requests spawn N concurrent Chromium
instances in one process, bounded only by the 300s timeout. This is real, but the right fix requires
a product decision this handoff shouldn't make unilaterally — the concurrency ceiling value, and
whether excess requests queue or reject with a specific error. It's the same gap the Anthropic
adoption plan already identified and correctly sequenced as **Phase 2 item 2.6** ("per-run cost/budget
ceiling with a distinct stop reason") — treat this finding as additional evidence for that item, not
a new one; implement the semaphore as part of 2.6, not as an isolated patch.

Full report has three ranked hosting options with 2026 pricing (VPS/Hetzner ~$160-190/mo recommended
for now, Railway ~$230-280/mo, self-managed k3s ~$270-320/mo — deferred until a second engineer or a
concrete scale trigger), a Browserbase-vs-self-run cost comparison that also recommends Browserbase
(~$20-99/mo, cheaper than a properly-sized self-run worker container at this volume, and removes the
OOM risk from the concurrency gap above), and a recommendation to migrate production auth/DB to
Supabase Cloud ($25/mo) rather than run the self-hosted stack in production — backed by three cited
2026 GoTrue CVEs and the fact that self-hosted Supabase ships with no backup/PITR by default. Read
the report's §4 "Concrete next steps" for the full ordered checklist; it is written to be executable
without further research.

### 6.2 `shadow-testing-and-observability.md` — landed; two more findings fixed directly

This report is thorough (216 lines, sourced) — read it in full, especially §0 (what's already wired:
**Sentry is fully instrumented in Python/Go/React, it just needs a `SENTRY_DSN`** — this is the
single highest-leverage zero-code action available, and it's an external-account decision, flagged
not done), §1 (why traffic-mirroring shadow deployment doesn't work for a form-submitting agent, and
the three-tier safe-target strategy: build a self-hosted fake-ATS fixture for CI, use Greenhouse/Lever's
real sandbox environments for the scheduled ghost-user cohort, use real postings only for read-only
discovery legs), §2 (a full Prometheus-style metric schema keyed to this repo's actual stage/field
names, not invented ones), and its own ranked "Summary of concrete next actions."

Two of that action list's six items were small, mechanical, no-judgment-call fixes — implemented and
verified directly (see `lessons.md` 2026-08-13 "Three deployment-blocking gaps..." for the full
writeup):

- **`Dockerfile`'s prod CMD ran `uvicorn --reload` with no `--workers`**, in every profile including
  prod (`docker-compose.yml`'s `python-ai` service shares one command across `dev`/`prod`/`eval`).
  Fixed with an opt-in `UVICORN_RELOAD`/`UVICORN_WORKERS` env pair, defaulting to today's exact
  behavior — same pattern as the LLM tier-routing work earlier this session. A prod deployment now
  needs to set `UVICORN_RELOAD=false` in its `.env`.
- **The Go gateway's DB pool was unbounded** (`database.go`'s `NewDB` had no
  `SetMaxOpenConns`/`SetMaxIdleConns`/`SetConnMaxLifetime`). Fixed with the report's recommended
  starting values (10/5/30min).

**Not verified by a real build** — Docker Desktop's engine backend was unresponsive throughout this
session (app processes running, daemon socket never answered) despite a restart attempt. Both fixes
were verified by every means available without a live daemon: `docker compose config` (validates
offline) confirms the compose file parses and resolves the new env vars to their documented defaults;
the Dockerfile's shell-conditional CMD logic was verified directly via `sh -c` for all four cases; the
Chromium install line (§6.0 above) is byte-identical to `Dockerfile.worker`'s already-proven command;
`go build`/`go vet`/`go test` are clean. **Run `docker compose --profile dev up -d --build` and
confirm before deploying any of this — inspection is not the same confidence level as a real build,
and this handoff does not claim otherwise.**

Remaining items from this report's action list, not done, in the report's own priority order:
add a concurrency semaphore to `session.py::open_session` for the local browser provider (ties
directly to Phase 2 item 2.6 in the Anthropic adoption plan, and to the identical finding in
`platform-recommendation.md` §6.0 above — treat as one item, not two); populate `SENTRY_DSN` (needs
an account); replace the `app/telemetry` stub's log-only body with a real Prometheus/OTel-backed
implementation (the correlation contract — `stage_name`/`trace_id` — is already right, just needs a
real backend behind the same function signatures); and build the Tier-1 self-hosted fake-ATS fixture
for CI (highest engineering cost in the report, but the report is explicit that it's also "what makes
every other recommendation in this report testable before it ships").

### 6.1 `quality-and-llm-eval.md` — landed, summarized here

This report is done; read it in full before implementing anything from it, but here is its own
priority order (cheapest/highest-payoff first) so you don't have to re-derive it:

1. **Guardrail trip-rate logging** — cheap, no new infra. `gate.py`'s return shape already has
   everything needed (`verified`, per-check pass/fail); this is pure instrumentation.
2. **Mock/fallback rate** — also cheap. `llm_service.active_engine_label()` already exists; log and
   aggregate it. Direct instrumentation of the exact failure class this whole session has been fixing.
3. **Wire the bandit loop to real data** — `_ARM_STATS` is a process-memory dict (explicitly
   documented as such in its own module docstring, lost on restart, and inconsistent across the
   FastAPI process and Celery workers even without a restart). The schema to fix this already
   exists (`resume_variants`, `ab_testing_bandit`, `application_outcomes`, and the FK chain linking
   them) — nothing currently writes to `ab_testing_bandit` or reads `application_outcomes` back into
   arm selection. The loop is open at both ends. See the report §2.2 for the concrete wiring steps.
4. **An LLM-as-judge layer** — highest effort, highest payoff for catching a specific gap every
   current guardrail structurally cannot see: *embellishment within an existing bullet* (same skill
   vocabulary, inflated scope/impact/causation — "helped launch" become "led the launch of a $2M
   initiative"). `validate_master_alignment` and `check_truthfulness` both anchor on named entities,
   numbers, and vocabulary presence, not on claims about scope or causation. Report §1 has a concrete
   rubric proposal and a load-bearing warning: **the judge model must be a different family from the
   generator**, because same-family judges share the generator's blind spots and specifically
   under-catch the fabricated-but-fluent failure mode this project has already hit twice in
   production (cited: arXiv:2604.22891, arXiv:2606.10315).
5. **Canary/golden-set probes** for silently-degraded LLM providers (model swapped underneath you,
   quality drops with no error) — do this once #1 proves the instrumentation pattern works.
6. **Training a replacement for `predictive_scorer.py`'s heuristic** — not yet viable. The report
   researched sample-size requirements for this class of problem (closest analog found: clinical
   binary-outcome prediction, median ~310 samples/~87 positive events in a systematic review, with
   the review's own headline finding that this is likely *too small*) and lands on **300–500
   positive outcome events as an internal floor**, explicitly labeled as cross-domain extrapolation
   since no resume-callback-specific literature exists. Also flags an unverified precondition: check
   whether the current outcome-tracking UI actually prompts for *negative* outcomes (rejections,
   no-replies) — training only on reported successes would be survivorship-biased.

Two things the report found and I verified/fixed directly rather than leaving for later (see §5,
item 7): `BanditService.select_variant` claimed "Thompson Sampling" in both its own docstring and
the API endpoint's error message, but read `conversion_rate`/`score` keys the request schema never
populates — every arm scored the same default, so it silently always returned `variants[0]`
regardless of real performance. Fixed with a real Beta-posterior draw and 7 new tests. The
`select_strategy`/`record_outcome` functions (real epsilon-greedy, honest cold-start gate) still have
zero callers — that's priority-3 above, not done this session.

The report also specifies a concrete 12-row weekly dashboard (§4 of the report) designed around one
constraint pulled directly from this session's fabrication-fix history: **every number must have an
explicit "no data" state that is visually distinct from a real zero**, because every fabrication bug
found this session was a degraded path rendering identically to a successful one. Rows 11–12
specifically exist to make a *future* version of that exact bug pattern visible on the dashboard
itself, not just in code review.

---

## 7. Quick wins — status

- ~~Confirm `form_filler.py`'s `_extract_input_roles`/`_selector_for_node` legacy helpers are truly
  dead now that 1.2 is done, and delete them if so.~~ **Done.** Both were confirmed dead (not called
  from `execute_form_auto_fill`, only from their own recursion and from tests). Deleted from
  `form_filler.py`. The tree-parsing regex they duplicated now lives as a single implementation:
  `BrowserOperator._parse_accessibility_tree()` — extracted from inline code in `observe()` into a
  pure classmethod (no Playwright objects, so it's unit-testable without a browser) that returns
  `[{"role", "name", "index"}]`, where `index` is the same repeat-disambiguation count `.nth()` uses.
  `observe()` now calls it and only handles the Locator-building loop. `test_form_filler_observation.py`
  was repointed at this real implementation instead of the dead duplicate — it was testing code that
  could never execute in production. Added one new test (`test_disambiguates_repeated_role_and_name_by_order`)
  covering the index bookkeeping, which had zero coverage before. **11/11 tests pass, full suite still
  213 passed / 2 skipped across 3 repeated runs (count includes 7 unrelated bandit-service tests added
  later the same session — see §5 item 7).** `observe()`'s Locator-building loop itself still has
  no live-browser test — see Phase 1.5's note in §2, unchanged by this cleanup.
- `backend/python/requirements.txt:40` vs installed Playwright — at minimum, add a comment noting the
  known drift and that both API shapes are now handled in code, so a future reader doesn't rediscover
  this from scratch.
- The `.env.example` model-routing documentation added this session (`OPENROUTER_MODEL_FAST` /
  `OPENROUTER_MODEL_SMART` etc.) should get a one-line mention in `backend/python/CLAUDE.md`'s config
  section if one exists, or wherever env vars are indexed — check `tayari-config-and-flags` skill
  ownership before adding a second source of truth for this.

---

## 8. Out of scope — do not touch blindly

`git status` at the time of this handoff shows substantial untracked work **not part of this
thread**: `.demo_work/`, `.github/workflows/kubernetes.yml`, `.landing_motion_review/`,
`audio-output/`, a waitlist-leads DB migration + Go routes + e2e test, `electron/` +
`electron-builder.yml`, `infra/`, `product-demo/`, several new `docs/*.md` files (Deployment
Architecture, Production Runbook, Disaster Recovery, Security and Data Handling, Customer/Investor
Readiness, Job Tayari Entity Card), `public/animations/` + `public/images/`, deploy/rollback/smoke-test
scripts under `scripts/`, a new `src/components/landing/CandidateControlSection.tsx`, a new
`src/pages/DesktopAgent.tsx`, and modifications to `HeroSection.tsx`, `Pricing.tsx`, `App.tsx`,
`Index.tsx`, `vite.config.ts`, `package.json`/`package-lock.json`. **None of this was produced by
this thread and none of it should be assumed stale, wrong, or safe to overwrite.** If a Phase 2/3 item
above turns out to touch one of these files, read the existing content first and integrate, don't
clobber.

---

## 9. How to resume

1. Run the verification block in §1. Confirm green.
2. Read `docs/anthropic-adoption/tayari-adoption-plan.html` in full — it is short and the actual
   authority for what "done" means on every remaining item.
3. Check whether the three files in §6 exist yet.
4. Work Phase 2 in the order listed (2.1 is a human/account action — flag and skip past it to 2.2
   if no keys are available; do not block the rest of the sequence on it).
5. After every change: re-run the full verification block. Never hand off a red tree.
6. Append a dated `lessons.md` entry for every completed task, per this repo's `CLAUDE.md` hard rule —
   no exceptions, including for infrastructure/research work.
