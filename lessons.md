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
