---
name: tayari-proof-and-analysis-toolkit
description: >-
  First-principles analysis recipes for Tayari Skill Boost — how to PROVE a claim about the
  system instead of assuming it, each recipe with a worked example from this repo. Load when
  you need to demonstrate (not assert) that a score is gameable, that TF-IDF misses synonyms,
  that a result came from a real vs mock LLM, that a test failure has a specific root cause,
  or that route parity holds. Owns the "measure it, derive it, isolate it" method and the
  worked examples. Facts verified 2026-07-08.
---

# Tayari Proof and Analysis Toolkit

The discipline of **proving** rather than **assuming**. In this project, "prove it, don't just
install it" means: before you trust a number, a fix, or a claim, run the smallest experiment
that would *falsify* it. Each recipe below is: **Claim → Method → Worked example (from this
repo) → Expected result → How it could be wrong.**

Use this alongside `tayari-quality-signal-campaign` (which applies these to the hardest problem)
and `tayari-research-methodology` (the evidence bar these recipes feed).

**Three primitives:**
- **Measure it** — get a number where you were about to guess.
- **Derive it** — show *why* the number must be what it is (math/mechanism), not just that it is.
- **Isolate it** — change one variable to pin a cause (a discriminating experiment).

---

## Recipe 1 — Prove a score is gameable (adversarial input)

**Claim:** `heuristic_ats_score` is structural and can be inflated by grammar-word overlap.
**Method:** construct an input that *should* be bad but scores high; measure the gap.
**Worked example (from `lessons.md`):** the historical bug — a resume padded with JD grammar
words hit ~91% "ATS score" and surfaced `'ll'`,`'re'`,`'if'` as "skill gaps."
**Do it now (from `backend/python`):**
```bash
python3 -c "from app.services import ats_engine as a; \
good='John Doe\njohn@x.com\n555-1234567\nEXPERIENCE\n- Led team of 5, cut latency 30% in 2021\nEDUCATION\nBS CS 2019\nSKILLS\nPython, AWS'; \
print('clean:', a.heuristic_ats_score(good,'Python AWS engineer')['score'])"
```
**Expected:** a mid/high structural score for a clean resume. Then craft a keyword-stuffed variant
and show it scores *similarly* (the vulnerability) — that similarity is the proof the gate rewards
structure, not quality.
**How it could be wrong:** if the keyword-stuffing guardrail is wired into acceptance (Solution S1),
the stuffed variant should now score lower — re-run to confirm your fix actually closed the gap.

---

## Recipe 2 — Derive why TF-IDF misses synonyms

**Claim:** `semantic_similarity_score` (TF-IDF cosine) cannot see synonymy.
**Method (derive):** TF-IDF vectors are indexed by *surface term*. Two docs sharing meaning but no
tokens have near-zero shared dimensions → cosine ≈ 0. Embeddings map meaning to a dense space, so
synonyms land close.
**Worked example (measure):** from `backend/python`, score a synonym pair:
```bash
python3 -c "from app.services.ats_engine import semantic_similarity_score as s; \
print('same words:', s('built machine learning models','machine learning models built')['raw_similarity']); \
print('synonyms  :', s('built machine learning models','constructed neural network systems')['raw_similarity'])"
```
**Expected:** the synonym pair scores **much lower** than the same-words pair, despite similar
meaning — the numeric proof of the limitation.
**How it could be wrong:** if someone swapped in embeddings (Solution S2), the synonym pair should
rise. That delta is exactly what you must report to justify the dependency.

---

## Recipe 3 — Prove a result came from a real (not mock) LLM

**Claim:** "this optimization is real."
**Method (isolate):** the ATS engine is deterministic (no LLM); the LLM path returns `_mock_text`
when unconfigured. So compare the engine identity, not the prose.
**Worked example:**
```bash
curl -s http://localhost:8002/health | grep -o '"model_status":"[^"]*"'
# loaded => real ; llm_not_configured => mock (any AI prose you saw is fiction)
bash .claude/skills/tayari-diagnostics-and-tooling/scripts/check_llm_engine.sh; echo "exit=$?"  # 0 real, 1 mock
```
**Expected:** a real run reports `loaded` and exit 0. A mock run reports `llm_not_configured` and
exit 1.
**How it could be wrong:** a provider can be configured but failing every call (429/timeout) — then
`llm_complete` still returns mock while `active_engine()` claims a real label. Cross-check by
forcing one real completion and inspecting the response for the mock template ("John Doe / TechCorp").

---

## Recipe 4 — Isolate a test failure's root cause

**Claim:** the 16 red Go tests are caused by `tenantMiddleware` touching a nil DB, not by your change.
**Method (isolate):** run the DB-free subset vs the full suite; inspect the panic frame.
**Worked example:**
```bash
cd backend/go
go test ./internal/api -run 'TestSmoke|TestRouteParity'   # expect 19 pass (no DB needed)
go test ./... 2>&1 | grep -m1 'database/sql'              # panic frame: (*DB).QueryContext
grep -n 'Conn: nil' internal/api/routes_hermes_test.go    # the nil DB the tests inject
grep -n 'tenantMiddleware' internal/api/middleware.go     # the global middleware that queries it
```
**Expected:** subset green; full suite panics in `database/sql.(*DB).QueryContext`; the Hermes tests
pass `Conn: nil`; `tenantMiddleware` runs on every route. That chain *is* the proof.
**How it could be wrong:** if the subset also fails, you have a NEW regression — do not blame the
known panic. See `tayari-failure-archaeology` Entry 1.

---

## Recipe 5 — Prove route parity holds (structural invariant)

**Claim:** every route has its `/api ↔ /api/v1` twin (or a documented exception).
**Method (measure):** the parity test walks the real router; run it.
**Worked example:**
```bash
cd backend/go && go test ./internal/api -run 'TestRouteParity' -v
```
**Expected:** PASS. A failure names the specific route missing a twin — that's the proof of drift.
Add the twin or a `knownAsymmetric` entry (`tayari-change-control`).

---

## Recipe 6 — Predict-then-measure a change's effect

**Claim (template):** "my change improves metric M by direction D."
**Method:** write the predicted number/direction BEFORE running; run on the golden set; compare.
**Worked example:** before wiring embeddings, predict "synonym-pair similarity rises from ~0.1 to
>0.5." Then measure (Recipe 2). If it doesn't move, the change didn't do what you claimed — stop and
diagnose, don't ship. This predict-first rule is the backbone of `tayari-research-methodology`.

---

## The analysis checklist (apply to any claim)

- [ ] Did I **measure** where I was about to guess?
- [ ] Can I **derive** why the number must be that, or only observe that it is?
- [ ] Did I **isolate** the cause by changing exactly one variable?
- [ ] Did I state the **expected** value before running?
- [ ] Does one mechanism explain **all** observations, including the negative/counter-cases?
- [ ] Is the run **real** (not mock) and **reproducible** (engine + dataset + command pinned)?

---

## When NOT to use this / use instead

| You want to… | Use |
|---|---|
| Apply these proofs to the hardest live problem | `tayari-quality-signal-campaign` |
| The concepts/formulas being proven | `resume-ats-llm-reference` |
| The evidence bar / test inventory | `tayari-validation-and-qa` |
| Triage a live failure fast | `tayari-debugging-playbook` |
| The discipline that turns proofs into accepted results | `tayari-research-methodology` |

---

## Provenance and maintenance

Facts verified against the repo on **2026-07-08**. Re-verify each recipe's command still runs:

```bash
cd backend/python && python3 -c "from app.services import ats_engine; from app.services.ats_engine import semantic_similarity_score; print('imports ok')"
grep -n 'model_status' backend/python/app/routes/health.py
cd backend/go && go test ./internal/api -run 'TestSmoke|TestRouteParity' >/dev/null && echo "subset green"
test -f .claude/skills/tayari-diagnostics-and-tooling/scripts/check_llm_engine.sh && echo "diag script present"
```

If a probed function is renamed or a script moves, update the recipe and bump the date.
