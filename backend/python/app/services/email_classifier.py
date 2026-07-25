"""Email intent classifier and fuzzy matcher for auto-updating interview board stages."""
import re
from typing import Optional, Dict, Any, List
from app.guardrails.pii_detector import check_pii

# Keyword-based classifier patterns
STAGE_PATTERNS = {
    "phone_screen": [
        r"phone\s+(screen|interview|call)",
        r"recruiter\s+(call|chat)",
        r"initial\s+conversation",
        r"15[\s-]*minute\s+(call|chat)",
        r"30[\s-]*minute\s+(call|chat)",
    ],
    "interview": [
        r"(onsite|on[\s-]site|virtual|video)\s+interview",
        r"interview\s+(scheduled|confirmed|invitation)",
        r"meet\s+the\s+team",
        r"panel\s+interview",
        r"technical\s+interview",
        r"round\s+\d+",
    ],
    "offer": [
        r"offer\s+(letter|package|received)",
        r"congratulations.*offer",
        r"excited\s+to\s+offer",
        r"compensation\s+package",
        r"verbal\s+offer",
    ],
    "rejected": [
        r"(unfortunately|regret|sorry).*(move\s+forward|proceed|selected)",
        r"not\s+(moving|proceeding)\s+forward",
        r"position\s+has\s+been\s+filled",
        r"decided\s+to\s+move\s+forward\s+with\s+other",
    ],
    "applied": [
        r"application\s+received",
        r"thank\s+you\s+for\s+applying",
        r"application\s+submitted",
        r"we.+(received|got)\s+your\s+application",
    ],
}


def redact_pii_content(text: str) -> str:
    """Redact sensitive PII from email content before LLM / external processing."""
    pii_res = check_pii(text)
    redacted = text
    for item in pii_res.get("pii_found", []):
        raw = item.get("match")
        label = item.get("type")
        if raw:
            redacted = redacted.replace(raw, f"[{label}_REDACTED]")
    return redacted


def classify_email_stage(email_subject: str, email_body: str) -> Optional[str]:
    """Classify an email to determine application stage."""
    res, _ = classify_email_with_confidence(email_subject, email_body)
    return res


def classify_email_with_confidence(email_subject: str, email_body: str) -> tuple[Optional[str], float]:
    """Classify an email and compute a confidence score (0.0 to 1.0)."""
    clean_body = redact_pii_content(email_body)
    text = f"{email_subject} {clean_body}".lower()

    scores = {}
    total_matches = 0
    for stage, patterns in STAGE_PATTERNS.items():
        score = 0
        for pattern in patterns:
            matches = len(re.findall(pattern, text, re.IGNORECASE))
            score += matches
        if score > 0:
            scores[stage] = score
            total_matches += score

    if not scores:
        return None, 0.0

    best_stage = max(scores, key=scores.get)
    best_score = scores[best_stage]

    # Calculate confidence based on pattern match density & strength
    confidence = min(0.95, 0.65 + (best_score * 0.15))
    if best_score == 1 and total_matches > 2:
        confidence = 0.75

    return best_stage, round(confidence, 2)


def match_email_to_application(
    email_subject: str,
    email_body: str,
    applications: List[Dict[str, Any]],
    auto_move_consent: bool = False
) -> Dict[str, Any]:
    """Fuzzy link email to an application row and determine action based on confidence threshold (0.8)."""
    stage, stage_conf = classify_email_with_confidence(email_subject, email_body)
    text = f"{email_subject} {email_body}".lower()

    best_app = None
    best_app_score = 0.0

    for app in applications:
        company = (app.get("company") or "").lower().strip()
        role = (app.get("title") or app.get("role") or "").lower().strip()

        score = 0.0
        if company and re.search(r'(?<!\w)' + re.escape(company) + r'(?!\w)', text):
            score += 0.5
        if role and re.search(r'(?<!\w)' + re.escape(role) + r'(?!\w)', text):
            score += 0.4
        
        # Word overlap bonus for company using word boundaries
        if company and any(re.search(r'\b' + re.escape(word) + r'\b', text) for word in company.split() if len(word) > 3):
            score += 0.1

        if score > best_app_score:
            best_app_score = score
            best_app = app

    combined_confidence = round(stage_conf * (best_app_score if best_app_score > 0 else 0.5), 2)
    
    if best_app_score >= 0.5:
        combined_confidence = round(min(0.98, stage_conf * 0.5 + best_app_score * 0.5), 2)

    if not best_app or not stage:
        return {
            "matched": False,
            "stage": stage,
            "confidence": 0.0,
            "action": "none",
            "reason": "No matching application or stage identified."
        }

    # Strict confidence threshold check per spec: >= 0.8
    action = "auto_move" if (combined_confidence >= 0.8 and auto_move_consent) else "needs_review"

    return {
        "matched": True,
        "application_id": best_app.get("id"),
        "company": best_app.get("company"),
        "title": best_app.get("title") or best_app.get("role"),
        "current_stage": best_app.get("stage"),
        "new_stage": stage,
        "confidence": combined_confidence,
        "action": action,
        "audit_trail": {
            "trigger": "email_classifier",
            "auto_move_consent": auto_move_consent,
            "confidence": combined_confidence,
            "reason": f"Matched company '{best_app.get('company')}' with stage '{stage}'"
        }
    }


def extract_interview_details(email_subject: str, email_body: str) -> dict:
    """Extract interview date/time from email."""
    text = f"{email_subject} {email_body}"
    date_patterns = [
        r"(\w+day,?\s+\w+\s+\d{1,2},?\s+\d{4})",
        r"(\d{1,2}/\d{1,2}/\d{2,4})",
        r"(\w+\s+\d{1,2},?\s+\d{4})",
    ]
    time_patterns = [
        r"(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)",
        r"(\d{1,2}\s*(?:AM|PM|am|pm))",
    ]

    dates, times = [], []
    for p in date_patterns:
        dates.extend(re.findall(p, text))
    for p in time_patterns:
        times.extend(re.findall(p, text))

    stage, conf = classify_email_with_confidence(email_subject, email_body)
    return {
        "dates_found": dates[:3],
        "times_found": times[:3],
        "stage": stage,
        "confidence": conf
    }
