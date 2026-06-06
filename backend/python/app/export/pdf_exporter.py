"""
Minimalist PDF export using Jinja2 + WeasyPrint.
Produces a single-column, standard-font, ATS-parseable PDF.
"""
import io
from typing import Dict, Any

from jinja2 import Environment, PackageLoader


try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False


class PDFExporter:
    """Export a structured resume JSON to a minimal ATS-safe PDF."""

    @staticmethod
    def export(resume_json: Dict[str, Any]) -> bytes:
        if not WEASYPRINT_AVAILABLE:
            raise ImportError("weasyprint is not installed. Run: pip install weasyprint")

        env = Environment(loader=PackageLoader("app", "data"))
        template = env.get_template("resume.html")

        html_content = template.render(
            contact=resume_json.get("contact", {}),
            summary=resume_json.get("summary", ""),
            experience=resume_json.get("experience", []),
            education=resume_json.get("education", []),
            skills=resume_json.get("skills", []),
            certifications=resume_json.get("certifications", []),
            projects=resume_json.get("projects", []),
        )

        pdf_buffer = io.BytesIO()
        HTML(string=html_content).write_pdf(pdf_buffer)
        return pdf_buffer.getvalue()
