"""Interview experience content moderation service.

Validates candidate-submitted interview questions and answers for:
- Profanity and abusive language
- Confidential PII and credentials (passwords, tokens, keys)
- Internal corporate URLs and hostnames
- Sensitive NDA disclaimers
"""
from __future__ import annotations

import re
from typing import Any

CONFIDENTIAL_PATTERNS = [
    r"\bpassword\b",
    r"\bpasscode\b",
    r"\bapi[_-]?key\b",
    r"\baccess[_-]?token\b",
    r"\bsecret[_-]?key\b",
    r"\bclient[_-]?secret\b",
    r"\bbearer\s+[a-zA-Z0-9_\-\.]{16,}\b",
    r"\bprivate[_-]?key\b",
    r"\b(ssn|social\s+security\s+(number)?)\b",
    r"\b\d{3}-\d{2}-\d{4}\b",
]

INTERNAL_URL_PATTERNS = [
    r"https?://localhost",
    r"https?://127\.0\.0\.1",
    r"https?://10\.\d{1,3}\.\d{1,3}\.\d{1,3}",
    r"https?://192\.168\.\d{1,3}\.\d{1,3}",
    r"https?://172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}",
    r"\.corp\b",
    r"\.internal\b",
    r"\.local\b",
    r"gitlab\.internal",
    r"jira\.internal",
    r"confluence\.internal",
]

PROFANITY_TOKENS = [
    "asshole",
    "bastard",
    "bitch",
    "bullshit",
    "cunt",
    "dick",
    "fuck",
    "fucking",
    "motherfucker",
    "nigger",
    "faggot",
    "shit",
    "whore",
]

CONFIDENTIAL_TERMS = [
    "non-disclosure",
    "under nda",
    "confidential project",
    "do not disclose",
    "strictly confidential",
    "proprietary source",
    "trade secret",
]


def moderate_experience_content(text: str) -> dict[str, Any]:
    """Analyze interview experience text for profanity, confidential PII, and internal links.

    Args:
        text: Raw text combining question, answer, company, and role.

    Returns:
        dict with:
            - approved: bool (True if clean, False if flagged)
            - flags: list[str] (reasons for flagging)
    """
    if not text or not text.strip():
        return {"approved": True, "flags": []}

    flags: list[str] = []
    text_lower = text.lower()

    # 1. Check for confidential credentials and PII patterns
    for pat in CONFIDENTIAL_PATTERNS:
        if re.search(pat, text_lower, re.IGNORECASE):
            flags.append("confidential_credential_or_pii")
            break

    # 2. Check for internal confidential URLs
    for pat in INTERNAL_URL_PATTERNS:
        if re.search(pat, text_lower, re.IGNORECASE):
            flags.append("internal_confidential_url")
            break

    # 3. Check for profanity
    for word in PROFANITY_TOKENS:
        if re.search(rf"\b{re.escape(word)}\b", text_lower):
            flags.append("profanity_or_abusive_language")
            break

    # 4. Check for explicit NDA / trade secret disclosures
    for term in CONFIDENTIAL_TERMS:
        if term in text_lower:
            flags.append("nda_or_trade_secret_disclosure")
            break

    approved = len(flags) == 0
    return {
        "approved": approved,
        "flags": flags,
    }
