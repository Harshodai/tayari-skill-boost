from __future__ import annotations

import json
import re
import logging

from app.services.llm_service import llm_complete, extract_json

logger = logging.getLogger(__name__)

SECTION_HEADINGS = [
    (r"(?i)^headline\b", "headline"),
    (r"(?i)^about\b", "about"),
    (r"(?i)^summary\b", "about"),
    (r"(?i)^experience\b", "experience"),
    (r"(?i)^education\b", "education"),
    (r"(?i)^skills\b", "skills"),
    (r"(?i)^licenses\b", "licenses"),
    (r"(?i)^certifications?\b", "certifications"),
    (r"(?i)^languages?\b", "languages"),
    (r"(?i)^honors?\b", "honors"),
    (r"(?i)^publications?\b", "publications"),
    (r"(?i)^recommendations?\b", "recommendations"),
]


def parse_sections(text: str) -> dict[str, str]:
    lines = text.split("\n")
    sections: dict[str, str] = {}
    current_label = "headline"
    current_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        matched = False
        for pattern, label in SECTION_HEADINGS:
            if re.match(pattern, stripped):
                if current_lines:
                    sections[current_label] = "\n".join(current_lines).strip()
                current_label = label
                current_lines = []
                matched = True
                break
        if not matched:
            current_lines.append(stripped)

    if current_lines:
        sections[current_label] = "\n".join(current_lines).strip()

    return sections


async def score_linkedin_profile(profile_text: str) -> dict:
    sections = parse_sections(profile_text)

    prompt = f"""You are a LinkedIn profile optimization expert. Analyze this LinkedIn profile and return a JSON object with exactly these fields:

{{
  "sections": {{
    "headline": {{"score": 0-100, "feedback": "...", "suggestions": ["..."]}},
    "about": {{"score": 0-100, "feedback": "...", "suggestions": ["..."]}},
    "experience": {{"score": 0-100, "feedback": "...", "suggestions": ["..."]}},
    "education": {{"score": 0-100, "feedback": "...", "suggestions": ["..."]}},
    "skills": {{"score": 0-100, "feedback": "...", "suggestions": ["..."]}}
  }},
  "overall_score": 0-100,
  "key_recommendations": ["..."],
  "missing_elements": ["..."],
  "extracted_profile": {{
    "headline": "...",
    "about": "...",
    "current_role": "...",
    "current_company": "...",
    "years_experience": 0,
    "top_skills": ["..."],
    "education_history": ["..."]
  }}
}}

Scoring criteria:
- headline: keyword optimization, value proposition clarity, role specificity
- about: storytelling, keyword density, call to action, quantifiable impact
- experience: achievement language, quantified results, STAR format, progression narrative
- education: completeness, relevance to target roles
- skills: breadth, relevance, endorsement-worthy specificity

Profile text (each section parsed):

{json.dumps(sections, indent=2)}

Return ONLY the JSON object, no markdown."""

    try:
        raw = await llm_complete("You are a LinkedIn profile optimization expert.", prompt, max_tokens=2000)
        result = extract_json(raw)
        if result and isinstance(result, dict):
            return result
    except Exception as e:
        logger.warning("LLM LinkedIn analysis failed: %s", e)

    return {
        "overall_score": 50,
        "sections": {},
        "key_recommendations": ["LLM analysis unavailable — provide more profile detail for personalized suggestions."],
        "missing_elements": [],
        "extracted_profile": {},
    }
