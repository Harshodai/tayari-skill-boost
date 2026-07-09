---
name: tayari-external-positioning
description: >-
  How to talk about Tayari Skill Boost externally without overselling — claims vs evidence,
  what's novel vs known, and the reproducibility bar a number must clear before you publish
  it. Load when writing release notes, a landing page, a README differentiators section, a
  competitive comparison, or any outward claim, and you need to know which differentiators
  are PROVEN vs CANDIDATE and what must be measured first. Owns the claims-vs-evidence table
  and the pre-publish checklist. Facts verified 2026-07-08.
---

# Tayari External Positioning

Outward-facing claims are hard to walk back once published; they get cached and indexed. This
skill keeps positioning **honest**: every claim is labeled by evidence strength, and quality
claims must clear a reproducibility bar. For internal docs use `tayari-docs-and-writing`; to
actually prove a metric use `tayari-proof-and-analysis-toolkit`; for open research directions
use `tayari-research-frontier`.

**Evidence labels:**
- **PROVEN** — the mechanism exists in code and is verifiable by running it.
- **PARTIAL** — the mechanism exists but depends on conditions (a real LLM, keys, DB) or is limited.
- **CANDIDATE** — aspirational / roadmap; not yet demonstrable. Never state as fact.

---

## 1. Claims-vs-evidence table (the 5 README differentiators)

| Claim | Verdict | Evidence | What you may NOT say |
|---|---|---|---|
| **Reflective/reflexion optimization** (iterates against its own scoring gate, not one-shot GPT) | **PROVEN** (mechanism) | `optimize_with_reflection` in `optimizer.py`: generate → critique via `_gap_feedback` → refine once; `SCORE_TARGET=85` | Do NOT say "beats real ATS", "recruiter-grade", or cite a score as quality proof — the gate is a *structural heuristic* and can run on the mock LLM. |
| **Tiered Hermes multi-board scraping**, zero API keys | **PROVEN** (mechanism) | `app/services/hermes/` tiers A–D; `config.py` self-disables keyless providers; 3 always-on free providers | Do NOT claim provider-specific reliability/coverage without a measured run; sites change and break silently. |
| **Hybrid RRF ranking** (reciprocal rank fusion of independent rankers) | **PROVEN** (mechanism) | `job_agent.py:191` `K = 60 # standard RRF constant`, an `rrf()` fn, "lexical + skill-taxonomy + semantic embeddings, RRF-fused" | Note it "degrades gracefully if embeddings unavailable" — don't imply semantic ranking is always on. |
| **Knowledge-graph extraction** (skills/achievements/timeline) | **PROVEN** (mechanism) | `POST /api/v1/resume/knowledge-graph` → `KnowledgeGraphExtractor.extract` | Quality depends on a real LLM; extraction on the mock path is fake. Don't cite HR-pricing comparisons as proof of parity. |
| **Persistent AI memory** (pgvector semantic retrieval, learned preferences) | **PARTIAL** | `embedding_storage.py` uses pgvector + a `document_embeddings` table; `preference_learning.py`, `memory_composer.py` exist | Requires DB + a working embedding service; don't claim "learns from every interaction" without a measured demonstration. |

**Self-hosted / zero-marginal-cost** is a **PROVEN** structural claim (mock/Ollama fallback → the
app runs with no API keys). But **"quality parity with hosted LLMs"** is **CANDIDATE** — not
demonstrated. Keep those two separate in any copy.

---

## 2. What must be proven before you claim it

Any **quality or accuracy** claim requires:
1. A **real LLM** produced the numbers (not MockProvider). Verify: `/health` `model_status:"loaded"`.
2. A **fixed dataset** (`backend/python/eval/datasets/*_v1.yaml`) — not cherry-picked inputs.
3. A **stated baseline** to compare against (e.g. one-shot vs reflexion; TF-IDF vs embeddings).
4. The result is **reproducible** by someone else with the same engine + dataset.

A number produced by the mock path, or by `eval/runner.py` with no LLM configured, is **not
evidence** and must never appear in external material (`tayari-validation-and-qa`).

---

## 3. Reproducibility standard (for any published number)

When you publish a metric, publish alongside it:
- **Engine identity** — `active_engine()` label (e.g. `openrouter/google/gemini-2.5-flash:free`).
- **Dataset + version** — e.g. `ats_scoring_v1.yaml`.
- **Command** — exact invocation that produced it.
- **Date** — numbers drift as models/datasets change.

Never publish a metric you cannot reproduce on demand.

---

## 4. Where positioning material lives (and what it is)

| Doc | What it is |
|---|---|
| `README.md` | The 5 differentiators (partly corrupted — see `tayari-docs-and-writing`). |
| `PRODUCT_GRILL.md` | Competitor landscape, gaps, recommendations — **strategy, not evidence.** |
| `research/DIFFERENTIATION_STRATEGY.md`, `research/competitor_landscape.md`, `research/WORLD_CLASS_ROADMAP.md`, `research/NEXT_PHASE_ROADMAP.md` | Roadmaps/positioning theses — aspirational; label derived claims CANDIDATE. |

Treat all of these as arguments to be evidenced, not facts to be repeated.

---

## 5. Pre-publish checklist (any external claim)

- [ ] Does the **mechanism exist** in code? (If not → CANDIDATE, don't state as fact.)
- [ ] If it's a **quality/accuracy** claim: measured with a **real engine** on a **fixed dataset**? Reproducible?
- [ ] Am I separating **"runs self-hosted for free"** (PROVEN) from **"as good as hosted"** (CANDIDATE)?
- [ ] Does the claim contradict `.agents/AGENTS.md` or `tayari-architecture-contract`? (If yes, fix the claim.)
- [ ] Have I labeled unproven items open/candidate rather than implying they ship?
- [ ] Publishing sends this outward permanently — is that intended and authorized?

---

## When NOT to use this / use instead

| You want to… | Use |
|---|---|
| Maintain internal docs / house style | `tayari-docs-and-writing` |
| Actually prove a metric (worked examples) | `tayari-proof-and-analysis-toolkit` |
| Judge if a result is real vs mock | `tayari-validation-and-qa` |
| Open problems worth publishing on | `tayari-research-frontier` |
| The discipline that turns a hunch into an accepted result | `tayari-research-methodology` |

---

## Provenance and maintenance

Facts verified against the repo on **2026-07-08**. Re-verify:

```bash
grep -n 'RRF\|reciprocal\|K = 60' backend/python/app/services/job_agent.py
grep -n 'pgvector\|document_embeddings' backend/python/app/services/embedding_storage.py
grep -n 'knowledge-graph' backend/python/app/main.py
grep -n 'optimize_with_reflection\|SCORE_TARGET' backend/python/app/services/optimizer.py
ls backend/python/app/services/hermes/
grep -n 'model_status' backend/python/app/routes/health.py
```

If a mechanism is added/removed or a claim's evidence changes, re-label it and bump the date.
