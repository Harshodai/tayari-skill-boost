"""Cross-Encoder Semantic Vector Embedding Re-Ranker.

Performs term-frequency vector space embedding and cosine similarity re-ranking
between candidate resume bullet points and job requirement queries.
"""

from __future__ import annotations

import math
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class VectorEmbeddingReranker:
    """Vector-space cross-encoder re-ranker for candidate experience bullets."""

    @staticmethod
    def _text_to_vector(text: str, vocabulary: List[str]) -> List[float]:
        """Convert text into term frequency vector over vocabulary."""
        text_lower = text.lower()
        return [float(text_lower.count(term.lower())) for term in vocabulary]

    @staticmethod
    def rank_bullets_by_relevance(
        bullets: List[str],
        query: str,
        vocabulary: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Re-rank candidate bullets by vector cosine similarity against query."""
        if not vocabulary:
            words = list(set(query.lower().split()))
            vocabulary = [w for w in words if len(w) > 2]

        if not vocabulary:
            return [{"bullet": b, "similarity_score": 0.0, "rank": i + 1} for i, b in enumerate(bullets)]

        q_vec = VectorEmbeddingReranker._text_to_vector(query, vocabulary)
        q_mag = math.sqrt(sum(x * x for x in q_vec))

        ranked_items = []
        for bullet in bullets:
            b_vec = VectorEmbeddingReranker._text_to_vector(bullet, vocabulary)
            b_mag = math.sqrt(sum(x * x for x in b_vec))

            if q_mag == 0 or b_mag == 0:
                sim = 0.0
            else:
                dot = sum(a * b for a, b in zip(q_vec, b_vec))
                sim = dot / (q_mag * b_mag)

            ranked_items.append({
                "bullet": bullet,
                "similarity_score": round(sim, 4)
            })

        # Sort descending by similarity score
        ranked_items.sort(key=lambda x: x["similarity_score"], reverse=True)

        for rank, item in enumerate(ranked_items, start=1):
            item["rank"] = rank

        return ranked_items


from typing import Optional
