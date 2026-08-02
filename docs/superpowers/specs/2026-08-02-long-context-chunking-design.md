# Long-Context Chunking + Parallel Map-Reduce — Design

Date: 2026-08-02. Status: awaiting user review.

## Problem

The Python AI engine head-slices resumes/JDs before LLM calls: ~30 sites across
~15 files use `text[:N]` (e.g. `resume_text[:2500]` in knowledge_graph.py:147,
`resume[:9000]`/`jd[:6000]` in optimizer.py, `resume/jd[:2000]` in
drafter_reviewer.py and interview_prep.py). The tail of long documents is
silently dropped — later jobs, education, skills never reach the LLM.

Scope confirmed with owner: full sweep of LLM context slices. Go backend and
frontend are clean (frontend slices are display-only previews — untouched).
Legitimate truncations (log lines, DB columns, display previews, snippet caps)
stay as-is.

## Design

New module: `backend/python/app/llm/long_context.py`. No changes to
`llm_service.py` (providers are already genuinely async via `httpx.AsyncClient`).

### Components (SOLID + patterns)

- **`Chunker` (protocol, Strategy pattern)** — `chunk(text) -> list[Chunk]`
  where `Chunk = (index, text, source_section)`.
  - `SectionAwareChunker` — splits resumes on section headers
    (`SUMMARY|EXPERIENCE|EDUCATION|SKILLS|PROJECTS|CERTIFICATIONS|...`,
    regex, case-insensitive); splits JDs on paragraph/heading boundaries
    (`\n\n`, `^[A-Z][^.]*\n`-style heading lines); falls back per-section to
    fixed-size when a section still exceeds budget.
  - `FixedSizeChunker(chunk_size=1500, overlap=150)` — deterministic uniform
    fallback when no boundaries exist.
  - `build_chunker(text, kind)` (Factory) — picks section-aware vs fixed.
  - Budgets from env: `LLM_CHUNK_SIZE` (1500), `LLM_CHUNK_OVERLAP` (150) —
    defaults work with zero env.
- **`LongContextClient` (Facade)** — single entry point; depends on an
  `LLMCallable` protocol (`async complete(...)`) that defaults to
  `llm_complete` (DIP: never imports a concrete provider).
  - `async map_only(text, task_prompt, kind, **llm_kwargs) -> list[ChunkResult]`
    — chunk, then map phase; ordered by chunk index.
  - `async map_reduce(text, task_prompt, kind, **llm_kwargs) -> str`
    — map phase + single reduce call with concatenated facts.
  - `run_sync(...)` — `asyncio.run` wrapper for sync callers (threadpool-safe;
    pattern proven by end_to_end_pipeline).
- **`Merger` (Strategy)** — `FactUnionMerger` (analysis tasks: union of
  facts/nodes client-side) and `CondenseAndGenerate` (generation tasks:
  map-reduce). Encapsulates the merge rule so task-specific behavior is
  pluggable without touching the client.

### Data flow

1. Fast path: `len(text) <= LLM_CHUNK_SIZE` → single direct call, byte-identical
   to today. Chunking engages only when over budget.
2. Map: per chunk, `llm_complete(system, extract_prompt + chunk.text, ...)`
   under `asyncio.Semaphore(LLM_MAX_CONCURRENCY=4)` via `asyncio.gather`.
3. Ordering: results collected into an index-ordered list — deterministic
   regardless of completion order.
4. Reduce: `llm_complete(system, task_prompt + "\n\nCONDENSED FACTS:\n" +
   facts_in_order, ...)` with the caller's `max_tokens`/`tier`/`temperature`.
5. Analysis mode: return ordered `ChunkResult`s; caller unions.

### Error handling (honesty preserved)

- Per-chunk failure → `ChunkResult(status="failed", text="")`; others proceed.
- Zero successful chunks → re-raise the underlying error so existing honesty
  paths fire (503 `llm_not_configured`, `draft_source != "llm"`,
  `generation_status="fallback"`). Chunking never fabricates.
- Reduce failure → propagate (same semantics as today's single call).
- Existing per-call timeouts (provider-side, 180s default) unchanged.

### Call-site rollout

Map-reduce (generation):
- `optimizer.py` — initial optimize, reflexion pass-2, humanize, `jd[:6000]`
- `drafter_reviewer.py` — draft/review/revise (5 sites)
- `interview_prep.py` — STAR stories (2 sites)
- `cover_letter.py` — draft + notes (2 sites)
- `automation_engine.py` — cover letter (2 sites)
- `job_agent.py` — profile summary, tailoring, refine (~4 sites)
- `career_ops_evaluator.py` — cover letter (1)
- `interview_ai.py` — (2 sites)

Map-only (analysis):
- `knowledge_graph.py:151` (resume node extraction)
- `strategic_analyzer.py` (2)
- `legitimacy_checker.py` (1)
- `career_ops_evaluator.py` eval (1)
- `embedding_storage.py` — chunk + embed each (standard RAG; store per-chunk)
- `memory_composer.py` — verify whether composed context feeds LLM

Untouched: `communication.py`, `outreach_copilot.py`, `negotiation_copilot.py`,
`followup_tracker.py`, `pattern_analyzer.py`, `agent_router.py`,
`linkedin_analyzer.py`, `live_interview_copilot.py`, `voice_stream.py` (no
input slicing today) + all display/DB/log truncations.

Each call site keeps its system prompt, `tier`, `max_tokens`, `temperature`,
and post-processing; only the input source switches from `text[:N]` to the
client. `# ponytail:` comment at each switched site referencing this spec.

## Testing

- `SectionAwareChunker` — resume with headers → section chunks; JD paragraphs;
  header-less → fixed-size fallback; chunk ≤ budget; overlap; ordering.
- `FixedSizeChunker` — size/overlap/determinism.
- `LongContextClient` with MockProvider — map phase issues N calls, ordered
  results, failed-chunk tolerance, all-failed re-raises, fast path = 1 call.
- Per-call-site integration — existing tests keep passing unchanged (same
  output shape); new long-input cases (resume/JD > budget) produce valid output.
- Gates: `python3 -m py_compile` on all changed files; `python3 -m pytest -q`
  from `backend/python` (369 passed baseline, no new failures).
- No new dependencies (stdlib only). No routes, API, Go, or frontend changes.

## Success criteria

- Every LLM call site that sliced its input uses the client; grep for
  `\[:\d{3,}\]` in `app/llm/` prompt construction returns only legit
  truncations.
- Long documents reach the LLM in full (chunked), outputs stay valid.
- Honesty gates unchanged: mock/absent LLM never produces a passing artifact.

## Out of scope

- Token-budget chunking (needs tokenizer dep — revisit later).
- Go/frontend slicing (none found).
- Async refactor of sync call sites beyond the `run_sync` wrapper.
