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
    current_year = 2026
    is_recent = bool(years) and max(years) >= current_year - 1
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
    }
