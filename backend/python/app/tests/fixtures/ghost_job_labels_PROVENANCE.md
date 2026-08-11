# ghost_job_labels.json — Fixture Provenance

## Version
v2 (2026-08-11). v1 was the original 30-entry set; v2 reflects the
`legitimacy_checker` urgency/salary rework of 2026-08-11 (generic
calls-to-action like "apply now"/"asap" no longer count as urgency cues;
only paired salary ranges with salary context count) and the updated
measured numbers it produced.

## 1. Synthetic and implementation-aligned — not a held-out corpus
This fixture is synthetic and implementation-aligned, NOT an
independently labeled sample of real job postings. Its ghost entries
were authored to stack the documented ghost signals the screener
implements (boilerplate terms, confidential employer, urgency cues,
wide salary bands, short descriptions); its real entries were authored
with concrete stacks and requirements. Measured precision/recall on it
are therefore **upper-bound engineering estimates** of how well the
screener can separate the two archetypes it was built around — they are
NOT general screening performance against real-world postings.

## 2. Label provenance
- 15 ghost entries: authored to trip the ghost signals implemented in
  `app/guardrails/legitimacy_checker.py` — boilerplate-term ratios,
  confidential/unnamed employer, urgency cues with no deadline, wide
  salary bands, short descriptions, no requirements section.
- 15 real entries: authored as concrete postings — named stacks,
  explicit requirements/qualifications sections, realistic narrow
  salary bands, normal length.

No human labeler was involved; labels are the author's ground truth
for the two archetypes.

## 3. Sampling criteria
None. This is a crafted fixture, not a sample drawn from any posting
universe — there is no sampling frame, no random draw, no external
labeling. Treat the numbers as fixture-relative.

## 4. Measured numbers (v2, see harness output)
Run `.venv/bin/python -m pytest app/tests/test_posting_screen_precision_recall.py -q -s`
to reproduce. The landing-page stat (`src/components/landing/GhostJobStat.tsx`)
must equal the latest measured values; the harness enforces the floor
(precision >= 0.6, recall >= 0.5).
