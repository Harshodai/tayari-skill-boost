"""Minimal Typst ATS Resume Builder & Parser round-trip validator (Mission M9)."""
import re
import logging
from typing import Dict, Any, List, Optional
from app.guardrails.truth_gate import verify_resume_truthfulness

logger = logging.getLogger(__name__)

# 3 ATS-Safe Single-Column Typst Templates per Spec §M9
TYPST_TEMPLATES = {
    "classic": """
#set page(paper: "us-letter", margin: (x: 0.75in, y: 0.75in))
#set text(font: "Georgia", size: 10pt)

= {full_name}
{contact_info}

== Professional Summary
{summary}

== Experience
{experience_bullets}

== Skills
{skills_list}

== Education
{education_info}
""",
    "modern": """
#set page(paper: "us-letter", margin: (x: 0.6in, y: 0.6in))
#set text(font: "Helvetica", size: 9.5pt)

= {full_name}
{contact_info}

== Executive Summary
{summary}

== Core Competencies
{skills_list}

== Professional Experience
{experience_bullets}

== Education & Credentials
{education_info}
""",
    "compact": """
#set page(paper: "us-letter", margin: (x: 0.5in, y: 0.5in))
#set text(font: "Arial", size: 9pt)

= {full_name} | {contact_info}

== Summary
{summary}

== Key Technical Skills
{skills_list}

== Professional History
{experience_bullets}

== Education
{education_info}
"""
}


def escape_typst(text: str) -> str:
    """Neutralize Typst markup control characters to prevent code injection."""
    if not isinstance(text, str):
        text = str(text)
    for char in ["\\", "#", "[", "]", "_", "*", "$", "<", ">", "~", "`", "\""]:
        text = text.replace(char, "\\" + char)
    # Neutralize lines that attempt to start Typst headings or comments within interpolated text
    lines = text.split("\n")
    escaped_lines = []
    for line in lines:
        if line.startswith("="):
            line = "\\" + line
        escaped_lines.append(line)
    return "\n".join(escaped_lines)


def render_typst_resume(profile_data: Dict[str, Any], template_name: str = "classic") -> str:
    """Render a clean, single-column ATS-safe Typst document."""
    template = TYPST_TEMPLATES.get(template_name, TYPST_TEMPLATES["classic"])

    skills = profile_data.get("skills", [])
    if isinstance(skills, list):
        skills_formatted = ", ".join([escape_typst(s) for s in skills])
    else:
        skills_formatted = escape_typst(skills)

    bullets = profile_data.get("experience", ["Software Engineer - Built high performance scalable services."])
    if isinstance(bullets, list):
        bullets_formatted = "\n".join([f"- {escape_typst(b)}" for b in bullets])
    else:
        bullets_formatted = escape_typst(bullets)

    return template.format(
        full_name=escape_typst(profile_data.get("full_name", "Jane Doe")),
        contact_info=escape_typst(profile_data.get("contact_info", "jane@example.com | 555-0199 | San Francisco, CA")),
        summary=escape_typst(profile_data.get("summary", "Experienced Senior Software Engineer building scalable distributed backends.")),
        skills_list=skills_formatted,
        experience_bullets=bullets_formatted,
        education_info=escape_typst(profile_data.get("education", "B.S. Computer Science — Stanford University")),
    ).strip()


def parse_structured_resume_sections(text: str) -> Dict[str, str]:
    """Parse sections from Typst text to verify lossless round-trip section extraction."""
    sections = {}
    current_section = "header"
    lines = text.split("\n")
    buffer = []

    for line in lines:
        stripped = line.strip()
        if re.match(r'^==\s+\S', stripped):
            if buffer:
                sections[current_section] = "\n".join(buffer).strip()
                buffer = []
            # Remove leading "==" and whitespace without stripping inner/trailing content
            section_title = re.sub(r'^==\s*', '', stripped).rstrip("=").strip().lower()
            current_section = section_title
        else:
            buffer.append(line)

    if buffer:
        sections[current_section] = "\n".join(buffer).strip()

    return sections


def validate_resume_bullet_truth(bullet_text: str, user_history_summary: str) -> Dict[str, Any]:
    """Truth-gate guardrail: flag unsupported claims as user types bullet (fails closed)."""
    truth_result = verify_resume_truthfulness(bullet_text, user_history_summary)
    passed = getattr(truth_result, "passed", False) if hasattr(truth_result, "passed") else (truth_result.get("passed", False) if isinstance(truth_result, dict) else False)
    violations = getattr(truth_result, "violations", []) if hasattr(truth_result, "violations") else (truth_result.get("flagged_claims", []) if isinstance(truth_result, dict) else [])
    return {
        "bullet": bullet_text,
        "is_truthful": passed,
        "unsupported_claims": violations,
        "guidance": "Bullet verified against history." if passed else "Claim exceeds recorded experience."
    }
