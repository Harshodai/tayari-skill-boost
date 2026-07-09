#!/usr/bin/env python3
"""ats_probe.py — Deterministic ATS score for a resume vs. a job description.

Calls app.services.ats_engine.heuristic_ats_score directly (NO server, NO LLM).
This is the STRUCTURAL ATS baseline: sections, contact info, length, bullets,
action verbs, quantified metrics, dates, recency, and — when a JD is supplied —
weighted keyword/phrase coverage and title alignment. Fully reproducible.

WHAT THE NUMBERS MEAN (interpretation guide):
  score            int 0-100 = 100 * (sum of PASSED check weights) / (sum of all weights).
  checks[]         each {name, passed, weight, detail}. Higher weight = more score impact.
                   Heaviest checks (weight): Experience section 12, Skills section 12,
                   Quantified achievements 10, Job keyword match 10 (JD only), Contact email 8.
  sections_found   which of experience/education/skills/summary were detected.
  keyword_match_pct  0.7*token_overlap% + 0.3*bigram_overlap% vs the JD (None without a JD).
  per_ats          heuristic REWEIGHT of the SAME checks for workday/greenhouse/icims + a
                   confidence band (wider when no JD). It is an estimate, not a real parser.
Rough bands (mirror ats_engine constants ATS_SCORE_HIGH=80 / ATS_SCORE_MEDIUM=60):
  >=80 High/Excellent  (above 80 the bottleneck is interview signal, not keywords)
  60-79 Good           (fix the FAILED checks, especially the high-weight ones)
  <60  Needs work
HONEST LIMITS: this is STRUCTURAL only (~7/10 confidence), NOT a Greenhouse/Workday score.
A grammar-heavy resume can reach ~90% on word overlap alone if stopwords are weak.
For thresholds/acceptance -> tayari-validation-and-qa; for what each check means ->
resume-ats-llm-reference. (Verified against ats_engine.py, 2026-07-08.)

USAGE (canonical — run from backend/python so `app` imports cleanly):
  cd backend/python
  python3 ../.claude/skills/tayari-diagnostics-and-tooling/scripts/ats_probe.py            # built-in sample
  python3 .../ats_probe.py --resume resume.txt --jd jd.txt
  python3 .../ats_probe.py --resume resume.txt                 # structural-only, no JD
  python3 .../ats_probe.py --json                              # raw engine dict as JSON
The script also inserts <repo>/backend/python onto sys.path from its own location,
so it runs from any CWD without setting PYTHONPATH.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _ensure_importable() -> None:
    """Make `app` importable whether run from backend/python or anywhere else.

    This script lives at
      <repo>/.claude/skills/tayari-diagnostics-and-tooling/scripts/ats_probe.py
    so <repo>/backend/python is parents[4]/backend/python.
    """
    try:
        import app.services.ats_engine  # noqa: F401
        return
    except ModuleNotFoundError:
        pass
    repo_root = Path(__file__).resolve().parents[4]
    py_dir = repo_root / "backend" / "python"
    if (py_dir / "app").is_dir():
        sys.path.insert(0, str(py_dir))


SAMPLE_RESUME = """Jordan Rivera
jordan.rivera@example.com | +1 (555) 018-2277 | San Francisco, CA

Summary
Senior Data Engineer with 8 years building high-throughput data pipelines and
platforms. Focus on Python, Spark, and streaming systems.

Experience
Senior Data Engineer — Northwind Data (2023-Present)
- Built ETL pipelines processing 12TB/day on Spark and Kafka, cutting latency 40%
- Led a team of 5 engineers delivering a self-serve data platform used by 200+ analysts
- Designed distributed stream-processing handling 1M events/sec with 99.95% uptime
- Reduced cloud spend 25% by optimizing Airflow scheduling and S3 lifecycle rules
- Implemented automated data-quality checks, improving pipeline reliability

Data Engineer — Acme Analytics (2019-2023)
- Developed batch and streaming jobs in Python and SQL on AWS
- Increased test coverage from 40% to 85% across the ingestion codebase

Skills
Python, SQL, Spark, Kafka, Airflow, AWS, Kubernetes, Docker, dbt, Snowflake

Education
BS Computer Science — State University (2015)
"""

SAMPLE_JD = """Senior Data Engineer
We are hiring a Senior Data Engineer to build and scale our data platform.
You will design data pipelines and distributed systems using Python, Spark,
Kafka, and AWS. Experience with Airflow, streaming, and data quality is required.
Strong collaboration and ownership in a fast-paced environment.
"""


def _read(path: str | None) -> str | None:
    if not path:
        return None
    p = Path(path)
    if not p.is_file():
        print(f"ERROR: file not found: {path}", file=sys.stderr)
        sys.exit(2)
    return p.read_text(encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description="Deterministic ATS probe (no server, no LLM).")
    ap.add_argument("--resume", help="Path to a resume .txt file (default: built-in sample).")
    ap.add_argument("--jd", help="Path to a job-description .txt file (optional).")
    ap.add_argument("--json", action="store_true", help="Print the raw engine dict as JSON and exit.")
    args = ap.parse_args()

    _ensure_importable()
    try:
        from app.services import ats_engine
    except ModuleNotFoundError as exc:
        print(f"ERROR: could not import app.services.ats_engine ({exc}).", file=sys.stderr)
        print("Run from backend/python, or set REPO layout so <repo>/backend/python/app exists.",
              file=sys.stderr)
        return 2

    resume = _read(args.resume) if args.resume else SAMPLE_RESUME
    jd = _read(args.jd) if args.jd else (None if args.resume else SAMPLE_JD)
    using_sample = args.resume is None

    result = ats_engine.heuristic_ats_score(resume, jd)

    if args.json:
        print(json.dumps(result, indent=2, default=str))
        return 0

    checks = result.get("checks", [])
    passed = sum(1 for c in checks if c["passed"])
    total_weight = sum(c["weight"] for c in checks)
    earned_weight = sum(c["weight"] for c in checks if c["passed"])
    score = result.get("score", 0)

    print("=" * 64)
    print("ATS PROBE — deterministic structural score (no LLM)")
    if using_sample:
        print("  (using built-in SAMPLE resume + JD — pass --resume/--jd for real input)")
    elif jd is None:
        print("  (structural-only run — no JD, keyword/title checks are absent)")
    print("=" * 64)
    print(f"SCORE: {score}/100    checks passed: {passed}/{len(checks)}    "
          f"weight: {earned_weight}/{total_weight}")
    band = ("High/Excellent (>=80): bottleneck is interview signal, not keywords" if score >= 80
            else "Good (60-79): fix the FAILED high-weight checks below" if score >= 60
            else "Needs work (<60): structural gaps are hurting parse-ability")
    print(f"BAND:  {band}")
    kmp = result.get("keyword_match_pct")
    if kmp is not None:
        print(f"JD keyword/phrase coverage: {kmp}%   (0.7*token% + 0.3*bigram%)")
    print(f"Sections found: {', '.join(result.get('sections_found', [])) or '(none)'}")
    print("-" * 64)
    print(f"{'RESULT':6}  {'WT':>2}  CHECK")
    for c in sorted(checks, key=lambda x: (-x["weight"], x["name"])):
        mark = "PASS" if c["passed"] else "FAIL"
        print(f"{mark:6}  {c['weight']:>2}  {c['name']} — {c['detail']}")
    print("-" * 64)

    fails = [c for c in checks if not c["passed"]]
    if fails:
        top = sorted(fails, key=lambda x: -x["weight"])[:3]
        print("Biggest wins (highest-weight FAILED checks):")
        for c in top:
            print(f"  +{c['weight']} pts if fixed: {c['name']}")
    else:
        print("All checks passed — structural ceiling reached (remember: STRUCTURAL only).")

    matched = result.get("matched_keywords") or []
    missing = result.get("missing_keywords") or []
    if jd is not None:
        print(f"Matched JD keywords ({len(matched)}): {', '.join(matched[:15]) or '(none)'}")
        print(f"Missing JD keywords ({len(missing)}): {', '.join(missing[:15]) or '(none)'}")
    print("Reminder: STRUCTURAL only (~7/10). NOT a real Greenhouse/Workday score.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
