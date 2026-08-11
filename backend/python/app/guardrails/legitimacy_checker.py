"""Job Posting Legitimacy & Ghost Job Risk Detector (Schema Based).

Computes Ghost Job Risk Score (0-100%) based on Pydantic schema validation,
posting staleness, boilerplate token ratio, and repeated reposting signals.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class LegitimacyAssessmentSchema(BaseModel):
    """Pydantic schema for job posting legitimacy evaluation."""
    title: str = Field(...)
    days_posted: int = Field(0, ge=0)
    ghost_job_risk_score: float = Field(..., ge=0.0, le=100.0)
    is_ghost_job_risk: bool = Field(...)
    risk_factors: List[str] = Field(default_factory=list)
    recommendation: str = Field(...)


class LegitimacyChecker:
    """Schema-based job posting legitimacy and ghost job risk evaluator."""

    BOILERPLATE_TERMS = [
        "fast-paced environment",
        "self-starter",
        "wear many hats",
        "competitive salary",
        "team player",
        "dynamic team"
    ]

    # Text-only ghost signals that do not depend on posting metadata
    # (days_posted / is_reposted), so the screener still fires on a fresh
    # scrape that carries only title + description. These map directly to
    # the documented ghost signals (audit P2 #15 / Flow 3): confidential
    # employer, urgency cues with no deadline, implausibly wide salary
    # bands, and the absence of a requirements/qualifications section.
    CONFIDENTIAL_PHRASES = [
        "confidential company",
        "confidential employer",
        "confidential firm",
        "a confidential",
    ]
    # Immediate-start/hiring phrases only. Generic calls-to-action
    # ("apply now", "asap") are normal marketing and never signal a ghost
    # job on their own — they were removed from the urgency set (2026-08-11).
    URGENCY_PHRASES = [
        "urgent hire",
        "urgent hiring",
        "immediate hire",
        "hire immediately",
        "immediate start",
    ]
    REQUIREMENTS_SECTION_HINTS = [
        "requirements",
        "qualifications",
        "must have",
        "you have",
        "you'll need",
        "we're looking for",
        "what you'll do",
    ]

    # Deadlines are a normal part of real job postings; a plain deadline is
    # NOT a ghost signal. The urgency factor only fires when an
    # immediate-start/hiring phrase appears without a confirmed deadline
    # (or together with one — the combo is the strongest signal).
    #
    # Direct deadline phrases always count. Standalone calendar dates only
    # count when nearby text carries an application/deadline cue, so an
    # unrelated date ("Founded Jan 15", "Est. 2010") does not fire the factor.
    DEADLINE_PHRASE_PATTERNS = [
        r"apply by \d{1,2}(?:st|nd|rd|th)?(?:\s+\w+)?",
        r"applications? close",
        r"application deadline",
        r"applications? (?:are )?due",
        r"due by \d{1,2}",
        r"\bdeadline\b",
    ]
    DEADLINE_DATE_PATTERNS = [
        r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b",
        r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
    ]
    # Context cues that make a standalone calendar date count as an
    # application deadline (looked up within a 40-char window before the date).
    DEADLINE_DATE_CONTEXT_RE = re.compile(
        r"\b(?:apply|application|applications|deadline|due|close|closes|closing|submit|by|before)\b",
        re.IGNORECASE,
    )
    SALARY_CONTEXT_RE = re.compile(r"salary|compensation|comp\b|pay|range|annual|per year", re.IGNORECASE)
    SALARY_RANGE_SEPARATOR_RE = re.compile(r"^\s*(?:to|-|–|—)\s*$")
    SALARY_AMOUNT_RE = re.compile(r"\$?\s*(\d{1,3}(?:[,\d]{0,9}))\s*(?:k|000)?")

    @staticmethod
    def _extract_application_deadline(desc_lower: str) -> bool:
        """Detect an explicit application deadline mention in the description.

        Direct deadline phrases ("application deadline", "due by", "apply by",
        bare "deadline") always count. A standalone calendar date only counts
        when nearby text carries an application/deadline cue, so an unrelated
        date ("Founded Jan 15") does not fire the urgency-deadline factor.
        """
        if any(re.search(p, desc_lower) for p in LegitimacyChecker.DEADLINE_PHRASE_PATTERNS):
            return True
        for p in LegitimacyChecker.DEADLINE_DATE_PATTERNS:
            for m in re.finditer(p, desc_lower):
                window_start = max(0, m.start() - 40)
                if LegitimacyChecker.DEADLINE_DATE_CONTEXT_RE.search(desc_lower[window_start:m.start()]):
                    return True
        return False

    @staticmethod
    def _detect_wide_salary_range(desc_lower: str) -> bool:
        """Flag an implausibly wide salary band, e.g. '$40k to $140k' or '$40,000-$140,000'.

        A >3x spread between the floor and ceiling is a known ghost signal:
        the recruiter can point at any candidate and say 'you're in range'.
        Only a SINGLE paired range counts — separate compensation values
        ("$120k salary plus $20k signing bonus") are not a range.
        """
        matches = list(LegitimacyChecker.SALARY_AMOUNT_RE.finditer(desc_lower))
        for i in range(len(matches) - 1):
            first, second = matches[i], matches[i + 1]
            between = desc_lower[first.end():second.start()]
            if not LegitimacyChecker.SALARY_RANGE_SEPARATOR_RE.match(between):
                continue
            context_start = max(0, first.start() - 40)
            context_end = min(len(desc_lower), second.end() + 40)
            # Salary context may precede the range ("Salary: $40k to $140k") or
            # follow it ("40k to 140k base salary"); currency notation on EITHER
            # bound also signals a compensation range.
            if not LegitimacyChecker.SALARY_CONTEXT_RE.search(desc_lower[context_start:context_end]) and "$" not in first.group(0) and "$" not in second.group(0):
                continue
            try:
                lo = float(first.group(1).replace(",", ""))
                hi = float(second.group(1).replace(",", ""))
            except ValueError:
                continue
            if "k" in desc_lower[first.start():first.end() + 1]:
                lo *= 1000
            if "k" in desc_lower[second.start():second.end() + 1]:
                hi *= 1000
            lo, hi = min(lo, hi), max(lo, hi)
            if hi >= lo * 3 and hi - lo >= 50000:
                return True
        return False

    @staticmethod
    def evaluate_posting_legitimacy(
        title: str,
        description: str,
        days_posted: int = 0,
        is_reposted: bool = False
    ) -> Dict[str, Any]:
        """Compute Ghost Job Risk Score using Pydantic schema validation."""
        risk_score = 0.0
        risk_factors: List[str] = []

        if days_posted >= 45:
            risk_score += 40.0
            risk_factors.append(f"Posting is stale ({days_posted} days old)")
        elif days_posted >= 30:
            risk_score += 20.0
            risk_factors.append(f"Posting is aging ({days_posted} days old)")

        if is_reposted:
            risk_score += 25.0
            risk_factors.append("Job has been repeatedly reposted")

        desc_lower = description.lower()
        bp_matches = [term for term in LegitimacyChecker.BOILERPLATE_TERMS if term in desc_lower]
        if len(bp_matches) >= 3:
            risk_score += 20.0
            risk_factors.append("High boilerplate text ratio detected")

        if len(description.strip()) < 200:
            risk_score += 15.0
            risk_factors.append("Vague or unusually short job description")

        confidential_hits = [p for p in LegitimacyChecker.CONFIDENTIAL_PHRASES if p in desc_lower]
        if confidential_hits:
            risk_score += 20.0
            risk_factors.append("Confidential / unnamed employer")

        urgency_hits = [p for p in LegitimacyChecker.URGENCY_PHRASES if p in desc_lower]
        if urgency_hits:
            risk_score += 15.0
            deadline_confirmed = LegitimacyChecker._extract_application_deadline(desc_lower)
            if deadline_confirmed:
                risk_factors.append("Urgent hire with explicit deadline")
            else:
                risk_factors.append("Urgency cue with no deadline")

        if LegitimacyChecker._detect_wide_salary_range(desc_lower):
            risk_score += 15.0
            risk_factors.append("Implausibly wide salary range")

        has_requirements = any(h in desc_lower for h in LegitimacyChecker.REQUIREMENTS_SECTION_HINTS)
        if not has_requirements and len(description.strip()) >= 200:
            risk_score += 10.0
            risk_factors.append("No requirements / qualifications section")

        risk_score = min(risk_score, 100.0)
        is_ghost_job = risk_score >= 50.0

        assessment = LegitimacyAssessmentSchema(
            title=title,
            days_posted=days_posted,
            ghost_job_risk_score=risk_score,
            is_ghost_job_risk=is_ghost_job,
            risk_factors=risk_factors,
            recommendation="High ghost job risk — proceed with caution or verify company contact" if is_ghost_job else "Legitimate posting"
        )
        return assessment.model_dump() if hasattr(assessment, "model_dump") else assessment.dict()
