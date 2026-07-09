---
name: tayari-failure-archaeology
description: >-
  The chronicle of Tayari Skill Boost's major investigations, dead ends, reverts, and
  still-open failures. Load BEFORE investigating a bug or "fixing" something that may have
  a known history — to check whether a battle is already settled and avoid re-fighting it.
  Each entry: Symptom → Root cause → Evidence → Status (OPEN/RESOLVED/DOC-DRIFT) → Lesson.
  Covers the nil-DB Go test panic, the CI/compose drift, the manualChunks TDZ crash, the
  white-screen fix, stopword pollution, and the port-doc drift. Facts verified 2026-07-08.
---

# Tayari Failure Archaeology

The settled (and unsettled) history. Read the relevant entry **before** you start
"fixing" something — several of these look like new bugs but are known, and one is a trap
that repeatedly makes newcomers think they broke the build.

For live triage (symptom → experiment) use `tayari-debugging-playbook`. This skill is the
record of *why* and *what was already tried*.

**Status legend:** `OPEN` (unfixed), `RESOLVED` (fixed, do not reopen), `DOC-DRIFT`
(docs disagree with reality; code is right), `WON'T-FIX` (deliberate).

**Entry format:** Symptom → Root cause → Evidence → Status → Lesson.

---

## 1. [OPEN] Go test suite is red: 16 nil-pointer panics

- **Symptom.** `cd backend/go && go test ./...` exits 1. Package `tayari-backend/internal/api`
  reports 16 failures: `TestSocialAuthRoutes_ProviderInjection` and every Hermes route test
  (`TestHermesScrape_*`, `TestHermesJobsBoard_*`, `TestHermesRunsList_*`, `TestHermesRunDetail_*`,
  `TestHermesUnknownRoute_404`, `TestHermesUnauthenticated_401`). Each panics:
  `panic: runtime error: invalid memory address or nil pointer dereference` inside
  `database/sql.(*DB).QueryContext`.
- **Root cause.** The global `tenantMiddleware` (`internal/api/middleware.go`, ~line 146) is
  registered on **every** route (`s.Router.Use(s.tenantMiddleware)` in `router.go`) and calls
  `s.DB.Conn.QueryRowContext(...)` to resolve a tenant on each request. The Hermes tests build
  the server via `newHermesServer` with `&database.DB{Conn: nil}` and a comment that says
  *"The DB is nil (Hermes routes never touch the Go DB — they only proxy)."* That comment is
  **false**: the middleware touches the DB before the handler runs, so a nil `Conn` nil-derefs.
- **Evidence.** `routes_hermes_test.go` (`newHermesServer` → `Conn: nil`); `middleware.go`
  `tenantMiddleware` doing `s.DB.Conn.QueryRowContext`; the smoke tests
  (`handlers_smoke_test.go`) instead pass `&database.DB{Conn: fakeDB()}` (non-nil) and survive
  because `QueryRowContext` returns an error (swallowed) rather than panicking.
- **Status.** **OPEN** as of 2026-07-08. Green DB-free subset:
  `go test ./internal/api -run 'TestSmoke|TestRouteParity'` → 19 pass.
- **Lesson.** Adding a global DB-touching middleware silently broke every DB-less test. Test
  doubles must satisfy the assumptions of *global middleware*, not just the handler under test.
  Two ways to close it: (a) give the Hermes tests a non-nil fake DB like the smoke tests do, or
  (b) make `tenantMiddleware` no-op when `s.DB == nil || s.DB.Conn == nil`. Whichever you pick
  routes through `tayari-change-control` and must keep the parity/smoke tests green.

## 2. [DOC-DRIFT / CI-BROKEN] CI's docker-compose job cannot pass as written

- **Symptom.** The `docker-compose` job in `.github/workflows/ci.yml` health-checks
  `http://localhost:8008` (supabase-kong) and `http://localhost:3005` (supabase-studio), and
  starts the stack with `docker compose up -d --wait`.
- **Root cause.** (a) No Supabase Kong/Studio services exist in the current `docker-compose.yml`
  at all — only frontend, go-backend, python-ai, postgres, redis, celery-worker/flower, ollama,
  caddy. (b) All 9 services are profile-gated `["dev","prod"]`, so `docker compose up -d` with no
  `--profile` starts nothing. The job thus waits on services that never come up and health-checks
  hosts that never exist. `ci.yml`'s `go-build` job also runs `go test -race ./...` with no DB →
  hits the 16 panics from Entry 1.
- **Evidence.** `grep -iE 'kong|studio' docker-compose.yml` (no service match);
  `grep -c 'profiles:' docker-compose.yml` → 9; `ci.yml` health-check steps.
- **Status.** DOC-DRIFT / CI aspirational. Two overlapping workflows (`ci.yml`, `deploy.yml`)
  both fire on push+PR to main. `scripts/perf_check.sh` is a **simulated** placeholder (sleeps 1s).
- **Lesson.** Do **not** equate "CI config exists" with "CI is green." Verify live GitHub Actions
  status. If you own this: add a `--profile`, delete the kong/studio checks (or add the services),
  and fix Entry 1 so `go test -race ./...` passes. See `tayari-validation-and-qa`.

## 3. [RESOLVED] Vite `manualChunks` TDZ crash — white screen

- **Symptom.** Production build white-screened with a runtime error like
  `Cannot access 'Gt' before initialization`.
- **Root cause.** A naive per-package `manualChunks` splitter in `vite.config.ts` gave every
  `node_modules` package its own Rollup chunk. Scoped packages that share module-level state
  (`@sentry/*`, `@sentry-internal/*`, `@radix-ui/*`) were split across chunks, producing a
  temporal-dead-zone access at runtime.
- **Evidence.** Commit `95ec118` "Removed manualChunks split"; `vite.config.ts` now carries an
  in-file warning block documenting exactly this failure.
- **Status.** **RESOLVED.** Rollup now chunks automatically (`build.chunkSizeWarningLimit: 1200`).
- **Lesson.** Never re-add a per-package `manualChunks` splitter. This is a hard rule in
  `tayari-change-control` §8. The warning comment in `vite.config.ts` must stay.

## 4. [RESOLVED] Browser white-screen bug (SPA crash)

- **Symptom.** App rendered a blank page.
- **Root cause / fix.** A small (5-line) fix across `src/App.tsx`,
  `src/components/AchievementsBadge.tsx`, `src/components/ResumeGraphViz.tsx`,
  `src/pages/ResumeGraph.tsx`.
- **Evidence.** Commit `2adee81` "Fixed browser white screen bug" (`git show --stat 2adee81`).
- **Status.** **RESOLVED.** Distinct from Entry 3 (that one was the chunking TDZ). If you see a
  white screen, check the console: TDZ → Entry 3; component error → this class of fix.
- **Lesson.** White screen has more than one cause; read the console before assuming chunking.

## 5. [RESOLVED] "Fixed 8 security issues"

- **Symptom.** Security hardening sweep.
- **Evidence.** Commit `1d20375` "Fixed 8 security issues" touched
  `backend/go/internal/api/router.go`, `backend/go/internal/api/routes_hermes.go`,
  `extension/background.js`, `extension/manifest.json`, `src/pages/Settings.tsx`,
  `supabase/functions/generate-resume-pdf/index.ts`.
- **Status.** **RESOLVED.** Related hardening lives in code: Go CORS is an explicit allowlist
  (never `*` with credentials), rate limiters on `/auth/login` + `/auth/register`, and the
  Python `_untrusted()` prompt-injection delimiter wrapping.
- **Lesson.** Security choices here are deliberate — don't "simplify" the CORS allowlist to `*`
  or drop the rate limiters.

## 6. [RESOLVED] Keyword-gap "skill gaps" were grammar words (stopword pollution)

- **Symptom.** The keyword-gap analysis reported words like `'ll'`, `'re'`, `'if'`, `'one'`,
  `'put'` as "skill gaps" — unusable output. A heuristic ATS score of 91% was achievable purely
  from grammar-word overlap.
- **Root cause.** `_tokenize()` used only ~17 stopwords.
- **Fix.** Build `STOPWORDS` from a base list **+ NLTK's 179-word English set** (~216 total), add
  a `TECH_SKILL_WHITELIST` (~86 real short tech terms like `python`, `sql`, `go`, `r`), and filter
  "missing keywords" through an `_is_meaningful()` guard (bigrams always kept; tokens ≥4 chars;
  drop `-tion`/`-ness`/`-ful` suffixes).
- **Evidence.** `backend/python/app/services/ats_engine.py` (`_build_stopwords`,
  `TECH_SKILL_WHITELIST`); documented in `lessons.md`.
- **Status.** **RESOLVED.**
- **Lesson.** Never trust a keyword extractor without a real stopword list. Validate that
  `matched_keywords` look like skills, not function words. Domain detail in `resume-ats-llm-reference`.

## 7. [RESOLVED] Supabase cloud-lock P0s

- **Symptom.** Features silently depended on cloud Supabase in self-hosted mode.
- **Fixes (per `IMPLEMENTATION_SUMMARY.md`).** `src/pages/ResumeTemplates.tsx` replaced
  `supabase.functions.invoke("generate-resume-pdf")` with a direct POST to the local Python
  `/api/v1/export/pdf`; the Go export handler now accepts `optimized_text` and falls back to
  `COALESCE(optimized_text, original_text)`; `src/pages/JobSearch.tsx` now fetches `profile` +
  `resumes` and passes real `resume_text` instead of an empty string.
- **Status.** **RESOLVED.**
- **Lesson.** Respect `VITE_USE_SELF_HOSTED`; never hardcode a cloud dependency into a
  self-hostable path (`.agents/AGENTS.md`).

## 8. [DOC-DRIFT] Port documentation disagrees with the compose file

- **Symptom.** Docs cite mutually inconsistent ports; newcomers curl the wrong host/port and
  conclude a service is down.
- **Reality (authoritative = `docker-compose.yml`, verified 2026-07-08).** Host ports: frontend
  **8083**, Go **8085**, Python **8002**, Postgres **5433**, Redis **6380**, Flower **5555**,
  Ollama **11435**, Caddy **8090/8443**.
- **Drifting docs.** `lessons.md` (frontend 4175; Supabase Kong 8008 / Studio 3005 / db 54326 —
  an **older/parallel** stack that no longer exists here); `DEPLOYMENT.md` (uses container-internal
  `8080/8000/80` as if host); `README.md` (partly corrupted, see below); `CLAUDE.md` (says Ollama
  11434 — that's the container port; host is 11435); `AGENT_SPEC.md` (frontend "5173" is legacy
  Vite default).
- **Status.** DOC-DRIFT, unresolved. Authoritative table lives in `tayari-build-and-env`.
- **Lesson.** Trust `docker-compose.yml` for host ports; treat prose docs as possibly stale.
- **Bonus.** `README.md` is **partly corrupted**: a "Kubernetes secret / New features" block is
  duplicated ~10× with malformed code fences. Cleanup guidance in `tayari-docs-and-writing`.

## 9. [WON'T-FIX / INFORMATIONAL] Dead agent branches

- **Symptom.** Branches `agent/frontend-jobsearch`, `agent/frontend-kanban`, `agent/go-api`,
  `agent/python-ai` exist.
- **Reality.** All are **fully merged into `main`** (0 commits ahead — `git log main..agent/*`
  is empty). They are historical parallel-agent workstreams.
- **Status.** Nothing to salvage. Don't resurrect or cherry-pick from them.
- **Lesson.** The useful history is in `main`; git messages are mostly opaque "Changes" commits,
  so rely on code + docs + this chronicle rather than `git log` prose.

---

## How to add an entry to this chronicle

When you close (or discover) a major issue, append an entry with the exact template:
**Symptom → Root cause → Evidence (file/line/commit/command) → Status → Lesson.** Prefer a
one-line reproduction command in Evidence. When an OPEN entry is fixed, flip it to RESOLVED,
keep the lesson, and remove any now-stale row from `tayari-debugging-playbook`.

---

## When NOT to use this / use instead

| You want to… | Use |
|---|---|
| Triage a live symptom right now | `tayari-debugging-playbook` |
| Judge whether a result is real evidence | `tayari-validation-and-qa` |
| Understand the design that permits these failures | `tayari-architecture-contract` |
| The rules a fix must satisfy | `tayari-change-control` |
| The deep quality-signal investigation | `tayari-quality-signal-campaign` |

---

## Provenance and maintenance

Facts verified against the repo on **2026-07-08**. Re-verify:

```bash
cd backend/go && go test ./... ; echo "exit=$?"          # Entry 1: expect non-zero until fixed
grep -n 'Conn: nil' backend/go/internal/api/routes_hermes_test.go
grep -n 'tenantMiddleware' backend/go/internal/api/middleware.go
grep -inE 'kong|studio|localhost:8008|localhost:3005' .github/workflows/ci.yml   # Entry 2
grep -c 'profiles:' docker-compose.yml                    # Entry 2: expect 9
grep -n 'manualChunks' vite.config.ts                     # Entry 3
git show --stat 2adee81 1d20375 95ec118 2>/dev/null | head -40   # Entries 3-5
grep -n 'TECH_SKILL_WHITELIST\|_build_stopwords' backend/python/app/services/ats_engine.py  # Entry 6
git branch -a                                             # Entry 9
```

Bump the date when an entry's status changes.
