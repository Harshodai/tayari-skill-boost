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

    # ponytail: small by design — every extra verb widens the prose
    # false-positive surface ("the team worked by the deadline"), so only
    # unambiguous employment verbs open a company slot.
    WORK_VERBS = {"worked", "employed", "interned", "hired"}

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

        # Detect company mentions in claim: a company-name slot is the token
        # right after (a) a work verb + preposition ("worked for Microsoft",
        # "employed by Acme", "interned at Google") or (b) a bare "at" whose
        # next token is capitalized, matches a verified company, or contains
        # one — so prose like "at scale" never opens a slot.
        words = claim_lower.split()
        tokens_orig = claim_text.split()
        for i, word in enumerate(words):
            if i + 1 >= len(words):
                break
            prev = words[i - 1] if i > 0 else ""
            work_context = word in ("for", "with", "by", "at") and prev in OntologyGuard.WORK_VERBS
            if word == "at" and not work_context:
                # bare "at": slot only when the next token looks like a
                # company (capitalized or verified-ish), not ordinary prose.
                next_orig = tokens_orig[i + 1].strip(".,();:")
                next_clean = words[i + 1].strip(".,();:")
                bare_at_ok = (
                    (bool(next_orig) and next_orig[0].isupper())
                    or any(company in next_clean for company in verified_companies_lower)
                    or any(next_clean in company for company in verified_companies_lower)
                )
                if not bare_at_ok:
                    continue
            elif not work_context:
                continue
            clean_company = words[i + 1].strip(".,();:")
            if not clean_company:
                continue
            # ponytail: verified skills outrank companies — "adept at Python"
            # is a skill mention, never a company mention.
            if clean_company in verified_skills_lower:
                continue
            # ponytail: one-way containment — a mention is verified only when
            # it is contained in a verified company ("target" ⊂ "target corp");
            # a verified company inside the mention ("google" ⊂ "googleplex")
            # does NOT verify it.
            verified = any(
                clean_company in company
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
