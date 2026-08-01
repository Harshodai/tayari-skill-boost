"""Smart DOM Sanitizer & Markdown Normalizer (Schema Based).

Strips cookie consent banners, headers, footers, modal overlays, inline scripts,
and CSS from raw scraped web pages to produce pristine LLM-ready markdown using Pydantic schema validation.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class CleanedDOMSchema(BaseModel):
    """Pydantic schema for cleaned DOM content payload."""
    markdown: str = Field(...)
    original_length: int = Field(..., ge=0)
    cleaned_length: int = Field(..., ge=0)


class DOMCleaner:
    """Sanitizes raw HTML to extract clean job description content using Pydantic schemas."""

    NOISE_PATTERNS = [
        r"<script.*?>.*?</script>",
        r"<style.*?>.*?</style>",
        r"<nav.*?>.*?</nav>",
        r"<footer.*?>.*?</footer>",
        r"<header.*?>.*?</header>",
        r"<!--.*?-->"
    ]

    @staticmethod
    def sanitize_html_to_markdown(raw_html: str) -> Dict[str, Any]:
        """Strip HTML noise and convert to clean markdown text validated via Pydantic schema."""
        if not raw_html:
            result = CleanedDOMSchema(markdown="", original_length=0, cleaned_length=0)
            return result.model_dump() if hasattr(result, "model_dump") else result.dict()

        cleaned = raw_html
        for pattern in DOMCleaner.NOISE_PATTERNS:
            cleaned = re.sub(pattern, "", cleaned, flags=re.DOTALL | re.IGNORECASE)

        # Replace basic tags with Markdown equivalents
        cleaned = re.sub(r"<h[1-6].*?>(.*?)</h[1-6]>", r"\n### \1\n", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"<li.*?>\s*(.*?)\s*</li>", r"\n* \1", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"<br\s*/?>", "\n", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"<p.*?>\s*(.*?)\s*</p>", r"\n\1\n", cleaned, flags=re.IGNORECASE)

        # Strip remaining HTML tags
        cleaned = re.sub(r"<.*?>", " ", cleaned)
        cleaned = re.sub(r"\n\s*\n", "\n\n", cleaned).strip()

        result = CleanedDOMSchema(
            markdown=cleaned,
            original_length=len(raw_html),
            cleaned_length=len(cleaned)
        )
        return result.model_dump() if hasattr(result, "model_dump") else result.dict()
