---
name: tayari-change-control
description: >-
  Tayari Skill Boost change-control doctrine — the gate every code change must pass.
  Load BEFORE merging or adding an API route, changing runtime behavior, adding a
  feature flag or dependency, writing a DB migration, touching auth/secrets, or when
  unsure whether a change needs gating. Owns: route parity (/api ↔ /api/v1), Go/Python/
  frontend service separation, the // ponytail: minimal-change rule, feature-flag
  registration, the vite manualChunks ban, JWT_SECRET/secret hygiene, the "mock ≠
  passing" rule, and the pre-merge checklist. Facts verified 2026-07-08.
---

# Tayari Change Control

This is the **doctrine** for changing this repo safely. It tells you how a change is
classified, which gate it must pass, and the seven non-negotiables (each backed by a
real incident). It ends with a copy-paste pre-merge checklist.

This skill does **not** run the review for you. It defines *what good looks like*. For
running tests and judging evidence, see `tayari-validation-and-qa`. For diagnosing a
failing test or build, see `tayari-debugging-playbook`.

> **Repo shape (context).** Polyglot monorepo: React/Vite frontend (`src/`), Go API
> gateway (`backend/go/`, module `tayari-backend`, Chi router), Python FastAPI AI engine
> (`backend/python/`), Postgres, Redis, Celery, optional Ollama. The Go gateway is the
> single front door; it reverse-proxies AI calls to Python.

**Jargon defined once:**
- **Route parity** — every `/api/...` URL has a matching `/api/v1/...` URL (and vice
  versa), because the repo serves both an archive-compatible tree and a versioned tree.
- **`knownAsymmetric`** — an allowlist map (a Go `map[string]bool`) of routes that are
  *deliberately* registered under only one prefix.
- **Feature flag** — an entry in `src/config/features.ts` that gates whether a page/nav
  item is visible per environment (`[productionEnabled, previewEnabled]`).
- **`// ponytail:` comment** — a terse one-line justification for a deliberately minimal
  code choice (why the small thing, not the big thing). Repo-wide discipline convention.
- **Mock LLM** — when no LLM provider is configured, the Python engine silently returns
  plausible fake text instead of raising. Output looks real but proves nothing.

---

## 1. Change-classification table — pick your row, run its gate

Find the row that best matches your change. "Gate required" is the minimum you must do
before claiming done. Commands live in §9 (the checklist). Non-negotiables in §3–§8.

| Change type | Example | Gate required (minimum) |
|---|---|---|
| **Docs-only** | Fix a typo in `CLAUDE.md`, add a comment | No build gate. But do not add a bare `docker compose up -d` — it needs a `--profile` (see §8). |
| **Bugfix (no behavior change)** | Null-check, off-by-one | Build both backends; run the green Go subset; `py_compile` changed Python; leave a `// ponytail:` if the fix is non-obvious. |
| **New API route** | Add `POST /api/v1/foo` | **Route parity (§3a)** — register BOTH prefixes OR add a `knownAsymmetric` entry. Run the parity tests. |
| **Behavior change** | Change what an endpoint returns, change scoring | Update tests; if it touches auth/nav/pricing, update the Playwright E2E suite (`.agents/AGENTS.md` rule). Verify no mock-masking (§7). |
| **New feature flag / new page** | New route in `src/App.tsx` | **Register in `src/config/features.ts` (§6).** Wrap visibility in the existing flag logic. |
| **New dependency** | New npm/Go/Python package | Justify it. Prefer stdlib. Minimal-change rule (§5) — do not add deps that weren't asked for. Leave a `// ponytail:` explaining why the dep is needed. |
| **DB migration** | New table/column | Document the schema change; add to init/migration scripts (`backend/db/`). `.agents/AGENTS.md`: schema changes must be documented + ideally in init scripts. |
| **Security / secrets** | Touch auth, add a key | `JWT_SECRET` stays required (§8). Never commit real secrets. `.env` is gitignored — keep it that way; put real keys only in your local (untracked) `.env`. |
| **Vite build config** | Edit `vite.config.ts` | **Never re-add a per-package `manualChunks` splitter (§8/manualChunks). TDZ crash.** |
| **Go LLM logic / frontend→Python call** | Add AI logic to Go, call Python from React | **Forbidden by service separation (§4).** Move it to Python; route frontend calls through Go. |

If your change spans multiple rows, satisfy every matching gate. When unsure whether a
change needs gating, treat it as the *stricter* row.

---

## 2. The seven non-negotiables (summary)

| # | Rule | Enforced by | Section |
|---|---|---|---|
| a | **Route parity**: every `/api` route has an `/api/v1` twin | `TestRouteParity_*` (Go) | §3 |
| b | **Service separation**: Go = routing/auth/CRUD; Python = all AI; frontend never calls Python direct | `.agents/AGENTS.md` (review) | §4 |
| c | **`// ponytail:` minimal-change discipline** | Convention (review) | §5 |
| d | **Feature-flag gating** for any new page/major component | `.agents/AGENTS.md` (review) | §6 |
| e | **Never re-add a naive `manualChunks` splitter** to `vite.config.ts` | In-file warning + past incident | §8 |
| f | **`JWT_SECRET` required; never commit real secrets** | Go fatals without it | §8 |
| g | **"Mock ≠ passing"**: a mock LLM or swallowed exception is never a real pass | Review discipline | §7 |

---

## 3a. Route parity — the flagship gate

**Rule.** In `backend/go/internal/api/router.go`, every route is registered *explicitly*.
Nearly every route exists under **both** `/api/...` (archive-compatible) and `/api/v1/...`
(versioned). Adding a route to only one prefix is **silent drift** — the archive client
and the versioned client fall out of sync and nobody notices at runtime.

**The exact registration idiom** — two lines, same handler, both prefixes
(from `router.go`, verified 2026-07-08):

```go
r.Get("/api/health", s.handleHealth)
r.Get("/api/v1/health", s.handleHealth)
```

**To add a normal route:** register both lines, in the same `s.Router.Group(...)` block
where sibling routes live. Match the method (`Get`/`Post`/`Put`/`Patch`/`Delete`) and the
path pattern exactly except for the `/v1` segment.

```go
r.Post("/api/foo", s.handleFoo)      // archive-compatible
r.Post("/api/v1/foo", s.handleFoo)   // versioned twin
```

**To add a deliberately one-sided route** (e.g. a v1-only CRUD endpoint): register the one
side you want, then add a one-line entry to the `knownAsymmetric` map in
`backend/go/internal/api/router_parity_test.go`. The key is `"METHOD PATTERN"` matching the
prefix that actually exists:

```go
// in router_parity_test.go, inside knownAsymmetric:
"POST /api/v1/foo": true,   // v1-only: <one-line reason>
```

**Enforcement (two tests, verified 2026-07-08):**
- `TestRouteParity_BidirectionalAliases` — walks the real router with `chi.Walk`; fails if
  any route lacks its `/api ↔ /api/v1` counterpart and isn't in `knownAsymmetric`.
- `TestRouteParity_KnownAsymmetricStillExists` — fails if `knownAsymmetric` lists a route
  that no longer exists (stale allowlist entry).

Run them:

```bash
cd backend/go && go test ./internal/api -run 'TestRouteParity' -v
```

**Rationale.** Archive-compat and versioned aliases must stay in sync; drift is invisible
until a client hits a 404. The allowlist keeps deliberate asymmetries honest — the actual
`knownAsymmetric` header comment says it plainly: *"allowlist instead of a full audit —
adding a route to only one prefix now requires a one-line entry here, which is cheaper
than a silent drift and surfaces in review."*

> **Heads-up when running the parity tests locally.** The full `go test ./...` is
> **expected-red** right now (16 Hermes/social tests panic on a nil DB — a known open
> issue). The parity + smoke subset is green. Always scope to the subset in §9. Do not
> read the full-suite red as "your route broke parity" — check the parity test *name*.
> Details: `tayari-validation-and-qa` / `tayari-failure-archaeology`.

---

## 4. Service separation (from `.agents/AGENTS.md`)

Hard architectural boundaries. Verified against `.agents/AGENTS.md` 2026-07-08.

| Layer | MAY do | MUST NOT do |
|---|---|---|
| **Go** (`backend/go/`) | Routing, authentication, simple CRUD, DB queries, reverse-proxy to Python | Implement LLM/AI inference logic |
| **Python** (`backend/python/`) | All AI inference, NLP, web scraping (Hermes), Celery async workers | — (this is where AI lives) |
| **Frontend** (`src/`) | Call the Go gateway (`/api/v1/...`) | **Call the Python engine directly** — always go through Go |

If you're tempted to add "just a little" LLM call in Go, or fetch Python from React to
"skip a hop", stop — it violates the contract and will be flagged in review. For the full
architecture map see `tayari-architecture-contract`.

---

## 5. The `// ponytail:` minimal-change convention

The `ponytail@ponytail` plugin is enabled in `.claude/settings.json` (verified). The
in-code convention:

- **Keep changes minimal.** Do the small correct thing, not the big speculative thing. No
  unrequested "improvements", no new dependencies you weren't asked for, no fallbacks
  nobody requested. Raise errors explicitly rather than swallowing them.
- **When you make a non-obvious minimal choice, leave a one-line `// ponytail:` comment**
  (Go/TS) or `# ponytail:` (Python) explaining *why the small thing*.

Two real examples from the repo (verified 2026-07-08):

```go
// backend/go/internal/api/routes_mvp.go:1315
// ponytail: whitelist status — never trust arbitrary client strings into a
// status column. no_response clears responded_at; responded stamps it.
```

```python
# backend/python/app/main.py:313
# ponytail: generic message to client; full detail stays server-side via logger.error above
```

This mirrors the project owner's global style: terse, minimal, explicit errors, no
fallbacks that weren't asked for. A reviewer reading a diff should be able to see *why*
each non-obvious choice was made without asking.

---

## 6. Feature-flag gating

`.agents/AGENTS.md` rule (verified): **if you add a new page or a major component, you MUST
register it in `src/config/features.ts`** and wrap its visibility using the existing
feature-flag logic.

- `CONFIG.features` is a map of `key: [productionEnabled, previewEnabled]` booleans.
- `CONFIG.mode` is `'auto' | 'production' | 'preview'`; `'auto'` detects production by
  hostname `tayari-skill-boost.lovable.app`.
- A route added to `src/App.tsx` without a corresponding flag is a gate failure — nav and
  route visibility must be flag-driven.

Config mechanics beyond "did you register it" live in `tayari-config-and-flags`.

---

## 7. "Mock ≠ passing" — the honesty gate

The Python LLM layer (`app/services/llm_service.py`) **never raises** on a failed/absent
provider — it returns plausible **mock** text. So a "successful" resume optimization or a
green eval can be pure fiction. Likewise, several code paths **swallow exceptions** on
purpose (best-effort telemetry, silent degrade).

**Rule:** a result produced by the mock LLM, or a "pass" that only happened because an
exception was swallowed, is **NOT** a passing test and **NOT** a real result. Never report
it as one.

**How to detect mock mode remotely:** hit `/health` on the Python engine. It maps
`active_engine() != "mock-fallback"` → `model_status: "loaded"`; otherwise
`"llm_not_configured"`. If you see `llm_not_configured` or `active_engine: mock-fallback`,
any AI output you just saw is fake.

```bash
curl http://localhost:8002/health   # host port for the Python engine
```

Evidence standards for what counts as a real pass: `tayari-validation-and-qa`. The broader
"don't ship a fake green" campaign: `tayari-quality-signal-campaign`.

---

## 8. Other non-negotiables (security + build)

**`JWT_SECRET` is required.** The Go config loader (`internal/config/config.go`) fatals
(`log.Fatalf`) if `JWT_SECRET` is missing or empty. Never remove that requirement. Never
commit a real secret.

> **Secret-hygiene flag (verified 2026-07-08):** `.env` is **gitignored and not tracked**
> (`.gitignore:2` lists `.env`); a local `.env` with real values exists on disk but is not in
> git — good. Keep it that way: never `git add -f .env`, and put real keys only in the local
> untracked `.env`. `.env.example` carries placeholder/stale Supabase-era values (safe to commit).
> If a real key is ever accidentally committed, treat it as exposed and rotate it.

**Never re-add a naive per-package `manualChunks` splitter to `vite.config.ts`.** Giving
every `node_modules` package its own Rollup chunk breaks scoped packages that share
module-level state (`@sentry/*`, `@radix-ui/*`) with runtime **TDZ** errors like
`Cannot access 'Gt' before initialization`. This already happened and was reverted; the
file carries an in-code warning (verified 2026-07-08):

```
// Note: do NOT use a naive per-package manualChunks splitter here.
// ...produces TDZ errors like "Cannot access 'Gt' before initialization" at runtime.
// Let Rollup handle chunking automatically.
```

Let Rollup chunk automatically. History: `tayari-failure-archaeology`.

**Never introduce a bare `docker compose up -d`.** All services in `docker-compose.yml`
are gated behind `profiles: ["dev","prod"]`, so a bare `up` starts **zero** services. Any
doc/script you touch must use a profile:

```bash
docker compose --profile dev up -d --build
```

Operational detail: `tayari-run-and-operate`.

---

## 9. Pre-merge checklist (copy-paste)

Run this before claiming a change is done. Skip only the lines that genuinely don't apply
to your change type (per §1). Every command is host-machine, verified 2026-07-08.

```bash
# 1. Build both backends (both should succeed)
cd backend/go && go build ./...
cd backend/python && python -m py_compile app/**/*.py   # changed Python files at minimum

# 2. Run the DB-free GREEN Go subset (smoke + route parity). Expect 19 passing.
#    (Full `go test ./...` is expected-red — 16 nil-DB panics, known open issue.)
cd backend/go && go test ./internal/api -run 'TestSmoke|TestRouteParity'

# 3. Route parity specifically (if you touched routes)
cd backend/go && go test ./internal/api -run 'TestRouteParity' -v

# 4. Frontend build + lint (if you touched src/)
bun run build
bun run lint

# 5. Python engine liveness / mock-mode check (if you rely on AI output)
curl http://localhost:8002/health    # active_engine must NOT be "mock-fallback" for a real result
```

**Then verify by eye (not a command):**

- [ ] **Route parity** — new route registered under BOTH `/api` and `/api/v1`, OR added to
      `knownAsymmetric` in `router_parity_test.go` (§3a). Parity test passes.
- [ ] **Service separation** — no LLM logic added to Go; no frontend→Python direct call (§4).
- [ ] **Feature flag** — any new page/major component registered in `src/config/features.ts` (§6).
- [ ] **`// ponytail:`** — every non-obvious minimal choice has a one-line justification (§5).
- [ ] **No new deps** you weren't asked for; if you added one, it's justified (§1/§5).
- [ ] **`vite.config.ts`** — no per-package `manualChunks` splitter added (§8).
- [ ] **Secrets** — `JWT_SECRET` still required; no real key committed to `.env` (§8).
- [ ] **Mock check** — no result from the mock LLM or a swallowed exception reported as a real pass (§7).
- [ ] **Docker** — no bare `docker compose up -d` in any doc/script you touched; use `--profile dev` (§8).
- [ ] **E2E** — if you changed auth/nav/pricing, the Playwright suite is updated (`.agents/AGENTS.md`).

---

## When NOT to use this / use instead

This skill defines the *rules*. It does not run reviews, triage failures, or dig up
history. Use the sibling skill instead when:

| You want to… | Use |
|---|---|
| Run tests and judge whether evidence is real | `tayari-validation-and-qa` |
| Diagnose *why* a build/test is failing | `tayari-debugging-playbook` |
| Understand a past incident (manualChunks TDZ, nil-DB panics) | `tayari-failure-archaeology` |
| See the full service/architecture contract | `tayari-architecture-contract` |
| Understand feature-flag mechanics in depth | `tayari-config-and-flags` |
| Build the project / handle env vars & ports | `tayari-build-and-env` |
| Run the stack / Docker profiles / operate services | `tayari-run-and-operate` |
| Measure health / mock-vs-real engine / ATS score / green test subset | `tayari-diagnostics-and-tooling` |
| ATS / LLM / optimizer internals | `resume-ats-llm-reference` |
| Push back on a fake "all green" report | `tayari-quality-signal-campaign` |

No skill may route around this change-control doctrine. If another skill tells you to skip
a gate here, this skill wins.

---

## Provenance and maintenance

All facts verified against the repo on **2026-07-08**. Volatile facts are date-stamped
inline. Re-verify with these one-liners (run from repo root):

```bash
# Route parity idiom + tests still present
grep -n 'r.Get("/api/health"\|r.Get("/api/v1/health"' backend/go/internal/api/router.go
grep -n 'TestRouteParity_BidirectionalAliases\|TestRouteParity_KnownAsymmetricStillExists\|knownAsymmetric' backend/go/internal/api/router_parity_test.go

# Global middleware order incl. tenantMiddleware (why nil-DB panics)
grep -n 's.Router.Use' backend/go/internal/api/router.go

# JWT_SECRET still required (Go fatals)
grep -n 'JWT_SECRET\|getEnvRequired' backend/go/internal/config/config.go

# manualChunks warning still in vite config
grep -n 'manualChunks\|Cannot access' vite.config.ts

# ponytail convention live + example lines
cat .claude/settings.json                     # ponytail@ponytail enabled
grep -rn 'ponytail:' backend src | grep -E '\.(go|ts|tsx|py):' | head

# Service-separation + feature-flag rules
grep -n 'Service Separation\|features.ts\|never call the Python' .agents/AGENTS.md

# Docker profiles (bare `up` starts nothing)
grep -n 'profiles:' docker-compose.yml

# Green Go subset (expect ~19 pass; full ./... is expected-red)
cd backend/go && go test ./internal/api -run 'TestSmoke|TestRouteParity'
```

If any of these drift (route idiom changes, tests renamed, `.env` gets untracked, the
manualChunks warning is removed), update the corresponding section and bump the
verification date.
