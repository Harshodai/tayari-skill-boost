"""ATS Resume Keyword Density Optimizer.

Inspired by ai-job-search keyword density optimization engine:
Calculates keyword frequency ratios in candidate resumes vs target job descriptions
and optimizes keyword density to meet ideal ATS thresholds (2%-5% target density).
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class KeywordDensityOptimizer:
    """Calculates and optimizes resume keyword density for ATS parsing."""

    TARGET_DENSITY_MIN = 2.0  # 2%
    TARGET_DENSITY_MAX = 5.0  # 5%

    @staticmethod
    def analyze_keyword_density(resume_text: str, target_keywords: List[str]) -> Dict[str, Any]:
        """Compute keyword frequency and density percentage across resume text."""
        words = re.findall(r"\b\w+\b", resume_text.lower())
        total_word_count = max(len(words), 1)

        keyword_counts: Dict[str, int] = {}
        densities: Dict[str, float] = {}
        recommendations: List[str] = []

        for kw in target_keywords:
            kw_clean = kw.lower().strip()
            # Count exact word or phrase occurrences
            count = len(re.findall(r"\b" + re.escape(kw_clean) + r"\b", resume_text.lower()))
            keyword_counts[kw] = count

            density_pct = round((count / total_word_count) * 100, 2)
            densities[kw] = density_pct

            if density_pct < KeywordDensityOptimizer.TARGET_DENSITY_MIN:
                recommendations.append(f"Increase usage of '{kw}' (current: {density_pct}%, target: 2%-5%)")
            elif density_pct > KeywordDensityOptimizer.TARGET_DENSITY_MAX:
                recommendations.append(f"Reduce over-stuffed keyword '{kw}' (current: {density_pct}%, max target: 5%)")

        return {
            "total_resume_words": total_word_count,
            "keyword_counts": keyword_counts,
            "keyword_densities": densities,
            "recommendations": recommendations,
            "is_optimal": len(recommendations) == 0
        }
