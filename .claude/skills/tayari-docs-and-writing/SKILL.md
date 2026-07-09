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
  one-home-per-fact / date-stamp discipline. Facts verified 2026-07-08.
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

## 1. The Doc Map — what each doc owns, and whether to trust it (verified 2026-07-08)

Find the doc you're about to read or edit. **Trust** tells you whether to believe its
current contents at face value. When a doc is stale on a fact, the "Owns / caveats" column
names who owns the correct value instead.

| Doc | Owns | Trust (verified 2026-07-08) |
|---|---|---|
| **`CLAUDE.md`** (root) | High-level project map: stack, structure, commands, conventions, gotchas. The best single orientation doc. | **Trust, two known slips.** Says Ollama `11434` (that's the *container* port; **host is 11435**) and `docker compose up -d` (bare `up` starts **zero** services — needs `--profile dev`). Ports owned by `tayari-build-and-env` / `tayari-run-and-operate`. |
| **`backend/python/CLAUDE.md`** | Python-engine local rules: run `python -m py_compile` on changed files before commit; `pytest`+`pyyaml` are NOT in `requirements.txt` (install separately); `app/plugins/resume_optimizer/` is auto-discovered. | **Trust.** Small and accurate. |
| **`.agents/AGENTS.md`** | **The hard architectural rules.** Service separation, frontend→Go-only, `VITE_USE_SELF_HOSTED`, feature-flag registration, E2E-on-auth/nav/pricing, 12-char password minimum, prefer `127.0.0.1`. | **Authoritative — quote it, don't paraphrase.** These are contracts, not suggestions. Verbatim rules in §1a below. |
| **`AGENT_SPEC.md`** | Subagent coordination + "shared contracts" for a past parallel-build effort. Historical context for how the codebase was assembled. | **Partial.** Rules OK; its "Shared Contracts" **ports are container-internal** (Python `8000`, Go `8080`) and it lists frontend dev `5173` — **legacy Vite default; current dev port is 8080** (`vite.config.ts`). Do not quote its ports as host ports. |
| **`lessons.md`** | Real engineering lessons: stopword pollution, TF-IDF vs heuristic ATS, STAR heuristic, humanization pass, NVIDIA NIM backoff, cv-tailor 5-phase mapping, confidence ratings. | **Trust the lessons; DISTRUST the port table.** Its opening port table (frontend `4175`, Supabase Kong `8008` / Studio `3005` / db `54326`) describes an **older parallel stack that is not in the current `docker-compose.yml`**. Those Supabase services do not exist now. |
| **`DEPLOYMENT.md`** | Intent: how to run locally and deploy (Railway/Render/Fly, Vercel/Netlify). | **STALE for local run.** Uses `docker compose up -d` (no profile → starts nothing) and container-internal ports as if they were host ports (`localhost:8080`, `:8000`, `:80`). Real host ports: Go `8085`, Python `8002`, frontend `8083`. Operational truth: `tayari-run-and-operate`. |
| **`IMPLEMENTATION_SUMMARY.md`** | A point-in-time build log (dated 2026-06-20): P0 fixes, new services, new pages, files changed. Good for "when/why did feature X land". | **Trust as history, not as current ops.** Its "How to Run" also uses bare `docker-compose up -d`. Do not cite it for current commands. |
| **`PRODUCT_GRILL.md`** | Competitive analysis, gaps, recommendations. Positioning material. | **Positioning, not engineering truth.** For external claims use `tayari-external-positioning` and keep the no-oversell rule (§3). |
| **`research/*`** | Roadmaps + strategy (`WORLD_CLASS_ROADMAP.md`, `NEXT_PHASE_ROADMAP.md`, `DIFFERENTIATION_STRATEGY.md`, `competitor_landscape.md`, `dim01…dim09_*.md`, `prd_gap_analysis.md`, etc.). | **Forward-looking / aspirational.** Describes intended, not shipped, work. Do not cite as "implemented". Roadmap/research posture: `tayari-research-frontier`, `tayari-research-methodology`. |
| **`README.md`** | *Intends* to own: pitch, five differentiators, architecture, docker/deploy, testing, feature-flag intro. | **PARTLY CORRUPTED — do NOT cite as clean.** A "Kubernetes secret / New features" block is duplicated ~10× and code fences are malformed; ports are stale (frontend `4173`, `8090` via Caddy). The differentiators section (top) is intact. Full advisory + safe fix checklist in §2. |
| **`backend/python/README.md`** | Python service overview: plugin architecture, FastAPI entry, how to add a plugin. | **Trust the plugin story.** Port `8000` it cites is container-internal. |
| **`backend/go/README.md`** | Go gateway overview: package layout, dual-mode auth, social login, deps. | **Trust the structure.** Thin; the router/parity detail lives in `tayari-architecture-contract` / `tayari-change-control`. |

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

## 2. README is partly corrupted — advisory + safe fix checklist

**Status (verified 2026-07-08): `README.md` is partly corrupted. Do not cite it as a
clean source, and do not copy its docker/deploy blocks.**

What broke, precisely:

- **A block is duplicated ~10 times.** The text starting `**Kubernetes secret**: Before
  installing, create a secret…` through `…updated accordingly.` is repeated throughout the
  Docker/Deployment/Feature-Flag sections. It is a copy-paste stutter, not intentional.
- **Code fences are malformed / fused.** The opening fence language got orphaned: a closing
  ```` ``` ```` is immediately followed by the duplicated block, and the language tag
  (`bash`, `typescript`) is stuck onto the **end** of the block instead of onto its own
  fence line (e.g. `…updated accordingly.bash` then `docker compose …`). Rendered, the
  code samples leak into prose and the prose leaks into code.
- **Stale ports.** It says frontend `4173` → host `8083` and "`:8090` via Caddy". The
  container/nginx port is `80`, not `4173`; host frontend is `8083`; Caddy host is `8090`.
  It also shows bare `docker compose up -d` / `docker compose --profile dev up -d` — the
  bare form starts nothing.

**What is intact and MUST be preserved:** the top of the file — the tagline, the
"Five differentiators no competitor ships" list, and the System Architecture section
(roughly the first ~50 lines through the differentiators + architecture). **Do not delete
or reword the differentiators when cleaning up.** Positioning wording is owned by
`tayari-external-positioning`; a docs cleanup must not silently rewrite claims.

### Safe fix checklist (this skill instructs; the edit routes through change-control)

You are **not** authorized to fix the README from this skill alone. Fixing a doc of record
is a docs-only change and goes through `tayari-change-control`. When you do fix it:

- [ ] **Announce first.** Per house style (§3), say in plain English what you're about to
      change and why before editing.
- [ ] **Preserve the differentiators + architecture header verbatim.** Diff the top ~50
      lines to zero. If the positioning wording needs to change, that's a separate task via
      `tayari-external-positioning`, not a cleanup.
- [ ] **Collapse the duplicated block to exactly one canonical instance,** placed once in
      the Helm/Kubernetes section where it belongs. Detect duplicates:
      ```bash
      grep -c '^\*\*Kubernetes secret\*\*' README.md   # expect 1 after the fix; today it's ~10
      ```
- [ ] **Repair every fence.** Each code sample must be a clean triple-backtick block with
      its language on the opening fence and nothing fused to the closing fence. Verify the
      fence count is even:
      ```bash
      grep -c '^```' README.md    # must be an EVEN number after the fix
      grep -n '```' README.md     # eyeball: no "accordingly.bash", no orphaned language tags
      ```
- [ ] **Correct stale ports while you're in there** (one home per fact — §5): frontend host
      `8083` (container `80`), Go `8085`, Python `8002`, Caddy `8090`. Replace bare
      `docker compose up -d` with `docker compose --profile dev up -d` (all services are
      profile-gated). Authoritative port/command values: `tayari-build-and-env`,
      `tayari-run-and-operate`.
- [ ] **Do not invent.** If the Helm chart / K8s secret instructions can't be verified
      against a real chart in the repo, keep only what's true and mark the rest clearly, or
      drop it. Do not "tidy" it into confident-sounding fiction.
- [ ] **Re-render / re-read** the file top-to-bottom before claiming done. A corrupted-doc
      fix is only done when the whole file reads clean, not when the diff looks plausible.

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
date prefix, then a short snake_case description (verified pattern 2026-07-08, e.g.
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
- [ ] **Ports/commands correct** against the current stack: host `8083`/`8085`/`8002`/
      `5433`; Ollama host `11435`; `docker compose --profile dev up -d` (never bare).
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

All facts verified against the repo on **2026-07-08**. Volatile facts are date-stamped
inline. Re-verify with these one-liners (run from repo root):

```bash
# README corruption still present (duplicated block should collapse to 1 after a fix)
grep -c '^\*\*Kubernetes secret\*\*' README.md      # ~10 today; target 1
grep -c '^```' README.md                            # fence count must be EVEN once repaired

# Doc-of-record inventory still exists
ls -1 CLAUDE.md .agents/AGENTS.md AGENT_SPEC.md lessons.md DEPLOYMENT.md \
      IMPLEMENTATION_SUMMARY.md PRODUCT_GRILL.md backend/python/README.md backend/go/README.md
ls research/

# Migration naming convention (YYYYMMDD_desc.sql)
ls backend/db/migrations/

# Stale-port claims still in the stale docs (so you know the caveats still apply)
grep -n '4175\|8008\|3005\|54326' lessons.md         # lessons.md OLD parallel-stack ports
grep -n 'localhost:8080\|localhost:8000\|up -d' DEPLOYMENT.md
grep -n '5173' AGENT_SPEC.md                         # legacy Vite dev port

# .agents/AGENTS.md hard rules still worded as quoted in §1a
grep -n 'ONLY be used\|NEVER call the Python\|features.ts\|12-character\|127.0.0.1' .agents/AGENTS.md

# Commit-style reality (mix of "Changes" squashes and feat/fix)
git log --oneline -30
```

If any of these drift — the README gets repaired, a stale doc gets corrected, the migration
naming changes, or a doc's ownership moves — update the corresponding row/section here and
bump the verification date. If the README is fixed, update §2 from "is corrupted" to a
short historical note and point new readers at the clean file.
