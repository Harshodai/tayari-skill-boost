# Tayari Skill Boost — Local Parallel Development Lessons

This document details key findings, architectural decisions, and lessons learned while configuring the local development stack of Tayari Skill Boost to run concurrently in parallel with another local self-hosted stack.

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
- `agent_engine.py` + `browser_operator.py`: `navigate_web` uses the original URL (TLS verifies against the real peer); `write_file_tool` opens with `O_NOFOLLOW` and catches filesystem errors; IPv6 pinned URLs are bracketed; Step 3 records true success/failure; the REPL snippet has no imports; `browser_operator.navigate` no longer passes the unsupported `headers=` to `page.goto`.
- Frontend: `AutonomousCareerConsole`, `JobSeekerAgentDashboard`, `InterviewVoiceCoach`, `PrivacyReadiness`, and `Settings` now use the configured `apiFetch` helpers, remove fabricated fallbacks, validate response shapes, and gate AI output on the health `active_engine`.

### Root cause
- Auth was duplicated with a hardcoded fallback secret and a `except (jwt.PyJWTError, Exception)` that converted server faults to 401. Export data and RAG answers fabricated content instead of querying real sources. Agent code executed untrusted LLM output, wrote files with a symlink TOCTOU gap, and pinned IPs into URLs breaking TLS/SNI. `browser_operator` passed an invalid `headers=` param to `page.goto`.

### Fix applied
- Single shared auth dependency with fail-fast secrets and precise error classification; gateway-backed export with explicit `unavailable_sections`; generic client errors with server-side detail; O_NOFOLLOW writes, IPv6 bracket pinning, original-URL navigation, import-free REPL snippets, valid Playwright `goto` args; `apiFetch`-based frontend flows with controlled error states.

### Reusable lesson
- Authentication and JWT policy belong in exactly one module; a baked-in secret default is worse than a startup failure. Never fabricate data in API responses — mark sections unavailable instead. `except (jwt.PyJWTError, Exception)` is a bug: it hides server faults as client errors. Verify every third-party SDK argument against the pinned SDK version (Playwright `goto` has no `headers=`). Pin IPs only at the routing layer; keep the hostname in the URL for TLS/SNI.


## 2026-08-03 — Agent engine: DNS-rebinding-safe navigation, AST code guard, descriptor-safe writes

### What was done
- `navigate_web` now navigates to the validated `target_url` (pinned IP literal + port) WITH the original hostname in the `Host` header, instead of `original_url`. This closes the DNS-rebinding TOCTOU window while keeping TLS correct: Chromium derives SNI from the URL host, so the `Host` header + IP-literal URL still present the real hostname to the server.
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
