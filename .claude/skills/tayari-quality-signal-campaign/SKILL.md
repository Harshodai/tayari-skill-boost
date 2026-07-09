---
name: tayari-quality-signal-campaign
description: >-
  The executable, decision-gated campaign for Tayari Skill Boost's hardest live problem —
  the resume-optimization QUALITY SIGNAL is not trustworthy (the optimizer scores against a
  gameable structural heuristic, and every LLM call silently falls back to mock text, so
  "good" results can be fiction). Load when asked to prove/improve optimization quality,
  when an eval or optimizer result looks too good, when wiring a real LLM, or when building a
  trustworthy benchmark. Numbered phases with EXPECTED numbers at each gate, a ranked
  solution menu with theory obligations, fenced wrong paths, and a promotion protocol through
  change-control. Facts verified 2026-07-08.
---

# Campaign: Make the Quality Signal Trustworthy

**The problem, precisely.** Tayari's headline value is "reflective resume optimization that
scores itself before emitting." Two facts undermine every quality number it produces:

1. **Mock-masking.** `llm_complete` (`app/services/llm_service.py`) returns plausible **fake**
   text on any error or when no provider is configured, and **never raises**. So an
   "optimized" resume, a guardrail pass, or a green eval can be pure fiction.
2. **Gameable gate.** The self-critique target is `heuristic_ats_score` — a *structural* proxy
   (~7/10) that a resume can satisfy via grammar-word overlap, plus TF-IDF similarity that
   misses synonyms. There is **no ground truth** that optimization improves real outcomes.

Per the project owner, this is entangled with the reliability/ops/LLM chain — a run can also be
"green" because the stack silently started nothing (profile trap) or hit a mock. This campaign
makes the signal **measurable** end to end. Success is never judged by eye.

> This skill executes an investigation. It does not replace the gates: any change it produces
> is promoted only via `tayari-change-control`. Concepts: `resume-ats-llm-reference`. Proof
> techniques: `tayari-proof-and-analysis-toolkit`. Evidence bar: `tayari-validation-and-qa`.

**Golden rule:** state the number you expect BEFORE you run each step. If the observed number
differs from "Expected," follow the branch — do not proceed.

---

## Phase 0 — Establish you are not looking at a mirage

**Goal:** confirm the environment is real before measuring anything.

```bash
# 0.1 Stack actually up? (profile trap: bare `up` starts nothing)
docker compose --profile dev ps        # expect 9 services "Up"; if empty -> tayari-run-and-operate
curl -s http://localhost:8002/health   # expect HTTP 200 JSON

# 0.2 Is the LLM real or mock? THE decisive gate.
curl -s http://localhost:8002/health | grep -o '"model_status":"[^"]*"'
```

| Observation | Meaning | Branch |
|---|---|---|
| `"model_status":"loaded"` | A real engine is wired | → Phase 1 |
| `"model_status":"llm_not_configured"` | MockProvider active — **every AI number below is fake** | Configure a provider (`tayari-config-and-flags` §2.1), re-run 0.2. Do NOT proceed on mock. |
| connection refused | Stack not up / wrong port | `tayari-run-and-operate`, then retry |

> **Fenced wrong path:** Do NOT "just look at the optimized resume and judge if it reads well."
> Eyeballing prose is exactly how mock output passes for real. The gate is `model_status`, not taste.

---

## Phase 1 — Quantify the mock-masking blast radius

**Goal:** prove to yourself that the same call path yields fake output under mock, so you never
trust an unverified run again.

```bash
# 1.1 With NO provider configured, run the deterministic ATS probe on a KNOWN-BAD resume.
cd backend/python
python3 -c "from app.services import ats_engine as a; print(a.heuristic_ats_score('x','')['score'])"
```
- **Expected:** a low score (a one-word resume is structurally empty). The ATS engine is
  deterministic and does NOT use the LLM — it is honest. **Good.**

```bash
# 1.2 Now exercise an LLM path under mock (optimizer) and inspect refinement_passes + text.
python3 -c "import asyncio; from app.services.optimizer import optimize_with_reflection as o; r=asyncio.run(o('John Doe\nEXPERIENCE\n- did stuff','Python engineer')); print('engine-independent? passes=',r['refinement_passes'],'len=',len(r['optimized_text']))"
```
- **Expected under mock:** it returns a canned "John Doe / TechCorp / Python, FastAPI, Docker"
  resume regardless of input. That canned text is `_mock_text` — **fiction**.
- **Branch:** if the output echoes the *mock template* verbatim, you have reproduced mock-masking.
  This is the enemy. Everything downstream (guardrails pass, ATS improvement) is meaningless here.

**Deliverable of Phase 1:** a one-line note in your working log: "Confirmed mock-masking: optimizer
returns `_mock_text` when unconfigured; ATS engine is deterministic and unaffected."

---

## Phase 2 — Get a REAL signal and baseline it

**Goal:** with a real engine, measure the optimizer's effect on the deterministic ATS score and
on TF-IDF similarity, before vs after. These two numbers are the only honest signals available today.

1. Configure a real provider (Ollama for zero-cost, or OpenRouter) — `tayari-config-and-flags` §2.1.
2. Re-run Phase 0.2 → must be `loaded`.
3. Pick 5 resumes + JDs from `eval/datasets/tayari_resume_v1.yaml` (the golden set).
4. For each, capture: `new_heuristic_score`, `semantic_similarity_before/after`,
   `refinement_passes`, and `guardrails.all_passed` from `optimize_with_reflection`.

**Expected (real engine, verified behavior):**
- `refinement_passes` is 1 or 2 (2 when pass-1 heuristic < 85 or alignment failed).
- `new_heuristic_score` typically ≥ the original and often ≥ 85 (the loop optimizes toward it).
- `semantic_similarity_after ≥ semantic_similarity_before` in most cases.
- `guardrails.all_passed == True` for truthful rewrites.

| Observation | Meaning | Branch |
|---|---|---|
| Scores improve, guardrails pass | Signal is *internally* consistent | → Phase 3 (is it *real* quality?) |
| `new_heuristic_score` ≥ 85 but resume is keyword-stuffed | Gate gamed (structural overlap) | → Solution menu S1 |
| `guardrails.all_passed` but the rewrite invented a degree/date | Truthfulness skipped (no `original_text`) or too weak | → Solution menu S3; see `resume-ats-llm-reference` §8 |
| `refinement_passes` always 1 even when score < 85 | Reflexion not triggering | Inspect `_gap_feedback`/`SCORE_TARGET`; → `tayari-debugging-playbook` |

> **Fenced wrong path:** Do NOT tune prompts to push the heuristic score up. Raising a proxy you
> already distrust is motion, not progress. Fix *what the number means* (Phase 3), not the number.

---

## Phase 3 — The core question: does "optimized" mean "better in reality"?

**Goal:** decide whether the internal score correlates with anything a real recruiter/ATS cares
about. Today there is **no ground truth** in the repo. This phase is where you either build one
or explicitly declare the signal unproven.

**Hypothesis to test (state numbers first):** "A higher `heuristic_ats_score` corresponds to a
higher score from an *independent* judge (a real ATS export, or an LLM-as-judge with a rubric,
or human labels)." Predict the correlation you expect (e.g. Spearman ρ > 0.5) before measuring.

| If you can obtain… | Then measure | You have a result when… |
|---|---|---|
| A handful of real ATS parse results (e.g. paste into a real Greenhouse/Workday test req) | Rank correlation between heuristic score and real ATS rank | ρ is reported on ≥20 pairs with the engine/dataset pinned |
| An independent LLM-as-judge with a fixed rubric (different model than the optimizer) | Correlation between heuristic score and judge score | ρ reported; judge model named; rubric committed |
| Human labels (even n=20) | Correlation + confusion of "passing (≥85)" vs human "would advance" | Precision/recall of the ≥85 threshold reported |

- **Expected honest outcome (today):** you cannot yet show strong correlation, because no
  ground-truth dataset exists. That is a *finding*, not a failure — it defines the work.
- **Branch:** if correlation is weak/absent, the heuristic is a formatting linter, not a quality
  oracle. Say so plainly and pursue the Solution menu. Cross-ref `tayari-research-frontier` for
  turning this into a benchmark.

---

## Solution menu (ranked; each carries a theory/derivation obligation)

Pick the highest-leverage item you can evidence. Each MUST be justified, not just installed.

**S1 — Make the gate ungameable: add an anti-stuffing + coverage-quality term.**
- *Do:* the keyword-stuffing guardrail already exists; wire its density signal INTO the acceptance
  threshold so a resume can't hit 85 by repetition. Add "keywords appear in distinct bullets" not
  just "keywords present."
- *Theory obligation:* show, on ≥10 golden resumes, that a deliberately stuffed resume now scores
  LOWER than a clean one (before your change they score similarly). Report both distributions.

**S2 — Replace TF-IDF with real embeddings for semantic similarity.**
- *Do:* use the existing `embedding_service` to compute cosine over sentence embeddings instead of
  TF-IDF; keep TF-IDF as a cheap fallback (graceful degrade, matching the RRF pattern).
- *Theory obligation:* derive why embeddings capture synonymy TF-IDF cannot; demonstrate on a
  synonym pair ("built ML models" vs "constructed machine-learning systems") that embedding
  similarity ≫ TF-IDF similarity. Report the delta. Watch Docker image size (why TF-IDF was chosen).

**S3 — Always run truthfulness with `original_text`.**
- *Do:* make the standalone guardrails endpoint and every optimizer path pass `original_text` so
  the fabrication check actually runs (today it's skipped without it).
- *Theory obligation:* construct a rewrite that invents a degree; show truthfulness now FAILS it
  (before: passes). This closes weak point W3 (`tayari-architecture-contract`).

**S4 — Ground-truth benchmark (the real fix).**
- *Do:* build a labeled dataset: resume+JD → independent judge score, committed under
  `eval/datasets/`. Then the heuristic can be *validated* against it, not trusted blindly.
- *Theory obligation:* define the label source and its bias; pre-register the correlation you'd
  accept as "the heuristic is a valid proxy." This is a `tayari-research-frontier` project.

**S5 — Fail loud on mock in "prove-it" contexts.**
- *Do:* provide a strict mode / a CI gate that refuses to record a result if
  `active_engine()=="mock-fallback"` (the diagnostics `check_llm_engine.sh` already exits nonzero
  on mock — wire it into eval/CI).
- *Theory obligation:* none beyond showing the gate blocks a mock run. Cheapest, do it first.

> **Fenced wrong paths (do NOT do these):**
> - Do NOT delete the mock fallback outright — it's load-bearing for "runs with zero keys"
>   (`tayari-architecture-contract` §2.3). Make it *detectable and gateable*, not absent.
> - Do NOT raise `SCORE_TARGET` above 85 to "make it stricter" — you'd just optimize the proxy harder.
> - Do NOT add sentence-transformers/scikit-learn casually — `lessons.md` records the ~50MB image
>   cost that motivated the stdlib TF-IDF. Justify the dependency (S2 obligation) or use a small model.

---

## Validation-and-promotion protocol (routes through change control)

A candidate fix is **adopted** only when ALL hold:

1. **Real engine.** Numbers produced with `model_status:"loaded"` (never mock). `check_llm_engine.sh`
   exits 0 in the run that produced them.
2. **Predicted-before-run.** You wrote the expected number/direction before measuring, and the
   result matched (or you documented why not).
3. **One mechanism explains all observations, including negatives.** e.g. S1 must explain why the
   stuffed resume drops AND why clean resumes are unaffected. (`tayari-research-methodology`.)
4. **Golden-set regression.** The eval datasets (`ats_scoring_v1.yaml`, `tayari_resume_v1.yaml`)
   still pass; you added a case that would FAIL without your fix.
5. **Change-control gate.** New route → parity twin; new flag → `features.ts`; new dep → justified;
   `// ponytail:` on non-obvious choices; green Go subset still green. (`tayari-change-control`.)
6. **No mock-masking reintroduced.** Errors are raised or logged, not silently swallowed into a pass.

Ship behind a flag if behavior changes; document the before/after numbers in `lessons.md`
(`tayari-docs-and-writing`). If a candidate fails the bar, retire it explicitly with a note
(`tayari-research-methodology` idea lifecycle) so no one re-tries it blindly.

---

## When NOT to use this / use instead

| You want to… | Use |
|---|---|
| A quick symptom fix (not the quality signal) | `tayari-debugging-playbook` |
| The concepts/formulas behind the scores | `resume-ats-llm-reference` |
| Generic evidence rules / test inventory | `tayari-validation-and-qa` |
| First-principles proof recipes | `tayari-proof-and-analysis-toolkit` |
| Turn the ground-truth gap into a research program | `tayari-research-frontier` |

---

## Provenance and maintenance

Facts verified against the repo on **2026-07-08**. Re-verify:

```bash
grep -n 'def llm_complete\|_mock_text\|MockProvider' backend/python/app/services/llm_service.py   # mock-masking
grep -n 'SCORE_TARGET\|_gap_feedback\|refinement_passes' backend/python/app/services/optimizer.py  # reflexion gate
grep -n 'model_status' backend/python/app/routes/health.py                                         # Phase 0 gate
grep -n 'original_text is not None\|truthfulness' backend/python/app/guardrails/gate.py            # S3 (skip when no original)
ls backend/python/eval/datasets/                                                                    # golden set for Phases 2-3
bash .claude/skills/tayari-diagnostics-and-tooling/scripts/check_llm_engine.sh || echo "mock/unreachable"
```

If `SCORE_TARGET` changes, mock behavior changes, or a ground-truth dataset is added, update the
affected phase/branch and bump the date.
