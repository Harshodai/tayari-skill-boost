"""Entity Disambiguator & Homonym Resolver.

Inspired by cognee entity disambiguation:
Disambiguates homonyms and ambiguous acronyms in candidate resume text
(e.g., 'Go' programming language vs 'GO' organisation; 'ML' Machine Learning vs 'ML' OCaml).
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict

logger = logging.getLogger(__name__)


class EntityDisambiguator:
    """Disambiguates homonyms and acronyms based on contextual keywords."""

    HOMONYM_MAP = {
        "go": {
            "context_keywords": ["golang", "backend", "code", "concurrency", "goroutine", "programming"],
            "canonical": "Go (Programming Language)",
            "fallback": "General Term"
        },
        "ml": {
            "context_keywords": ["python", "model", "training", "scikit", "pytorch", "machine learning"],
            "canonical": "Machine Learning",
            "fallback": "OCaml / General"
        }
    }

    @staticmethod
    def disambiguate_term(term: str, context_text: str) -> Dict[str, Any]:
        """Disambiguate ambiguous entity term using surrounding context."""
        term_clean = term.lower().strip()
        context_lower = context_text.lower()

        if term_clean in EntityDisambiguator.HOMONYM_MAP:
            config = EntityDisambiguator.HOMONYM_MAP[term_clean]
            matches = [kw for kw in config["context_keywords"] if kw in context_lower]
            if len(matches) > 0:
                return {
                    "raw_term": term,
                    "canonical_entity": config["canonical"],
                    "confidence": 0.95,
                    "matched_context_words": matches
                }
            return {
                "raw_term": term,
                "canonical_entity": config["fallback"],
                "confidence": 0.50,
                "matched_context_words": []
            }

        return {"raw_term": term, "canonical_entity": term, "confidence": 1.0}
