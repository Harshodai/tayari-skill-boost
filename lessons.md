# Tayari Skill Boost — Local Parallel Development Lessons

This document details key findings, architectural decisions, and lessons learned while configuring the local development stack of Tayari Skill Boost to run concurrently in parallel with another local self-hosted stack.

---

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

4. **Go Concurrency Primitives Provide High-Throughput Gateway Control**:
   - Offloading thread synchronization, rate limiting, and event dispatching to native Go channels, RWMutex primitives, and goroutines (`worker_pool.go`, `rate_limiter.go`, `cache_router.go`, `event_bus.go`) prevents bottlenecks at the API gateway layer.

