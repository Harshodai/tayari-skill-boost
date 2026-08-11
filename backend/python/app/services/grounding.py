"""Shared grounding guards (WS-08).

Lifted out of the orphaned ``AutopilotGraphEngine`` so the live pipeline
(``automation_engine``) enforces the same anti-fabrication rules the graph
engine had but never applied in production. Pure functions, no state.
"""

from __future__ import annotations

import re

MAX_OUTPUT_SIZE = 20_000

_FABRICATED_MARKERS = ("@fake", "example.com", "placeholder", "[your", "xxx-xxx")
_CONTACT_NUMBER_RE = re.compile(r"(?<!\w)\+?\d[\d\s().-]{7,}\d")
_EMPLOYER_RE = re.compile(
    r"(?:at|with)\s+([A-Z][A-Za-z0-9&.'-]{1,}(?:\s+[A-Z][A-Za-z0-9&.'-]{1,})?)"
)
_CREDENTIAL_RE = re.compile(r"\b(?:CISSP|CCSP|AWS|AZ|PMP|MSCE|MBA|Ph\.?D\.?)\b")


def _digits(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def verified_contact(value: object, resume_text: str) -> str:
    """Return the contact value only if it is traceable to the resume, else ""."""
    if not isinstance(value, str):
        return ""
    stripped = value.strip()
    if not stripped:
        return ""
    if stripped.lower() in (resume_text or "").lower():
        return stripped
    if any(ch.isdigit() for ch in stripped):
        digits = _digits(stripped)
        # A realistic contact number has at least 7 digits; short numbers
        # (zip codes, extensions) must never pass on the digit fallback.
        if len(digits) >= 7 and digits in _digits(resume_text or ""):
            return stripped
    return ""


def claims_supported(text: str, resume_text: str, job_description: str) -> bool:
    """Reject generated text that invents contacts, employers, or credentials."""
    if not text:
        return False
    lowered = text.lower()
    sources = f"{resume_text or ''} {job_description or ''}".lower()
    if any(marker in lowered for marker in _FABRICATED_MARKERS):
        return False
    if len(text) > MAX_OUTPUT_SIZE:
        return False
    resume_digits = _digits(resume_text or "")
    for number in _CONTACT_NUMBER_RE.findall(text):
        digits = _digits(number)
        if digits and digits not in resume_digits:
            return False
    for employer in _EMPLOYER_RE.findall(text):
        if employer.lower() not in sources:
            return False
    for credential in _CREDENTIAL_RE.findall(text):
        if credential.lower() not in sources:
            return False
    return True
