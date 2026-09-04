"""PII scrubbing before LLM calls — stdlib regex only."""
from __future__ import annotations

import re

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
# ponytail: phone before SSN so 3-3-4 never partially matches the 3-2-4 SSN pattern.
_PHONE_RE = re.compile(r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
# ponytail: same SSN shape as guardrails/pii_detector.py for detection parity.
_SSN_RE = re.compile(r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b")
_ADDRESS_RE = re.compile(
    r"\b\d{1,5}\s+[A-Za-z0-9][A-Za-z0-9.\s'\-]{1,40}?\s+"
    r"(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|"
    r"Court|Ct|Circle|Cir|Parkway|Pkwy|Terrace|Plaza|Way)\b\.?",
    re.IGNORECASE,
)


def _is_year(digits: str) -> bool:
    return bool(re.fullmatch(r"(19|20)\d{2}", digits))


def scrub(text: str) -> tuple[str, list[str]]:
    """Redact PII; return (scrubbed_text, field_types). Types only, never values."""
    if not text:
        return text, []
    found: set[str] = set()

    def _sub_phone(m: re.Match) -> str:
        found.add("phone")
        return "[PHONE]"

    def _sub_ssn(m: re.Match) -> str:
        digits = re.sub(r"[-\s]", "", m.group())
        # ponytail: skip bare years (1900-2099) to match pii_detector parity.
        if _is_year(digits):
            return m.group()
        found.add("ssn")
        return "[SSN]"

    def _sub_email(m: re.Match) -> str:
        found.add("email")
        return "[EMAIL]"

    def _sub_address(m: re.Match) -> str:
        found.add("address")
        return "[ADDRESS]"

    out = _PHONE_RE.sub(_sub_phone, text)
    out = _SSN_RE.sub(_sub_ssn, out)
    out = _EMAIL_RE.sub(_sub_email, out)
    out = _ADDRESS_RE.sub(_sub_address, out)
    return out, sorted(found)
