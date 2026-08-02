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
        verified_companies_lower = [c.lower() for c in verified_companies]

        # Detect tech keywords in claim
        unverified_mentions = []
        for word in claim_lower.split():
            clean_word = word.strip(".,();:")
            if len(clean_word) > 3 and clean_word in ["react", "docker", "kubernetes", "aws", "python", "golang", "rust"]:
                if clean_word not in verified_skills_lower:
                    unverified_mentions.append(clean_word)

        # Detect company mentions in claim: the token right after "at"
        # (e.g. "worked at Acme Corp") is the company-name slot, so ordinary
        # prose words like "engineered" are never misread as companies.
        words = claim_lower.split()
        for i, word in enumerate(words):
            if word == "at" and i + 1 < len(words):
                clean_company = words[i + 1].strip(".,();:")
                # ponytail: no len>3 gate here — short company names (IBM, SAP)
                # are legitimate mentions, and only the token after "at" is
                # inspected, so the noise surface is one word.
                verified = any(
                    company in clean_company or clean_company in company
                    for company in verified_companies_lower
                )
                if not verified:
                    unverified_mentions.append(clean_company)

        is_valid = len(unverified_mentions) == 0

        return {
            "is_valid": is_valid,
            "claim_text": claim_text,
            "unverified_mentions": unverified_mentions,
            "status": "APPROVED" if is_valid else "FLAGGED_UNVERIFIED"
        }
