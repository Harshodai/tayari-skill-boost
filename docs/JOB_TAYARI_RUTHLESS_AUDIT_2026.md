# Job Tayari — Ruthless Reality Audit (2026)

Method: four parallel code-reading sub-audits over `main` + a market/SOTA research pass.
Every verdict is **REAL** (wired end-to-end), **PARTIAL** (code exists, link missing), or
**THEATER** (mock / hardcoded / fabricated status). No claim without a file path.

---

## Q1 — Does the platform look professional and use "catchy", adoptable words?

**Verdict: PARTIAL. The IA is good; the copy layer is not shippable.**

What's right:
- Sidebar is deliberately restrained — 5 primary + 7 under "More" (`src/components/layout/AppSidebar.tsx:43-59`), with an explicit design comment. That is better discipline than Careerflow or Teal.

What's wrong:
| Problem | Evidence |
|---|---|
| Brand name is three different things | `Tayari` (majority), `Job Tayari` (`src/components/layout/Footer.tsx:125`), `jobtayari` (`Footer.tsx:31-34`) |
| Internal codename leaked into user copy | "Now with Hermes AI Agent" (`src/components/landing/HeroSection.tsx:64`), "Hermes Desktop Integration" (`src/pages/Settings.tsx:822-883`), `AgentPanel.tsx:340-619`, backend routes `/api/v1/hermes/*` |
| Fabricated social proof | Named personas with invented outcomes, `src/components/landing/SocialProofSection.tsx:20-22`; unsourced "2.5x more relevant job matches" `FAQSection.tsx:27` |
| Route sprawl vs. slim nav | **70 `<Route>` entries** in `src/App.tsx` against a 12-item nav — most pages are unreachable except by deep link |

"Hermes" is also the name of an unrelated open-source LLM family. Shipping it in the hero
line reads as an unpolished internal build, not a product.

---

## Q2 — Is the resume optimizer fully working (resume + pasted JD **or** link + custom instructions)?

**Verdict: REAL. This is the strongest part of the product.**

| Capability | Verdict | Path |
|---|---|---|
| PDF/DOCX upload → parse → store | REAL | `ResumeUpload.tsx:107` → `resumes.ts:46` → Go `routes_mvp.go:1108-1163` → Python `/api/v1/parser/parse` → `app/parsers/document_parser.py:67-137` (pdfplumber/pypdf/python-docx); text persisted to `resumes.original_text` |
| Pasted JD text | REAL | `ResumeUpload.tsx:46,121-125` → `createJD` → `/v1/analyze` |
| JD **URL** scrape | REAL, two independent wired paths | UI field `ResumeUpload.tsx:47,175-197` → `/v1/job-descriptions/import` (`routes_resume_extra.go:117-147`) with SSRF-hardened fetch (`ai_routes.py:190-245`); plus `jd_url` forwarded into `optimizer.py:635-673` Playwright fallback |
| Custom instructions | REAL, full stack | `ResumeUpload.tsx:49` → `resumeAnalysis.ts:82-91` → Go `routes_mvp.go:964` → `OptimizerRequest.custom_instructions` (`ai_routes.py:264`) → injected into prompt at `optimizer.py:437-438`, deliberately kept out of the JD scoring text |
| No LLM configured | REAL fail-closed | `LLMNotConfiguredError` (`llm_service.py:56-61`) → honest `503 ai_service_unavailable`. No fabricated output. |

Defects (minor):
1. `backend/python/app/services/resume_parser.py` is **dead code** — nothing imports it. Delete it; the real parser is `app/parsers/document_parser.py`.
2. `src/lib/resume-parser.ts` re-parses the file in-browser purely for a preview that is thrown away — wasted bundle weight.
3. Unverified: whether a mid-pipeline LLM failure can return heuristic-only text with a high `estimated_score` and no "degraded" flag (`optimizer.py:468-635`). Needs an explicit degraded-mode marker.

---

## Q3 — Does onboarding branch on job change vs. domain change, and can users edit it?

**Verdict: PARTIAL — collected, editable, and completely ignored.**

- Branching is real: `TransitionType = "same_domain" | "cross_domain"` (`src/pages/Onboarding.tsx:22`), divergent content at `:135-173` and `:193-293`.
- Editable later: yes, `src/pages/Profile.tsx:108-136, 645-782`.
- Persisted properly: `profiles` via `PATCH /profile` (`routes_mvp.go:93-116`), mirrored to `pet_preferences` + localStorage.
- **Consumed: nowhere.** `transition_type` / `current_industry` / `target_industry` appear **zero times** in `backend/python`. Job ranking, match scoring, and the optimizer never branch on them.

A cross-domain switcher and a same-domain ladder-climber currently get byte-identical output.
That is the single highest-leverage, lowest-effort fix in this audit.

---

## Q4 — Do we have a Manus-like computer-use setup: sandbox, safety, user profile, live browser in the UI?

**Verdict: PARTIAL — the hardest parts exist; the user never sees them.**

| Piece | Verdict | Evidence |
|---|---|---|
| Real browser agent | REAL | `browser_automation/agent.py:57,210,259` (`browser_use.Agent` + Playwright), `app/agent/browser_operator.py:24-49` |
| SSRF allowlist / private-IP block | REAL | `browser_operator.py:34-48,113-147`, `sandbox_executor.py:12-56` |
| PII redaction | REAL | `sandbox_executor.py:59-71,96-115` (SSN/TIN/passport) |
| Truthful failure reporting | REAL | `sandbox_executor.py:219` emits `"simulated": true` when it can't map fields |
| **Actual sandbox isolation** | **MISSING** | Runs inside the shared Celery worker image (`backend/python/Dockerfile.worker:20`). No container-per-run, no VM, no gVisor. "Sandbox" in `sandbox_executor.py` is a misnomer. |
| **Kill switch** | **MISSING** | Cancelling an `agent_runs` row (`supabase/functions/apply-agent/index.ts:70-71`) does not stop the in-flight Playwright process |
| Live screenshot stream | BUILT BUT UNREACHABLE | Backend SSE streams real per-step base64 screenshots (`agent.py:245-318` → `src/api/browser.ts` → `AgentLiveView.tsx:204-258`), but `src/pages/ApplyAgent.tsx:122` never passes `browserInstruction`, so the whole live view is dead in the shipped UI |
| VNC / continuous video / takeover | MISSING | Discrete step screenshots only; no takeover control |

So: we have Manus's engine and none of Manus's window.

---

## Q5 — "I want Google" → scan → optimize → user approves → apply in sandbox → and for new jobs too?

**Verdict: PARTIAL, and one link is actively dishonest.**

| Link | Verdict | Evidence |
|---|---|---|
| Portal scan for target company | REAL | `automation_engine.py:281,292` → `job_agent.smart_search` / `job_providers` |
| Resume tailoring | REAL | `automation_engine.py:350-355` → `optimize_with_reflection` |
| Truthfulness / PII / keyword-stuffing gate | REAL | `_QUALITY_GATE.check`, `automation_engine.py:387-399` |
| **Explicit user approval of the tailored resume** | **MISSING** | Status flips to `ready_to_submit` then submit fires at `automation_engine.py:402` if `auto_apply` is true. The only thing standing between a user and an unapproved submission is that `AutoPilot.tsx:116` hardcodes `auto_apply: false`. A `job_watches` row with `auto_apply: true` bypasses the UI entirely — `tasks/automation.py:64-81` forwards the stored config verbatim. |
| Sandbox submit | REAL code, unreachable UI | `browser_library.py:18-101` |
| **What the shipped "Apply Assist" actually did** | **WAS THEATER — fixed in this pass** | `src/lib/automation/applyChain.ts` wrote `status:"applied"` after merely drafting, without ever touching a job site. Now writes `saved` + "not yet submitted". |
| Recurring watch for new jobs | REAL | Celery beat hourly `autopilot.run_standing_job_watches` (`celery_app.py:56-59` → `tasks/automation.py:281-314`) |
| `autopilot_graph.py` (6-stage guardrailed engine) | ORPHANED | No caller in `automation_engine.py`, `tasks/automation.py`, or beat schedule |
| `end_to_end_pipeline.py` | ORPHANED | `EndToEndPipelineEngine.process_job_application` has no production caller |
| `one_shot_engine.py` | Wired only to its own page | Disconnected from the recurring flow |

**Three parallel pipelines exist; two are dead.** That is the core architectural debt.

---

## Q6 — Is there an Omnisave-style page for Substack / Medium / LinkedIn saved posts with AI tagging and citation-driven Q&A?

**Verdict: PARTIAL — the page exists, the connectors do not, and the "RAG" isn't retrieval.**

- No OAuth or API integration with Substack, Medium, or LinkedIn. Ingest is **manual URL paste** (`src/pages/Omnisave.tsx:105-130`) scraped by a generic DOM reader (`omnisave_service.py:297-336`). The docstring at `omnisave_service.py:22-23` claims connectors that do not exist.
- `sync_agent_reach_posts` (`:338-405`) correctly refuses to invent URLs — so the "Sync" button is a no-op without user input.
- Hardcoded demo cards (`Omnisave.tsx:20-60`) make an empty account look populated.
- Auto-tagging: **absent** — category hardcodes `"Career Strategy"` (`:200`), summaries are string templates (`:245-248`).
- Retrieval: `query_knowledge_rag` (`:502-571`) is `ORDER BY created_at DESC LIMIT top_k` — recency, not relevance. Embeddings are inserted as `NULL` (`:126-127`), so the working fastembed + pgvector stack (`embedding_service.py`, `embedding_storage.py`) is never called.
- Genuinely good: `_answer_is_grounded` (`:573-598`) rejects hallucinated `[Source N]` citations. Correct grounding over the wrong chunks.

---

## Q7 — Is the Gmail connector working, and does it read only what the interview board needs?

**Verdict: REAL, and the scoping is correct.**

- Full OAuth: login `routes_gmail.go:99-138`, callback/token exchange `:146-197`, refresh `:228-239`, sync `:204-298`, disconnect `:300-317`, Pub/Sub push `:329+`. Degrades gracefully when `GOOGLE_CLIENT_ID/SECRET` are unset (`:51,78,105`).
- Scope: `gmail.readonly` **only** (`:124`).
- Query is filtered, not a full-inbox pull: `q=subject:(offer OR interview OR application OR applied OR reject)` (`:513-551`).
- PII redaction before any LLM call (`email_classifier.py:44-52`); stage classification is regex-first (`:8-40`).
- UI wired: `InterviewBoard.tsx:501-548, 577-609`.

One defect: the webhook falls back to "most recently updated token" when it can't match the notified address (`routes_gmail.go:383`) — a cross-tenant mis-attribution risk. Fix before multi-user scale.

---

## Q8 — The harder questions you didn't ask (and their answers)

1. **Which of the 70 routes have ever been used?** Unknown — there is no analytics on route entry. You cannot cut scope without this.
2. **What is the actual submission success rate?** Unmeasurable. Nothing captures a confirmation number or post-submit screenshot. Sonara died of exactly this blind spot (25–40% silent failure).
3. **What happens when the agent hits "Are you authorized to work in the US?"** Today it guesses. Business Insider documented AIHawk sending factual inaccuracies under users' real names. You need a blocking human-answer queue, not a heuristic.
4. **Who is liable when the bot submits a false compliance answer?** The user, legally — under their name. You have no consent record or per-answer provenance log.
5. **Can a user prove what was sent on their behalf?** No immutable artifact of the exact submitted resume + answers per application exists.
6. **What is retention after someone gets hired?** Structurally near-zero. Category LTV cap; see Q9.
7. **Which ATSs are you willing to fight?** Undecided in code — the agent treats Workday and Greenhouse identically. They must be tiered.
8. **Is the quality gate ever measured against outcomes?** No. `_QUALITY_GATE` has no feedback loop from interview rate.

---

## Q9 — Market reality: are we ahead, and is this profitable?

Full evidence in `docs/JOB_TAYARI_10_10_PLAN.md`. Headlines:

- **Everybody who truly auto-submits has bad trust scores.** LazyApply 2.2–2.4/5 with documented LinkedIn bans; AIHawk (30k stars) flagged by Business Insider for inaccuracies; **Sonara shut down in 2024** and its relaunch still shows 25–40% silent failures.
- **Everybody with good trust scores refuses to auto-submit.** Simplify (1.8M users, 300M autofills) is explicitly autofill-only and only ~70% accurate on Workday. Teal and Huntr never promise submission.
- **The platforms are hardening.** Robert Half (Mar 2026): 67% of HR leaders say AI-generated applications are slowing hiring. Greenhouse's CEO publicly calls it an "AI doom loop" (Fortune, Jul 2026). Zapply's founder reverse-engineered Greenhouse/Lever, blogged about beating bot protection, **then shut the company down**.
- **No major ATS offers a sanctioned third-party submission API.** Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable — public *listing* endpoints only.
- **Agent infra is now commodity.** Browserbase ($20/$99 tiers, session replay + live view) and Browser Use ($0.02/browser-hour) both ship the sandbox and live-view primitives. Building your own is wasted capital. OpenAI has killed its consumer agent product twice — do not build on it.

**Honest profitability verdict: the auto-apply mechanic is a graveyard; the trust-and-signal layer is a real business.**
The category kills founders on the exact promise that excites them. Job Tayari's defensible position is not "we apply everywhere" — it is **"we are the only tool that can prove what was sent, why, and what it produced."** Verified submission receipts, an outcome funnel, honest ATS tiering, and a human-in-the-loop answer queue are things *nobody* in the matrix has. That is a 10/10 wedge. Volume auto-apply is a 2/10 wedge with a lawsuit and a ban wave attached.

Secondary structural risk: **LTV is capped by success** — users churn the moment they're hired. Without a boomerang/career-monitoring mode, unit economics stay thin regardless of product quality.

---

## Confidence

| Question | Confidence |
|---|---|
| Q2 resume optimizer REAL | 9/10 (one unverified degraded-mode branch) |
| Q7 Gmail REAL | 9/10 |
| Q3, Q6 PARTIAL | 10/10 (absence proven by grep) |
| Q4, Q5 PARTIAL/THEATER | 9/10 (`run_scheduled` config provenance confirmed) |
| Q9 market verdict | 8/10 (public sources, 2026-current) |
