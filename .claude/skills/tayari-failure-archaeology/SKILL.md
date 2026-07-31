---
name: tayari-failure-archaeology
description: >-
  The chronicle of Tayari Skill Boost's major investigations, dead ends, reverts, and
  still-open failures. Load BEFORE investigating a bug or "fixing" something that may have
  a known history — to check whether a battle is already settled and avoid re-fighting it.
  Each entry: Symptom → Root cause → Evidence → Status (OPEN/RESOLVED/DOC-DRIFT) → Lesson.
  Covers the nil-DB Go test panic (RESOLVED 2026-07-31), the CI/compose drift (RESOLVED
  2026-07-31), the manualChunks TDZ crash, the white-screen fix, stopword pollution, the
  port-doc drift, and the Postgres→self-hosted-Supabase migration. Facts verified 2026-07-31.
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

## 1. [RESOLVED 2026-07-31] Go test suite was red: 16 nil-pointer panics

- **Symptom (historical).** `cd backend/go && go test ./...` exited 1. Package
  `tayari-backend/internal/api` reported 16 failures: `TestSocialAuthRoutes_ProviderInjection`
  and every Hermes route test (`TestHermesScrape_*`, `TestHermesJobsBoard_*`,
  `TestHermesRunsList_*`, `TestHermesRunDetail_*`, `TestHermesUnknownRoute_404`,
  `TestHermesUnauthenticated_401`). Each panicked:
  `panic: runtime error: invalid memory address or nil pointer dereference` inside
  `database/sql.(*DB).QueryContext`.
- **Root cause.** The global `tenantMiddleware` (`internal/api/middleware.go`) was
  registered on **every** route (`s.Router.Use(s.tenantMiddleware)` in `router.go`) and called
  `s.DB.Conn.QueryRowContext(...)` to resolve a tenant on each request, unconditionally. The
  Hermes tests build the server via `newHermesServer` with `&database.DB{Conn: nil}` and a
  comment that says *"The DB is nil (Hermes routes never touch the Go DB — they only proxy)."*
  That comment was **false**: the middleware touches the DB before the handler runs, so a nil
  `Conn` nil-derefed.
- **Fix.** `tenantMiddleware` (`internal/api/middleware.go` ~line 200) now checks
  `if s.DB == nil || s.DB.Conn == nil` and skips tenant resolution when there's no DB, before
  ever calling `QueryRowContext`.
- **Evidence.** `routes_hermes_test.go` (`newHermesServer` → `Conn: nil`, still nil, no longer
  panics); `middleware.go`'s nil guard; `go test ./...` and `go test -race ./...` both exit 0.
- **Status.** **RESOLVED**, confirmed live 2026-07-31 (`go test ./...` → exit 0,
  `go test -race ./...` → exit 0). Green DB-free subset still works too:
  `go test ./internal/api -run 'TestSmoke|TestRouteParity'` → 19 pass. **Remaining Go gap:**
  test **coverage** is 14.1% vs the 80% `ci.yml` requires — that's a different problem (not
  enough tests, not broken tests) — see `tayari-validation-and-qa`.
- **Lesson.** Adding a global DB-touching middleware silently broke every DB-less test. Test
  doubles must satisfy the assumptions of *global middleware*, not just the handler under test.
  The eventual fix was option (b) from the original entry: make `tenantMiddleware` no-op when
  `s.DB == nil || s.DB.Conn == nil`, rather than giving every DB-less test a fake DB.

## 2. [RESOLVED 2026-07-31] CI's docker-compose job couldn't pass as written

- **Symptom (historical).** The `docker-compose` job in `.github/workflows/ci.yml`
  health-checked `http://localhost:8008` (supabase-kong) and `http://localhost:3005`
  (supabase-studio), and started the stack with `docker compose up -d --wait` (no profile).
- **Root cause.** (a) No Supabase Kong/Studio services existed in `docker-compose.yml` at
  all — only frontend, go-backend, python-ai, a standalone `postgres`, redis,
  celery-worker/flower, ollama, caddy. (b) Every service was profile-gated `["dev","prod"]`, so
  `docker compose up -d` with no `--profile` started nothing. The job waited on services that
  never came up and health-checked hosts that never existed.
- **Fix (part of the 2026-07-31 Postgres→self-hosted-Supabase migration, not a standalone CI
  patch).** The standalone `postgres` service was replaced with the full self-hosted Supabase
  stack (`supabase-local/`, merged via `include:`) — so Kong/Studio are now real services. CI's
  `docker-compose` job was updated to (a) pass `--profile dev`, (b) create both `.env` and
  `supabase-local/.env` with matching `POSTGRES_PASSWORD`/`JWT_SECRET`, and (c) health-check
  Kong/Studio at their real ports (8000/3001) with response-code checks that account for Kong
  having no bare `/health` route (401s unauthenticated requests — that's the "alive" signal) and
  Studio redirecting (307) its root path.
- **Evidence.** `docker compose --profile dev config --services` now lists `db`/`kong`/`auth`/
  `rest`/`realtime`/`storage`/`meta`/`studio`/`supavisor` alongside the root services; `ci.yml`'s
  updated `Create .env files`/health-check steps.
- **Status.** RESOLVED in the YAML. Still verify a live GitHub Actions run — "config matches
  reality" is necessary but not sufficient for "CI is green." The `go-build` job's separate
  Coverage Check step is still red (14% vs 80%, unrelated to this fix — see Entry 1).
  `scripts/perf_check.sh` is still a **simulated** placeholder (sleeps 1s), untouched.
- **Lesson.** Do **not** equate "CI config exists" with "CI is green," even after fixing the
  config — verify live GitHub Actions status. See `tayari-validation-and-qa`.

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

## 8. [DOC-DRIFT, partially resolved 2026-07-31] Port documentation disagrees with the compose file

- **Symptom.** Docs cite mutually inconsistent ports; newcomers curl the wrong host/port and
  conclude a service is down.
- **Reality (authoritative = `docker-compose.yml` incl. `include:`d `supabase-local/docker-compose.yml`,
  verified 2026-07-31).** Host ports: frontend **8083**, Go **8085**, Python **8002**, Redis
  **6380**, Flower **5555**, Ollama **11435**, Caddy **8090/8443**, Supabase Kong **8000**
  (`KONG_HTTP_PORT`), Supabase Studio **3001**, Supabase Postgres **54329**
  (`SUPABASE_DB_PORT`). There is no standalone `postgres` service anymore (removed 2026-07-31).
- **Remaining drift.** `lessons.md`'s opening entry cites frontend 4175 / Supabase Kong 8008 /
  Studio 3005 / db 54326 — that's a **specific, one-off port remap** from running Tayari
  alongside an unrelated "Mukthi Guru" stack on the same machine, not the shipped defaults;
  `AGENT_SPEC.md` (frontend "5173" is legacy Vite default). `README.md`'s corruption (below) was
  independently found to be **already fixed** — see the corrected status there.
- **Status.** Mostly resolved 2026-07-31 — the docs were rewritten in the same session as the
  Postgres→Supabase migration since almost every port changed at once. Re-verify anything not
  explicitly listed as updated before trusting it. Authoritative table: `tayari-build-and-env`.
- **Lesson.** Trust `docker-compose.yml` (+ its `include:`s) for host ports; treat prose docs as
  possibly stale, especially right after a port-changing migration — update every doc that cites
  the changed fact in the same session, not "later."
- **Bonus (corrected 2026-07-31).** `README.md` is **not** corrupted as of this check —
  `grep -c '^\*\*Kubernetes secret\*\*' README.md` → 0, fence count even. The corruption
  described in `tayari-docs-and-writing` §2 either predates this check or was already fixed;
  either way it no longer applies. Don't skip re-verifying a doc just because an older entry says
  it's broken.

## 9. [WON'T-FIX / INFORMATIONAL] Dead agent branches

- **Symptom.** Branches `agent/frontend-jobsearch`, `agent/frontend-kanban`, `agent/go-api`,
  `agent/python-ai` exist.
- **Reality.** All are **fully merged into `main`** (0 commits ahead — `git log main..agent/*`
  is empty). They are historical parallel-agent workstreams.
- **Status.** Nothing to salvage. Don't resurrect or cherry-pick from them.
- **Lesson.** The useful history is in `main`; git messages are mostly opaque "Changes" commits,
  so rely on code + docs + this chronicle rather than `git log` prose.

## 10. [RESOLVED] Standalone `postgres` service replaced with self-hosted Supabase

- **Symptom.** User asked to stop using a bare Postgres image and use Docker-based Supabase
  only. The codebase already had `internal/auth/supabase.go` (a `SupabaseAuth` implementation
  that verifies GoTrue-issued JWTs) sitting unused, and `supabase-local/` (a full self-hosted
  Supabase Docker Compose bundle) sitting unmerged into the main stack — plus `lessons.md`
  already documented a **prior** attempt at this exact migration (port-remap entry, dated
  before this session), suggesting an earlier worktree did this work and it was lost/reverted.
- **Fix.** Removed the standalone `postgres` service from `docker-compose.yml`; merged
  `supabase-local/docker-compose.yml` in via Compose's `include:`; ported `backend/db/`'s full
  schema (auth-schema stub stripped) into `supabase-local/volumes/db/init/` as individually
  mounted files; flipped `USE_SUPABASE=true`/`VITE_USE_SELF_HOSTED=false` defaults.
- **Three additional bugs found and fixed only by actually driving the app** (not just curling
  the API with a hand-copied token) — full detail in `lessons.md`'s "Migrating Off Bare Postgres"
  entry:
  1. Supabase's `migrate.sh` globs `migrations/*.sql` **non-recursively** — a directory mount
     was silently invisible to it (zero tables, zero errors).
  2. `${VAR:?err}` Compose interpolation isn't scoped by profile — broke `--profile prod` for a
     dev-only service.
  3. `AuthContext.tsx`'s Supabase branch never bridged the session token into the
     `localStorage` key `apiFetch` reads — every backend call in Supabase mode was silently
     unauthenticated, invisible until someone actually signed up through the real UI.
- **Status.** RESOLVED, verified live 2026-07-31: `down -v && up --build` twice, 18/18
  services healthy, real GoTrue signup → real JWT → Go verifies it → full CRUD → GDPR delete
  removes the real Supabase auth user → browser-driven signup with zero console/network errors.
  Caveat: this is a persistent-volume restart verification, not a from-scratch init verification
  — `supabase-local/volumes/db/data` is a bind mount, not a named Docker volume, so `down -v`
  did not actually wipe it (see the "Never `docker compose down -v`..." gotcha in `CLAUDE.md`).
  The init SQL scripts running correctly against a genuinely empty volume is unverified by this
  entry; it would need an explicit `rm -rf supabase-local/volumes/db/data` first.
- **Lesson.** An auth strategy that's implemented but never the default can be silently broken
  for a long time with zero symptoms, the same class of risk as an untested `except` clause.
  Flipping the default is what first exercises the dead path — budget time to actually drive the
  previously-dormant path end-to-end, not just unit-test around it.

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

Facts verified against the repo on **2026-07-31**. Re-verify:

```bash
cd backend/go && go test ./... ; echo "exit=$?"           # Entry 1: expect 0 (fixed)
cd backend/go && go test -race ./... ; echo "exit=$?"     # Entry 1: expect 0 (matches CI)
grep -n 'Conn: nil' backend/go/internal/api/routes_hermes_test.go
grep -n 's.DB == nil' backend/go/internal/api/middleware.go   # the nil-guard that fixed Entry 1
docker compose --profile dev config --services            # Entry 2: full merged list, incl. Supabase
grep -inE 'kong|studio|profile dev' .github/workflows/ci.yml   # Entry 2
grep -n 'manualChunks' vite.config.ts                     # Entry 3
git show --stat 2adee81 1d20375 95ec118 2>/dev/null | head -40   # Entries 3-5
grep -n 'TECH_SKILL_WHITELIST\|_build_stopwords' backend/python/app/services/ats_engine.py  # Entry 6
git branch -a                                             # Entry 9
grep -n 'include:' -A2 docker-compose.yml                 # Entry 10: the Supabase merge
grep -n "localStorage.setItem('auth_token'" src/contexts/AuthContext.tsx  # Entry 10: must be in both branches
```

Bump the date when an entry's status changes.
