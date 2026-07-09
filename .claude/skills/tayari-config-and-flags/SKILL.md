---
name: tayari-config-and-flags
description: >-
  The complete configuration catalog for Tayari Skill Boost — every env var, the LLM
  provider-selection order, and the frontend feature flags. Load when configuring env vars,
  choosing or switching an LLM provider (Ollama / OpenRouter / NVIDIA NIM / mock), toggling
  a feature flag, switching auth mode (self-hosted JWT vs Supabase), confirming which engine
  is actually active, or adding a new config axis. Owns the env-var table, the build_provider
  priority order, the Ollama-host-port trap, and the features.ts mechanics. Facts verified
  2026-07-08.
---

# Tayari Config and Flags

Everything you can turn a knob on. Three knob families: **backend env vars**, **LLM provider
selection**, and **frontend feature flags**. This skill catalogs them and shows how to add a
new one. It does not run the stack (`tayari-run-and-operate`) or measure what's active
(`tayari-diagnostics-and-tooling`) — but it tells you which command confirms a setting.

**Jargon defined once:**
- **Provider** — a concrete LLM backend (Ollama, OpenRouter, NVIDIA NIM, generic
  OpenAI-compatible, Hermes, or the Mock fallback).
- **Feature flag** — an entry in `src/config/features.ts`; a `[productionEnabled, previewEnabled]`
  boolean tuple gating a page/nav item per environment.
- **Build-time var** — a `VITE_*` value baked into the static JS at build time (Docker build
  arg), NOT read at runtime.
- **Mock fallback** — the engine returns fake text when no real provider is configured.

---

## 1. Backend env var catalog

Consumed by: **Go** (`internal/config/config.go`, `os.Getenv`), **Python** (`os.environ`),
**Vite** (build-time), **compose** (passthrough in `docker-compose.yml`). Verified 2026-07-08.

| Var | Consumed by | Default | Required? | Notes |
|---|---|---|---|---|
| `JWT_SECRET` | Go | — | **YES** (Go `log.Fatalf` if empty) | Auth signing key. Must match Supabase JWT secret when `USE_SUPABASE=true`. |
| `DATABASE_URL` | Go, Python, worker | `""` | Yes in practice | `postgres://tayari:tayari_dev@postgres:5432/tayari?sslmode=disable` in-compose. |
| `PORT` | Go, Python | Go `8080`, Py `8000` (container) | No | Container-internal port. |
| `USE_SUPABASE` | Go | `false` | No | `true` → Supabase auth; else local JWT. Pair with `VITE_USE_SELF_HOSTED`. |
| `ALLOWED_ORIGINS` | Go | `http://localhost:5173` | No | Comma-separated CORS allowlist. Never `*` with credentials. |
| `CORS_ALLOWED_ORIGINS` | Go | `""` | No | Additional CORS origins (merged with defaults). |
| `FRONTEND_URL` | Go | `http://localhost:5173` | No | OAuth redirect base. |
| `AI_SERVICE_URL` / `PYTHON_AI_URL` | Go | `http://localhost:8000` | No | Gateway→engine URL; compose sets `http://python-ai:8000`. |
| `REDIS_URL` | Python, worker | — | Yes for Celery/Hermes | `redis://redis:6379/0` in-compose. |
| `LLM_PROVIDER` | Python | `""` (auto) | No | `openrouter`\|`nvidia_nim`\|`ollama`\|`openai`\|empty. Drives `build_provider` (§2). |
| `LLM_BASE_URL` | Python | `""` | No | Generic base URL; Ollama auto-detect needs `ollama` or `11434` substring (§2 trap). |
| `LLM_API_KEY` | Python | `""` | No | Generic key (also read as OpenRouter/NIM key). |
| `LLM_MODEL` | Python | `default`/`llama3.1` | No | Model name for generic/Ollama providers. |
| `OPENROUTER_API_KEY` | Python | `""` | Needed for OpenRouter | Also satisfied by `LLM_API_KEY`. |
| `OPENROUTER_MODEL` | Python | `openai/gpt-4o-mini` (factory) | No | `.env.example` uses `google/gemini-2.5-flash:free`. |
| `NVIDIA_NIM_API_KEY` | Python | `""` | Needed for NIM | Presence triggers NIM auto-detect when `LLM_PROVIDER` empty. |
| `NVIDIA_NIM_MODEL` | Python, compose | `meta/llama-3.1-70b-instruct` | No | |
| `NVIDIA_NIM_BASE_URL` | Python, compose | `https://integrate.api.nvidia.com/v1` | No | |
| `HERMES_AGENT_URL` | Python | `""` | Enables hermes tier | If set, `tier="hermes"` calls route here. |
| `HERMES_API_KEY` / `HERMES_MODEL` | Python | `""` / `hermes3:8b` | No | |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | Python, worker | — | No | Passed through; not the primary path. |
| `FIRECRAWL_API_KEY`, `APIFY_API_TOKEN`, `SERPAPI_API_KEY`, `CRAWL4AI_BASE_URL` | Python, worker | `""` | No (graceful) | Hermes scraper tiers; absent → that provider self-disables. `_truthy` treats `NONE`/`NULL`/`CHANGEME`/`YOUR_KEY_HERE` as absent. |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | Go, Python | `""`/`production` | No | Error tracking (off if DSN empty). |
| `GOOGLE_*`, `GITHUB_*`, `LINKEDIN_*` (client id/secret/callback) | Go | `""` | No | Social OAuth. |
| `VITE_API_URL` | Vite (build) | `/api` (compose) / `http://localhost:8080/api` (code default) | **Build-time** | Point at Go host `http://localhost:8085/api` for local dev (see trap). |
| `VITE_USE_SELF_HOSTED` | Vite (build) | `true` (.env.example) | Build-time | Pair with Go `USE_SUPABASE`. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Vite (build) | — | Build-time | Baked into the bundle; a change re-hashes the build (vite fingerprint). |

> **`VITE_*` are build-time.** Vite statically replaces them at build. In Docker they are
> **build args** (`Dockerfile.frontend` ARGs), not runtime env. Changing one requires a rebuild.

> **Secret hygiene.** `.env` is gitignored/untracked (`.gitignore:2`) — keep it that way; real
> keys live only in your local `.env`. `.env.example` holds placeholders (some stale Supabase-era).

---

## 2. LLM provider selection — the priority order

`build_provider(tier)` in `backend/python/app/services/llm_service.py` picks a provider in this
exact order (verified 2026-07-08). First match wins:

1. `tier=="hermes"` AND `HERMES_AGENT_URL` set → **HermesProvider**.
2. `LLM_PROVIDER=openrouter` AND (`OPENROUTER_API_KEY` or `LLM_API_KEY`) → **OpenRouterProvider**
   (model default `openai/gpt-4o-mini`; 3-retry backoff on 429).
3. `LLM_PROVIDER=nvidia_nim` AND `NVIDIA_NIM_API_KEY` → **NVIDIANIMProvider** (backoff on 429/5xx).
4. `LLM_PROVIDER` empty/`auto` AND `NVIDIA_NIM_API_KEY` present → **auto-detect NIM**.
5. `LLM_PROVIDER` in (`ollama`,`""`) AND `LLM_BASE_URL` contains `ollama` or `11434` →
   **OllamaProvider** (uses `/api/generate`, NOT `/chat/completions`).
6. `LLM_BASE_URL` set (anything else) → **OpenAICompatibleProvider** (`/chat/completions`).
7. otherwise → **MockProvider** (`active_engine()` = `mock-fallback`).

> **`tier` is a near no-op.** `llm_complete(..., tier=...)` only special-cases `"hermes"`;
> `"fast"` and `"smart"` both resolve to `build_provider("default")`. The optimizer calls
> `tier="smart"` but gets the same provider as `"fast"`. Don't rely on tier for cost/speed.

> **OLLAMA HOST-PORT TRAP.** Auto-detect (step 5) keys on the substrings `ollama` or `11434`.
> The compose **host** port is `11435`, so `LLM_BASE_URL=http://localhost:11435` matches
> **neither** → it falls to step 6 (generic `/chat/completions`), the wrong Ollama path.
> In-network use `http://ollama:11434` (contains `ollama`). From the host, either set
> `LLM_PROVIDER=ollama` explicitly or use a URL containing `11434`.

### 2.1 Three recipes

**(a) Fully local Ollama (zero API cost):**
```bash
LLM_PROVIDER=ollama
LLM_BASE_URL=http://ollama:11434      # in-compose DNS; host: use a URL containing 11434
LLM_MODEL=hermes3:8b
```
**(b) OpenRouter (hosted):**
```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemini-2.5-flash:free
```
**(c) Mock (no keys) — the default.** Leave all LLM vars empty. Everything "works" but
returns fake text.

### 2.2 Confirm which provider is actually active
```bash
curl -s http://localhost:8002/health | grep -o '"model_status":"[^"]*"'
#   "loaded"             -> a real provider is wired
#   "llm_not_configured" -> MockProvider (results are fake)
```
`active_engine()` labels: `mock-fallback`, `ollama-<model>`, `openrouter/<model>`,
`nvidia-nim/<model>`, `openai-compatible (<model>)`, `hermes-<model>`. Deeper measurement:
`tayari-diagnostics-and-tooling`. Why mock is dangerous: `tayari-quality-signal-campaign`.

---

## 3. Frontend feature flags (`src/config/features.ts`)

- `CONFIG.mode`: `'auto' | 'production' | 'preview'`. `'auto'` = production when
  `window.location.hostname === "tayari-skill-boost.lovable.app"`, else preview.
- `CONFIG.features`: map of `key: [productionEnabled, previewEnabled]` booleans.
- `CONFIG.links`: nav links, each `{ label, href, feature }`, filtered by the flag.

**Current flags (verified 2026-07-08):**

| Flag | [prod, preview] | Flag | [prod, preview] |
|---|---|---|---|
| `resumeOptimizer` | [true, true] | `coverLetter` | [true, true] |
| `careerRoadmap` | [true, true] | `communicationHub` | [true, true] |
| `interviewPrep` | [true, true] | `interviewAI` | [true, true] |
| `jobSearch` | [true, true] | `browserExtension` | **[false, false]** |
| `blog` | [true, true] | `knowledgeHub` | [true, true] |
| `pricing` | [true, true] | `careerOps` | [true, true] |
| `careers` | [false, true] | `help` | [false, true] |

### 3.1 Checklist — add a feature flag
- [ ] Add `key: [prod, preview]` to `CONFIG.features`.
- [ ] If it's a page: add a route in `src/App.tsx` and a `CONFIG.links` entry with `feature: "key"`.
- [ ] Register/guard the page per `.agents/AGENTS.md` (new page/major component MUST be flagged).
- [ ] Verify visibility in BOTH modes (flip `CONFIG.mode` to `production` and `preview`).
- [ ] Gate change routes through `tayari-change-control`.

---

## 4. Auth mode switch

| Setting | Location | `true` means |
|---|---|---|
| `USE_SUPABASE` | Go env | Gateway verifies Supabase-issued JWTs |
| `VITE_USE_SELF_HOSTED` | Vite build arg | Frontend uses the local Go JWT backend (self-hosted) |

They must agree: self-hosted frontend + Supabase Go = broken login. `JWT_SECRET` is required
either way. Architecture rationale: `tayari-architecture-contract` §2.5.

---

## 5. Add a new config axis (checklist)
- **Env var:** add to `.env.example` (documented) → add compose passthrough in `docker-compose.yml`
  → read it (`getEnv` in Go `config.go` / `os.environ` in Python) → add a row to §1 here.
- **`VITE_*`:** also add as a build ARG in `Dockerfile.frontend` (build-time!).
- **Feature flag:** §3.1.
- Always date-stamp the change here and cross-reference `tayari-change-control`.

---

## When NOT to use this / use instead

| You want to… | Use |
|---|---|
| Run/deploy the stack, Docker profiles | `tayari-run-and-operate` |
| Measure which engine is active / health | `tayari-diagnostics-and-tooling` |
| Set up toolchains / the port table | `tayari-build-and-env` |
| The gate for adding a flag/route | `tayari-change-control` |
| Why the provider layer never crashes (design) | `tayari-architecture-contract` |

---

## Provenance and maintenance

Facts verified against the repo on **2026-07-08**. Re-verify:

```bash
grep -n 'getEnv\|getEnvRequired' backend/go/internal/config/config.go   # Go env surface
grep -n 'def build_provider\|LLM_PROVIDER\|11434\|OPENROUTER_MODEL' backend/python/app/services/llm_service.py
grep -n 'features:\|mode:' src/config/features.ts                        # flags + values
grep -n 'ARG VITE_' Dockerfile.frontend                                 # build-time vars
grep -nE '^\s+- [A-Z_]+=' docker-compose.yml | head -40                 # compose passthrough
cat .env.example
```

If a flag is added/renamed, a provider default changes, or the Ollama detection substring
changes, update the relevant table and bump the date.
