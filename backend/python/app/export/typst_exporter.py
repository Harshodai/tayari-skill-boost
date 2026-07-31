"""Typst ATS Typesetting Exporter — Tayari AI Engine.

Compiles resume Knowledge Graph / profile JSON into bulletproof, single-page,
ATS-optimized PDF documents using the Typst typesetting system (Rust-based).
Supports 6 industry-standard templates: executive_slate, modern_tech, minimalist_ats,
academic_cv, creative_compact, faang_single_page.
"""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


MINIMALIST_ATS_TEMPLATE = """
#set page(paper: "us-letter", margin: (x: 0.5in, y: 0.5in))
#set text(font: "Liberation Sans", size: 10pt)
#set par(justify: true, leading: 0.52em)

#align(center)[
  #text(size: 16pt, weight: "bold")[VAR_FULL_NAME] \\
  #text(size: 9pt)[VAR_CONTACT_INFO]
]

#v(2pt)
#line(length: 100%, stroke: 0.7pt + rgb("#333333"))
#v(2pt)

== Professional Summary
VAR_SUMMARY

== Technical Skills & Core Competencies
VAR_SKILLS

== Professional Experience
VAR_EXPERIENCE

== Education & Credentials
VAR_EDUCATION
"""

MODERN_TECH_TEMPLATE = """
#set page(paper: "us-letter", margin: (x: 0.4in, y: 0.4in))
#set text(font: "DejaVu Sans", size: 9.5pt)
#set par(justify: true, leading: 0.5em)

#grid(
  columns: (1fr, auto),
  [*#text(size: 18pt, weight: "bold", fill: rgb("#1e3a8a"))[VAR_FULL_NAME]* \ _VAR_HEADLINE_],
  align(right)[#text(size: 8.5pt)[VAR_CONTACT_INFO]]
)

#v(3pt)
#line(length: 100%, stroke: 1.5pt + rgb("#2563eb"))
#v(4pt)

*CORE SKILLS & TECHNOLOGIES* \
VAR_SKILLS

#v(4pt)
*PROFESSIONAL EXPERIENCE* \
VAR_EXPERIENCE

#v(4pt)
*EDUCATION & CERTIFICATIONS* \
VAR_EDUCATION
"""

EXECUTIVE_SLATE_TEMPLATE = """
#set page(paper: "us-letter", margin: (x: 0.5in, y: 0.5in))
#set text(font: "Liberation Serif", size: 10.5pt)
#set par(justify: true, leading: 0.6em)

#align(center)[
  #text(size: 20pt, weight: "bold", fill: rgb("#0f172a"))[VAR_FULL_NAME] \\
  #text(size: 10pt, style: "italic")[VAR_HEADLINE] \\
  #v(2pt)
  #text(size: 9pt)[VAR_CONTACT_INFO]
]

#v(4pt)
#line(length: 100%, stroke: 1pt + rgb("#0f172a"))
#v(4pt)

#text(weight: "bold", size: 12pt, fill: rgb("#0f172a"))[EXECUTIVE PROFILE]
#v(-2pt)
VAR_SUMMARY

#v(4pt)
#text(weight: "bold", size: 12pt, fill: rgb("#0f172a"))[CORE COMPETENCIES & LEADERSHIP]
#v(-2pt)
VAR_SKILLS

#v(4pt)
#text(weight: "bold", size: 12pt, fill: rgb("#0f172a"))[CAREER HISTORY]
#v(-2pt)
VAR_EXPERIENCE

#v(4pt)
#text(weight: "bold", size: 12pt, fill: rgb("#0f172a"))[EDUCATION]
#v(-2pt)
VAR_EDUCATION
"""

FAANG_SINGLE_PAGE_TEMPLATE = """
#set page(paper: "us-letter", margin: (x: 0.35in, y: 0.35in))
#set text(font: "Liberation Sans", size: 9.5pt)
#set par(justify: true, leading: 0.48em)

#align(center)[
  #text(size: 18pt, weight: "bold")[VAR_FULL_NAME] \\
  #text(size: 8.5pt)[VAR_CONTACT_INFO]
]

#v(-2pt)
#line(length: 100%, stroke: 0.8pt + rgb("#111827"))
#v(-2pt)

*SKILLS* --- VAR_SKILLS

#v(2pt)
*EXPERIENCE*
VAR_EXPERIENCE

#v(2pt)
*EDUCATION*
VAR_EDUCATION
"""

CREATIVE_COMPACT_TEMPLATE = """
#set page(paper: "us-letter", margin: (x: 0.4in, y: 0.4in))
#set text(font: "DejaVu Sans", size: 9pt)
#set par(justify: true, leading: 0.45em)

#grid(
  columns: (2.2in, 1fr),
  gutter: 12pt,
  [
    #rect(fill: rgb("#f1f5f9"), inset: 8pt, radius: 4pt, width: 100%)[
      #text(size: 14pt, weight: "bold", fill: rgb("#0f172a"))[VAR_FULL_NAME] \
      #text(size: 8.5pt, fill: rgb("#475569"))[VAR_HEADLINE] \
      #v(6pt)
      #text(size: 8pt)[VAR_CONTACT_INFO]
      #v(6pt)
      *SKILLS* \
      VAR_SKILLS
      #v(6pt)
      *EDUCATION* \
      VAR_EDUCATION
    ]
  ],
  [
    *SUMMARY* \
    VAR_SUMMARY
    #v(6pt)
    *EXPERIENCE* \
    VAR_EXPERIENCE
  ]
)
"""

ACADEMIC_CV_TEMPLATE = """
#set page(paper: "us-letter", margin: (x: 0.6in, y: 0.6in))
#set text(font: "Liberation Serif", size: 11pt)
#set par(justify: true, leading: 0.65em)

#align(center)[
  #text(size: 22pt, weight: "bold")[VAR_FULL_NAME] \\
  #text(size: 10pt)[VAR_CONTACT_INFO]
]

#v(6pt)
== Curriculum Vitae & Summary
VAR_SUMMARY

== Education & Academic Credentials
VAR_EDUCATION

== Research & Technical Experience
VAR_EXPERIENCE

== Publications & Technical Skills
VAR_SKILLS
"""

TEMPLATES = {
    "minimalist_ats": MINIMALIST_ATS_TEMPLATE,
    "modern_tech": MODERN_TECH_TEMPLATE,
    "executive_slate": EXECUTIVE_SLATE_TEMPLATE,
    "faang_single_page": FAANG_SINGLE_PAGE_TEMPLATE,
    "creative_compact": CREATIVE_COMPACT_TEMPLATE,
    "academic_cv": ACADEMIC_CV_TEMPLATE,
    "executive": EXECUTIVE_SLATE_TEMPLATE,  # Alias
}


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
        ("@", "\\@"),
    ]
    res = str(text)
    for old, new in replacements:
        res = res.replace(old, new)
    return res


def generate_typst_code(data: Dict[str, Any], template: str = "modern_tech") -> str:
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
    if data.get("github"):
        contact_parts.append(str(data["github"]))
    contact_info = " | ".join([_sanitize_typst(c) for c in contact_parts if c])

    summary = _sanitize_typst(data.get("summary") or data.get("about") or "")

    # Format skills
    raw_skills = data.get("skills") or []
    if isinstance(raw_skills, list):
        skills_str = ", ".join([_sanitize_typst(str(s)) for s in raw_skills[:30]])
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
    elif isinstance(raw_exp, str) and raw_exp.strip():
        lines = [l.strip() for l in raw_exp.splitlines() if l.strip()]
        for line in lines:
            clean_line = line.lstrip("-•* ")
            if clean_line:
                exp_blocks.append(f"  - {_sanitize_typst(clean_line)}")

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

    template_code = TEMPLATES.get(template, MODERN_TECH_TEMPLATE)

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
            logger.info("[Typst] typst binary not found on PATH. Falling back to PDFExporter.")

        from app.export.pdf_exporter import PDFExporter
        plain_text = typst_code.replace("#", "").replace("*", "**")
        return PDFExporter.export_to_pdf(plain_text)
