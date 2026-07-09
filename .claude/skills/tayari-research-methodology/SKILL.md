---
name: tayari-research-methodology
description: >-
  The discipline that turns a hunch into an accepted result in Tayari Skill Boost — the
  evidence bar, the predict-numbers-before-running rule, the idea lifecycle from experiment
  flag to adopted change or documented retirement, and where good ideas have historically
  come from. Load when starting an investigation, proposing a non-trivial change, evaluating
  someone's "it works" claim, or deciding whether an idea is adopted or retired. Pairs with
  the quality-signal campaign, the proof toolkit, and validation-and-qa. Facts verified
  2026-07-08.
---

# Tayari Research Methodology

How a hunch becomes an accepted result here. This is the meta-skill: the *standard of proof*
the other skills serve. It is deliberately strict because the project's core hazard is
convincing-but-fake signals (mock LLM output, gameable scores). Cheap sessions and small models
must be able to apply this bar mechanically.

- To apply it to the hardest problem: `tayari-quality-signal-campaign`.
- For the concrete proof recipes: `tayari-proof-and-analysis-toolkit`.
- For what counts as passing tests/CI: `tayari-validation-and-qa`.
- The gate that adopts a result into the codebase: `tayari-change-control`.

---

## 1. The evidence bar (a claim is accepted only if ALL hold)

1. **Real, not mock.** Any AI-derived number was produced with `model_status:"loaded"`
   (`check_llm_engine.sh` exits 0). A mock-path result is inadmissible.
2. **Predicted before run.** You wrote the expected number or direction *before* measuring, and
   the observation matched — or you documented precisely why it didn't. (See §2.)
3. **One mechanism explains ALL observations, including the negatives.** A hypothesis that
   explains the wins but not the counter-cases is not accepted. If your fix makes stuffed resumes
   score lower, it must also explain why clean resumes are unaffected. Unexplained negatives sink
   the claim.
4. **Survives adversarial refutation.** Before acceptance, someone (or you, wearing the red hat)
   must actively try to break it: construct the input that *should* falsify it and show it doesn't.
5. **Reproducible.** Engine identity + dataset + exact command are recorded; another person can
   reproduce the number.
6. **Golden-set safe.** The eval datasets (`ats_scoring_v1.yaml`, `tayari_resume_v1.yaml`) still
   pass, and you added a case that would FAIL without the change.

If any item is missing, the claim is a *candidate*, not a result. Label it as such.

---

## 2. Hypothesis predicts numbers before running

The anti-rationalization rule. For every experiment:

1. Write the hypothesis as a **falsifiable** statement with a number/direction.
   *e.g.* "Wiring embeddings raises synonym-pair similarity from ~0.1 to > 0.5."
2. Record the **prediction** before you run.
3. Run on a **fixed** input (golden set), with a **real** engine.
4. Compare. A miss is informative — do NOT quietly re-fit the story to the result. Either the
   mechanism is wrong or the measurement is; diagnose which.

This converts "it seems better" into "it moved metric M by D, as predicted," which is the only
kind of statement that survives review here.

---

## 3. The idea lifecycle

Every non-trivial idea moves through these states. Record the transition (in `lessons.md` /
`tayari-failure-archaeology`), so no one re-litigates a settled question.

```
  HUNCH
    │  frame as a falsifiable hypothesis with a predicted number (§2)
    ▼
  EXPERIMENT  ── run behind an experiment flag / branch, real engine, golden set
    │
    ├── meets the evidence bar (§1) ─────────────► ADOPTED
    │        promote via tayari-change-control:            (flagged if behavior changes;
    │        route parity, feature flag, // ponytail,       before/after numbers in lessons.md)
    │        green Go subset, guardrails intact
    │
    └── fails the bar ──────────────────────────► RETIRED
             document WHY it failed + what would revive it
             (a retirement note prevents blind re-tries)
```

- **ADOPTED** results become the new baseline; update the relevant skill and
  `tayari-external-positioning` if it changes what may be claimed.
- **RETIRED** ideas get a one-line obituary (symptom → why it failed → what would change the
  verdict). The dead agent branches and the manualChunks splitter are examples of things that
  should stay retired (`tayari-failure-archaeology`).

---

## 4. Where good ideas have historically come from

Pattern-match your search for leverage on where wins actually originated here (verified from docs):

| Source | Example |
|---|---|
| **Cross-pollination from the sibling project** (askmukthiguru) | The NVIDIA NIM retry/backoff pattern, eval-dataset structure, pipeline guardrails, architecture-audit patterns (`AGENT_SPEC.md`, `lessons.md`). |
| **Post-mortems in `lessons.md`** | Stopword pollution → NLTK + whitelist; heuristic vs semantic score being *different* metrics; two-LLM humanization. |
| **Failure archaeology** | The nil-DB test panic reveals a real coupling (tenantMiddleware ↔ every route) worth fixing properly. |
| **Honest limits admitted in code/docs** | "structural only ~7/10", "TF-IDF misses synonyms" — each admitted limit is a research lead (`tayari-research-frontier`). |

The meta-lesson: the best ideas came from **taking an admitted weakness seriously and measuring
it**, not from adding features. Mine `lessons.md` and the failure chronicle before inventing.

---

## 5. Red-team checklist (run before you call something a result)

- [ ] Could this number be the **mock** LLM? (Check `model_status`.)
- [ ] Did I **predict** it before running?
- [ ] What observation would **falsify** my mechanism — did I try to produce it?
- [ ] Does my mechanism explain the **negative** cases too?
- [ ] Is it **reproducible** by someone else (engine + dataset + command)?
- [ ] Did I record the ADOPTED/RETIRED decision so it isn't re-fought?

---

## When NOT to use this / use instead

| You want to… | Use |
|---|---|
| Apply the bar to the hardest live problem | `tayari-quality-signal-campaign` |
| Concrete proof/measurement recipes | `tayari-proof-and-analysis-toolkit` |
| Open problems to point the method at | `tayari-research-frontier` |
| Whether tests/CI actually pass | `tayari-validation-and-qa` |
| Adopt a result into the codebase | `tayari-change-control` |

This skill sets the standard; it does not itself run experiments or change code.

---

## Provenance and maintenance

Method is stable; the anchors it cites are verified against the repo on **2026-07-08**:

```bash
grep -n 'model_status' backend/python/app/routes/health.py                # real-vs-mock gate
ls backend/python/eval/datasets/                                          # golden set
grep -n 'NVIDIA NIM\|askmukthiguru' lessons.md AGENT_SPEC.md              # idea provenance
test -f .claude/skills/tayari-diagnostics-and-tooling/scripts/check_llm_engine.sh && echo "mock gate script present"
```

If the evidence anchors move (health endpoint, datasets, diagnostics script), update §1/§4 and
bump the date. The methodology itself changes rarely — treat edits to §1 as significant.
