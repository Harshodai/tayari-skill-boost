"""Multi-Modal Resume Layout & Structure Parser (Schema Based).

Extracts structural layout blocks, contact headers, work history sections, and education nodes
using Pydantic schema models and string token matching (without raw regex scans).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class StructuralResumeBlocksSchema(BaseModel):
    """Pydantic schema for structured resume layout sections."""
    header_block: str = Field("")
    experience_block: str = Field("")
    education_block: str = Field("")
    skills_block: str = Field("")
    total_lines_parsed: int = Field(0, ge=0)


class MultiModalResumeParser:
    """Schema-based structural layout block parser."""

    SECTION_KEYWORDS = {
        "header": ["contact", "info", "name"],
        "experience": ["experience", "employment", "work history", "career"],
        "education": ["education", "academic", "degrees", "university"],
        "skills": ["skills", "technologies", "competencies", "stack"]
    }

    @staticmethod
    def parse_structural_blocks(document_text: str) -> Dict[str, Any]:
        """Extract structured sections using Pydantic schema validation."""
        lines = document_text.splitlines()
        blocks: Dict[str, List[str]] = {
            "header": [],
            "experience": [],
            "education": [],
            "skills": [],
            "other": []
        }

        current_section = "header"

        for line in lines:
            line_strip = line.strip()
            if not line_strip:
                continue

            line_clean = line_strip.lower().lstrip("#: ").rstrip("#: ")
            detected_header = None

            for sec_name, keywords in MultiModalResumeParser.SECTION_KEYWORDS.items():
                if line_clean in keywords:
                    detected_header = sec_name
                    break

            if detected_header:
                current_section = detected_header
            else:
                blocks[current_section].append(line_strip)

        result = StructuralResumeBlocksSchema(
            header_block="\n".join(blocks["header"]),
            experience_block="\n".join(blocks["experience"]),
            education_block="\n".join(blocks["education"]),
            skills_block="\n".join(blocks["skills"]),
            total_lines_parsed=len(lines)
        )
        return result.model_dump() if hasattr(result, "model_dump") else result.dict()
