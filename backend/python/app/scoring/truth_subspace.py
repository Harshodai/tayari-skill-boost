"""Truth Subspace Vector Alignment Engine.

Inspired by cognee truth_subspace architecture:
Computes vector space alignment and centroid distance between candidate skill vectors
and job requirement vectors to determine truth subspace distance and alignment score.
"""

from __future__ import annotations

import math
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class TruthSubspaceEngine:
    """Calculates vector alignment and centroid distance between candidate & job requirement subspaces."""

    @staticmethod
    def _simple_text_vector(text: str, vocab: List[str]) -> List[float]:
        """Generate term-frequency vector across target vocabulary."""
        text_lower = text.lower()
        return [float(text_lower.count(term.lower())) for term in vocab]

    @staticmethod
    def compute_subspace_alignment(candidate_text: str, jd_text: str, target_vocabulary: List[str]) -> Dict[str, Any]:
        """Compute cosine similarity and centroid distance in truth subspace."""
        if not target_vocabulary:
            return {"alignment_score": 0.0, "distance": 1.0}

        vec_c = TruthSubspaceEngine._simple_text_vector(candidate_text, target_vocabulary)
        vec_j = TruthSubspaceEngine._simple_text_vector(jd_text, target_vocabulary)

        dot_product = sum(a * b for a, b in zip(vec_c, vec_j))
        mag_c = math.sqrt(sum(a * a for a in vec_c))
        mag_j = math.sqrt(sum(b * b for b in vec_j))

        if mag_c == 0 or mag_j == 0:
            similarity = 0.0
        else:
            similarity = dot_product / (mag_c * mag_j)

        distance = round(1.0 - similarity, 4)
        alignment_score = int(round(similarity * 100))

        return {
            "alignment_score": alignment_score,
            "truth_subspace_distance": distance,
            "cosine_similarity": round(similarity, 4),
            "vocab_terms_evaluated": len(target_vocabulary)
        }
