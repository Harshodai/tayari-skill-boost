from __future__ import annotations
"""Deterministic (heuristic) ATS scoring engine.
Runs instantly without an LLM and gives a reproducible baseline score 0-100.
The LLM analysis layered on top refines this with semantic understanding.
"""
import re

from app.guardrails.pii_detector import check_pii


SECTION_PATTERNS = {
    "experience": r"(work\s+experience|professional\s+experience|employment|experience)",
    "education": r"(education|academic|qualification)",
    "skills": r"(skills|technologies|technical\s+skills|competencies)",
    "summary": r"(summary|objective|profile|about)",
}

ACTION_VERBS = [
    "achieved", "built", "created", "delivered", "designed", "developed", "drove",
    "engineered", "established", "implemented", "improved", "increased", "launched",
    "led", "managed", "optimized", "reduced", "spearheaded", "streamlined", "transformed",
]

STOPWORDS = set(
    "a an and are as at be by for from has have in is it of on or that the to was were "
    "will with you your we our they this their i".split()
)

# --- Scoring constants (single source of truth for thresholds/bands) -------
# ponytail: named instead of magic numbers so the score/band logic and the UI
# thresholds stay traceable. UI mirrors ATS_SCORE_HIGH/MED in ResumeResults.
ATS_SCORE_HIGH = 80      # "High"/"Excellent" threshold; also the plateau cutoff
ATS_SCORE_MEDIUM = 60    # "Medium"/"Good" threshold
ATS_PLATEAU_THRESHOLD = ATS_SCORE_HIGH  # above this → bottleneck = interview signal
_CURRENT_YEAR = 2026     # ponytail: pinned; swap for date-based if multi-year runs matter

# Per-ATS confidence band widths (±). Wider when signals disagree (no JD) or
# the score sits near the 50/50 uncertainty line.
_ATS_BAND_WIDE = 10      # no keyword signal available
_ATS_BAND_MEDIUM = 8     # score within ±15 of 50 (uncertain)
_ATS_BAND_NARROW = 6     # score far from 50 (signals converge)
_ATS_BAND_WIDEN_NEAR = 15  # distance from 50 that triggers the medium band


def _tokenize(text: str) -> set:
    return {t for t in re.findall(r"[a-zA-Z][a-zA-Z+#.\-]{1,}", text.lower())
            if t not in STOPWORDS and len(t) > 2}


def _bigrams(text: str) -> set:
    """Exact 2-word phrases - ATS keyword matching favors exact phrases over
    single tokens (e.g. 'machine learning', 'project management')."""
    words = [w for w in re.findall(r"[a-zA-Z][a-zA-Z+#.\-]*", text.lower())
             if w not in STOPWORDS and len(w) > 2]
    return {f"{a} {b}" for a, b in zip(words, words[1:])}


def _extract_jd_title(job_description: str) -> str:
    """Best-effort job title from a JD: first short non-sentence line."""
    for line in job_description.splitlines():
        line = line.strip()
        if 2 < len(line) < 70 and not line.endswith(('.', ':')):
            return line
    return ""


def heuristic_ats_score(resume_text: str, job_description: str | None = None) -> dict:
    text = resume_text or ""

    # PII guardrail on input
    pii_result = check_pii(text)

    lower = text.lower()
    words = text.split()
    word_count = len(words)
    checks = []

    def add_check(name, passed, weight, detail):
        checks.append({"name": name, "passed": bool(passed), "weight": weight, "detail": detail})

    has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text))
    has_phone = bool(re.search(r"(\+?\d[\d\s().-]{8,}\d)", text))
    add_check("Contact email", has_email, 8, "Recruiters need an email to reach you")
    add_check("Phone number", has_phone, 5, "Add a phone number for faster contact")

    found_sections = []
    for section, pattern in SECTION_PATTERNS.items():
        if re.search(pattern, lower):
            found_sections.append(section)
    add_check("Experience section", "experience" in found_sections, 12,
              "A clear experience section is the #1 thing ATS parsers look for")
    add_check("Education section", "education" in found_sections, 8,
              "List your education with dates")
    add_check("Skills section", "skills" in found_sections, 12,
              "A dedicated skills section maximizes keyword matching")
    add_check("Summary / objective", "summary" in found_sections, 5,
              "A short professional summary helps both ATS and recruiters")

    good_length = 300 <= word_count <= 1100
    add_check("Optimal length", good_length, 8,
              f"Resume has {word_count} words (ideal: 300-1100, roughly 1-2 pages)")

    bullet_count = len(re.findall(r"(?m)^\s*[•\-\*\u2022]", text))
    add_check("Bullet points", bullet_count >= 5, 8,
              f"{bullet_count} bullet points found - bullets improve ATS parsing")

    verb_hits = sum(1 for v in ACTION_VERBS if v in lower)
    add_check("Action verbs", verb_hits >= 5, 8,
              f"{verb_hits} strong action verbs found (led, built, improved...)")

    quantified = len(re.findall(r"\d+\s*%|\$\s*\d|\d+[kKmM]\+?|\b\d{2,}\b", text))
    add_check("Quantified achievements", quantified >= 5, 10,
              f"{quantified} numbers/metrics found - quantified results rank higher")

    has_dates = bool(re.search(
        r"(19|20)\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec", lower))
    add_check("Dates present", has_dates, 6, "ATS systems extract employment dates")

    # Recency: parsers and ranking models weight recent experience heavily
    years = [int(y) for y in re.findall(r"\b(19\d{2}|20\d{2})\b", text)]
    is_recent = bool(years) and max(years) >= _CURRENT_YEAR - 1
    add_check("Recent experience visible", is_recent, 5,
              "Most recent role should show a current/last-year date (or 'Present')"
              if not ("present" in lower or "current" in lower) else
              "Current role detected - recency signal is strong")
    if "present" in lower or "current" in lower:
        checks[-1]["passed"] = True

    keyword_score_pct = None
    matched_keywords: list = []
    missing_keywords: list = []
    if job_description and job_description.strip():
        jd_tokens = _tokenize(job_description)
        resume_tokens = _tokenize(text)
        overlap = jd_tokens & resume_tokens

        # Exact phrase (bigram) matching - exact phrases outrank single tokens in ATS
        jd_phrases = _bigrams(job_description)
        resume_phrases = _bigrams(text)
        phrase_overlap = jd_phrases & resume_phrases
        phrase_pct = round(100 * len(phrase_overlap) / max(len(jd_phrases), 1))

        token_pct = round(100 * len(overlap) / max(len(jd_tokens), 1))
        keyword_score_pct = round(0.7 * token_pct + 0.3 * phrase_pct)
        matched_keywords = sorted(overlap)[:30]
        missing_keywords = sorted(jd_tokens - resume_tokens)[:30]
        add_check("Job keyword match", keyword_score_pct >= 45, 10,
                  f"{keyword_score_pct}% weighted keyword/phrase coverage of the job description")

        # Job-title alignment - a major ATS visibility filter
        jd_title = _extract_jd_title(job_description)
        if jd_title:
            title_tokens = _tokenize(jd_title)
            title_hit = bool(title_tokens) and \
                len(title_tokens & resume_tokens) >= max(1, len(title_tokens) // 2)
            add_check("Job title alignment", title_hit, 7,
                      f"Resume {'mentions' if title_hit else 'should mention'} the target "
                      f"title wording: '{jd_title[:50]}'")

    total_weight = sum(c["weight"] for c in checks)
    earned = sum(c["weight"] for c in checks if c["passed"])
    score = round(100 * earned / max(total_weight, 1))

    return {
        "score": score,
        "ats_score": score,
        "category_scores": checks,
        "word_count": word_count,
        "sections_found": found_sections,
        "checks": checks,
        "keyword_match_pct": keyword_score_pct,
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords,
        "pii_check": pii_result,
        "per_ats": per_ats_estimate(checks, keyword_score_pct),
    }


# ponytail: per-ATS estimate is a heuristic REWEIGHTING of the same checks the
# single score uses — no new model. Different ATS parsers emphasize different
# dimensions (Workday weights format, Greenhouse weights keyword relevance,
# iCIMS weights contact + achievements). Confidence band widens when signals
# disagree (no JD → keyword checks absent → wider band). Ceiling: a real
# per-ATS parser would differ; this is an honest estimate, not a benchmark.
_ATS_WEIGHT_PROFILES = {
    "workday": {
        "Experience section": 1.4, "Education section": 1.3, "Skills section": 1.4,
        "Optimal length": 1.3, "Bullet points": 1.3, "Dates present": 1.3,
        "Job keyword match": 0.8, "Job title alignment": 0.9,
    },
    "greenhouse": {
        "Job keyword match": 1.6, "Job title alignment": 1.5,
        "Skills section": 1.2, "Action verbs": 1.1, "Quantified achievements": 1.1,
    },
    "icims": {
        "Contact email": 1.4, "Phone number": 1.3, "Quantified achievements": 1.4,
        "Action verbs": 1.3, "Recent experience visible": 1.2,
    },
}


def per_ats_estimate(checks: list, keyword_match_pct: int | None) -> dict:
    """Per-ATS score estimates + confidence band from existing check dimensions.

    Returns {estimates: {workday, greenhouse, icims}, band, confidence, plateau_note}.
    """
    estimates: dict[str, int] = {}
    for ats, profile in _ATS_WEIGHT_PROFILES.items():
        total = 0.0
        earned = 0.0
        for c in checks:
            w = c["weight"] * profile.get(c["name"], 1.0)
            total += w
            if c["passed"]:
                earned += w
        estimates[ats] = round(100 * earned / max(total, 1))
    base = max(estimates.values()) if estimates else 0
    # band widens when the keyword signal is absent (no JD) and when the score
    # sits near 50 — both mean the underlying signals are weak/disagreeing.
    if keyword_match_pct is None:
        band = _ATS_BAND_WIDE
    elif abs(base - 50) < _ATS_BAND_WIDEN_NEAR:
        band = _ATS_BAND_MEDIUM
    else:
        band = _ATS_BAND_NARROW
    plateau = (
        "Above 80 the bottleneck shifts from keywords to interview signal — start interview prep."
        if base >= ATS_PLATEAU_THRESHOLD else None
    )
    return {
        "estimates": estimates,
        "band": band,
        "confidence": f"±{band}",
        "plateau_note": plateau,
    }
