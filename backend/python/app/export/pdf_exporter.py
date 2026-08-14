"""
Safe, minimalist PDF export for structured resumes.

ReportLab receives escaped text only; the exporter never evaluates HTML, loads
CSS, follows URLs, or reads local resources from resume content.
"""
from __future__ import annotations

import io
from html import escape
from typing import Any, Dict, Iterable

try:
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def _text(value: Any) -> str:
    """Convert user-provided values to printable text without control bytes."""
    return str(value or "").replace("\x00", "").strip()


def _paragraph(value: Any, style: ParagraphStyle) -> Paragraph:
    safe = escape(_text(value)).replace("\n", "<br/>")
    return Paragraph(safe or " ", style)


def _write_pdf(
    *,
    contact: Dict[str, Any],
    summary: Any,
    sections: Iterable[tuple[str, Iterable[Any]]],
) -> bytes:
    if not REPORTLAB_AVAILABLE:
        raise ImportError("reportlab is not installed. Run: pip install reportlab")

    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2.5 * cm,
        leftMargin=2.5 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2.5 * cm,
        title="Resume",
    )
    styles = getSampleStyleSheet()
    name_style = ParagraphStyle(
        "ResumeName",
        parent=styles["Title"],
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        spaceAfter=2,
    )
    contact_style = ParagraphStyle(
        "ResumeContact",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        textColor="#555555",
        fontSize=10,
        leading=13,
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "ResumeSection",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        spaceBefore=10,
        spaceAfter=5,
        borderWidth=0.5,
        borderColor="#333333",
        borderPadding=2,
    )
    body_style = ParagraphStyle(
        "ResumeBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        spaceAfter=4,
    )
    bullet_style = ParagraphStyle(
        "ResumeBullet",
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        bulletIndent=0,
    )

    contact_values = [contact.get("email"), contact.get("phone")]
    contact_line = " | ".join(_text(value) for value in contact_values if _text(value))
    story = [_paragraph(contact.get("name", "Name"), name_style)]
    if contact_line:
        story.append(_paragraph(contact_line, contact_style))
    else:
        story.append(Spacer(1, 12))

    if _text(summary):
        story.extend([_paragraph("Summary", section_style), _paragraph(summary, body_style)])

    for heading, values in sections:
        items = [_text(value) for value in values if _text(value)]
        if not items:
            continue
        story.append(_paragraph(heading, section_style))
        if heading == "Skills":
            story.append(_paragraph(", ".join(items), body_style))
        else:
            story.extend(_paragraph(f"• {item}", bullet_style) for item in items)

    document.build(story)
    return buffer.getvalue()


class PDFExporter:
    """Export structured resume data to a single-column, ATS-safe PDF."""

    @staticmethod
    def export(resume_json: Dict[str, Any]) -> bytes:
        return _write_pdf(
            contact=resume_json.get("contact", {}),
            summary=resume_json.get("summary", ""),
            sections=(
                ("Experience", resume_json.get("experience", [])),
                ("Education", resume_json.get("education", [])),
                ("Skills", resume_json.get("skills", [])),
                ("Certifications", resume_json.get("certifications", [])),
                ("Projects", resume_json.get("projects", [])),
            ),
        )

    @staticmethod
    def export_to_pdf(text: str) -> bytes:
        return _write_pdf(contact={}, summary=text, sections=())
