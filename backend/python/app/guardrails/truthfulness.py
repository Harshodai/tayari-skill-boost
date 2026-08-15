"""Truthfulness guardrail — detect hallucinations / factual drift in optimized resume."""
import re


def _extract_facts(text: str) -> dict:
    """Extract lightweight factual anchors from resume text."""
    text = text or ""
    lower = text.lower()

    # Employers / companies: capitalized word sequences after "at", "with", "for"
    employers = set(re.findall(
        r"(?:at|with|for|@)\s+([A-Z][A-Za-z0-9&\s]{2,40}?)(?=\s|,|\.|;|$)", text))

    # Job titles: capitalized words before "at" or after "-" bullets
    titles = set(re.findall(
        r"(?:^|\n|\s{2,})([A-Z][A-Za-z\s]{2,30}?)(?=\s+at\s|@|,)", text))

    # Years / dates: 4-digit years and month-year ranges
    years = set(re.findall(r"\b(?:19|20)\d{2}\b", text))
    date_phrases = set(re.findall(
        r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,.]+\d{4}", lower))

    # Degrees / credentials
    degrees = set(re.findall(
        r"\b(?:bs|ba|ms|ma|mba|phd|md|jd|pmp|cfa|cpa|aws|azure|gcp)\b", lower))

    # Contact email (partial match for identity drift)
    email = set(re.findall(r"[\w.+-]+@[\w-]+\.[\w.]+", text))

    return {
        "employers": employers,
        "titles": titles,
        "years": years,
        "date_phrases": date_phrases,
        "degrees": degrees,
        "email": email,
    }


def check_truthfulness(original_text: str, optimized_text: str) -> dict:
    """Compare optimized_text against original_text for factual drift.

    Returns {"passed": bool, "violations": [...]}
    """
    original_text = original_text or ""
    optimized_text = optimized_text or ""

    orig = _extract_facts(original_text)
    opt = _extract_facts(optimized_text)

    violations = []
    passed = True

    # 1. Employers should not disappear without reason (warn, not hard-fail)
    missing_employers = orig["employers"] - opt["employers"]
    if len(missing_employers) >= 3:
        violations.append(
            f"Many employers dropped ({len(missing_employers)}): possible rewrite drift."
        )
        passed = False

    # 2. Years should not be invented
    invented_years = opt["years"] - orig["years"]
    if invented_years:
        violations.append(
            f"New years not in original: {sorted(invented_years)}"
        )
        passed = False

    # 3. Dates should not be invented
    invented_dates = opt["date_phrases"] - orig["date_phrases"]
    if invented_dates:
        violations.append(
            f"New date phrases not in original: {sorted(invented_dates)}"
        )
        passed = False

    # 4. Degrees / credentials should not be invented
    invented_degrees = opt["degrees"] - orig["degrees"]
    if invented_degrees:
        violations.append(
            f"New credentials not in original: {sorted(invented_degrees)}"
        )
        passed = False

    # 5. Email should not change (hard identity signal)
    if orig["email"] and opt["email"] and orig["email"] != opt["email"]:
        violations.append("Contact email changed — possible identity drift.")
        passed = False

    # 6. Length sanity check — if optimized is <30% of original, likely truncation
    orig_len = len(original_text.split())
    opt_len = len(optimized_text.split())
    if orig_len > 50 and opt_len < orig_len * 0.3:
        violations.append(
            f"Optimized resume severely truncated ({opt_len}/{orig_len} words)."
        )
        passed = False

    # 7. Source-Locked Claim Ledger check (zero hallucination of bullet metrics)
    from app.services.claim_ledger import build_claim_ledger
    ledger_result = build_claim_ledger(original_text, optimized_text)
    if not ledger_result["all_grounded"]:
        for v in ledger_result["violations"][:3]:
            violations.append(f"Claim Ledger: {v}")
        passed = False

    return {
        "passed": passed,
        "violations": violations,
        "claim_ledger": ledger_result,
    }
