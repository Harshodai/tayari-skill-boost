# Tayari Resume Optimizer — PRD Gap Analysis

> **Generated:** 2025-01-21  
> **PRD Source:** `/Users/harshodaikolluru/Documents/Resume_Optimizer_PRD.pages` (Apple Pages, binary extracted)  
> **Implementation:** `/Users/harshodaikolluru/Public/tayari-skill-boost/`  
> **Archive Reference:** `/Users/harshodaikolluru/Music/archive/`  
> **Test Suite:** `/Users/harshodaikolluru/Music/archive/backend_test.py`

---

## 1. PRD Text Extraction (Key Sections)

### Vision (from PRD)
> One profile-driven platform that removes job-seeker friction: AI resume optimization (ATS), agentic smart job search, and application Auto-Pilot automation — replacing the multi-website, multi-free-trial midnight workflow.

### Core Competitor Gaps (from PRD)
> Every major resume optimization tool operates on a freemium chokehold model. Jobscan limits free users to 5 scans/month. Rezi restricts to 1 resume + 3 downloads. Teal charges $13/week. Resume Worded gates job-specific matching behind $49/month. EarnBetter monetizes user data and produces generic output. The result: job seekers who need help the most are systematically excluded.

### Built (MVP, fully tested) — from PRD

#### Auth & Profile
- Email/password (bcrypt + JWT) and Google OAuth (httpOnly cookie sessions)
- LinkedIn/Facebook sign-in buttons present as "coming soon"
- Profile (headline, summary, skills, desired roles, locations, experience, links) auto-created at signup; powers all matching

#### Resume Optimizer (Jobscan-class "scan, explain, fix")
- Upload PDF/DOCX/TXT (5MB), pypdf/python-docx parsing
- Deterministic ATS engine (14 research-backed checks: sections, contact, bullets, action verbs, quantified metrics, dates, recency, job-title alignment, weighted token+bigram keyword coverage)
- LLM analysis grounded with deterministic evidence (45% heuristic + 55% AI score)
- Optimization with **REFLEXION LOOP**: generate → deterministic re-score → critique with concrete gaps → refine (kept only if measurably better); ATS-safe DOCX export

#### Smart Job Search (Hermes-style agent: PLAN → GATHER → PRERANK → RANK → REPORT)
- Multi-query expansion from profile; aggregates Remotive + Arbeitnow + RemoteOK (free, key-less; pluggable adapters for JSearch/Adzuna); 30-min Mongo cache; dedupe
- Lexical pre-rank (skill overlap + recency) → LLM batch scoring → hybrid RRF-style fusion of lexical and semantic ranks; transparent agent trace + per-job reasons

#### Auto-Pilot (automation)
- Config: job titles, dream companies (boosted + targeted sweeps), location, resume, max applications; background run with live progress polling + full audit log
- Per job: reflexion-tailored resume, ATS before/after, AI cover letter, tracked application (statuses: ready_to_submit / auto_applied / submitted / interview / rejected / offer)
- Never re-applies to the same job (cross-run dedupe)
- Recurring schedules (daily/weekly) with multi-worker-safe atomic scheduler
- NOTE: submission is **ASSISTED/SIMULATED** — external boards expose no apply API; the package (tailored resume DOCX + letter + deep link) is prepared and tracked

#### LLM Engine Abstraction (open-source ready)
- `emergent` (preview default: gpt-5.2 smart / gpt-5-mini fast)
- `hermes`: NousResearch Hermes Agent OpenAI-compatible API (HERMES_AGENT_URL)
- `openai_compatible`: Groq / OpenRouter / Together / Ollama / vLLM (LLM_BASE_URL / KEY / MODEL)
- `/api/health` exposes active `agent_engine`; engine shown in agent traces

#### Local Production Deploy (`/app/deploy`)
- `docker-compose.yml`: mongo + backend (4 uvicorn workers) + frontend (nginx, /api proxy)
- `docker-compose.hermes.yml`: + Ollama hermes3:8b (100% open-source AI) and a Mode B template for the full hermes-agent container
- `README.md` with one-command instructions; `.env.example` with 4 LLM modes

#### Test Status
- Backend: 29/29 passed (testing agent) + main-agent smoke of reflexion/dedupe/fusion
- Frontend: login → dashboard verified via browser on preview URL; full UI testing pending user permission

### Research-Backed Roadmap (not yet built) — from PRD
1. Review-before-submit queue UX — DONE (default review mode, approve/skip controls)
2. Embedding hybrid retrieval + skill taxonomy — DONE (local BGE embeddings via fastembed + curated ESCO-style taxonomy + RRF fusion of 3 rankers)
3. Browser-extension / RPA true auto-submit with stop-when-unsure safety
4. LinkedIn/Facebook OAuth (developer apps required), job alerts, social profile feed
5. Outcome calibration: track interview rates per match-score band to tune ranking

---

## 2. Section-by-Section Gap Analysis

### 2.1 Auth & Profile — ✅ FULLY IMPLEMENTED

| Requirement | Status | Evidence |
|------------|--------|----------|
| Email/password (bcrypt + JWT) | ✅ | `backend/go/internal/auth/local.go` — bcrypt hashing, JWT generation, `auth/users` table |
| Google OAuth (httpOnly cookie) | ✅ | `backend/go/internal/auth/social.go`, `router.go` routes `/api/auth/google`, `/api/auth/google/callback` |
| LinkedIn/Facebook OAuth | 🟡 Coming soon | Config has `LinkedinClientID`/`LinkedinClientSecret` (`config.go`), social routes exist, but frontend shows "coming soon" |
| Profile fields (headline, summary, skills, desired_roles, locations, experience_years, open_to_remote, links) | ✅ | `backend/go/internal/models/profile.go`, `routes_mvp.go` handles GET/PUT, `frontend/src/pages/Profile.tsx` full UI |
| Profile auto-created at signup | ✅ | `backend/go/internal/auth/local.go` — profile upsert on registration |

**Files:**
- `backend/go/internal/auth/local.go` — local auth service
- `backend/go/internal/auth/social.go` — social OAuth
- `backend/go/internal/models/profile.go` — profile model
- `backend/go/internal/api/routes_mvp.go` — profile handlers (lines 57-133)
- `frontend/src/pages/Profile.tsx` — full profile UI with editing
- `backend/db/init.sql` — `profiles` table definition
- `backend/db/mvp_additions.sql` — profile column additions

---

### 2.2 Resume Optimizer — ✅ FULLY IMPLEMENTED

| Requirement | Status | Evidence |
|------------|--------|----------|
| Upload PDF/DOCX/TXT (5MB) | ✅ | `frontend/src/pages/ResumeUpload.tsx` — `UploadZone` with `accept=".pdf,.docx"`, `maxSize={5*1024*1024}`; `backend/go/internal/api/router.go` — `handleUploadResumeMultipart` (lines 890-941) |
| pypdf / python-docx parsing | ✅ | `backend/python/app/parsers/document_parser.py` — `ResumeParser.parse_file()` |
| Deterministic ATS engine (14 checks) | ✅ | `backend/python/app/services/ats_engine.py` — 14 research-backed checks: contact email, phone, experience section, education, skills, summary, optimal length, bullet points, action verbs, quantified achievements, dates present, recent experience, job keyword match, job title alignment |
| LLM analysis grounded with evidence (45% heuristic + 55% AI) | ✅ | `backend/python/app/main.py` — `ats_analyze` calls both `keyword_analyzer` and `ats_scorer`; `backend/python/app/llm/strategic_analyzer.py` — strategic LLM layer |
| **REFLEXION LOOP** optimization | ✅ | `backend/python/app/services/optimizer.py` — `optimize_with_reflection()`: pass 1 (generate) → heuristic score → if < 85, pass 2 (critique + refine). Returns `refinement_passes`, `new_heuristic_score`, `changes`, `keywords_added` |
| ATS-safe DOCX export | ✅ | `backend/python/app/services/docx_builder.py` — `build_resume_docx()`; `backend/go/internal/api/routes_mvp.go` — `handleDownloadApplicationResume` (lines 592-631), `handleExportResume` (lines 847-884) |
| PDF export | ✅ | `backend/python/app/export/pdf_exporter.py` — `PDFExporter.export()` |
| JSON export | ✅ | `backend/python/app/export/json_exporter.py` — `JSONExporter.export()` |

**Files:**
- `backend/python/app/services/ats_engine.py` — deterministic ATS scorer (14 checks, 152 lines)
- `backend/python/app/services/optimizer.py` — reflexion loop optimizer (122 lines)
- `backend/python/app/parsers/document_parser.py` — document parsing
- `backend/python/app/scoring/ats_scorer.py` — legacy ATS scorer
- `backend/python/app/analysis/similarity.py` — keyword analysis
- `backend/python/app/analysis/ngram_analyzer.py` — n-gram analysis
- `backend/python/app/services/docx_builder.py` — DOCX generation
- `backend/python/app/export/pdf_exporter.py` — PDF export
- `backend/python/app/export/json_exporter.py` — JSON export
- `frontend/src/pages/ResumeUpload.tsx` — upload + analysis UI (618 lines)
- `frontend/src/pages/ResumeResults.tsx` — results + optimize + deep ATS + export UI (446 lines)
- `backend/go/internal/api/routes_mvp.go` — Go handlers for resume endpoints

---

### 2.3 Smart Job Search — ✅ FULLY IMPLEMENTED

| Requirement | Status | Evidence |
|------------|--------|----------|
| Hermes-style agent: PLAN → GATHER → PRERANK → RANK → REPORT | ✅ | `backend/python/app/services/job_agent.py` — `smart_search()` implements full trace: `derive_query` (PLAN), `search_jobs` (GATHER), `hybrid_prerank` (PRERANK), `rank_jobs` (RANK), trace logging (REPORT) |
| Multi-query expansion from profile | ✅ | `job_agent.py` — `expand_queries()` generates up to 3 query variants from `desired_roles` and `headline` |
| Aggregates Remotive + Arbeitnow + RemoteOK | ✅ | `backend/python/app/services/job_providers.py` — `search_jobs()` calls all three providers |
| 30-min Mongo cache | ❌ MISSING | PRD mentions MongoDB cache; no MongoDB connection or caching layer visible in current code. `job_agent.py` fetches fresh every time. |
| Deduplication | ✅ | `job_agent.py` — `seen = set()` with `(title.lower(), company.lower())` dedupe key; `smart_search` and `automation_engine.py` both dedupe |
| Lexical pre-rank (skill overlap + recency) | ✅ | `job_agent.py` — `lexical_prerank()` scores by token overlap + recency boost (fresh jobs get +5) |
| LLM batch scoring | ✅ | `job_agent.py` — `rank_jobs()` sends batched LLM call scoring all jobs against candidate |
| Hybrid RRF-style fusion (lexical + semantic) | ✅ | `job_agent.py` — `hybrid_prerank()` uses 3 rankers: lexical, skill-taxonomy, semantic embeddings (BGE), fused with RRF (K=60) |
| Transparent agent trace + per-job reasons | ✅ | `job_agent.py` — `trace` array with `step`, `detail`, `at` timestamps; each job gets `match_score`, `matched_skills`, `missing_skills`, `match_reason` |
| Skill taxonomy (ESCO-style) | ✅ | `backend/python/app/services/skill_taxonomy.py` — `taxonomy_overlap()` |
| Semantic embeddings (BGE) | ✅ | `backend/python/app/services/embedding_service.py` — `embed_texts()` using fastembed BGE model, `cosine_similarity()` |
| Pluggable adapters for JSearch/Adzuna | 🟡 | `job_providers.py` structure is pluggable; only Remotive, Arbeitnow, RemoteOK currently implemented |

**Files:**
- `backend/python/app/services/job_agent.py` — full agent pipeline (283 lines)
- `backend/python/app/services/job_providers.py` — job provider adapters
- `backend/python/app/services/skill_taxonomy.py` — ESCO-style taxonomy overlap
- `backend/python/app/services/embedding_service.py` — BGE embeddings via fastembed
- `frontend/src/pages/JobSearch.tsx` — job search UI (274 lines)
- `backend/go/internal/api/routes_mvp.go` — `handleJobSearch` (lines 139-152), `handleJobSearchGET` (lines 943-964)

---

### 2.4 Auto-Pilot — ✅ FULLY IMPLEMENTED (Core); 🟡 MISSING (Scheduler Execution)

| Requirement | Status | Evidence |
|------------|--------|----------|
| Config: job titles, dream companies, location, resume, max applications | ✅ | `frontend/src/pages/AutoPilot.tsx` — query, location, maxJobs slider; `automation_engine.py` — reads `run_config` with `job_titles`, `dream_companies`, `location`, `max_applications` |
| Background run with live progress polling | ✅ | `automation_engine.py` — `asyncio.create_task()` for background; `backend/go/internal/api/routes_mvp.go` — `handleGetAutopilotRun` polls Python status and enriches with DB data (lines 345-432) |
| Full audit log | ✅ | `automation_engine.py` — `_log()` writes structured logs with step, message, timestamp; stored in `_autopilot_store` and returned via Go polling |
| Per job: reflexion-tailored resume | ✅ | `automation_engine.py` — calls `optimize_with_reflection()` for each selected job (lines 178-183) |
| ATS before/after scoring | ✅ | `automation_engine.py` — `base_score = heuristic_ats_score(resume_text)["score"]` then `ats_after` from optimization result (lines 172-188) |
| AI cover letter per job | ✅ | `automation_engine.py` — `_cover_letter()` generates 180-260 word cover letter (lines 65-72) |
| Tracked application statuses | ✅ | `backend/db/mvp_additions.sql` — `applications` table with `status` field; `automation_engine.py` — sets `status: "auto_applied"` or `"ready_to_submit"` |
| Never re-applies (cross-run dedupe) | ✅ | `automation_engine.py` — `prior_keys` scans all prior `_autopilot_store` runs to dedupe (lines 142-153) |
| Recurring schedules (daily/weekly) | 🟡 **PARTIAL** | Backend CRUD exists (`routes_mvp.go` lines 637-769); but **no scheduler daemon executes scheduled runs** |
| Multi-worker-safe atomic scheduler | ❌ MISSING | No distributed scheduler or cron worker visible |
| Submission is ASSISTED/SIMULATED | ✅ | `automation_engine.py` — sets `submission_mode: "assisted"`, `apply_url` from job; no actual external API submission |
| Concurrent run prevention (409) | ✅ | `backend/go/internal/api/routes_mvp.go` — `handleAutopilotStart` checks active runs and returns 409 (lines 264-267) |
| Application Kanban board | ✅ | `frontend/src/pages/Dashboard.tsx` — Applications tab with status badges; `frontend/src/pages/AutoPilot.tsx` — displays generated applications with ATS scores |
| Resume DOCX download per application | ✅ | `backend/go/internal/api/routes_mvp.go` — `handleDownloadApplicationResume` (lines 592-631) |

**Files:**
- `backend/python/app/services/automation_engine.py` — Auto-Pilot engine (245 lines)
- `backend/python/app/services/optimizer.py` — reflexion loop (shared)
- `frontend/src/pages/AutoPilot.tsx` — Auto-Pilot UI (349 lines)
- `backend/go/internal/api/routes_mvp.go` — Go handlers (lines 257-431, 637-769)
- `backend/db/mvp_additions.sql` — `autopilot_runs`, `applications`, `autopilot_schedules` tables
- `backend/go/internal/models/autopilot.go` — AutopilotRun, Application, AutopilotSchedule models

---

### 2.5 LLM Engine Abstraction — 🟡 PARTIALLY IMPLEMENTED

| Requirement | Status | Evidence |
|------------|--------|----------|
| `emergent` preview (gpt-5.2 smart / gpt-5-mini fast) | ❌ MISSING | No `emergent` API integration; `llm_service.py` uses generic `LLM_BASE_URL` |
| `hermes`: NousResearch Hermes Agent | ❌ MISSING | No Hermes-specific endpoint or `HERMES_AGENT_URL` handling; config doesn't have `HERMES_AGENT_URL` |
| `openai_compatible`: Groq / OpenRouter / Together / Ollama / vLLM | ✅ | `backend/python/app/services/llm_service.py` — `_openai_compatible_complete()` with standard OpenAI chat completions format |
| `/api/health` exposes `agent_engine` | ✅ | `backend/go/internal/api/router.go` — `handleHealth` returns `"agent_engine": "hermes-local"` (line 188); `backend/python/app/main.py` — health returns `model_status` |
| Engine shown in agent traces | ✅ | `job_agent.py` — trace includes `agent_engine: {active_engine()}` |
| Tier distinction (fast vs smart) | 🟡 NO-OP | `llm_service.py` — `tier` parameter accepted but currently ignored; both tiers call same function |
| Mock fallback when no LLM configured | ✅ | `llm_service.py` — `_mock_complete()` returns generic JSON when `LLM_BASE_URL` is empty |

**Files:**
- `backend/python/app/services/llm_service.py` — LLM abstraction (88 lines)
- `backend/go/internal/api/router.go` — health endpoint (lines 184-204)
- `backend/python/app/main.py` — Python health endpoint (lines 68-76)

---

### 2.6 Database — ✅ FULLY IMPLEMENTED

| Requirement | Status | Evidence |
|------------|--------|----------|
| `auth.users` (emulated Supabase schema) | ✅ | `backend/db/init.sql` — full `auth.users` table with all Supabase columns |
| `profiles` | ✅ | `backend/db/init.sql` — with headline, summary, skills, desired_roles, locations, experience_years, open_to_remote, links |
| `resumes` | ✅ | `backend/db/init.sql` — with original_text, parsed_json, file_url, file_type, status |
| `job_descriptions` | ✅ | `backend/db/init.sql` — with title, company, text |
| `saved_jobs` | ✅ | `backend/db/mvp_additions.sql` — with dedupe_key, job JSONB, status |
| `autopilot_runs` | ✅ | `backend/db/mvp_additions.sql` — with run_id, config, status, progress, current_step, logs, applications_created, error |
| `applications` | ✅ | `backend/db/mvp_additions.sql` — with application_id, job, tailored_resume_text, cover_letter, changes, keywords_added, ats_score_before, ats_score_after, is_dream_company, status, submission_mode, apply_url |
| `autopilot_schedules` | ✅ | `backend/db/mvp_additions.sql` — with schedule_id, frequency, config, active, next_run_at, last_run_at |
| `analysis_results` | ✅ | `backend/go/internal/api/router.go` — `handleAnalyze` stores to `analysis_results` table |
| `resume_analyses` | ✅ | `backend/db/init.sql` — Supabase-style table for cloud mode |
| `blog_posts` | ✅ | `backend/db/init.sql` — with slug, content, excerpt, featured_image, category, tags, etc. |
| `auth_attempts` | ✅ | `backend/db/init.sql` — rate limiting table |
| `user_roles` | ✅ | `backend/db/init.sql` — RBAC table |
| `user_achievements`, `user_streaks` | ✅ | `backend/db/init.sql` — gamification tables |
| Proper indexes | ✅ | All tables have appropriate indexes (`idx_*`) |
| RLS / security functions | ✅ | `backend/db/init.sql` — `has_role()` security definer function; Supabase migrations have extensive RLS policies |

**Files:**
- `backend/db/init.sql` — full schema (238 lines)
- `backend/db/mvp_additions.sql` — MVP additions (100 lines)
- `supabase/migrations/` — 12 migration files with security hardening, RLS policies, RBAC

---

### 2.7 Dashboard — ✅ FULLY IMPLEMENTED

| Requirement | Status | Evidence |
|------------|--------|----------|
| Stats grid (resumes, analyses, applications, saved jobs, avg score) | ✅ | `frontend/src/pages/Dashboard.tsx` — stats grid with all metrics |
| Analysis history | ✅ | `frontend/src/pages/Dashboard.tsx` — `AnalysisHistoryList` component; `useQuery` with `listAnalysisHistory` |
| Saved resumes | ✅ | `frontend/src/pages/Dashboard.tsx` — Resumes tab with status badges and scores |
| Applications Kanban | ✅ | `frontend/src/pages/Dashboard.tsx` — Applications tab with status badges (interview, applied, rejected, offer, phone_screen, saved) |
| Backend dashboard stats | ✅ | `backend/go/internal/api/routes_mvp.go` — `handleDashboardStats` (lines 966-1006) returns `resumes_count`, `saved_jobs_count`, `applications_count`, `interviews_count`, `profile_completion_pct` |

**Files:**
- `frontend/src/pages/Dashboard.tsx` — Dashboard UI (437 lines)
- `backend/go/internal/api/routes_mvp.go` — `handleDashboardStats` (lines 966-1006)
- `frontend/src/api/index.ts` — `dashboardStats()` API function

---

### 2.8 Frontend / UI — ✅ MOSTLY IMPLEMENTED; 🟡 SOME GAPS

| Requirement | Status | Evidence |
|------------|--------|----------|
| Landing page | ✅ | `frontend/src/pages/Index.tsx` — hero, features, testimonials, CTA |
| Resume upload + analysis | ✅ | `frontend/src/pages/ResumeUpload.tsx` — full 2-column layout with upload zone, JD paste, AI options, analysis progress |
| Resume results | ✅ | `frontend/src/pages/ResumeResults.tsx` — score display, keyword analysis, section breakdown, suggestions with apply buttons, optimize/deep ATS/export buttons |
| Job search | ✅ | `frontend/src/pages/JobSearch.tsx` — search bar, location filter, results with match scores, save/apply buttons |
| Auto-Pilot config + run | ✅ | `frontend/src/pages/AutoPilot.tsx` — query, location, max jobs slider, start button, progress polling, logs, application cards with ATS before/after |
| Profile management | ✅ | `frontend/src/pages/Profile.tsx` — full edit form with skills, roles, locations, experience, remote toggle |
| Dashboard | ✅ | `frontend/src/pages/Dashboard.tsx` — tabs for history, resumes, applications |
| Settings | ✅ | `frontend/src/pages/Settings.tsx` — (exists, not fully examined) |
| Auth pages (login/register) | ✅ | `frontend/src/pages/Auth.tsx` — email/password + OAuth |
| FAQ, Contact, Terms, Privacy, About, Careers | ✅ | All pages exist |
| Blog | ✅ | `frontend/src/pages/Blog.tsx`, `BlogPost.tsx` |
| Resume Templates | 🟡 STUB | `frontend/src/pages/ResumeTemplates.tsx` — 6 template options with preview UI, but generation relies on Supabase edge function (external LaTeX); no self-hosted DOCX template generation |
| Schedule management UI | ❌ MISSING | No frontend page for creating/viewing/managing recurring Auto-Pilot schedules |
| Review-before-submit queue | ❌ MISSING | PRD says "DONE" but no UI for reviewing `ready_to_submit` applications before they become `auto_applied` |
| Coming soon badges | ✅ | `frontend/src/config/features.ts` — `showComingSoonBadges: true` |
| Feature flags | ✅ | `frontend/src/config/features.ts` — production/preview mode toggles for all features |

**Files:**
- `frontend/src/App.tsx` — routing with feature flags (161 lines)
- `frontend/src/config/features.ts` — feature toggles (78 lines)
- `frontend/src/pages/*.tsx` — 27 page components

---

### 2.9 Local Production Deploy — ❌ MISSING

| Requirement | Status | Evidence |
|------------|--------|----------|
| `docker-compose.yml` (mongo + backend + frontend) | ❌ MISSING | Not found in current codebase. PRD explicitly mentions this file. |
| `docker-compose.hermes.yml` (+ Ollama hermes3:8b) | ❌ MISSING | Not found in current codebase. |
| `README.md` with one-command instructions | 🟡 PARTIAL | `backend/README.md`, `backend/go/README.md`, `backend/python/README.md` exist but no root-level deploy README |
| `.env.example` with 4 LLM modes | 🟡 PARTIAL | `backend/go/.env.example`? Not examined. `config.go` lists required env vars. |
| Nginx reverse proxy (/api → backend) | ❌ MISSING | No nginx config visible |
| 4 uvicorn workers | 🟡 CONFIGURABLE | `backend/python/app/main.py` uses `uvicorn.run()` directly; can be configured with `UVICORN_WORKERS` env var typically |

**Note:** The archive (`/Users/harshodaikolluru/Music/archive/`) may contain these Docker files, but they are **not in the current implementation**.

---

### 2.10 Tests — 🟡 PARTIALLY IMPLEMENTED

| Requirement | Status | Evidence |
|------------|--------|----------|
| Backend: 29/29 passed | ❌ MISSING FROM CURRENT CODEBASE | `backend_test.py` exists **only in archive** (`/Users/harshodaikolluru/Music/archive/backend_test.py` — 1001 lines). Not in current `tayari-skill-boost/` directory. |
| Go router tests | ✅ | `backend/go/internal/api/router_test.go` — exists (not fully examined) |
| Frontend unit tests | ✅ | `frontend/src/App.test.tsx`, `frontend/src/components/ui/Button.test.tsx`, `Switch.test.tsx`, `ScrollToTop.test.tsx`, `features.test.ts` — exist |
| Main-agent smoke of reflexion/dedupe/fusion | ❌ MISSING | No Python integration test suite in current codebase |

**Files:**
- `/Users/harshodaikolluru/Music/archive/backend_test.py` — **Archive only** — comprehensive 29-test suite covering health, CORS, auth, schedules, autopilot, smart search, optimize, analyze, dashboard
- `backend/go/internal/api/router_test.go` — Go router tests
- `frontend/src/**/*.test.tsx` — Frontend unit tests

---

### 2.11 AI Proofing & Strategic Analysis — 🟡 BACKEND EXISTS; FRONTEND MISSING

| Requirement | Status | Evidence |
|------------|--------|----------|
| AI proofing detector (AI-detection risk analysis) | 🟡 BACKEND ONLY | `backend/python/app/ai_proofing/detector.py` — exists; `main.py` — `/api/v1/strategic/ai-proof` endpoint; **NOT used in frontend** |
| Strategic analyzer (hidden skills, templates, recommendations) | 🟡 BACKEND ONLY | `backend/python/app/llm/strategic_analyzer.py` — exists; `main.py` — `/api/v1/strategic/analyze` endpoint; **NOT used in frontend** |
| Entity extractor | 🟡 BACKEND ONLY | `backend/python/app/extraction/entity_extractor.py` — exists; `main.py` — `/api/v1/strategic/entities` endpoint; **NOT used in frontend** |
| Keyword injector | 🟡 BACKEND ONLY | `backend/python/app/extraction/entity_extractor.py` — `KeywordInjector.suggest_injections()`; **NOT used in frontend** |

**Files:**
- `backend/python/app/ai_proofing/detector.py`
- `backend/python/app/llm/strategic_analyzer.py`
- `backend/python/app/extraction/entity_extractor.py`
- `backend/python/app/main.py` — strategic routes (lines 147-169)

---

### 2.12 Supabase Edge Functions — 🟡 EXISTS BUT BYPASSED IN SELF-HOSTED MODE

| Requirement | Status | Evidence |
|------------|--------|----------|
| `analyze-resume` edge function | ✅ | `supabase/functions/analyze-resume/index.ts` — calls Lovable AI Gateway with gemini-3-flash-preview (370 lines) |
| `generate-resume-pdf` edge function | ✅ | `supabase/functions/generate-resume-pdf/index.ts` — exists |
| `check-rate-limit` edge function | ✅ | `supabase/functions/check-rate-limit/index.ts` — exists |
| `check-breached-password` edge function | ✅ | `supabase/functions/check-breached-password/index.ts` — exists |
| Self-hosted mode bypasses edge functions | 🟡 BY DESIGN | `frontend/src/api/index.ts` — `USE_SELF_HOSTED` flag switches to Go backend API; edge functions only used in cloud/Supabase mode |

**Files:**
- `supabase/functions/analyze-resume/index.ts`
- `supabase/functions/generate-resume-pdf/index.ts`
- `supabase/functions/check-rate-limit/index.ts`
- `supabase/functions/check-breached-password/index.ts`

---

## 3. Priority-Ranked Missing Features

### P0 — CRITICAL FOR LAUNCH (Must Have)

| # | Gap | Why Critical | Effort |
|---|-----|-------------|--------|
| 1 | **No scheduled Auto-Pilot execution** — Schedules are stored in DB but no cron/scheduler daemon actually runs them | Core PRD promise: "recurring schedules (daily/weekly)" | Medium |
| 2 | **No frontend UI for schedule management** — API client has `createSchedule`/`listSchedules`/`updateSchedule`/`deleteSchedule` but no page/component | Users cannot create or manage recurring runs | Medium |
| 3 | **No review-before-submit queue UI** — PRD says "DONE" but `ready_to_submit` applications have no frontend review flow | Users cannot approve/skip Auto-Pilot applications before they are marked applied | Medium |
| 4 | **Backend test suite missing from current codebase** — `backend_test.py` is only in archive; no integration tests in current repo | Cannot verify 29/29 pass; regression risk is high | Low |
| 5 | **No `docker-compose.yml` for local production deploy** — PRD explicitly requires this for one-command deployment | Users cannot self-host easily | Medium |
| 6 | **LLM tier distinction is no-op** — `tier="fast"` vs `tier="smart"` does nothing in `llm_service.py`; PRD expects different models (gpt-5-mini vs gpt-5.2) | Cannot optimize latency vs quality | Low |

### P1 — IMPORTANT (Should Have for v1.0)

| # | Gap | Why Important | Effort |
|---|-----|-------------|--------|
| 7 | **No MongoDB cache for job search** — PRD says "30-min Mongo cache"; jobs fetched fresh every time | Unnecessary API calls to job boards; no dedupe across sessions | Medium |
| 8 | **Resume Templates page uses Supabase edge function only** — Self-hosted mode has no PDF generation from templates; `ResumeTemplates.tsx` calls `supabase.functions.invoke("generate-resume-pdf")` which requires cloud | Self-hosted users cannot generate PDFs from templates | Medium |
| 9 | **No `nginx` / reverse proxy config** — PRD mentions nginx with `/api` proxy for frontend container | Production deployment needs proper routing | Low |
| 10 | **AI proofing / strategic analysis not integrated in frontend** — Endpoints exist but ResumeUpload/ResumeResults don't use them | Missed value-add features that differentiate from competitors | Medium |
| 11 | **No `HERMES_AGENT_URL` or emergent API integration** — LLM abstraction only supports generic OpenAI-compatible; PRD expects 3 distinct engine modes | Cannot use Hermes or Emergent tiers as described | Medium |
| 12 | **LinkedIn OAuth marked "coming soon"** — Config exists but no actual developer app integration verified | Social auth parity with Google | Medium |

### P2 — NICE-TO-HAVE (Post-Launch)

| # | Gap | Why Nice-to-Have | Effort |
|---|-----|-----------------|--------|
| 13 | **Browser extension / Chrome extension** — PRD mentions "Chrome extension to save jobs" | Distribution channel; not core to product | High |
| 14 | **One-Click Apply to major ATS platforms** (Workday, Greenhouse, Taleo, Lever) | Pages file mentions this; RPA-level complexity | High |
| 15 | **Job alerts** — PRD roadmap item #4 | Engagement feature; email/push notification system needed | Medium |
| 16 | **Social profile feed** — PRD roadmap item #4 | Community feature; not core to resume optimization | High |
| 17 | **Outcome calibration** — track interview rates per match-score band to tune ranking | Data science feature; needs time to collect data | Medium |
| 18 | **White-label for career centers / universities** — Pages file mentions this | B2B sales channel; separate business model | High |
| 19 | **Pluggable adapters for JSearch / Adzuna** — `job_providers.py` structure supports it but not implemented | More job board coverage | Low |
| 20 | **Frontend `ResumeResults.tsx` export button exports original resume, not optimized text** — The `optimizedText` state has the LLM-refined resume but `handleExport` calls `exportResume(resumeId)` which exports the original from DB | UX inconsistency; users may want optimized export | Low |

---

## 4. File Path Map: Implementation ↔ PRD Requirements

### Fully Implemented (✅) — Key Files

| PRD Requirement | Implementation File(s) |
|-----------------|----------------------|
| Auth (email/password, JWT) | `backend/go/internal/auth/local.go` |
| Google OAuth | `backend/go/internal/auth/social.go`, `backend/go/internal/config/config.go` |
| Profile model + API | `backend/go/internal/models/profile.go`, `backend/go/internal/api/routes_mvp.go:57-133` |
| Profile UI | `frontend/src/pages/Profile.tsx` |
| Resume upload (multipart) | `backend/go/internal/api/routes_mvp.go:890-941`, `frontend/src/pages/ResumeUpload.tsx:397-417` |
| Document parsing | `backend/python/app/parsers/document_parser.py` |
| ATS engine (14 checks) | `backend/python/app/services/ats_engine.py` |
| Reflexion loop optimizer | `backend/python/app/services/optimizer.py` |
| DOCX export | `backend/python/app/services/docx_builder.py`, `backend/go/internal/api/routes_mvp.go:847-884` |
| PDF export | `backend/python/app/export/pdf_exporter.py` |
| JSON export | `backend/python/app/export/json_exporter.py` |
| Job agent (PLAN→GATHER→PRERANK→RANK→REPORT) | `backend/python/app/services/job_agent.py` |
| Job providers (Remotive, Arbeitnow, RemoteOK) | `backend/python/app/services/job_providers.py` |
| Hybrid ranking (lexical + taxonomy + embeddings + RRF) | `backend/python/app/services/job_agent.py:128-177` |
| Skill taxonomy | `backend/python/app/services/skill_taxonomy.py` |
| Semantic embeddings (BGE) | `backend/python/app/services/embedding_service.py` |
| Auto-Pilot engine | `backend/python/app/services/automation_engine.py` |
| Auto-Pilot Go handlers | `backend/go/internal/api/routes_mvp.go:257-431` |
| Auto-Pilot UI | `frontend/src/pages/AutoPilot.tsx` |
| Dashboard | `frontend/src/pages/Dashboard.tsx`, `backend/go/internal/api/routes_mvp.go:966-1006` |
| Database schema | `backend/db/init.sql`, `backend/db/mvp_additions.sql` |
| Feature flags | `frontend/src/config/features.ts` |
| Go router + middleware | `backend/go/internal/api/router.go` |
| Go models | `backend/go/internal/models/*.go` |
| Python FastAPI app | `backend/python/app/main.py` |
| Supabase edge functions | `supabase/functions/*/index.ts` |
| Auth context + protected routes | `frontend/src/contexts/AuthContext.tsx`, `frontend/src/components/ProtectedRoute.tsx` |
| API client | `frontend/src/api/index.ts` |

### Partially Implemented (🟡) — Key Files

| PRD Requirement | What's Done | What's Missing | Key File(s) |
|-----------------|-------------|---------------|-------------|
| Schedules (CRUD) | DB table, Go handlers, API client | No scheduler daemon; no frontend UI | `backend/go/internal/api/routes_mvp.go:637-769`, `frontend/src/api/index.ts:278-305` |
| LLM engine abstraction | Generic OpenAI-compatible; mock fallback | No `emergent` tier; no `hermes` tier; `tier` parameter is no-op | `backend/python/app/services/llm_service.py` |
| Resume templates | 6 template options in UI | Self-hosted PDF generation missing; relies on Supabase edge function | `frontend/src/pages/ResumeTemplates.tsx` |
| LinkedIn OAuth | Config + social routes exist | Developer app integration not verified; frontend shows "coming soon" | `backend/go/internal/config/config.go:29-31`, `backend/go/internal/api/router.go:76-93` |
| MongoDB cache | Not mentioned in code | 30-min cache for job search | — |
| Docker deploy | No compose files | `docker-compose.yml`, `docker-compose.hermes.yml`, nginx config | — |
| AI proofing / strategic | Backend endpoints exist | Not wired into frontend resume flow | `backend/python/app/ai_proofing/detector.py`, `backend/python/app/llm/strategic_analyzer.py` |
| Backend test suite | Go `router_test.go` exists | Full 29-test Python suite (`backend_test.py`) only in archive | `/Users/harshodaikolluru/Music/archive/backend_test.py` |

### Completely Missing (❌) — Key Files

| PRD Requirement | Where It Should Live | Notes |
|-----------------|---------------------|-------|
| Scheduler daemon (cron executor) | `backend/go/cmd/scheduler/main.go` or `backend/python/app/services/scheduler.py` | Needs to poll `autopilot_schedules` table and execute due runs |
| Frontend schedule management page | `frontend/src/pages/Schedules.tsx` or integrated into `AutoPilot.tsx` | Create/view/edit/delete recurring schedules |
| Review-before-submit queue | `frontend/src/pages/ReviewQueue.tsx` or `AutoPilot.tsx` section | Display `ready_to_submit` applications with approve/skip buttons |
| `docker-compose.yml` | `/docker-compose.yml` | mongo + Go backend + Python AI + frontend + nginx |
| `docker-compose.hermes.yml` | `/docker-compose.hermes.yml` | + Ollama hermes3:8b container |
| Nginx config | `/nginx.conf` or `/deploy/nginx.conf` | `/api` → backend, `/` → frontend |
| MongoDB connection / cache | `backend/python/app/services/cache.py` or `job_agent.py` | 30-min TTL cache for job search results |
| Browser extension | `/extension/` directory | Chrome extension manifest + content scripts |
| One-Click ATS apply | `backend/python/app/services/ats_apply.py` | RPA for Workday, Greenhouse, etc. |
| Job alerts system | `backend/python/app/services/alerts.py` | Email/push notification for new matching jobs |
| Outcome calibration analytics | `backend/python/app/services/calibration.py` | Track interview rate vs. match score |
| White-label mode | `frontend/src/config/white-label.ts` | Custom branding for career centers |

---

## 5. Quick-Reference: PRD vs. Implementation Matrix

| PRD Section | Requirement | Status | File(s) |
|------------|-------------|--------|---------|
| **Auth** | Email/password + JWT | ✅ | `auth/local.go`, `auth/service.go` |
| **Auth** | Google OAuth | ✅ | `auth/social.go`, `config.go` |
| **Auth** | LinkedIn/Facebook OAuth | 🟡 | Config + routes exist, frontend "coming soon" |
| **Profile** | Full profile fields | ✅ | `models/profile.go`, `pages/Profile.tsx` |
| **Resume** | PDF/DOCX/TXT upload (5MB) | ✅ | `router.go:890-941`, `ResumeUpload.tsx` |
| **Resume** | pypdf/python-docx parsing | ✅ | `parsers/document_parser.py` |
| **Resume** | 14-check ATS engine | ✅ | `services/ats_engine.py` |
| **Resume** | Reflexion loop optimizer | ✅ | `services/optimizer.py` |
| **Resume** | DOCX export | ✅ | `services/docx_builder.py`, `routes_mvp.go:592-631` |
| **Resume** | PDF export | ✅ | `export/pdf_exporter.py` |
| **Job Search** | PLAN→GATHER→PRERANK→RANK→REPORT | ✅ | `services/job_agent.py` |
| **Job Search** | Remotive + Arbeitnow + RemoteOK | ✅ | `services/job_providers.py` |
| **Job Search** | 30-min Mongo cache | ❌ | — |
| **Job Search** | Hybrid RRF fusion (3 rankers) | ✅ | `job_agent.py:128-177` |
| **Job Search** | BGE embeddings | ✅ | `services/embedding_service.py` |
| **Job Search** | Skill taxonomy | ✅ | `services/skill_taxonomy.py` |
| **Auto-Pilot** | Background run + polling | ✅ | `automation_engine.py`, `routes_mvp.go:345-432` |
| **Auto-Pilot** | Cross-run dedupe | ✅ | `automation_engine.py:142-153` |
| **Auto-Pilot** | Dream company boosting | ✅ | `automation_engine.py:60-62, 157-159` |
| **Auto-Pilot** | Cover letter generation | ✅ | `automation_engine.py:65-72` |
| **Auto-Pilot** | Application statuses | ✅ | DB `applications` table, `automation_engine.py:205-207` |
| **Auto-Pilot** | Concurrent prevention (409) | ✅ | `routes_mvp.go:264-267` |
| **Auto-Pilot** | Recurring schedules (CRUD) | 🟡 | DB + Go handlers exist, but no executor |
| **Auto-Pilot** | Schedule frontend UI | ❌ | — |
| **Auto-Pilot** | Review-before-submit queue | ❌ | Backend supports status, no frontend |
| **LLM** | `emergent` tier (gpt-5.2/gpt-5-mini) | ❌ | — |
| **LLM** | `hermes` tier (NousResearch) | ❌ | — |
| **LLM** | `openai_compatible` tier | ✅ | `services/llm_service.py` |
| **LLM** | `/api/health` agent_engine | ✅ | `router.go:188`, `main.py:75` |
| **LLM** | Tier distinction (fast/smart) | 🟡 | Parameter accepted, no-op behavior |
| **Deploy** | `docker-compose.yml` | ❌ | — |
| **Deploy** | `docker-compose.hermes.yml` | ❌ | — |
| **Deploy** | Nginx /api proxy | ❌ | — |
| **Tests** | 29-test backend suite | ❌ | Only in archive (`backend_test.py`) |
| **Tests** | Go router tests | ✅ | `router_test.go` |
| **Tests** | Frontend unit tests | ✅ | `*.test.tsx` files |
| **Roadmap** | Browser extension | ❌ | — |
| **Roadmap** | One-Click ATS apply | ❌ | — |
| **Roadmap** | Job alerts | ❌ | — |
| **Roadmap** | Social profile feed | ❌ | — |
| **Roadmap** | Outcome calibration | ❌ | — |
| **Roadmap** | White-label | ❌ | — |

---

## 6. Recommended Action Plan

### Phase 1: Launch Blockers (P0)
1. **Implement scheduler daemon** — A lightweight cron job or Go goroutine that polls `autopilot_schedules` and triggers `automation_engine.run_autopilot()` for due schedules.
2. **Add schedule management UI** — A tab or page in `AutoPilot.tsx` (or new `Schedules.tsx`) to create/edit/delete recurring schedules.
3. **Add review-before-submit queue** — In `AutoPilot.tsx` or `Dashboard.tsx`, show applications with `status: "ready_to_submit"` with "Approve" / "Skip" / "Apply Now" buttons.
4. **Port `backend_test.py` from archive** — Copy `/Users/harshodaikolluru/Music/archive/backend_test.py` into current codebase and verify it passes against the current backend.
5. **Create `docker-compose.yml`** — Copy/adapt from archive if available; otherwise create: postgres + Go backend + Python AI (FastAPI) + frontend (Vite dev server or nginx).
6. **Fix LLM tier no-op** — In `llm_service.py`, route `tier="fast"` to a lighter model and `tier="smart"` to a stronger model based on env vars.

### Phase 2: Polish (P1)
7. **Add MongoDB job cache** — Cache job search results with 30-min TTL to reduce provider API calls.
8. **Self-hosted template PDF generation** — Replace Supabase edge function dependency in `ResumeTemplates.tsx` with direct call to Python backend (e.g., new endpoint `/api/v1/export/pdf-from-template`).
9. **Add nginx config** — Create `nginx.conf` for production reverse proxy.
10. **Integrate AI proofing into resume flow** — Add an "AI Detection Check" button in `ResumeResults.tsx` that calls `/api/v1/strategic/ai-proof`.
11. **Integrate strategic analyzer** — Add "Hidden Skills" or "Strategic Recommendations" section in `ResumeResults.tsx`.
12. **Complete LinkedIn OAuth** — Verify developer app setup and test the callback flow end-to-end.

### Phase 3: Growth (P2)
13. **Browser extension** — Manifest v3 extension for saving jobs from job board pages.
14. **Job alerts** — Email or in-app notification when new jobs match the profile.
15. **Outcome calibration dashboard** — Analytics showing interview rate vs. match score bands.
16. **Additional job providers** — Implement JSearch and Adzuna adapters in `job_providers.py`.

---

*End of Gap Analysis*
