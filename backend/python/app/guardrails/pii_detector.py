"""PII detector — flag sensitive identifiers in resume text."""
import re


# Regex patterns for common PII in US/North American resumes
_PII_PATTERNS = [
    ("SSN", r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b"),
    ("Credit Card", r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
    ("Passport (US)", r"\b[A-Z]\d{7,9}\b"),  # rough heuristic
    ("Passport (UK/CA)", r"\b[A-Z]{1,2}\d{6,9}\b"),  # rough heuristic
    ("Bank Account (US)", r"\b\d{8,17}\b"),  # very rough, used with context
    ("Driver's License", r"\b[A-Z]{1,2}\d{6,8}\b"),  # rough heuristic
]


def _context_filter(text: str, match: re.Match, label: str) -> bool:
    """Reduce false positives by checking surrounding context."""
    start = max(0, match.start() - 40)
    end = min(len(text), match.end() + 40)
    context = text[start:end].lower()

    # SSN: avoid matching years (1900-2099) or phone extensions
    if label == "SSN":
        # Year pattern 19xx or 20xx is common false positive
        if re.match(r"^(19|20)\d{2}$", match.group().replace("-", "").replace(" ", "")):
            return False
        if "year" in context or "phone" in context or "extension" in context:
            return False
        return True

    # Credit card: avoid matching phone numbers or long dates
    if label == "Credit Card":
        if "phone" in context or "tel" in context or "fax" in context:
            return False
        return True

    # Passport: avoid matching model numbers, serial numbers
    if "passport" in context or "passport" in text[max(0, match.start()-80):match.start()].lower():
        return True
    if label.startswith("Passport"):
        # high false-positive rate without explicit keyword
        return False

    # Bank account: needs explicit context
    if label == "Bank Account (US)" and not any(
        kw in context for kw in ["account", "routing", "bank", "deposit", "iban"]
    ):
        return False

    # Driver's license: needs explicit context
    if label == "Driver's License" and not any(
        kw in context for kw in ["license", "driver", "dl", "d.l."]
    ):
        return False

    return True


def check_pii(text: str) -> dict:
    """Detect PII in resume text.

    Returns {"passed": bool, "pii_found": [...]}
    """
    text = text or ""
    pii_found = []

    for label, pattern in _PII_PATTERNS:
        for match in re.finditer(pattern, text):
            if _context_filter(text, match, label):
                pii_found.append({
                    "type": label,
                    "match": match.group(),
                    "position": match.start(),
                })

    # Remove duplicates
    seen = set()
    deduped = []
    for item in pii_found:
        key = (item["type"], item["match"], item["position"])
        if key not in seen:
            seen.add(key)
            deduped.append(item)

    return {
        "passed": len(deduped) == 0,
        "pii_found": deduped,
    }
