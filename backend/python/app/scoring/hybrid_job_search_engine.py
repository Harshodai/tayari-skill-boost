"""Unified Hybrid Vector + Graph RAG + LLM Role Search Engine.

Combines:
1. SemanticRoleMatcher: LLM dynamic title-to-description intent matching.
2. VectorEmbeddingReranker: Cross-encoder vector space similarity over job description text.
3. GraphRAGRetriever: 2-hop NetworkX candidate graph context retrieval.
4. ATSEngine: 5-dimension candidate application fit evaluation.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
try:
    import networkx as nx
except ImportError:
    nx = None

from app.scoring.semantic_role_matcher import SemanticRoleMatcher
from app.scoring.vector_embedding_reranker import VectorEmbeddingReranker
from app.scoring.graph_rag_retriever import GraphRAGRetriever
from app.services.ats_engine import evaluate_5d_fit


logger = logging.getLogger(__name__)


class HybridJobSearchEngine:
    """Unified hybrid job search engine matching role intent across title variations."""

    @staticmethod
    def search_and_rank_postings(
        query_role: str,
        job_postings: List[Dict[str, Any]],
        candidate_skills: Optional[List[str]] = None,
        candidate_graph: Optional[Any] = None
    ) -> Dict[str, Any]:
        """Search and rank job postings using hybrid vector, graph RAG, and LLM intent matching."""
        # ponytail: missing/empty skills rejected — never score with fabricated vocabulary
        if not candidate_skills:
            raise ValueError("candidate_skills must be a non-empty list")
        skills = candidate_skills
        results: List[Dict[str, Any]] = []

        for posting in job_postings:
            title = posting.get("title", "")
            description = posting.get("description", "")
            posting_id = posting.get("id") or title

            # 1. LLM / Dynamic Semantic Role Intent Matching
            semantic_match = SemanticRoleMatcher.classify_posting(query_role, title, description)

            # 2. Vector Embedding Re-ranking
            vector_res = VectorEmbeddingReranker.rank_bullets_by_relevance([description], query_role)
            vector_score = vector_res[0]["similarity_score"] * 100 if vector_res else 0.0

            # 3. Graph RAG Context Retrieval
            graph_rag_res = None
            if candidate_graph is not None:
                graph_rag_res = GraphRAGRetriever.retrieve_context(candidate_graph, query_role)

            # 4. 5D ATS Fit Evaluation
            ats_res = evaluate_5d_fit(
                resume_text=" ".join(skills),
                jd_text=description,
                candidate_skills=skills
            )

            if "overall_fit_score" not in ats_res:
                # ponytail: missing fit result must not fabricate a plausible score (was 80.0)
                logger.warning(
                    "evaluate_5d_fit returned no overall_fit_score for posting %r; contributing 0.0",
                    posting_id
                )
                ats_fit_score = 0.0
            else:
                ats_fit_score = ats_res["overall_fit_score"]

            # Calculate composite hybrid score
            combined_score = round(
                (semantic_match["semantic_match_score"] * 0.40) +
                (vector_score * 0.30) +
                (ats_fit_score * 0.30),
                2
            )


            results.append({
                "posting_id": posting_id,
                "title": title,
                "description": description,
                "is_semantically_matched": semantic_match["is_semantically_matched"],
                "canonical_role_classification": semantic_match["canonical_role_classification"],
                "combined_hybrid_score": combined_score,
                "semantic_match_score": semantic_match["semantic_match_score"],
                "vector_similarity_score": round(vector_score, 2),
                "ats_5d_fit_score": ats_fit_score,

                "graph_rag_context": graph_rag_res
            })

        # Sort postings by combined hybrid score descending
        results.sort(key=lambda x: x["combined_hybrid_score"], reverse=True)

        for rank, res in enumerate(results, start=1):
            res["rank"] = rank

        return {
            "query_role": query_role,
            "total_postings_evaluated": len(job_postings),
            "matched_postings_count": sum(1 for r in results if r["is_semantically_matched"]),
            "ranked_postings": results
        }
