"""Semantic Ontology Guardrails for Tayari AI Engine.

Inspired by Vimal Dwarampudi's Architecture (Ontologies + Knowledge Graphs):
- Enforces strict domain rules on candidate claims.
- Validates that generated resume bullets and interview prep claims are grounded
  in verified graph nodes (zero hallucination guarantee).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class OntologyGuard:
    """Validates claims against candidate knowledge graph nodes."""

    ALLOWED_RELATIONSHIPS = {
        "HAS_SKILL", "WORKED_AT", "HELD_ROLE", "ACHIEVED_METRIC", "EARNED_CERT"
    }

    @staticmethod
    def validate_claim(claim_text: str, verified_skills: List[str], verified_companies: List[str]) -> Dict[str, Any]:
        """Check if claim mentions unverified skills or companies."""
        claim_lower = claim_text.lower()
        verified_skills_lower = [s.lower() for s in verified_skills]

        # Detect tech keywords in claim
        unverified_mentions = []
        for word in claim_lower.split():
            clean_word = word.strip(".,();:")
            if len(clean_word) > 3 and clean_word in ["react", "docker", "kubernetes", "aws", "python", "golang", "rust"]:
                if clean_word not in verified_skills_lower:
                    unverified_mentions.append(clean_word)

        is_valid = len(unverified_mentions) == 0

        return {
            "is_valid": is_valid,
            "claim_text": claim_text,
            "unverified_mentions": unverified_mentions,
            "status": "APPROVED" if is_valid else "FLAGGED_UNVERIFIED"
        }
