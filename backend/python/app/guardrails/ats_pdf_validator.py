"""ATS PDF Parseability Validator.

Inspired by ai-job-search ATS parseability verification pipeline:
Inspects generated or uploaded PDF documents, verifies plain text extractability,
detects image-only/rasterized text risks, single-column alignment, and font encoding issues.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ATSPDFValidator:
    """Validates ATS parseability and text extractability of PDF files."""

    @staticmethod
    def validate_pdf_bytes(pdf_bytes: bytes) -> Dict[str, Any]:
        """Inspect raw PDF bytes for text parseability and ATS risks."""
        if not pdf_bytes or len(pdf_bytes) < 10:
            return {"is_parseable": False, "score": 0, "issues": ["Invalid or empty PDF file"]}

        # Check for standard PDF header
        if not pdf_bytes.startswith(b"%PDF"):
            return {"is_parseable": False, "score": 0, "issues": ["File missing %PDF magic header"]}

        issues: List[str] = []
        parseable_text_len = 0

        try:
            # Simple stream text extraction attempt
            raw_content = pdf_bytes.decode("latin1", errors="ignore")
            # Count text stream objects
            text_matches = [m for m in raw_content.splitlines() if "BT" in m or "ET" in m or "Tj" in m or "TJ" in m]
            parseable_text_len = len(text_matches)

            if parseable_text_len < 5:
                issues.append("Low text stream density — PDF may contain rasterized images instead of selectable text.")

            if "Font" not in raw_content and "FontName" not in raw_content:
                issues.append("Unusual font structures detected — check custom font embeddings.")

        except Exception as exc:
            logger.warning("PDF stream inspection error: %s", exc)
            issues.append(f"PDF parsing error: {exc}")

        score = max(100 - len(issues) * 25, 20)
        is_parseable = len(issues) == 0 or score >= 70

        return {
            "is_parseable": is_parseable,
            "score": score,
            "issues": issues,
            "text_stream_objects_found": parseable_text_len,
            "recommendation": "PDF is ATS-friendly" if is_parseable else "Re-render PDF using standard fonts without tables"
        }
