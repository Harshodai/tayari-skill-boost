"""Email intent classifier for auto-updating interview board stages."""
import re
from typing import Optional

# Keyword-based classifier (fast, no LLM needed)
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


def classify_email_stage(email_subject: str, email_body: str) -> Optional[str]:
    """Classify an email to determine application stage."""
    text = f"{email_subject} {email_body}".lower()
    
    scores = {}
    for stage, patterns in STAGE_PATTERNS.items():
        score = 0
        for pattern in patterns:
            matches = len(re.findall(pattern, text, re.IGNORECASE))
            score += matches
        if score > 0:
            scores[stage] = score
    
    if not scores:
        return None
    
    # Return stage with highest score
    return max(scores, key=scores.get)


def extract_interview_details(email_subject: str, email_body: str) -> dict:
    """Extract interview date/time from email."""
    text = f"{email_subject} {email_body}"
    
    # Date patterns
    date_patterns = [
        r"(\w+day,?\s+\w+\s+\d{1,2},?\s+\d{4})",
        r"(\d{1,2}/\d{1,2}/\d{2,4})",
        r"(\w+\s+\d{1,2},?\s+\d{4})",
    ]
    
    # Time patterns
    time_patterns = [
        r"(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)",
        r"(\d{1,2}\s*(?:AM|PM|am|pm))",
    ]
    
    dates = []
    for pattern in date_patterns:
        dates.extend(re.findall(pattern, text))
    
    times = []
    for pattern in time_patterns:
        times.extend(re.findall(pattern, text))
    
    return {
        "dates_found": dates[:3],
        "times_found": times[:3],
        "stage": classify_email_stage(email_subject, email_body),
    }
