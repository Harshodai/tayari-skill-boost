"""Reciprocal Rank Fusion (RRF) Hybrid Search Engine.

Implements mathematical Reciprocal Rank Fusion:
    RRF_Score(d) = sum_{m in Models} (1 / (k + r_m(d)))
with k=60 to fuse dense vector rankings, keyword BM25/TF-IDF rankings,
and LLM semantic intent rankings into a single optimal hybrid result list.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class RRFHybridFusion:
    """Reciprocal Rank Fusion engine for multi-retrieval rank aggregation."""

    K_CONSTANT = 60  # Standard RRF constant parameter

    @staticmethod
    def fuse_rankings(
        ranking_lists: List[List[Dict[str, Any]]],
        id_key: str = "id"
    ) -> List[Dict[str, Any]]:
        """Fuse multiple ordered ranking lists using Reciprocal Rank Fusion formula."""
        rrf_scores: Dict[str, float] = {}
        item_map: Dict[str, Dict[str, Any]] = {}

        for rank_list in ranking_lists:
            for rank_idx, item in enumerate(rank_list, start=1):
                # ponytail: key presence, not truthiness — ids 0 and "" are usable
                if id_key in item:
                    item_id = str(item[id_key])
                elif "title" in item:
                    item_id = str(item["title"])
                else:
                    continue  # no usable identifier — skip, never rank_idx fallback
                item_map.setdefault(item_id, item)  # first payload wins

                score_increment = 1.0 / (RRFHybridFusion.K_CONSTANT + rank_idx)
                rrf_scores[item_id] = rrf_scores.get(item_id, 0.0) + score_increment

        # Sort items descending by combined RRF score
        fused_items = []
        for item_id, score in sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True):
            item_copy = dict(item_map[item_id])
            item_copy["rrf_score"] = round(score, 6)
            fused_items.append(item_copy)

        for rank, item in enumerate(fused_items, start=1):
            item["fused_rank"] = rank

        return fused_items
