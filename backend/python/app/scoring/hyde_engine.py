"""Cognitive HyDE (Hypothetical Document Embeddings) Query Expander.

Inspired by cognee HyDE implementation:
Generates a hypothetical 'ideal candidate experience profile' for a given job posting,
then measures similarity distance against actual candidate knowledge graph facts.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class HyDEEngine:
    """Hypothetical Document Embedding (HyDE) query expander for job matching."""

    @staticmethod
    def generate_hypothetical_profile(jd_text: str, role_title: str) -> Dict[str, Any]:
        """Generate a hypothetical ideal candidate profile based on JD text."""
        tech_vocab = {"python", "go", "java", "kubernetes", "aws", "docker", "react", "sql", "ci/cd", "microservices"}
        # ponytail: keyword-set intersection dropped "go" (2 letters) and "ci/cd" (slash) — match raw text instead
        jd_norm = jd_text.casefold()
        matched_tech = sorted(t for t in tech_vocab if re.search(rf"\b{re.escape(t)}\b", jd_norm))

        hypothetical_summary = (
            f"Ideal candidate for {role_title} with 5+ years experience building production software. "
            f"Demonstrated mastery in {', '.join(matched_tech) if matched_tech else 'software development'}. "
            f"Track record of scaling distributed cloud infrastructure and leading technical initiatives."
        )

        return {
            "role_title": role_title,
            "hypothetical_summary": hypothetical_summary,
            "extracted_tech_requirements": matched_tech
        }

    @staticmethod
    def evaluate_hyde_match(candidate_skills: List[str], hypothetical_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate overlap between candidate's actual skills and hypothetical ideal requirements."""
        req_tech = set(hypothetical_profile.get("extracted_tech_requirements", []))
        cand_tech = set(s.lower() for s in candidate_skills)

        if not req_tech:
            overlap_score = 75
        else:
            common = req_tech & cand_tech
            overlap_score = int(round((len(common) / len(req_tech)) * 100))

        return {
            "hyde_match_score": overlap_score,
            "matching_skills": sorted(list(req_tech & cand_tech)),
            "missing_skills": sorted(list(req_tech - cand_tech))
        }


import re
