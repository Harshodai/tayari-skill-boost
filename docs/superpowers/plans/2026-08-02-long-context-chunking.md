# Implementation Plan: Long-Context Chunking + Parallel Map-Reduce

Date: 2026-08-02. Status: ready for execution.
Spec: `docs/superpowers/specs/2026-08-02-long-context-chunking-design.md` (approved).

## Goal

Replace every LLM-prompt head-slice (`text[:N]` on resume/JD inputs, ~20 sites in
11 files) with chunking + parallel map-reduce via a new `LongContextClient`.
Long documents reach the LLM in full; outputs stay valid; honesty gates unchanged.

## Approach

1. New module `backend/python/app/llm/long_context.py` (stdlib only):
   - `Chunk` / `ChunkResult` dataclasses, `Chunker` protocol, `SectionAwareChunker`
     (resume header regex / JD paragraph regex, fixed-size fallback for oversized
     sections), `FixedSizeChunker(1500/150)`, `build_chunker(text, kind)` factory.
   - `LLMCallable` / `LLMJsonCallable` protocols (DIP) with `DefaultLLMCallable`
     wrapping `llm_complete` / `llm_json`.
   - `LongContextClient` facade: `condense`, `map_only`, `map_reduce`,
     `map_reduce_json`; `asyncio.Semaphore(LLM_MAX_CONCURRENCY=4)` +
     `asyncio.gather`; results reordered by chunk index; fast path
     (`len(text) <= LLM_CHUNK_SIZE`) = one direct call, byte-identical to today.
   - Error handling: per-chunk failure → `status="failed"`, others proceed; zero
     successful chunks → re-raise first error (honesty gates fire); reduce
     failure propagates.
   - Env: `LLM_CHUNK_SIZE` (1500), `LLM_CHUNK_OVERLAP` (150), `LLM_MAX_CONCURRENCY`
     (4) — defaults work with zero env.
2. Call-site conversion pattern (each site keeps its system prompt, tier,
   max_tokens, temperature, post-processing): long input → template placeholder
   `{LONG_TEXT}`; secondary long input (JD) → `await client.condense(jd, "jd")`
   inlined into the template. `# ponytail: chunked via long_context (spec 2026-08-02)`
   at each switched site.
3. Map-only sites: `map_only` per chunk + in-site union (dedupe by value).

## Change Policy

- No new dependencies (stdlib only). No routes, API, Go, or frontend changes.
- No changes to `llm_service.py` (providers already async via httpx.AsyncClient).
- Existing tests must pass unchanged (short inputs hit the fast path).
- New code: classes per spec (SOLID + patterns), module docstring, `__main__`
  self-check (house style).
- Commit after each task; push only after the final gate.
- `# ponytail:` one-line justification on every switched site.

## Files / Structures

- NEW `backend/python/app/llm/long_context.py` — chunkers + factory + protocols + client.
- NEW `backend/python/tests/test_long_context.py` — unit tests (FakeLLM).
- EDITED (slice sites): `app/services/optimizer.py`, `drafter_reviewer.py`,
  `interview_prep.py`, `cover_letter.py`, `automation_engine.py`, `job_agent.py`,
  `career_ops_evaluator.py`, `interview_ai.py`, `knowledge_graph.py`,
  `legitimacy_checker.py`, `app/llm/strategic_analyzer.py`.
- Test surfaces re-run per task: `test_knowledge_graph.py`, `test_drafter_reviewer.py`,
  `test_interview_prep.py`, `test_job_agent_hermes.py`, `test_career_ops_evaluator.py`,
  `test_legitimacy_and_hermes.py`, `test_automation_beat.py`, `test_phase18_adaptations.py`,
  `test_ai_routes_resilience.py`, `test_end_to_end_pipeline.py`.

## Tasks

### Task 1: long_context.py — chunkers + factory + client (core)

Preconditions: none. Spec §Components + §Data flow + §Error handling.

TODO:
- [ ] `app/llm/long_context.py`:
  - [ ] `Chunk(index, text, source_section)`, `ChunkResult(index, status, text)`.
  - [ ] `Chunker` Protocol (`chunk(text) -> list[Chunk]`).
  - [ ] `RESUME_HEADER_RE`: `(?im)^\s*(SUMMARY|OBJECTIVE|PROFILE|EXPERIENCE|EMPLOYMENT|WORK HISTORY|EDUCATION|SKILLS|TECHNICAL SKILLS|PROJECTS|CERTIFICATIONS?|AWARDS|PUBLICATIONS|LANGUAGES|INTERESTS|ACTIVITIES|REFERENCES)\s*[:#]?\s*$`.
  - [ ] `JD_BOUNDARY_RE`: blank-line paragraphs + heading-like lines
        (`(?m)(\n\n+|\n(?=[A-Z][A-Z0-9 .\-\/]{2,60}:?\n))`).
  - [ ] `SectionAwareChunker(split_re, chunk_size, overlap)` — boundary split;
        sections ≤ budget kept whole; oversized section → fixed-size split
        (source_section carried); no boundary matches → whole-doc fixed-size.
  - [ ] `FixedSizeChunker(chunk_size, overlap)` — deterministic, overlap tail of
        previous chunk; no chunk empty; last chunk never < 1 char.
  - [ ] `build_chunker(kind, chunk_size=None, overlap=None)` — "resume" →
        SectionAwareChunker(RESUME_HEADER_RE), "jd" → SectionAwareChunker(JD_BOUNDARY_RE),
        else FixedSizeChunker.
  - [ ] `LLMCallable` / `LLMJsonCallable` protocols; `DefaultLLMCallable` (lazy
        import of `llm_complete`/`llm_json` inside methods).
  - [ ] `CONDENSE_SYSTEM` (verbatim fact extraction: "copy exactly as written,
        do not paraphrase, add, or invent") + `CONDENSE_TEMPLATE`
        (`"Extract all facts from this document chunk.\n\nCHUNK:\n{LONG_TEXT}"`).
  - [ ] `LongContextClient(chunker_factory=build_chunker, llm=None, llm_json=None,
        max_concurrency=MAX_CONCURRENCY)`:
    - `condense(text, kind) -> str` — fast path returns text; else map +
      ordered join (no reduce call).
    - `map_only(text, extract_template, kind, system, **llm_kwargs) ->
      list[ChunkResult]` — per-chunk `extract_template.format(LONG_TEXT=chunk.text)`;
      ordered; failures `status="failed"`, `text=""`; zero ok → re-raise first error.
    - `map_reduce(text, template, kind, system, **llm_kwargs) -> str` — fast
      path: `llm.complete(system, template.format(LONG_TEXT=text), ...)`;
      else map with CONDENSE prompts → `template.format(LONG_TEXT=joined_facts)`
      → single reduce with caller's tier/max_tokens/temperature.
    - `map_reduce_json(...) -> BaseModel` — same, reduce via `llm_json` with
      `response_model`.
    - semaphore bounds map-phase concurrency; gather preserves order by index.
  - [ ] Module docstring (SRP/DIP notes per house style) + `__main__` self-check
        (chunker determinism, fast path identity, no-llm re-raise) — headless runnable.
- [ ] `python3 -m py_compile app/llm/long_context.py`
- [ ] `python3 app/llm/long_context.py` (self-check)
- [ ] Commit: `feat: long-context chunking + parallel map-reduce client`

Acceptance: chunker bounds honored (every chunk ≤ budget except lone short docs);
overlap ≥ 0; fast path returns input unchanged (no LLM call — FakeLLM counts calls).

### Task 2: test_long_context.py

Preconditions: Task 1.

TODO:
- [ ] FakeLLM: records calls, returns configurable text / raises, counts calls.
- [ ] Chunker tests: resume headers → section chunks in order; JD paragraphs;
  header-less → fixed-size; oversized section split; chunk ≤ chunk_size; overlap
  present on multi-chunk splits; determinism (two calls identical).
- [ ] Client tests: fast path = exactly 1 call, output == FakeLLM output;
  map_reduce on long input = N map + 1 reduce, reduce template contains all
  facts in chunk order; failed chunk tolerated (reduce gets only ok facts);
  all-failed re-raises (LLMNotConfiguredError-shaped); map_only ordering +
  statuses; condense = no reduce call.
- [ ] Run: `python3 -m pytest tests/test_long_context.py -q`
- [ ] Commit: `test: long-context chunker + client unit tests`

Acceptance: new suite green; no existing suite touched yet.

### Task 3: knowledge_graph.py (map-only + union)

Preconditions: Tasks 1-2.

TODO:
- [ ] Replace `resume_text[:2500]` prompt (line ~147) with
  `client.map_only(resume_text, extract_template=EXTRACTION_TEMPLATE_WITH_LONG_TEXT,
  kind="resume", system=current_extraction_system, tier="smart", max_tokens=600,
  temperature=0.3)` — same extraction schema/validation per chunk.
- [ ] In-site union (FactUnionMerger): for each schema field (skills, projects,
  education, experiences, certifications, languages) extend + dedupe (case-insensitive
  by value) preserving first-seen order.
- [ ] Keep line 101 `line[:200]` (local extraction) untouched.
- [ ] `python3 -m py_compile app/services/knowledge_graph.py`
- [ ] `python3 -m pytest tests/test_knowledge_graph.py -q`
- [ ] Commit: `feat: knowledge_graph extraction via chunked map-only`

Acceptance: existing 3 tests pass (incl. user's WIP edits); chunked path returns
union with no duplicates.

### Task 4: optimizer.py (initial optimize + reflexion + humanize)

Preconditions: Tasks 1-2.

TODO:
- [ ] Initial optimize (llm_json, line ~454): `resume[:9000]` → `{LONG_TEXT}` +
  `map_reduce_json` (`OptimizedResumePayloadSchema`, tier smart, keep max_tokens);
  `jd[:6000]` → `condense(jd, "jd")` inlined.
- [ ] Reflexion pass-2 (llm_json, line ~499): same conversion for
  `optimized_text[:9000]` + condensed jd.
- [ ] Humanize (llm_complete, line ~222): `optimized_text[:8000]` →
  `map_reduce` (tier smart, keep max_tokens=3000).
- [ ] Keep `target_role[:120]`, `job_label[:160]`, `clean[:80]` (legit short
  fields) untouched.
- [ ] `python3 -m py_compile app/services/optimizer.py`
- [ ] `python3 -m pytest tests/test_phase18_adaptations.py tests/test_ai_routes_resilience.py -q`
- [ ] Commit: `feat: optimizer long-context via chunked map-reduce`

Acceptance: short-input tests unchanged; long resume (> budget) produces
valid `OptimizedResumePayloadSchema` output in tests with FakeLLM-style wiring.

### Task 5: drafter_reviewer.py (draft/review/revise)

Preconditions: Tasks 1-2.

TODO:
- [ ] Draft (line ~144): resume → `map_reduce` (`{LONG_TEXT}`), jd →
  `condense(jd, "jd")` in the draft prompt template.
- [ ] Review: `_build_review_prompt` (line ~76) jd[:2000] → condensed jd inlined.
- [ ] Revise: `_build_revision_prompt` (lines ~91/94) resume+jd slices → same
  pattern (resume is the LLM draft there — keep map_reduce if over budget,
  which it is when the draft is long).
- [ ] `python3 -m py_compile app/services/drafter_reviewer.py`
- [ ] `python3 -m pytest tests/test_drafter_reviewer.py -q`
- [ ] Commit: `feat: drafter/reviewer long-context via chunked map-reduce`

Acceptance: existing drafter tests pass; draft/review/revise produce valid output
for long resume+JD.

### Task 6: interview_prep.py + interview_ai.py

Preconditions: Tasks 1-2.

TODO:
- [ ] `interview_prep.py` `_build_prep_prompt` (lines ~66/69): resume[:2000] →
  `map_reduce` (`{LONG_TEXT}`), jd[:2000] → `condense(jd, "jd")`. Keep `_parse_prep_json`
  untouched. Run `tests/test_interview_prep.py`.
- [ ] `interview_ai.py` `_technical` (line ~124) + `_system_design` (line ~147):
  `job_description[:1000]` → `condense(jd, "jd")`. Keep `_extract_bullets`
  `line[:160]` (local regex) untouched.
- [ ] `python3 -m py_compile` both; run `tests/test_interview_prep.py`
- [ ] Commit: `feat: interview prep + interview AI long-context`

Acceptance: prep tests pass; `condense` fast path (jd ≤ 1500) is a behavior
superset of the old 1000-char cap — benign.

### Task 7: cover_letter.py + automation_engine.py

Preconditions: Tasks 1-2.

TODO:
- [ ] `cover_letter.py` generate (lines ~29/32): jd[:2000] → `condense`,
  resume[:3000] → `map_reduce`. Keep `notes[:500]` (short field) + `bullet_refs`
  line-level caps.
- [ ] `automation_engine.py` `_cover_letter` (lines ~218/220): resume[:5000] →
  `map_reduce`, jd[:2500] → `condense` (tier fast preserved).
- [ ] `python3 -m py_compile` both; `python3 -m pytest tests/test_automation_beat.py tests/test_phase18_adaptations.py -q`
- [ ] Commit: `feat: cover letter + automation long-context`

Acceptance: cover-letter outputs unchanged shape; automation tests pass.

### Task 8: job_agent.py + career_ops_evaluator.py

Preconditions: Tasks 1-2.

TODO:
- [ ] `job_agent.py` `derive_query` (line ~80): resume[:2000] → `map_reduce`
  (tier fast preserved; `[:60]` output cap stays). Do NOT touch
  `_candidate_summary`/`_candidate_text` (embeddings, not LLM).
- [ ] `career_ops_evaluator.py` eval (lines ~90/97): resume[:4000] →
  `map_reduce_json` (EVALUATION contract), description[:4000] → `condense(jd)`.
  Cover (line ~128): resume[:2000] → `map_reduce`.
- [ ] `python3 -m py_compile` both; `python3 -m pytest tests/test_job_agent_hermes.py tests/test_career_ops_evaluator.py -q`
- [ ] Commit: `feat: job agent + career ops evaluator long-context`

Acceptance: hermes + evaluator tests pass.

### Task 9: legitimacy_checker.py + strategic_analyzer.py

Preconditions: Tasks 1-2.

TODO:
- [ ] `legitimacy_checker.py` (line ~116): description[:4000] →
  `map_reduce_json` (its response schema; tier fast). Keep the on-error fallback
  dict. Run `tests/test_legitimacy_and_hermes.py`.
- [ ] `strategic_analyzer.py` (own httpx, lines ~18-34): implement
  `_StrategicLLMCallable` (LLMCallable protocol — posts the same payload to
  LLM_API_URL with LLM_API_KEY, returns content) and drive its prompt through
  `client.condense(jd, "jd")` + `client.map_reduce(resume, template)` with the
  custom callable; keep `_fallback_analysis` and optional-LLM semantics.
- [ ] `python3 -m py_compile` both
- [ ] Commit: `feat: legitimacy + strategic analyzer long-context`

Acceptance: legitimacy tests pass; strategic analyzer falls back identically
when LLM absent (no new errors).

### Task 10: sweep + full-suite gate + docs

Preconditions: Tasks 3-9.

TODO:
- [ ] Sweep: `rg '\[:\d{3,}\]' app/` — remaining matches must be only legit
  truncations (logs, DB columns, display previews, local parsers, short-field
  caps, memory_composer budget). List them in the commit message.
- [ ] `python3 -m py_compile` on every changed file.
- [ ] Full suite: `python3 -m pytest -q` — baseline 369 passed / 3 skipped
  (network), zero new failures; `test_knowledge_graph` 3/3.
- [ ] `git status` clean except intended files; commit any stragglers.
- [ ] Update spec status line: `awaiting user review` → `implemented 2026-08-02`.
- [ ] Commit: `docs: long-context chunking implemented (sweep + full suite green)`

Acceptance: grep proof + full suite green + spec closed.

## Definition of Done

- `rg '\[:\d{3,}\]' app/` shows only legit truncations (enumerated in Task 10).
- Every LLM call site from the spec's verified inventory uses the client.
- Full pytest suite green (369 passed baseline, no new failures).
- Honesty gates unchanged: mock/absent LLM never produces a passing artifact.
- All commits pushed to `origin/main` after final gate (user confirmation).
