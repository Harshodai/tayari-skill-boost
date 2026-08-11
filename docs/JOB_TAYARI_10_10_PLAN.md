# Job Tayari → 10/10: Agent-Ready Execution Plan

Companion to `docs/JOB_TAYARI_RUTHLESS_AUDIT_2026.md`.
Every workstream below is written to be handed to an autonomous coding agent verbatim.

---

## 0. The thesis (read this before writing any code)

The market evidence is unambiguous: **volume auto-apply kills companies** (Sonara shut down;
Zapply's founder shut himself down after beating Greenhouse's bot protection; LazyApply sits at
2.2/5 with documented LinkedIn bans; Robert Half Mar-2026: 67% of HR leaders say AI applications
are *slowing hiring down*; Greenhouse's CEO calls it an "AI doom loop").

Meanwhile **nobody** — not Teal, Huntr, Simplify, Jobscan, Careerflow, LazyApply, or AIHawk —
ships any of these:

1. Cryptographic-grade **proof of submission** (confirmation number + screenshot + submitted artifact)
2. An **outcome funnel** (response / interview / offer rate by company, role, resume version)
3. **Honest ATS tiering** (full-auto only where tolerated; assisted-only where detection is real)
4. A **blocking human-answer queue** so the agent never invents a compliance answer under your name
5. **Self-throttling by design**, sold as a feature, because recruiters now penalize AI-volume patterns
6. A **boomerang mode** that survives the user getting hired

Job Tayari should be positioned as **"the only job agent that can prove what it did."**
That is the 10/10. "Applies to 500 jobs" is the 2/10 that ends in a ban wave.

---

## 1. Priority stack

| P | Workstream | Why now |
|---|---|---|
| **P0** | Truth in status (no fake "applied") | Shipping a lie users act on. *(Partially fixed: `src/lib/automation/applyChain.ts` now writes `saved`.)* |
| **P0** | Hard server-side approval gate on `auto_apply` | A `job_watches` row can submit without any human ever seeing the resume |
| **P0** | Copy/brand cleanup: one name, kill "Hermes", delete fabricated testimonials | Legally and reputationally indefensible |
| **P1** | Submission Receipt system | The #1 differentiator nobody has |
| **P1** | Wire the live browser view that already exists | Manus-grade UI is built and unreachable |
| **P1** | Consume onboarding `transition_type` in ranking + optimizer | Data collected, ignored |
| **P1** | Human-Answer Queue for ambiguous ATS fields | Prevents the AIHawk failure mode |
| **P2** | Omnisave: real ingest + real vector RAG | Embedding stack exists, is never called |
| **P2** | Kill two orphan pipelines, keep one | 3 engines, 1 in use |
| **P2** | Move browser runs onto Browserbase / Browser Use | Real isolation + kill switch, without building a sandbox |
| **P3** | Outcome funnel dashboard | Retention + the honest marketing asset |
| **P3** | ATS tolerance tiering | Survival against detection hardening |
| **P4** | Boomerang mode | Fixes the structural LTV cap |

---

## 2. Agent-ready workstream specs

Each spec is self-contained. Hand one block to one agent.

### WS-01 — Server-side approval gate (P0)

```
GOAL: No application may be submitted without a recorded human approval of the exact
      tailored resume text that gets sent.

FILES:
  backend/python/app/services/automation_engine.py:387-410
  backend/python/app/tasks/automation.py:64-81
  supabase migration (new table)

DO:
  1. Create table `application_approvals`:
     id uuid pk, user_id uuid not null, run_id text not null, job_url text,
     resume_sha256 text not null, approved_at timestamptz, approved_by uuid,
     decision text check (decision in ('pending','approved','rejected')) default 'pending'
     + GRANT SELECT,INSERT,UPDATE ON ... TO authenticated; GRANT ALL TO service_role;
     + RLS: user_id = auth.uid()
  2. In automation_engine.py, before ANY call into browser_library.apply_job:
     - compute sha256 of the tailored resume text
     - look up an `approved` row for (user_id, run_id, resume_sha256)
     - if absent: write a `pending` row, set status='awaiting_approval', RETURN. Never submit.
  3. In tasks/automation.py:64-81, strip `auto_apply` out of any config loaded from
     `job_watches`. auto_apply may only ever be set by an approval row, never by stored config.
  4. Add pytest: a job_watches row with auto_apply=true must NOT reach apply_job.

DONE WHEN: python -m pytest backend/python passes and the new test fails if the guard is removed.
```

### WS-02 — Submission Receipts (P1, the differentiator)

```
GOAL: Every submission produces an immutable, user-visible receipt. Silent failure
      becomes structurally impossible.

DO:
  1. Table `submission_receipts`: id, user_id, application_id, job_url, ats_vendor,
     submitted_at, confirmation_text, confirmation_number, screenshot_path (storage),
     submitted_resume_sha256, answers_jsonb, outcome text default 'unknown'.
     Storage bucket `receipts` (private, RLS by user_id prefix).
  2. In backend/python/app/services/browser_library.py apply_job(): after submit,
     capture page.screenshot() + page text; regex for confirmation patterns
     (/application (received|submitted)/i, /reference (number|id)[: ]*([A-Z0-9-]{4,})/i).
     If NO confirmation evidence is found -> status = 'submitted_unverified', never 'applied'.
  3. UI: src/components/pipeline/PipelineCard.tsx — badge states
     Saved | Prepared | Submitted (verified) | Submitted (unverified) | Interview | Offer | Rejected.
     Clicking a verified badge opens the receipt (screenshot + confirmation number).

DONE WHEN: an application card can never read "Applied" without a receipt row.
```

### WS-03 — Wire the live browser view (P1)

```
GOAL: The Manus-grade live view that already exists becomes reachable.

FILES: src/pages/ApplyAgent.tsx:122, src/components/agent/AgentLiveView.tsx:204-258,
       src/api/browser.ts, backend/python/app/services/browser_automation/agent.py:245-318

DO:
  1. Pass `browserInstruction` from ApplyAgent.tsx into <AgentLiveView/> so streamBrowserAgent runs.
  2. Add a "Take over" button: pauses the agent, surfaces the current step's question
     to the Human-Answer Queue (WS-05), resumes on answer.
  3. Add a real Stop control wired to WS-06's kill switch.
  4. Label the feed honestly: "step screenshots, not video".

DONE WHEN: starting a run on /apply-agent shows live screenshots + a step timeline + Stop.
```

### WS-04 — Make onboarding actually change behaviour (P1)

```
GOAL: same_domain vs cross_domain must produce visibly different output.

DO:
  1. Go: include transition_type/current_industry/target_industry/transferable_skills in
     the profile payload forwarded to Python (backend/go/internal/api/routes_mvp.go).
  2. optimizer.py:437 — branch the prompt:
       same_domain  -> emphasise depth, seniority signals, scope/impact escalation
       cross_domain -> emphasise transferable skills, reframed domain vocabulary,
                       an explicit "why this switch" narrative line
  3. Ranking: job_agent.smart_search — for cross_domain, down-weight exact-title match and
     up-weight skill-overlap; for same_domain, invert.
  4. Add a visible chip in ResumeResults: "Optimised for a cross-domain move".

DONE WHEN: the same resume+JD yields materially different output across the two modes.
```

### WS-05 — Human-Answer Queue (P1)

```
GOAL: The agent NEVER invents an answer to a factual/compliance question.

DO:
  1. Table `agent_questions`: id, run_id, user_id, field_label, field_type, options_jsonb,
     answer text, answered_at, status ('pending'|'answered'|'skipped').
  2. In sandbox_executor.py form-fill: classify each unmapped field. If it matches
     /sponsorship|authoriz|visa|salary|years of experience|criminal|disabilit|veteran/i
     -> ALWAYS enqueue, never infer, even if the profile has a plausible value.
  3. Agent blocks on pending questions (with timeout -> abandon run, not guess).
  4. Answers persist to a reusable answer bank keyed by normalized field_label.
  5. UI: badge on the live view + a /questions inbox.

DONE WHEN: a Workday visa question halts the run and appears in the inbox.
```

### WS-06 — Real isolation + kill switch (P2)

```
GOAL: Replace the fake "sandbox" with real per-run isolation and a working stop.

DECISION: do NOT build a sandbox. Use Browserbase (session replay + live view built in,
          $20/$99 tiers) or Browser Use browser infra ($0.02/browser-hour).

DO:
  1. Introduce a BrowserSession provider interface in
     backend/python/app/services/browser_automation/ with two impls: local Playwright (dev)
     and remote (prod). Select via BROWSER_PROVIDER env.
  2. One remote session per run. Session id stored on agent_runs.
  3. Kill switch: a 'cancel' transition on agent_runs must terminate the remote session
     (poll cancellation inside the agent loop AND call the provider's session-terminate API).
  4. Rename sandbox_executor.py -> form_filler.py; it is not a sandbox and must stop claiming to be.

DONE WHEN: cancelling a run in the UI provably ends the remote browser session.
```

### WS-07 — Omnisave: real ingest + real retrieval (P2)

```
DO:
  1. Delete the hardcoded demo cards (src/pages/Omnisave.tsx:20-60). Ship a real empty state.
  2. Ingest, in order of effort:
     - Substack: RSS (<publication>/feed) — no OAuth needed. Ship first.
     - Medium: RSS (medium.com/feed/@user) + user-exported reading list.
     - LinkedIn: NO saved-items API exists. Do not fake it — support the official
       data export (Saved Items CSV) upload instead, and say so in the UI.
  3. Kill the recency "RAG": populate the embedding column at insert
     (omnisave_service.py:126) via embedding_service.py, and change query_knowledge_rag:502
     to pgvector cosine top-k. The stack already exists and is unused.
  4. Real auto-tagging: one LLM call at ingest returning {topics[], entities[], one_line_summary}.
     Replace the hardcoded "Career Strategy" (:200) and template bullets (:245-248).
  5. Keep _answer_is_grounded (:573-598) — it is the best code in that file.

DONE WHEN: asking a question returns citations from semantically relevant posts, not the newest ones.
```

### WS-08 — Delete the orphan pipelines (P2)

```
Three engines exist; one runs.
  KEEP:   automation_engine.py (it is the one Celery actually calls)
  MERGE:  end_to_end_pipeline.py's guardrails (ghost-job check, semantic role match,
          ATS fit, drafter-reviewer, ontology guard) INTO automation_engine.py
  MERGE:  autopilot_graph.py's fact-checking (_claims_supported, _verified_contact)
          into the quality gate
  DELETE: both files afterwards, plus backend/python/app/services/resume_parser.py (dead)
DONE WHEN: grep finds no unreferenced pipeline engines.
```

### WS-09 — Copy & trust cleanup (P0, one afternoon)

```
1. One brand string, everywhere: "Job Tayari". Fix Footer.tsx:31-34,125.
2. Purge "Hermes" from all user-facing surfaces: HeroSection.tsx:64, Settings.tsx:822-883,
   AgentPanel.tsx:340-619, ActivityButton.tsx. Rename /api/v1/hermes/* -> /api/v1/agent/*
   (keep the old path as an alias — route parity rule in CLAUDE.md).
3. Delete the fabricated testimonials (SocialProofSection.tsx:20-22) and the unsourced
   "2.5x" claim (FAQSection.tsx:27). Replace with live DB counts only, or nothing.
4. Audit the 70 routes in src/App.tsx: add route-entry analytics, then delete or merge
   anything with zero entries after two weeks.
```

### WS-10 — Outcome funnel + boomerang (P3/P4)

```
Funnel: from submission_receipts + Gmail classifier stages, compute per-user
  applications -> responses -> interviews -> offers, sliced by company, role, resume version.
  Surface as /outcomes. This is the retention hook AND the only honest marketing asset
  you will ever have ("median user: 6 applications -> 2 responses").
Boomerang: after 'offer'/'hired', switch the account to a free monitoring mode —
  market-rate tracking for their title, quarterly skill-gap delta, passive role alerts.
  Fixes the structural LTV cap that kills every tool in this category.
```

---

## 3. The subagent runner (drop-in)

`scripts/run_workstreams.ts` — fan the specs above out to parallel agents.

```ts
// bun run scripts/run_workstreams.ts WS-01 WS-02 WS-03
import { readFileSync } from "node:fs";

const PLAN = readFileSync("docs/JOB_TAYARI_10_10_PLAN.md", "utf8");

/** Pull one ```-fenced spec block out of the plan by its WS id. */
function extractSpec(id: string): string {
  const re = new RegExp(`### ${id}[^\\n]*\\n+\`\`\`([\\s\\S]*?)\`\`\``);
  const m = PLAN.match(re);
  if (!m) throw new Error(`No spec block for ${id}`);
  return m[1].trim();
}

const SYSTEM = `You are a senior engineer on the Job Tayari monorepo.
Rules (from CLAUDE.md, non-negotiable):
- Go = routing/auth/CRUD only. Python = all AI/LLM/scraping/async work.
- Frontend never calls Python directly; everything goes through the Go gateway.
- Every /api/... route needs a /api/v1/... alias and vice versa.
- Never call fetch('/api/v1/...') in React; use apiFetch('/v1/...') from @/api.
- Every CREATE TABLE in public needs GRANTs + RLS in the same migration.
- Run 'python -m py_compile' on changed Python and 'bunx tsc --noEmit -p tsconfig.app.json'
  on changed TS before declaring done.
- Append a dated entry to lessons.md describing root cause, fix, and reusable lesson.
Never fabricate success: if a step cannot be completed, say so explicitly.`;

const ids = process.argv.slice(2);
if (!ids.length) throw new Error("usage: run_workstreams.ts WS-01 [WS-02 ...]");

// Each workstream is independent by construction — run them concurrently.
const results = await Promise.allSettled(
  ids.map(async (id) => {
    const spec = extractSpec(id);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": process.env.LOVABLE_API_KEY!,
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        input: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Workstream ${id}. Implement exactly this spec:\n\n${spec}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
    return { id, output: await res.json() };
  }),
);

for (const r of results) {
  console.log(r.status === "fulfilled" ? `✅ ${r.value.id}` : `❌ ${r.reason}`);
}
```

For the Lovable agent itself, the equivalent is one `spawn_agent` per workstream:

```
spawn_agent({
  model: "capable",
  user_facing_name: "Implement WS-02 receipts",
  system_prompt: <SYSTEM above>,
  task: <the WS-02 fenced block, verbatim>,
})
```

Fan out P0s first (WS-01, WS-09), then P1s (WS-02, WS-03, WS-04, WS-05) in parallel — they
touch disjoint files. WS-06 must land before WS-02's screenshot capture is production-safe.

---

## 4. Competitive evidence appendix

| Tool | 2026 price | Does it submit? | Weakness |
|---|---|---|---|
| Teal | $13/wk | No | Weekly-billing backlash |
| Huntr | Free/Pro | No (autofill) | No intelligence layer |
| Simplify | Free + Jobs Bot | **No** — autofill only | ~70% accuracy on Workday |
| Jobscan | $49.95/mo | No | Single-purpose scanner |
| LazyApply | $99/yr | Yes | 2.2–2.4/5, LinkedIn bans |
| AIHawk (OSS) | Free | Yes | Business Insider: factual inaccuracies sent under your name |
| Sonara | Sub | Yes | **Shut down 2024**; relaunch still 25–40% silent failure |
| Careerflow | $23.99/mo | No | Shallow across everything |
| Final Round AI | $25–90/mo | n/a | Press-branded a "cheating tool" |
| Interview Warmup | Free | n/a | **Discontinued Apr 2026** |

Agent infra: Browserbase (Free/$20/$99, session replay + live view) · Browser Use
($0.02/browser-hour) · Anthropic computer-use (you own the VM) · OpenAI agent product
**killed twice** — use the raw API primitive only.

ATS reality: no major vendor (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable)
offers a sanctioned third-party submission API. Listing endpoints are open; submission is
reverse-engineering with real ToS exposure.

---

## 5. Will this be profitable? — the honest answer

**As a volume auto-apply bot: no.** That is a documented graveyard (Sonara, Zapply, Gradus,
Resume Smashers, FUJM) with a hardening arms race, ban risk, and recruiter backlash on top of
a structurally capped LTV.

**As the proof-and-signal layer: yes, and it is defensible.** Teal, Huntr, and Careerflow prove
people pay $13–24/mo for organization alone. Job Tayari can charge more because it does the
tailoring *and* proves the outcome — and receipts, an outcome funnel, honest ATS tiering, and a
human-answer queue are genuinely unowned. Nobody in the matrix has any of them.

Confidence that the product *can* be 10/10 on the plan above: **9/10.**
Confidence that a volume auto-apply positioning succeeds: **2/10.**
The difference between those two numbers is the entire strategy.
