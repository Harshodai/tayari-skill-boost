"""Typst ATS Typesetting Exporter — Tayari AI Engine.

Compiles resume Knowledge Graph / profile JSON into bulletproof, single-page,
ATS-optimized PDF documents using the Typst typesetting system (Rust-based).
"""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


EXECUTIVE_TYPST_TEMPLATE = """
#set page(paper: "us-letter", margin: (x: 0.5in, y: 0.5in))
#set text(font: "Liberation Sans", size: 10pt)
#set par(justify: true, leading: 0.55em)

#align(center)[
  #text(size: 16pt, weight: "bold")[VAR_FULL_NAME] \\
  #text(size: 9pt)[VAR_CONTACT_INFO]
]

#v(2pt)
#line(length: 100%, stroke: 0.7pt + rgb("#333333"))
#v(2pt)

== Professional Summary
VAR_SUMMARY

== Core Technical Skills
VAR_SKILLS

== Professional Experience
VAR_EXPERIENCE

== Education & Certifications
VAR_EDUCATION
"""

MODERN_TECH_TYPST_TEMPLATE = """
#set page(paper: "us-letter", margin: (x: 0.4in, y: 0.4in))
#set text(font: "DejaVu Sans", size: 9.5pt)
#set par(justify: true, leading: 0.5em)

#grid(
  columns: (1fr, auto),
  [*#text(size: 18pt, weight: "bold")[VAR_FULL_NAME]* \ _VAR_HEADLINE_],
  align(right)[#text(size: 8.5pt)[VAR_CONTACT_INFO]]
)

#v(4pt)
#line(length: 100%, stroke: 1.5pt + rgb("#2563eb"))
#v(4pt)

*SKILLS & TECHNOLOGIES* \
VAR_SKILLS

#v(4pt)
*EXPERIENCE* \
VAR_EXPERIENCE

#v(4pt)
*EDUCATION & CREDENTIALS* \
VAR_EDUCATION
"""


def _sanitize_typst(text: str) -> str:
    """Escape special Typst markup characters."""
    if not text:
        return ""
    replacements = [
        ("\\", "\\\\"),
        ("[", "\\["),
        ("]", "\\]"),
        ("#", "\\#"),
        ("$", "\\$"),
        ("*", "\\*"),
        ("_", "\\_"),
    ]
    res = str(text)
    for old, new in replacements:
        res = res.replace(old, new)
    return res


def generate_typst_code(data: Dict[str, Any], template: str = "executive") -> str:
    """Generate Typst markup string from profile/resume dictionary."""
    full_name = _sanitize_typst(data.get("full_name") or data.get("name") or "Candidate Name")
    headline = _sanitize_typst(data.get("headline") or data.get("current_role") or "Software Engineer")

    contact_parts = []
    if data.get("email"):
        contact_parts.append(str(data["email"]))
    if data.get("phone"):
        contact_parts.append(str(data["phone"]))
    if data.get("location"):
        contact_parts.append(str(data["location"]))
    if data.get("linkedin"):
        contact_parts.append(str(data["linkedin"]))
    contact_info = " | ".join([_sanitize_typst(c) for c in contact_parts if c])

    summary = _sanitize_typst(data.get("summary") or data.get("about") or "")

    # Format skills
    raw_skills = data.get("skills") or []
    if isinstance(raw_skills, list):
        skills_str = ", ".join([_sanitize_typst(str(s)) for s in raw_skills[:25]])
    else:
        skills_str = _sanitize_typst(str(raw_skills))

    # Format experience
    exp_blocks = []
    raw_exp = data.get("experience") or data.get("experiences") or []
    if isinstance(raw_exp, list):
        for exp in raw_exp:
            if isinstance(exp, dict):
                title = _sanitize_typst(exp.get("title") or exp.get("role") or "Role")
                company = _sanitize_typst(exp.get("company") or "Company")
                dates = _sanitize_typst(exp.get("dates") or exp.get("duration") or "")
                bullets = exp.get("bullets") or exp.get("achievements") or []

                block = f"* {title} * --- _{company}_ #h(1fr) {dates}\n"
                if isinstance(bullets, list):
                    for b in bullets[:5]:
                        block += f"  - {_sanitize_typst(str(b))}\n"
                exp_blocks.append(block)
    experience_str = "\n".join(exp_blocks) if exp_blocks else "  - Built scalable web applications and microservices."

    # Format education
    edu_blocks = []
    raw_edu = data.get("education") or []
    if isinstance(raw_edu, list):
        for edu in raw_edu:
            if isinstance(edu, dict):
                degree = _sanitize_typst(edu.get("degree") or "Degree")
                school = _sanitize_typst(edu.get("school") or edu.get("institution") or "University")
                year = _sanitize_typst(edu.get("year") or "")
                edu_blocks.append(f"* {degree} *, _{school}_ #h(1fr) {year}")
    education_str = "\n".join(edu_blocks) if edu_blocks else "* B.S. in Computer Science *"

    template_code = MODERN_TECH_TYPST_TEMPLATE if template == "modern_tech" else EXECUTIVE_TYPST_TEMPLATE

    code = template_code.replace("VAR_FULL_NAME", full_name)
    code = code.replace("VAR_HEADLINE", headline)
    code = code.replace("VAR_CONTACT_INFO", contact_info)
    code = code.replace("VAR_SUMMARY", summary)
    code = code.replace("VAR_SKILLS", skills_str)
    code = code.replace("VAR_EXPERIENCE", experience_str)
    code = code.replace("VAR_EDUCATION", education_str)

    return code


def compile_typst_to_pdf(typst_code: str) -> bytes:
    """Compile Typst code into PDF bytes using typst CLI if available, or fallback."""
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "resume.typ")
        output_path = os.path.join(tmpdir, "resume.pdf")

        with open(input_path, "w", encoding="utf-8") as f:
            f.write(typst_code)

        try:
            res = subprocess.run(
                ["typst", "compile", input_path, output_path],
                capture_output=True,
                text=True,
                check=False,
            )
            if res.returncode == 0 and os.path.exists(output_path):
                with open(output_path, "rb") as f:
                    return f.read()
            else:
                logger.warning("[Typst] typst compile returned %d: %s. Using fallback.", res.returncode, res.stderr)
        except FileNotFoundError:
            logger.info("[Typst] typst binary not found on PATH. Falling back to HTML/Weasyprint.")

        # Fallback to HTML/Weasyprint if typst binary is not installed
        from app.export.pdf_exporter import PDFExporter
        # Convert code to plain markdown text for fallback
        plain_text = typst_code.replace("#", "").replace("*", "**")
        return PDFExporter.export_to_pdf(plain_text)
