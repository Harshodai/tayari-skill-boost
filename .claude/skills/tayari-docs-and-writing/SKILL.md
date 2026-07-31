---
name: tayari-docs-and-writing
description: >-
  Tayari Skill Boost house style + doc-of-record ownership. Load BEFORE creating or
  updating any document of record (README, root CLAUDE.md, .agents/AGENTS.md,
  AGENT_SPEC.md, lessons.md, DEPLOYMENT.md, IMPLEMENTATION_SUMMARY.md, a DB migration
  note, or a backend README), OR before writing commit/PR text, OR when you need to know
  WHICH doc owns a fact and whether that doc is currently trustworthy. Owns: the doc map
  (what each doc owns + its verified trust status), the README-is-corrupted advisory + a
  safe fix checklist, the terse "caveman" house style, copy-paste templates (migration
  note, lessons.md entry, commit message, PR skeleton, doc-update checklist), and the
  one-home-per-fact / date-stamp discipline. Facts verified 2026-07-31.
---

# Tayari Docs and Writing

This is the **house style + documentation-ownership** skill. It answers three questions:

1. **Which doc owns this fact, and can I trust what that doc currently says?** → the Doc
   Map (§1) and the README corruption advisory (§2).
2. **How do I write it in this repo's voice?** → house style (§3).
3. **What's the exact shape of the thing I'm writing?** → copy-paste templates (§4).

It ends with the discipline rule that keeps docs from rotting (§5): one home per fact,
date-stamp volatile facts, cross-link the rest.

This skill **instructs**; it does not edit docs for you and it does not bypass gating.
Any edit to a document of record — including *fixing* a broken one — still routes through
the change-control gate. See `tayari-change-control` (docs-only row).

**Jargon defined once:**
- **Document of record ("doc of record")** — a Markdown file a future agent or engineer
  will trust as the source of truth for some domain (architecture rules, ports, lessons,
  deployment). Editing one changes what everyone downstream believes. Treat it with more
  care than a code comment.
- **House style** — the project owner's global writing rules, restated in §3. They apply
  to everything you write in this repo unless a doc says otherwise.
- **Volatile fact** — anything that can drift out from under the doc: a port, a version, a
  test count, a "currently broken" status, an env-var default. Volatile facts get a
  `(verified YYYY-MM-DD)` stamp so a reader knows how stale they might be.
- **One home per fact** — every fact lives in exactly one doc/skill; everyone else links
  to it. Duplicated facts drift silently (this is literally how the README broke — §2).

---

## 1. The Doc Map — what each doc owns, and whether to trust it (verified 2026-07-31)

Find the doc you're about to read or edit. **Trust** tells you whether to believe its
current contents at face value. When a doc is stale on a fact, the "Owns / caveats" column
names who owns the correct value instead.

| Doc | Owns | Trust (verified 2026-07-31) |
|---|---|---|
| **`CLAUDE.md`** (root) | High-level project map: stack, structure, commands, conventions, gotchas. The best single orientation doc. | **Trust — rewritten 2026-07-31** for the Postgres→self-hosted-Supabase migration (removed `postgres` service, added `supabase-local/` via `include:`, new `.env` pair requirement, auth-mode defaults flipped). One known slip: says Ollama `11434` (that's the *container* port; **host is 11435**). Ports owned by `tayari-build-and-env` / `tayari-run-and-operate`. |
| **`backend/python/CLAUDE.md`** | Python-engine local rules: run `python -m py_compile` on changed files before commit; `pytest`+`pyyaml` are NOT in `requirements.txt` (install separately); `app/plugins/resume_optimizer/` is auto-discovered. | **Trust.** Small and accurate; unaffected by the Supabase migration. |
| **`.agents/AGENTS.md`** | **The hard architectural rules.** Service separation, frontend→Go-only, `VITE_USE_SELF_HOSTED`, feature-flag registration, E2E-on-auth/nav/pricing, 12-char password minimum, prefer `127.0.0.1`. | **Authoritative — quote it, don't paraphrase.** These are contracts, not suggestions. Verbatim rules in §1a below. Not re-verified 2026-07-31 (no reason to expect drift — it's rules, not ports/facts). |
| **`AGENT_SPEC.md`** | Subagent coordination + "shared contracts" for a past parallel-build effort. Historical context for how the codebase was assembled. | **Partial, historical.** Rules OK; its "Shared Contracts" **ports are container-internal** (Python `8000`, Go `8080`) and it lists frontend dev `5173` — **legacy Vite default; current dev port is 8080** (`vite.config.ts`). Do not quote its ports as host ports. |
| **`lessons.md`** | Real engineering lessons: stopword pollution, TF-IDF vs heuristic ATS, STAR heuristic, humanization pass, NVIDIA NIM backoff, cv-tailor 5-phase mapping, confidence ratings, and (new 2026-07-31) the three Supabase-migration traps. | **Trust the lessons; the opening port table is a one-off, not the shipped defaults.** Its first entry (frontend `4175`, Supabase Kong `8008` / Studio `3005` / db `54326`) describes a **specific port remap** from running Tayari alongside an unrelated "Mukthi Guru" stack on one machine — not what ships in `.env.example`. Shipped defaults (Kong 8000, Studio 3001, db 54329) live in `tayari-build-and-env`. |
| **`DEPLOYMENT.md`** | How to run locally and deploy (Railway/Render/Fly, Vercel/Netlify), backups/PITR, GDPR endpoints. | **Trust — rewritten 2026-07-31** for the Supabase migration: two-`.env`-file setup, `db`/`supabase-local` service names throughout, Supabase Cloud vs self-hosted prod paths, `scripts/backup.sh`/`restore.sh` cross-referenced. A couple of Railway/Fly snippets illustrate container-internal ports by design (that's normal in a Dockerfile-build context) — don't confuse those with the host port table. |
| **`IMPLEMENTATION_SUMMARY.md`** | A point-in-time build log (dated 2026-06-20): P0 fixes, new services, new pages, files changed. Good for "when/why did feature X land". | **Trust as history, not as current ops.** Its "How to Run" also uses bare `docker-compose up -d`. Do not cite it for current commands. |
| **`PRODUCT_GRILL.md`** | Competitive analysis, gaps, recommendations. Positioning material. | **Positioning, not engineering truth.** For external claims use `tayari-external-positioning` and keep the no-oversell rule (§3). |
| **`research/*`** | Roadmaps + strategy (`WORLD_CLASS_ROADMAP.md`, `NEXT_PHASE_ROADMAP.md`, `DIFFERENTIATION_STRATEGY.md`, `competitor_landscape.md`, `dim01…dim09_*.md`, `prd_gap_analysis.md`, etc.). | **Forward-looking / aspirational.** Describes intended, not shipped, work. Do not cite as "implemented". Roadmap/research posture: `tayari-research-frontier`, `tayari-research-methodology`. |
| **`README.md`** | Pitch, five differentiators, stack/ports tables, architecture, docker/deploy, testing, feature-flag intro. | **Trust — corruption advisory below is STALE, and the doc was independently rewritten 2026-07-31** for the Supabase migration (ports table, setup steps, "what happens on fresh start"). See the corrected §2. |
| **`backend/python/README.md`** | Python service overview: plugin architecture, FastAPI entry, how to add a plugin. | **Trust.** Updated 2026-07-31 (compose command fix); plugin story unaffected. |
| **`backend/go/README.md`** | Go gateway overview: package layout, dual-mode auth, social login, deps. | **Trust.** Updated 2026-07-31 (compose command, DB note); thin otherwise — router/parity detail lives in `tayari-architecture-contract` / `tayari-change-control`. |

**General rule when a doc's prose disagrees with these skills on a volatile fact
(ports/commands/versions/test status): the skills win, because they are date-stamped and
the doc is not.** When you edit the doc, fix the fact and stamp it (§5).

### 1a. `.agents/AGENTS.md` — the hard rules, verbatim (quote these, do not paraphrase)

These are the load-bearing sentences. When you write a doc that touches architecture,
quote them rather than restating them in your own words:

- **Service separation.** "Go (`backend/go/`): Must ONLY be used for routing,
  authentication, simple CRUD, and database queries. DO NOT implement complex LLM logic
  here." "Python (`backend/python/`): Must ALWAYS be used for AI inference, NLP, web
  scraping (Hermes), and async workers (Celery)."
- **API communication.** "The frontend must NEVER call the Python AI engine directly. All
  requests must go through the Go API Gateway (e.g. `/api/v1/ai/...`), which acts as a
  reverse proxy."
- **Self-hosted.** "Always respect the `VITE_USE_SELF_HOSTED` flag." "Never hardcode
  cloud Supabase URLs."
- **Feature flags.** "If you are adding a new page or a major component, you MUST register
  it in `src/config/features.ts` and wrap its visibility using the existing feature flag
  logic."
- **E2E.** "Any change to the authentication flow, navigation, or pricing pages must be
  accompanied by an update to the Playwright suite (`e2e/features.spec.ts`)."
- **Password strictness.** "The platform enforces a strict 12-character minimum password
  policy." A seed/test password below 12 chars makes the test silently fail.
- **Network resolution.** "Prefer `127.0.0.1` over `localhost` to avoid IPv6 resolution
  timeouts."

Enforcement of these as change gates: `tayari-change-control`. Full architecture map:
`tayari-architecture-contract`.

---

## 2. README corruption advisory — CORRECTED 2026-07-31, was already stale

**Status (re-checked 2026-07-31): `README.md` is NOT corrupted.**
`grep -c '^\*\*Kubernetes secret\*\*' README.md` → **0**. `grep -c '^```' README.md` → **6**
(even). No duplicated block, no fused fences. This section previously (verified 2026-07-08)
described the file as partly corrupted with a "Kubernetes secret" block duplicated ~10× — that
description no longer matches the file, whether because it was fixed between 2026-07-08 and
2026-07-31 or because the original finding was already stale by the time it was written down.
Either way: **do not act on the old advisory below as current fact** — it's kept only as a
worked example of the safe-fix checklist discipline (§below), and as a lesson: an inherited
"known broken" claim about a doc is itself a fact that can go stale, same as a port number. Check
before you fix.

The README was also independently rewritten 2026-07-31 for the Postgres→self-hosted-Supabase
migration (ports table, setup steps, "what happens on fresh start" section) — current and
trustworthy as of that date.

**Historical advisory (as originally written 2026-07-08, kept for the checklist template
below — do not treat the "what broke" facts as current):**

- ~~A block is duplicated ~10 times~~ — not reproducible as of 2026-07-31.
- ~~Code fences are malformed / fused~~ — not reproducible as of 2026-07-31.
- ~~Stale ports (frontend 4173, "8090 via Caddy" instead of a real host mapping)~~ — the
  file's actual ports table as of 2026-07-31 matches `docker-compose.yml`.

### Safe fix checklist template (still the right process for a *real* future corruption)

If a future check finds README (or any doc of record) genuinely corrupted again, this is still
the right procedure — this skill instructs, the edit still routes through `tayari-change-control`:

- [ ] **Announce first.** Per house style (§3), say in plain English what you're about to
      change and why before editing.
- [ ] **Preserve positioning-sensitive sections verbatim** (differentiators, architecture
      pitch) unless the task is specifically a positioning change — that goes through
      `tayari-external-positioning`, not a cleanup.
- [ ] **Detect duplication before assuming it exists:**
      ```bash
      grep -c '^\*\*Kubernetes secret\*\*' README.md   # whatever pattern is actually duplicated
      ```
- [ ] **Verify fence balance:**
      ```bash
      grep -c '^```' README.md    # must be an EVEN number
      ```
- [ ] **Correct stale ports against the authoritative table** (one home per fact — §5):
      `tayari-build-and-env`, `tayari-run-and-operate`.
- [ ] **Do not invent.** If instructions can't be verified against something real in the repo,
      keep only what's true and mark the rest clearly, or drop it.
- [ ] **Re-render / re-read** the file top-to-bottom before claiming done — and before writing
      an advisory that a doc is broken, re-check it's *still* broken right now.

---

## 3. House style (the project owner's global rules — they apply here)

These are the repo's writing rules. They come from the project owner's global instructions
and apply to everything you write in this repo unless a specific doc overrides them.

**Voice: terse "caveman" prose for docs and explanations.**
- Drop filler, hedging, and pleasantries. Keep **all** technical substance — terse means
  fewer words, never fewer facts.
- Prefer tables, checklists, and short imperative sentences over paragraphs.
- Cut "In order to", "It is worth noting that", "Basically", "As you can see". Say the
  thing.

**Where NOT to be terse:**
- **Code, commit messages, and PR descriptions are written normally** — full, clear,
  readable prose. Terseness is for docs/chat, not artifacts other people review later.
- **Security warnings and irreversible actions get full, explicit sentences.** Spell out
  the risk and the blast radius. Do not compress a `docker compose down -v` warning or a
  secret-rotation note into three words. (Examples of irreversible/dangerous in this repo:
  `docker compose down -v` wipes the Postgres volume; committing a real key to the tracked
  `.env`; removing the `JWT_SECRET` requirement.)

**Working manner (applies to how you narrate work in docs and chat):**
- **Explain what you're about to do in plain English before doing it.**
- **State your assumptions.** If the request is ambiguous, say what you're assuming and ask
  before writing.
- **Push back when the user is wrong.** Never agree just to be agreeable.
- **Keep changes minimal.** No drive-by "improvements", no unrequested scope. When you make
  a deliberately small, non-obvious choice in code, leave a one-line `// ponytail:` (Go/TS)
  or `# ponytail:` (Python) rationale. The `// ponytail:` convention is owned by
  `tayari-change-control`.
- **Raise errors explicitly.** Do not swallow errors or add fallbacks nobody asked for.
- **Read the existing code/doc before editing it.**

**Language defaults:**
- **TypeScript over JavaScript, always.**
- **Python with type hints** (the engine already uses `from __future__ import annotations`
  for `X | None` syntax — match it).

**Git manner:** never commit, branch, or push unless the user explicitly asks. Leave
changes in the working tree for review.

---

## 4. Templates (copy-paste)

Every template below is self-contained. Fill the `<…>` placeholders. Keep the house-style
rules from §3 (terse docs; normal prose in commits/PRs; explicit security notes).

### 4a. DB migration note

Migrations live in `backend/db/migrations/` and are named **`YYYYMMDD_desc.sql`** —
date prefix, then a short snake_case description (verified pattern 2026-07-31, e.g.
`20260620_hermes_agents.sql`, `20260701_add_resume_graph_table.sql`). `.agents/AGENTS.md`:
schema changes "must be meticulously documented and ideally added to init scripts."

File: `backend/db/migrations/<YYYYMMDD>_<short_desc>.sql`

```sql
-- Migration: <YYYYMMDD>_<short_desc>.sql
-- Author: <name>
-- Date: <YYYY-MM-DD>
-- Purpose: <one line — what this changes and why>
-- Related: <PR / issue / feature-flag key, if any>
-- Reversible: <yes/no — if no, say so LOUDLY and describe the manual undo>
--
-- Tables/columns touched: <list>
-- Data impact: <none | backfill | destructive — spell out destructive changes fully>

BEGIN;

-- <DDL here. Prefer additive changes. IF NOT EXISTS where it makes the script re-runnable.>

COMMIT;
```

- Additive by default (`ADD COLUMN`, new table). A destructive change (`DROP`, `ALTER …
  TYPE` that loses data) is an **irreversible action** — describe it in full sentences per
  §3, and never run it against local data without explicit confirmation.
- After adding a migration, note it wherever the feature is documented (one home per fact —
  link, don't duplicate the SQL into prose). Gate: `tayari-change-control` (DB-migration row).

### 4b. `lessons.md` entry

Match the existing `lessons.md` shape: an `##` heading (emoji optional), then
Problem → Lesson → Fix. Keep it terse; keep the honesty (state confidence, state limits).

```markdown
## <Short title of the lesson>

<One or two sentences: the situation where this bit us.>

### The Problem
- <What went wrong, concretely. Include the wrong output/symptom.>

### The Lesson
- <The generalizable rule. What to never/always do next time.>
- <If a metric or score is involved, state its confidence and its limit honestly —
  e.g. "heuristic ATS is structural only, ~7/10, not a real Greenhouse score".>

### The Fix (in `<file>`)
```<lang>
<minimal code or config that fixed it>
```
```

### 4c. Commit message

**Current reality (verified 2026-07-08): the history is a mix.** Many commits are opaque
squashes titled `Changes`; a growing set use Conventional Commits (`feat: …`, `fix: …`,
`fix(hermes): …`). **Going forward, write Conventional Commits — do not add more `Changes`
commits.** They're worthless for archaeology (see `tayari-failure-archaeology`).

Format (commit body is normal prose, not terse — §3):

```
<type>(<optional scope>): <imperative summary, <=72 chars>

<Body: what changed and WHY. Wrap ~72 cols. Reference the gate you passed
(route parity, py_compile, green Go subset) if relevant. Note anything you're
unsure about.>

<Footer: Refs #<issue> / BREAKING CHANGE: <desc> if applicable>
```

- **type**: `feat` | `fix` | `docs` | `refactor` | `test` | `chore` | `perf`.
- **scope** (optional): the area, e.g. `hermes`, `go`, `ats`, `frontend`.
- Examples that match the repo's better commits: `fix(hermes): /runs/active now returns
  both running AND queued runs`; `docs: repair corrupted README fences and stale ports`.
- Do not claim something works in the message unless you ran it (§3 honesty; and see the
  pre-merge gate in `tayari-change-control`).

### 4d. PR description skeleton

```markdown
## What
<One-paragraph summary of the change. Plain English.>

## Why
<The problem this solves / the request it fulfills.>

## How
- <Key implementation points. Note any deliberately minimal choices (`// ponytail:`).>

## Gates run (see tayari-change-control)
- [ ] Route parity — both `/api` and `/api/v1` registered, or `knownAsymmetric` entry (if routes changed)
- [ ] `go build ./...` + green Go subset (`go test ./internal/api -run 'TestSmoke|TestRouteParity'`)
- [ ] `python -m py_compile` on changed Python
- [ ] `bun run build` / `bun run lint` (if `src/` changed)
- [ ] Feature flag registered in `src/config/features.ts` (if new page/major component)
- [ ] Playwright E2E updated (if auth/nav/pricing changed)
- [ ] Mock-mode check: `active_engine` != `mock-fallback` for any real AI result claimed
- [ ] No bare `docker compose up -d` introduced (profile-gated); no per-package `manualChunks`

## Risk / rollback
<Blast radius. For anything irreversible (migrations, secret changes, volume-affecting
ops) spell it out in full sentences — §3. State how to roll back.>

## Notes / unsure
<Anything you couldn't verify or want a reviewer to check.>
```

### 4e. Doc-update checklist

Run this whenever you touch a doc of record.

- [ ] **Right home?** The fact belongs in exactly one doc/skill (§5). If it already lives
      elsewhere, link to it — do not duplicate it here.
- [ ] **Announced first** (plain English, §3) and change kept minimal.
- [ ] **Volatile facts date-stamped** `(verified YYYY-MM-DD)` — ports, versions, test
      counts, "currently broken" statuses, env defaults (§5).
- [ ] **Cross-referenced by name**, not by copy-paste. Sibling skills are referenced by
      their skill name (e.g. `tayari-run-and-operate`), never by re-explaining their content.
- [ ] **No oversell.** Quality claims that rest on the heuristic ATS score or a
      mock-capable LLM are labeled honestly; nothing claims "beats real ATS" /
      "recruiter-grade" without evidence. Positioning goes through
      `tayari-external-positioning`.
- [ ] **Ports/commands correct** against the current stack: host `8083`/`8085`/`8002`;
      Ollama host `11435`; Supabase Kong `8000`/Studio `3001`/Postgres `54329` (no standalone
      `postgres` service — removed 2026-07-31); `docker compose --profile dev up -d` (never bare).
- [ ] **Read the whole file after editing** — especially near code fences (README lesson, §2).
- [ ] **Routed through the gate** for the edit: `tayari-change-control` (docs-only row).

---

## 5. The discipline rule: one home per fact, date-stamp the volatile ones

This is how docs stay trustworthy, and it's how these skills are organized — mirror it.

- **One home per fact.** Every fact (a port, a rule, a command, a limit) lives in exactly
  one place. Everywhere else **links to that home by name** instead of restating it.
  Duplicated facts drift: the README broke partly because a block was copied ~10× (§2), and
  `lessons.md` / `DEPLOYMENT.md` mislead because they carry their own stale copies of ports
  that have a correct home elsewhere.
- **Date-stamp volatile facts.** Any fact that can drift — port, version, test count,
  "currently red/green" status, env-var default — gets a `(verified YYYY-MM-DD)` stamp so
  the next reader knows its age. Non-volatile prose (architecture intent, lessons) doesn't
  need a stamp.
- **When a fact and this skill disagree, the date-stamped source wins.** Update the stale
  doc, stamp it, and move on.
- **Cross-link, don't re-teach.** If a reader needs ports, send them to
  `tayari-build-and-env` / `tayari-run-and-operate`. If they need the change gate, send
  them to `tayari-change-control`. Keep this skill about *style and ownership*, not about
  re-deriving other skills' content.

---

## When NOT to use this / use instead

This skill covers house style and who-owns-what for the docs of record. Use a sibling
instead when:

| You want to… | Use |
|---|---|
| Make an **external claim / positioning / marketing** statement (differentiators, competitor comparison) | `tayari-external-positioning` |
| Write the **chronicle of a past failure** in the archaeology format (incident narrative) | `tayari-failure-archaeology` |
| Know whether a change is **allowed / what gate it must pass** (incl. fixing a doc) | `tayari-change-control` |
| Get the **full architecture contract** (service boundaries, router, parity) | `tayari-architecture-contract` |
| Get **correct ports / build / env vars** | `tayari-build-and-env` |
| **Run / operate** the stack (Docker profiles, health checks) | `tayari-run-and-operate` |
| Understand **feature-flag mechanics** in depth | `tayari-config-and-flags` |
| **Diagnose** a failing build/test | `tayari-debugging-playbook` |
| Judge whether **test evidence is real** (mock ≠ pass) | `tayari-validation-and-qa` |
| ATS / LLM / optimizer **internals** | `resume-ats-llm-reference` |
| Roadmap / research posture | `tayari-research-frontier`, `tayari-research-methodology` |

This skill governs *how* docs are written and *which doc owns what*. It does not authorize
skipping any change-control gate — even a documentation fix goes through the gate.

---

## Provenance and maintenance

All facts verified against the repo on **2026-07-31** (Doc Map §1, README status §2, doc-update
checklist port list). Volatile facts are date-stamped inline. Re-verify with these one-liners
(run from repo root):

```bash
# README corruption claim — should stay negative; if this ever comes back positive,
# the advisory in §2 needs to flip back to "corrupted" and a real fix is needed
grep -c '^\*\*Kubernetes secret\*\*' README.md      # expect 0
grep -c '^```' README.md                            # expect an EVEN number

# Doc-of-record inventory still exists
ls -1 CLAUDE.md .agents/AGENTS.md AGENT_SPEC.md lessons.md DEPLOYMENT.md \
      IMPLEMENTATION_SUMMARY.md PRODUCT_GRILL.md backend/python/README.md backend/go/README.md
ls research/ supabase-local/

# Migration naming convention (YYYYMMDD_desc.sql)
ls backend/db/migrations/

# Every backend/db/migrations/*.sql file must have a matching NN-prefixed
# copy in supabase-local/volumes/db/init/ (the two are NOT auto-synced —
# adding one without the other silently never applies to the self-hosted
# stack). Flags any migration missing its mirror.
for f in backend/db/migrations/*.sql; do
  base=$(basename "$f")
  ls supabase-local/volumes/db/init/*"-${base}" >/dev/null 2>&1 || echo "MISSING mirror for: $base"
done

# Every file in supabase-local/volumes/db/init/ must be individually mounted
# in supabase-local/docker-compose.yml's db: service — the postgres image's
# init glob is non-recursive, so a directory-level mount is silently
# invisible to it (zero tables created, zero errors logged).
for f in supabase-local/volumes/db/init/*.sql; do
  base=$(basename "$f")
  grep -q "init/${base}:" supabase-local/docker-compose.yml || echo "NOT MOUNTED: $base"
done
# Confirm no directory-level mount shadows the individual-file mounts above
grep -n 'volumes/db/init:' supabase-local/docker-compose.yml    # expect NO output

# Supabase migration facts (2026-07-31) still hold
grep -n 'include:' -A2 docker-compose.yml                      # the merge
grep -c 'postgres:' docker-compose.yml                           # expect 0 (service removed)
grep -n '5173' AGENT_SPEC.md                                     # legacy Vite dev port, still historical

# .agents/AGENTS.md hard rules still worded as quoted in §1a
grep -n 'ONLY be used\|NEVER call the Python\|features.ts\|12-character\|127.0.0.1' .agents/AGENTS.md

# Commit-style reality (mix of "Changes" squashes and feat/fix)
git log --oneline -30
```

If any of these drift — README gets genuinely corrupted, a doc gets corrected, the migration
naming changes, or a doc's ownership moves — update the corresponding row/section here and bump
the verification date.
