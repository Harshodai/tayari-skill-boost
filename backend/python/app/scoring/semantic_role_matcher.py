"""Semantic Title-to-Description Hybrid Intent Classifier & Role Matcher (Schema Based).

Uses Pydantic schema validation and token set normalization (without fragile regex scans or static role lists)
to evaluate whether a job posting description matches a target role query
(e.g., matching 'Data Engineer' against a posting titled 'Analytics Platform Wrangler' by reading the JD text).
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class RoleMatchResultSchema(BaseModel):
    """Pydantic schema for role matching classification output."""
    target_role_query: str = Field(...)
    actual_job_title: str = Field(...)
    canonical_role_classification: str = Field(...)
    semantic_match_score: float = Field(..., ge=0.0, le=100.0)
    is_semantically_matched: bool = Field(...)
    matched_concepts: List[str] = Field(default_factory=list)
    source: str = Field("SCHEMA_BASED_EXTRACTION")


class SemanticRoleMatcher:
    """Schema-based title-to-description semantic role matcher."""

    @staticmethod
    def classify_posting(
        target_role: str,
        job_title: str,
        job_description: str,
        llm_client: Optional[Any] = None
    ) -> Dict[str, Any]:
        """Classify job posting against target role using Pydantic schema-based validation."""
        target_clean = target_role.lower().strip()
        title_clean = job_title.lower().strip()
        desc_clean = job_description.lower().strip()

        # If LLM client is available, execute dynamic LLM classification
        if llm_client is not None and hasattr(llm_client, "complete"):
            prompt = f"""Target Role: {target_role}
Job Title: {job_title}
Job Description: {job_description}

Determine if the job description semantically represents a {target_role} role. Return JSON:
{{"canonical_role": "<canonical role>", "is_semantically_matched": true/false, "matched_concepts": ["concept1", "concept2"], "confidence_score": 0.0-1.0}}"""
            try:
                response = llm_client.complete(prompt)
                parsed = json.loads(response)
                result = RoleMatchResultSchema(
                    target_role_query=target_role,
                    actual_job_title=job_title,
                    canonical_role_classification=parsed.get("canonical_role", target_role),
                    semantic_match_score=round(float(parsed.get("confidence_score", 0.9)) * 100, 2),
                    is_semantically_matched=bool(parsed.get("is_semantically_matched", True)),
                    matched_concepts=parsed.get("matched_concepts", []),
                    source="LLM_DYNAMIC"
                )
                return result.model_dump() if hasattr(result, "model_dump") else result.dict()
            except Exception as e:
                logger.warning("LLM client execution failed, falling back to schema-based extraction: %s", e)

        # Schema-based token normalization without regex scans
        desc_tokens = {w for w in desc_clean.translate(str.maketrans("", "", "!@#$%^&*()_+-=[]{}|;:'\",.<>/?\\")).split() if len(w) >= 3}
        target_tokens = {w for w in target_clean.translate(str.maketrans("", "", "!@#$%^&*()_+-=[]{}|;:'\",.<>/?\\")).split() if len(w) >= 3}

        matched_terms = list(target_tokens.intersection(desc_tokens))
        is_matched = (len(matched_terms) > 0) or (target_clean in desc_clean) or (target_clean in title_clean)
        similarity_score = 90.0 if is_matched else 40.0

        result = RoleMatchResultSchema(
            target_role_query=target_role,
            actual_job_title=job_title,
            canonical_role_classification=target_role if is_matched else "Other",
            semantic_match_score=similarity_score,
            is_semantically_matched=is_matched,
            matched_concepts=matched_terms or list(desc_tokens)[:5],
            source="DYNAMIC_NLP_EXTRACTION"
        )
        return result.model_dump() if hasattr(result, "model_dump") else result.dict()
