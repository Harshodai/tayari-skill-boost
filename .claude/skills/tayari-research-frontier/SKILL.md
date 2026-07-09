---
name: tayari-research-frontier
description: >-
  Open problems where Tayari Skill Boost could advance the state of the art, each with why
  current SOTA falls short, the specific asset THIS repo already has, the first three
  concrete steps IN THIS REPO, and a falsifiable "you have a result when…" milestone. Load
  when scoping a research-grade improvement, deciding what's worth publishing, or turning the
  "our quality signal is unproven" gap into a concrete program. Not for routine features
  (use the core skills) — this is the frontier. Facts verified 2026-07-08.
---

# Tayari Research Frontier

Where this project could do something genuinely new — not "add a feature," but "produce a
result the field doesn't have." Each frontier problem is framed so a mid-level engineer can
start Monday: **why SOTA is insufficient → the repo's specific asset → first 3 steps here → a
falsifiable milestone.**

"Advance the state of the art" here does NOT mean a bigger model. It means: a self-hostable,
zero-marginal-cost job-prep pipeline that is **measurably** honest and effective, with the
evidence to prove it. Every program below routes results through `tayari-research-methodology`
(the evidence bar) and lands changes via `tayari-change-control`.

---

## F1 — An open ground-truth benchmark for resume↔JD fit

- **Why SOTA falls short.** ATS vendors are closed; there is no public dataset mapping
  (resume, JD) → real screening outcome. Everyone (including Tayari) scores against proxies
  and *asserts* they matter.
- **This repo's asset.** A working eval harness (`eval/runner.py`), a deterministic
  `heuristic_ats_score`, TF-IDF similarity, and guardrails — i.e. a scaffold to *validate a
  proxy against a label* the moment labels exist.
- **First 3 steps here.**
  1. Extend `eval/datasets/` with a labeled set: (resume, JD) → an independent judge score
     (real ATS export where obtainable, else a fixed LLM-as-judge with a committed rubric, or human labels).
  2. Add a runner that computes rank correlation (Spearman ρ) between `heuristic_ats_score` and the label.
  3. Pre-register the ρ you'd accept as "the heuristic is a valid proxy."
- **You have a result when…** you report ρ on ≥30 labeled pairs, with the engine + dataset +
  judge pinned, and can state whether the heuristic is a valid proxy or merely a formatting linter.
- **Cross-ref.** `tayari-quality-signal-campaign` Phase 3, Solution S4.

---

## F2 — Self-hostable semantic matching that beats TF-IDF without bloat

- **Why SOTA falls short.** Strong semantic matching normally means large embedding models /
  hosted APIs. Tayari deliberately uses stdlib TF-IDF (no scikit-learn/sentence-transformers)
  to keep the image small and local — at the cost of missing synonymy.
- **This repo's asset.** An `embedding_service` + `embedding_storage` (pgvector) already exist,
  and the ranking pipeline (`job_agent`) already fuses lexical + semantic via RRF with graceful
  degradation.
- **First 3 steps here.**
  1. Route `semantic_similarity_score` through a *small* local embedding model behind the
     existing `embedding_service`, keeping TF-IDF as the fallback (mirror the RRF degrade pattern).
  2. Measure the synonym-pair delta (`tayari-proof-and-analysis-toolkit` Recipe 2) and the image-size cost.
  3. A/B the two similarity backends on the F1 benchmark.
- **You have a result when…** you show, on the golden set, that the embedding backend raises
  correlation-with-labels by a stated margin while keeping the image under a stated size budget
  (the constraint that motivated TF-IDF originally — `lessons.md`).

---

## F3 — Verifiable truthfulness for AI-rewritten resumes

- **Why SOTA falls short.** "Don't hallucinate" is unsolved generally; resume rewriting is a
  crisp, checkable slice (facts = employers/titles/dates/degrees that must be preserved).
- **This repo's asset.** `check_truthfulness` (fact-drift detection) + `validate_master_alignment`
  (fabricated skills/certs) already encode the invariant — and there's a known gap: truthfulness
  is skipped when `original_text` is absent.
- **First 3 steps here.**
  1. Build an adversarial dataset: truthful rewrites + deliberately fabricated ones (invented
     degrees/dates/employers), committed under `eval/datasets/`.
  2. Measure detection precision/recall of `check_truthfulness` on it.
  3. Close the skip-when-no-original gap (Solution S3) and re-measure.
- **You have a result when…** you report detection precision/recall on ≥40 labeled rewrites and
  show the fixed pipeline catches fabrications the old path let through.

---

## F4 — Can a local LLM match a hosted one for resume optimization?

- **Why SOTA falls short.** The assumption is "local models are too weak for production prose."
  Rarely measured on a *specific, gated* task with a reflexion loop.
- **This repo's asset.** A provider abstraction that swaps Ollama/OpenRouter/NIM behind one
  interface, plus the reflexion loop that can compensate for a weaker generator via critique.
- **First 3 steps here.**
  1. Fix the golden set + an independent judge (F1).
  2. Run `optimize_with_reflection` with a local model (e.g. `hermes3:8b`) vs a hosted model;
     hold everything else constant.
  3. Report judge-score distributions and `refinement_passes` for each.
- **You have a result when…** you can state the quality gap (if any) between local and hosted on
  the same gated task, with reproducible numbers — turning "self-hosted quality parity" from
  CANDIDATE toward PROVEN (`tayari-external-positioning`).

---

## F5 — Observable reliability of keyless multi-tier scraping (Hermes)

- **Why SOTA falls short.** Job-board scraping breaks silently; most tools give no reliability signal.
- **This repo's asset.** Tiered providers (A keyless ATS JSON → D Crawl4AI) with per-provider
  `CircuitBreaker` state (CLOSED/OPEN/HALF_OPEN) and a `scraped_jobs` cache.
- **First 3 steps here.**
  1. Emit per-provider success/latency/breaker-state metrics from the orchestrator.
  2. Run the keyless tier daily and record a time series.
  3. Surface it (Flower already observes Celery; add a scraper-health view).
- **You have a result when…** you can report per-provider success rate and mean time-to-open of
  each circuit breaker over ≥1 week — a reliability profile no comparable open tool publishes.

---

## Prioritization

F1 is the keystone — F2, F3, and F4 all need its labels/judge to be measurable. Do F1 (or at
least a fixed LLM-as-judge) first; then the others become falsifiable rather than anecdotal.

---

## When NOT to use this / use instead

| You want to… | Use |
|---|---|
| Execute the quality-signal fix now (decision-gated) | `tayari-quality-signal-campaign` |
| The evidence bar / idea lifecycle these programs obey | `tayari-research-methodology` |
| Proof recipes for the measurements above | `tayari-proof-and-analysis-toolkit` |
| The domain concepts (ATS, TF-IDF, guardrails) | `resume-ats-llm-reference` |
| What you may claim externally today | `tayari-external-positioning` |

These are open/candidate directions — nothing here is a shipped claim.

---

## Provenance and maintenance

Facts verified against the repo on **2026-07-08**. Re-verify the assets each program relies on:

```bash
ls backend/python/eval/datasets/                                   # F1/F3 datasets home
grep -n 'semantic_similarity_score' backend/python/app/services/ats_engine.py   # F2
grep -n 'embed_texts\|document_embeddings' backend/python/app/services/embedding_storage.py  # F2
grep -n 'check_truthfulness\|validate_master_alignment' backend/python/app/guardrails/truthfulness.py backend/python/app/services/optimizer.py  # F3
grep -n 'build_provider' backend/python/app/services/llm_service.py             # F4
grep -rn 'CircuitBreaker\|CLOSED\|HALF_OPEN' backend/python/app/services/circuit_breaker.py  # F5
```

If an asset moves or a program produces a result, update the entry (and promote proven claims to
`tayari-external-positioning`). Bump the date.
