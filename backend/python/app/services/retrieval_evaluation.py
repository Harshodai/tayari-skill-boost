"""Pure retrieval-quality metrics for consent-safe benchmark fixtures.

This module intentionally performs no data access and accepts only opaque IDs and
approved relevance labels. Production benchmark storage and fixture consent are
separate operational concerns; these functions make ranking regressions measurable
without logging job descriptions, resumes, names, or provider payloads.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Sequence

EVALUATION_VERSION = "retrieval-v1"


@dataclass(frozen=True)
class RetrievalCase:
    query_id: str
    ranked_ids: tuple[str, ...]
    relevant_ids: frozenset[str]
    expected_family_ids: frozenset[str] = frozenset()


def recall_at_k(ranked_ids: Sequence[str], relevant_ids: frozenset[str], k: int = 10) -> float:
    if not relevant_ids:
        return 1.0
    if k <= 0:
        return 0.0
    retrieved = set(ranked_ids[:k])
    return round(len(retrieved & relevant_ids) / len(relevant_ids), 4)


def ndcg_at_k(ranked_ids: Sequence[str], relevant_ids: frozenset[str], k: int = 10) -> float:
    if not relevant_ids:
        return 1.0
    if k <= 0:
        return 0.0
    dcg = sum(
        (1.0 / math.log2(index + 2))
        for index, item_id in enumerate(ranked_ids[:k])
        if item_id in relevant_ids
    )
    ideal_hits = min(k, len(relevant_ids))
    ideal = sum(1.0 / math.log2(index + 2) for index in range(ideal_hits))
    return round(dcg / ideal, 4) if ideal else 0.0


def family_precision_at_k(ranked_ids: Sequence[str], expected_family_ids: frozenset[str], k: int = 10) -> float:
    if not expected_family_ids:
        return 1.0
    if k <= 0:
        return 0.0
    top = ranked_ids[:k]
    if not top:
        return 0.0
    return round(sum(item_id in expected_family_ids for item_id in top) / len(top), 4)


def evaluate_retrieval(cases: Iterable[RetrievalCase], k: int = 10) -> dict[str, object]:
    case_list = tuple(cases)
    if k <= 0:
        raise ValueError("k must be positive")
    if not case_list:
        return {
            "version": EVALUATION_VERSION,
            "sample_size": 0,
            "k": k,
            "ndcg_at_k": None,
            "recall_at_k": None,
            "family_precision_at_k": None,
        }
    return {
        "version": EVALUATION_VERSION,
        "sample_size": len(case_list),
        "k": k,
        "ndcg_at_k": round(sum(ndcg_at_k(c.ranked_ids, c.relevant_ids, k) for c in case_list) / len(case_list), 4),
        "recall_at_k": round(sum(recall_at_k(c.ranked_ids, c.relevant_ids, k) for c in case_list) / len(case_list), 4),
        "family_precision_at_k": round(sum(family_precision_at_k(c.ranked_ids, c.expected_family_ids, k) for c in case_list) / len(case_list), 4),
    }
