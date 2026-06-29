# Tayari Skill Boost — Differentiation Strategy

> Date: 2026-06-29
> Grounded in: CLAUDE.md, README.md, PRODUCT_GRILL.md (1170 lines), `ls src/pages/` (43 pages).
> Opinion: stop marketing "all-in-one suite" — competitors are dying in that lane (JobCopilot 4.2★, Jobright billing complaints). Own **the chain**: one observable pipeline from resume to interview. Half the moat is already shipped but invisible in the UI.

---

## 1. What Tayari Already Does That Competitors Don't

Cross-referenced against Teal, Jobscan, Sonara, Loopcv, Rezi (and the 17 others in PRODUCT_GRILL §1). Only items **backed by code in this repo** listed.

| Capability | In repo | No competitor has it because |
|---|---|---|
| **Reflective optimizer** (`app/services/optimizer.py`) — iterates optimization against its own scoring gate before emitting, not a single GPT pass | `optimizer.py` + `guardrails/gate.py` | Rezi/Teal/Jobscan do one-shot GPT → template. Users on r/resumes consistently rate ChatGPT's raw output *above* dedicated tools because the tools constrain for keywords at the expense of language. Reflection loop is the fix and only Tayari ships it. |
| **Pipeline guardrails** (`app/guardrails/`: `keyword_stuffing.py`, `pii_detector.py`, `truthfulness.py`, `gate.py`) | `guardrails/` directory | PRODUCT_GRILL §17: 77% of employers now see AI-aided apps; 88% of execs say auto-rejectors dump qualified high-skill people. Authenticity is the new premium. No competitor ships a stuffing detector — they ship the stuffer. |
| **Knowledge graph** (`app/services/knowledge_graph.py`, `ResumeGraph.tsx`, `/api/v1/resume/graph`) | `knowledge_graph.py` + `src/pages/ResumeGraph.tsx` | Feature matrix §2: every competitor has ❌. Enterprise HR (Eightfold, Beamery, Phenom) charges $50K–750K/yr for skills-inference; Tayari ships a version of it for $0 self-hosted. |
| **Tiered Hermes scrape** (`app/services/hermes/` — Tier A keyless ATS JSON: Greenhouse/Lever/Ashby/Workday; Tier B Firecrawl+SerpApi; Tier C Apify; Tier D Crawl4AI+Playwright; 3 free providers always-on) | `hermes/providers/`, `orchestrator.py`, `circuit_breaker.py` | Sonara (dead) and LazyApply (2.2★) scrape one or two boards badly. Teal/Rezi don't scrape at all. The tiered + circuit-breakered design means the pipeline **works with zero API keys** and upgrades gracefully — no competitor has this resilience shape. |
| **Self-hosted + local LLM** (`docker-compose.yml`, `docker-compose.hermes.yml` Ollama `hermes3:8b`, `llm_service.py` auto-detect) | `llm_service.py`, Ollama compose | PRODUCT_GRILL §3.1: literally the only platform in the 22-competitor set that runs on-prem with zero external API deps. Opens EU GDPR, India data-sovereignty, enterprise/gov segments with no direct competitor. |
| **Celery/Redis durable autopilot** (`app/celery_app.py`, `app/tasks/`, `agent_runs` table, Flower UI) | `celery_app.py`, `tasks/` | LoopCV/Simplify/ApplyHero autopilot is a black box. Tayari's run state is in Postgres with logs/screenshots jsonb, queryable via `/api/v1/hermes/runs/{id}`, monitorable in Flower. This is industrial-grade, not a Chrome ext hack. |
| **Full REST API** (Go `internal/api/router.go` v1 + archive parity, Python `app/api/hermes_routes.py`) | `router.go`, `hermes_routes.py` | PRODUCT_GRILL §21: "No competitor offers programmatic resume optimization as a service." API monetization is untapped. |
| **Browser extension with server-side queue** (`extension/` MV3 → Go review-queue endpoints) | `extension/`, Go review-queue handlers | Teal/Simplify extensions feed *their* SaaS. Tayari's extension feeds a self-hostable queue. |
| **Career roadmap** (`src/pages/CareerRoadmap.tsx`, 45.5K — the largest non-Interview page) | `CareerRoadmap.tsx` | Feature matrix §2: only JobCopilot claims "career tools" and it's shallow (4.2★ complaints). Tayari's is a real module. |
| **Communication Hub** (follow-up / thank-you / negotiation email gen, `src/pages/CommunicationHub.tsx`, `app/services/communication.py`) | `communication.py` | Only LoopCV has recruiter emails; nobody does the full post-apply comms arc. |
| **Per-ATS analysis latent in `ats_engine.py`** (PRODUCT_GRILL §12.3) | `app/services/ats_engine.py` | Jobscan's entire brand is per-ATS detection. The data is in our engine; the UI collapses it to one fiction number. Surfacing it is a moat move, not a build. |

**What we don't have (and should stop pretending we do until we ship):** a resume *builder* (we're analysis-first), a public Chrome Web Store extension (`extension/` is unreleased), a mobile app, voice/video interview AI, LinkedIn profile optimizer, and any public outcome numbers. PRODUCT_GRILL §12.6 lists these as hard truths. This strategy does **not** lean on any of them.

---

## 2. Five Killer Features — Defensible Because the Code Exists

Each: what it is, why it's a moat, smallest impl path reusing existing modules, 1-line MVP.

### K1. The Observable Chain — "Active runs: N" as the product's spine

**What.** Today the Automation engine + Hermes scrape + Celery runs are hidden in a side sheet and a JSON-returning API. Make the live pipeline the header's permanent resident: a chip showing `Active runs: 3 · last resume tailored 4m ago · 2 apps queued`, clickable into a full activity rail that shows resume→tailor→cover→apply→interview-prep as one connected run with per-stage status from `agent_runs.logs`.

**Why moat.** PRODUCT_GRILL §12.2's verdict is that Tayari is "good at everything, famous for nothing." Teal owns "resume is your bottleneck," Huntr owns "visual Kanban + mobile," Simplify owns "free autofill." **No competitor can build the observable chain** because none of them own all five stages in one process graph — they're suites of separate tools. The chain is the one thing only we can show. It also directly answers §12.1's trust liability: visible per-stage QA makes us "AI-tailored" not "blast bot."

**Smallest path.**
- `agent_runs` table already has `status, progress, current_step, logs jsonb`. Add a Go endpoint `GET /api/v1/runs/active` (mirror of existing `GET /runs` filtered to `status IN ('running','queued')`) — ~15 lines in `routes_hermes.go`.
- Frontend: a `HeaderActivityChip` component polling that endpoint every 15s, expanding to the existing `AgentPanel.tsx` (34.5K — already built, just promote it). Reuse `AutomationContext.tsx` FSM state for the client-side mirror.
- No new service, no new table, no new LLM call.

**MVP line.** Header chip `Active runs: N` → click → live rail of resume→tailor→apply→interview stages from `agent_runs`, polling `/api/v1/runs/active`.

### K2. Per-ATS Score Breakdown + Confidence Band (defuse the lying-number risk)

**What.** Replace the single ATS % on `ResumeResults.tsx` with `Workday: high · Greenhouse: medium · iCIMS: low` plus a `72 ± 8` band, and a plateau note: "Above 80 the bottleneck shifts from keywords to interview signal — start interview prep." Cite Resumly/Ajusta/TalentTuner on a public methodology page.

**Why moat.** PRODUCT_GRILL §12.3 is unambiguous: all six competitors produce different scores for the same resume+JD; the single number is "a marketing artifact, not a benchmark." This is the most reputationally exposed number we display. **Jobscan's whole brand is per-ATS detection** — but Jobscan gives you one number too. Surfacing the per-ATS breakdown plus a confidence band turns a liability into the *only honest ATS score on the market*. Trust is the wedge Deloitte (§11.1) says consumers pay more for. This is also the cheapest moat move in this doc: the data already exists in `ats_engine.py`.

**Smallest path.**
- `ats_engine.py` already produces per-dimension scores. Add a `per_ats_estimate()` helper that emits a dict `{workday: {score, confidence}, greenhouse: {...}, icims: {...}}` — heuristic on existing keyword/format dimensions, no new model.
- `ResumeResults.tsx` (32K — already renders results) gets a `PerATSBreakdown` subcomponent; the single number becomes the band header.
- Methodology page: static `src/pages/Methodology.tsx`, no backend. Cite the three studies already named in §12.3.

**MVP line.** Resume Results shows 3 ATS estimates + `±8` band + "bottleneck shifted to interview signal" plateau note; `/methodology` cites the studies.

### K3. "Skills You're Missing for This Role" Widget — surface the knowledge graph

**What.** On the Job detail pane in `JobSearch.tsx` and the Review Queue, show a widget: target role's top 10 skills (from `knowledge_graph.py`), the user's match vector from `embedding_service.py`, and the 3 gaps with the highest centrality. Clicking a gap links to the Career Roadmap node that closes it.

**Why moat.** PRODUCT_GRILL §12.5 names this exact widget as Teal/Phenom's "biggest single conversion lever in their funnel." Teal has the widget but no real graph behind it (§16.1: Teal is GPT-based, monolithic). Phenom charges $120K–600K/yr for it (§1.3). Tayari has `knowledge_graph.py` **and** `embedding_service.py` **and** `skill_taxonomy.py` **and** `CareerRoadmap.tsx` — the full stack — and surfaces none of it. This is the highest-leverage "shipped but invisible" item in the whole audit.

**Smallest path.**
- New Python route `GET /api/v1/jobs/{id}/skill-gaps?user={userId}` in `hermes_routes.py` (or a new `skill_routes.py`): query `knowledge_graph` for role nodes, `embedding_service` for user vector, return top-3 gaps. ~40 lines reusing existing services.
- Go proxies it under `/api/v1/...` + `/api/...` (route parity rule from CLAUDE.md).
- Frontend: `SkillGapWidget.tsx` mounted in `JobSearch.tsx`'s job detail pane and `ReviewQueue.tsx`. Link each gap to `CareerRoadmap.tsx` node id.

**MVP line.** Job detail pane shows 3 missing high-centrality skills for the role, each linking to the roadmap node that teaches it.

### K4. Apply Assist (renamed Autopilot) — per-job confirm + visible quality gate

**What.** Rename "AutoPilot" → "Apply Assist" across `AutoPilot.tsx` (22.2K) and nav. Gate the auto-submit step behind an explicit per-job confirmation that surfaces the per-application quality score (already computed by `ats_engine` + `guardrails`). Show the stuffing/PII/truthfulness gate results *before* submit, not after.

**Why moat.** PRODUCT_GRILL §12.1: the auto-apply category is a trust liability in 2026 — LazyApply 2.4★, Sonara dead, Jobscan itself says "auto-apply tanks quality." Volume auto-apply is a trap (§R6, §12.6.4). The defensible position is **visible quality gate per application** — "AI-tailored tier, not blast-bot tier." No competitor exposes this because none have the guardrail chain. Tayari's `keyword_stuffing.py` + `truthfulness.py` + `PipelineGate` are already in the pipeline; hiding them is leaving the moat unfilled.

**Smallest path.**
- No service change. `automation_engine.run_autopilot` already runs the gates; it just doesn't surface pass/fail to the UI.
- Add `quality_gate_result` to the `agent_runs.logs` jsonb (one extra field written in `automation_engine` where the gate already runs).
- `AutoPilot.tsx`: rename strings, add a per-job confirm modal showing the gate results before the Celery `run_application_agent` task is enqueued. Reuse `ReviewQueue.tsx` (25.9K) — it already has the review-before-submit pattern.

**MVP line.** "Apply Assist" requires per-job confirm showing stuffing/PII/truthfulness gate results before enqueueing Celery submit.

### K5. Resume → Interview Chain via Guardrail-Scored Applications — the *only* end-to-end loop

**What.** Wire the existing modules into one observable loop in the Dashboard: resume upload (`ResumeUpload.tsx`) → ATS score (`ats_engine`) → reflective optimize (`optimizer.py`) → Hermes job match (`job_agent.smart_search`) → cover letter (`cover_letter.py`) → Apply Assist (K4) → **Interview Board picks up the tailored resume + JD** (`InterviewBoard.tsx`, 47K — the largest page) → Communication Hub follow-up (`communication.py`). Each stage's output is the next stage's input; all state in `agent_runs`.

**Why moat.** PRODUCT_GRILL §3.3 / §12.2: "No competitor covers the full pipeline." Jobscan stops at resume. Teal tracks but doesn't auto-apply. Auto-apply tools have no interview prep. Final Round AI has interview but no resume. The chain is the one position no competitor can occupy without building all six modules — and we already built them. This is the positioning answer to "good at everything, famous for nothing": **famous for the chain.**

**Smallest path.**
- No new service. This is a frontend orchestration + one Go aggregation endpoint: `GET /api/v1/chain/{userId}` returning the user's current stage + next action, composed from existing tables (`applications`, `agent_runs`, `autopilot_schedules`).
- `Dashboard.tsx` (21.2K) renders a horizontal stage strip with the user's current position; each stage links to its existing page (`ResumeUpload`, `ResumeResults`, `JobSearch`, `CoverLetter`, `AutoPilot`, `InterviewBoard`, `CommunicationHub`).
- `AutomationContext.tsx` already holds the FSM — extend it to 7 stages from the current 3.

**MVP line.** Dashboard shows a 7-stage chain strip; current stage lit; click any stage to jump to its existing page; state from `agent_runs` + `applications`.

---

## 3. Product Positioning Statement

**Tayari is the only job-search platform that runs the whole chain — resume to interview — as one observable pipeline you can watch execute, with guardrails that keep every application on the authentic side of the AI-vs-recruiter arms race. It's self-hostable with a local LLM for zero marginal cost and zero data leaves-your-machine, or cloud-hosted for everyone else. No competitor connects reflective resume optimization, tiered multi-board job scraping, guardrail-gated apply assist, structured interview prep, and follow-up communication in one process graph — because they're each a point solution. We're not the suite; we're the chain.**

---

## ponytail: notes

- K1/K3/K4/K5 are **surface what's shipped** moves, not new builds. K2 is one helper + one component + one static page. The whole strategy is ~1 sprint of frontend + 2 small endpoints.
- Skipped: voice/video interview (Final Round AI owns it, 4.5★/3.4K reviews — not worth the fight this quarter), resume builder from scratch (Enhancv/Kickresume are design-first and we're analysis-first — wrong fight), mobile app (PWA is enough for now, ship native only if Huntr's mobile wins our segment).
- Add when: voice/video only after InterviewBoard retention is measurable; resume builder only if free-tier conversion is below 6%; mobile only if PWA install rate is above 15%.