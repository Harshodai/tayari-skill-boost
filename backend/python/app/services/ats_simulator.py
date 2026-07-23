"""ATS Plain-Text Parser Simulator.

Simulates how top Applicant Tracking Systems (Greenhouse, Lever, Workday, Taleo)
parse, tokenize, and extract plain text and entities from candidate resumes.
"""

from __future__ import annotations
import re
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


def simulate_ats_parsing(resume_text: str) -> Dict[str, Any]:
    """Simulate plain-text extraction and issue diagnostic warnings for ATS compatibility."""
    lines = resume_text.splitlines()
    clean_lines = [l.strip() for l in lines if l.strip()]
    plain_text = "\n".join(clean_lines)

    warnings: List[str] = []
    
    # 1. Check for table / multi-column indicators
    if re.search(r"(\t+|\s{4,})", plain_text):
        warnings.append("Possible multi-column or tabbed layout detected — ATS parsers may misorder sections.")

    # 2. Check for missing standard headings
    lower_text = plain_text.lower()
    standard_headings = ["experience", "education", "skills"]
    missing_headings = [h for h in standard_headings if h not in lower_text]
    if missing_headings:
        warnings.append(f"Missing recommended standard heading(s): {', '.join(missing_headings).upper()}")

    # 3. Check email & phone parsing
    email_match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", plain_text)
    phone_match = re.search(r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", plain_text)

    if not email_match:
        warnings.append("Email address not easily parseable at top of document.")
    if not phone_match:
        warnings.append("Phone number not formatted in standard US/International format.")

    # 4. Special character checks
    special_chars = re.findall(r"[^\x00-\x7F]", plain_text)
    if len(special_chars) > 10:
        warnings.append("Non-standard unicode symbols or icons detected. May cause junk character corruption in legacy ATS.")

    # 5. Extract parsed fields
    parsed_contact = {
        "email": email_match.group(0) if email_match else None,
        "phone": phone_match.group(0) if phone_match else None,
        "parsed_lines_count": len(clean_lines),
        "word_count": len(plain_text.split())
    }

    # ATS Parsability Grade
    score = 100 - (len(warnings) * 15)
    score = max(score, 30)

    return {
        "plain_text_preview": plain_text[:1500] + ("..." if len(plain_text) > 1500 else ""),
        "parsability_score": score,
        "parsed_contact": parsed_contact,
        "warnings": warnings,
        "simulated_ats_engines": {
            "greenhouse": "COMPATIBLE" if score >= 70 else "WARNINGS",
            "lever": "COMPATIBLE" if score >= 75 else "WARNINGS",
            "workday": "COMPATIBLE" if score >= 80 else "NEEDS_REFORMATTING"
        }
    }
