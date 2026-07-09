---
name: resume-ats-llm-reference
description: >-
  Domain-theory pack for the resume/ATS/LLM concepts Tayari Skill Boost is built on — the
  field knowledge a mid-level engineer lacks, explained AS IMPLEMENTED HERE (not a generic
  textbook). Load when working on resume scoring, ATS checks, keyword matching, semantic
  similarity, STAR bullets, the reflexion optimizer, humanization, or the guardrails, and
  you need the concepts, formulas, and honest limits. Owns the definitions of ATS, heuristic
  vs semantic scoring, TF-IDF cosine, STAR heuristics, reflexion, and the guardrail checks.
  Facts verified 2026-07-08.
---

# Resume / ATS / LLM Reference

The concept pack behind the AI engine. Read this to understand *what the numbers mean* and
*what they do not*. It is theory-as-implemented — every concept ties to a real function in
`backend/python/`. For the campaign to make these numbers trustworthy, see
`tayari-quality-signal-campaign`; for first-principles proofs, `tayari-proof-and-analysis-toolkit`.

---

## 0. Glossary (each term defined once)

| Term | Meaning here |
|---|---|
| **ATS** | Applicant Tracking System — recruiter software (Greenhouse, Workday, Lever, Ashby) that parses and filters resumes. |
| **Heuristic ATS score** | A deterministic, LLM-free *structural* score 0–100 (`heuristic_ats_score`). A proxy, not a real ATS's output. |
| **Semantic similarity** | TF-IDF cosine between resume and JD (`semantic_similarity_score`). Measures vocabulary overlap, not meaning. |
| **TF-IDF** | Term-Frequency × Inverse-Document-Frequency: weights a term by how often it appears here vs how rare it is overall. |
| **Cosine similarity** | Angle between two term-weight vectors; 1 = identical direction, 0 = orthogonal. |
| **STAR** | Situation, Task, Action, Result — the rubric for a strong resume bullet. |
| **Reflexion** | Generate → self-critique against a measurable gap → refine. |
| **Guardrail** | A pre-emit check (truthfulness / keyword-stuffing / PII) in `PipelineGate`. |
| **Stopword** | A grammar word (`the`, `and`, `of`) with no skill signal; filtered before scoring. |

---

## 1. What an ATS actually is — and why the score here is a proxy

Real ATS software parses a resume into fields, matches it to a job's requisition, and ranks
candidates. Modern ones (2023+) use embeddings/semantic matching, not just keyword lists.

Tayari does **not** have a real ATS. Its `heuristic_ats_score` is a **structural proxy**: it
rewards having the right sections, contact info, bullets, quantified achievements, dates, and
length. It says nothing about whether a specific Greenhouse instance would rank you highly.
Treat "ATS score 85" as "structurally clean," not "will pass the recruiter's filter."

---

## 2. Heuristic ATS score (`ats_engine.heuristic_ats_score`)

- **Signature.** `heuristic_ats_score(resume_text, job_description=None) -> dict` with keys
  `score` (0–100), `passed`, `total`, `checks` (list of `{name, passed, weight, detail}`),
  `sections_found`, and (when a JD is given) keyword-match fields.
- **Checks (verified — the `name` values include):** Contact email, Phone number, Experience
  section, Education section, Skills section, Summary / objective, Optimal length, Bullet
  points, Action verbs, Quantified achievements, Dates present, Recent experience visible.
  Each has a `weight`; `score = round(100 * earned / total_weight)`.
- **Deterministic.** No LLM, reproducible, instant. Good for diagnosing *format* problems.
- **Honest limit.** Structural only (~7/10 confidence per `lessons.md`). Because it rewards
  section/keyword presence, a resume can score high on grammar-word overlap alone if the
  stopword list is weak — see §5 (the stopword-pollution lesson). Probe it with
  `tayari-diagnostics-and-tooling`'s `ats_probe.py`.

---

## 3. Semantic similarity — TF-IDF cosine (`semantic_similarity_score`)

- **What it measures.** Does the resume *talk like* the JD? Vocabulary alignment.
- **How.** Pure stdlib (`math`, `collections.Counter`) — **no scikit-learn, no
  sentence-transformers** (deliberate: avoids ~50MB of Docker image). Formula:
  1. Tokenize both docs (drop stopwords).
  2. For each term: `TF` (count in doc) × smoothed `IDF`.
  3. `cosine = dot(A, B) / (‖A‖ · ‖B‖)` over the shared term space.
  Returns `{score (0–100), raw_similarity, interpretation}`.
- **Heuristic vs semantic — they measure DIFFERENT things.** A resume can score 80%+ structural
  (great format) yet 30% semantic (wrong vocabulary vs the JD). You need both numbers.
- **Honest limit.** TF-IDF is lexical: it misses synonyms ("built" vs "constructed", "ML" vs
  "machine learning") and paraphrase. ~7/10. A true semantic score needs embeddings (open
  problem — `tayari-research-frontier`).

---

## 4. STAR method + heuristic bullet scoring (`optimizer._score_bullet_star`)

STAR = a strong bullet shows **S**ituation, **T**ask, **A**ction, **R**esult. The heuristic
scores each bullet 0–4 by signal presence (verified):

| Element | Signal the code looks for |
|---|---|
| **Action** | Bullet starts with a known action verb (led, built, designed, implemented, …) |
| **Result** | Contains a number/percent/dollar: `\d+%`, `$\d`, `\d+[kKmMx]`, or a 2+-digit number |
| **Task** | Mentions a system/scope: team, system, platform, service, pipeline, api, model, process |
| **Situation** | Context words: across, within, for, during, supporting, serving, handling |

Bullets scoring < 3 are flagged for improvement. **Never fabricate metrics** — the rule is to
suggest an honest range like `~20-30% [ESTIMATE]` rather than invent a number. This heuristic is
good for *flagging* weak bullets (~7/10); it misses nuance.

---

## 5. Keyword extraction, stopwords, and categorization

- **Stopwords (`_build_stopwords`).** A base list **+ NLTK's English set** (~216 words total)
  removes grammar words. This exists because an early 17-word list surfaced `'ll'`, `'re'`,
  `'if'` as "skill gaps" (the stopword-pollution incident — `tayari-failure-archaeology`).
- **`TECH_SKILL_WHITELIST` (~86 terms).** Short real tech terms (`python`, `sql`, `go`, `r`,
  `aws`, …) are ALWAYS kept even though a naive length filter (≥4 chars) would drop them.
- **`_is_meaningful` guard.** Surfaces bigrams (always meaningful), whitelist terms, and tokens
  ≥4 chars that don't end in non-skill suffixes (`-tion`, `-ness`, `-ful`).
- **`categorize_jd_keywords`.** Buckets JD keywords into **hard skills** (tech stack), **soft
  skills** (competencies), **domain keywords** (industry terms). The optimizer reports coverage %
  per bucket; **≥80% required-keyword coverage = passing, ≥90% = excellent** (cv-tailor rule).
- **Rule.** Never trust a keyword extractor without a real stopword list. Validate that
  `matched_keywords` look like skills, not function words.

---

## 6. Reflexion / reflective optimization (`optimize_with_reflection`)

The flagship. Contrast with a one-shot GPT call:

1. **Generate.** LLM rewrites the resume (marker protocol `<<<META>>>…<<<RESUME>>>…<<<END>>>`).
2. **Score.** `heuristic_ats_score` + `validate_master_alignment` (fabrication check on
   skills/certs vs the original).
3. **Critique → refine (once).** If `heuristic.score < SCORE_TARGET (=85)` OR alignment fails,
   build a concrete gap report (`_gap_feedback`: failed checks + missing JD keywords + coverage %)
   and re-prompt. Keep pass-2 only if it scores ≥ pass-1 or fixes an alignment violation.
4. **Polish.** `remove_ai_buzzwords` (local, JD-aware) → `_humanize_pass` (2nd LLM call, temp
   0.4, falls back to pre-humanize text on failure).
5. **Guard.** `PipelineGate` before returning.

**The catch (critical).** The critique target is the *structural heuristic* from §2, and every
LLM call can silently be the **mock** provider. So a "reflexion improved the score to 88" result
can be optimizing a weak proxy on fake text. Confirm a real engine (`/health` model_status) and
read `tayari-quality-signal-campaign` before trusting reflexion numbers.

---

## 7. Humanization + AI-buzzword removal

LLM-written resumes fail because they repeat verbs, stuff keywords unnaturally
("Leveraged Apache Spark to facilitate Apache Kafka…"), and sound formulaic. The engine:
- **`remove_ai_buzzwords`** — local regex cleanup of blacklisted AI phrases, but skips any phrase
  that actually appears in the target JD (don't remove a real requirement).
- **`_humanize_pass`** — a second, separate LLM call with a "make it sound human" system prompt at
  temperature 0.4 (higher than the optimizer's 0.3, for natural variation). Wrapped in try/except:
  on failure it returns the pre-humanization text (polish, not critical path).

---

## 8. Guardrails as domain concepts (`app/guardrails/`)

`PipelineGate.check(optimized_text, original_text=None, job_description=None)` runs three checks:

| Guardrail | Fails when (verified thresholds) |
|---|---|
| **Truthfulness** (`check_truthfulness`) | Optimized invents years/dates/degrees not in original; contact email changed; ≥3 employers dropped; optimized < 30% of original length. **SKIPPED (marked passed) if `original_text` is None.** |
| **Keyword-stuffing** (`check_keyword_stuffing`) | A single word > 15% of words; a bigram > 10% of bigrams; a high-risk keyword appears ≥5×; a word repeats 3+× in one sentence. |
| **PII** (`check_pii`) | Detects personally-identifiable info patterns. |

> **Load-bearing caveat.** Because truthfulness needs `original_text`, the standalone
> `POST /api/v1/guardrails/check` endpoint (which passes only `optimized_text`) does NOT run the
> fabrication check. Always pass `original_text` when you actually want truthfulness enforced.

**Prompt-injection defense.** User-supplied text is wrapped with `_untrusted()` delimiters
(`<<<UNTRUSTED_USER_DATA>>>`) plus a system instruction telling the model to treat it as data,
not instructions. A domain safety measure worth preserving.

---

## When NOT to use this / use instead

| You want to… | Use |
|---|---|
| Make the ATS/quality numbers trustworthy (the campaign) | `tayari-quality-signal-campaign` |
| Prove a metric from first principles (worked examples) | `tayari-proof-and-analysis-toolkit` |
| Actually measure a resume's score / mock status | `tayari-diagnostics-and-tooling` |
| The history of the stopword/scoring fixes | `tayari-failure-archaeology` |
| Design/boundary questions about the engine | `tayari-architecture-contract` |
| Open research directions (embeddings, real ATS ground truth) | `tayari-research-frontier` |

This is a knowledge pack, not a change gate — code changes route through `tayari-change-control`.

---

## Provenance and maintenance

Facts verified against the repo on **2026-07-08**. Re-verify:

```bash
grep -n 'def heuristic_ats_score\|def semantic_similarity_score\|def categorize_jd_keywords\|TECH_SKILL_WHITELIST\|_build_stopwords' backend/python/app/services/ats_engine.py
grep -n 'SCORE_TARGET\|_score_bullet_star\|_gap_feedback\|_humanize_pass\|remove_ai_buzzwords' backend/python/app/services/optimizer.py
grep -n 'def check_truthfulness\|0.3\|0.15\|0.10' backend/python/app/guardrails/truthfulness.py backend/python/app/guardrails/keyword_stuffing.py
grep -n '_untrusted\|UNTRUSTED_USER_DATA' backend/python/app/services/llm_service.py
# quick live check (from backend/python):
python3 -c "from app.services import ats_engine as a; print(a.heuristic_ats_score('John Doe\njohn@x.com\n555-1234567\nEXPERIENCE\n- Led team of 5, cut latency 30% in 2021\nEDUCATION\nBS CS 2019\nSKILLS\nPython, AWS','Python AWS engineer')['score'])"
```

If check names, thresholds, or `SCORE_TARGET` change, update §2/§4/§6/§8 and bump the date.
