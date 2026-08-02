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

    TARGET_DENSITY_MIN = 2.0  # ponytail: 2% aggregate across all target keywords
    TARGET_DENSITY_MAX = 5.0  # ponytail: 5% aggregate across all target keywords
    TARGET_MIN_OCCURRENCES_PER_KEYWORD = 2  # ponytail: per-keyword count floor for recommendations
    TARGET_MAX_OCCURRENCES_PER_KEYWORD = 10  # ponytail: per-keyword over-stuffing cap

    @staticmethod
    def analyze_keyword_density(resume_text: str, target_keywords: List[str]) -> Dict[str, Any]:
        """Compute keyword frequency and density percentage across resume text."""
        resume_lower = resume_text.lower()
        words = re.findall(r"\b\w+\b", resume_lower)
        total_word_count = max(len(words), 1)

        keyword_counts: Dict[str, int] = {}
        densities: Dict[str, float] = {}
        recommendations: List[str] = []
        aggregate_count = 0

        for kw in target_keywords:
            kw_clean = kw.lower().strip()
            # ponytail: lookaround boundaries (not \b) so C++, .NET, C# match exactly
            pattern = r"(?<!\w)" + re.escape(kw_clean) + r"(?!\w)"
            count = len(re.findall(pattern, resume_lower))
            keyword_counts[kw] = count
            aggregate_count += count

            density_pct = round((count / total_word_count) * 100, 2)
            densities[kw] = density_pct

            if count == 0:
                recommendations.append(f"Add missing keyword '{kw}' to resume")
            elif count < KeywordDensityOptimizer.TARGET_MIN_OCCURRENCES_PER_KEYWORD:
                recommendations.append(
                    f"Increase usage of '{kw}' (current: {count} occurrences, target: at least "
                    f"{KeywordDensityOptimizer.TARGET_MIN_OCCURRENCES_PER_KEYWORD})"
                )
            elif count > KeywordDensityOptimizer.TARGET_MAX_OCCURRENCES_PER_KEYWORD:
                recommendations.append(
                    f"Reduce over-stuffed keyword '{kw}' (current: {count} occurrences, max target: "
                    f"{KeywordDensityOptimizer.TARGET_MAX_OCCURRENCES_PER_KEYWORD})"
                )

        if not target_keywords:
            recommendations.append(
                "No target keywords provided — add target keywords to evaluate resume keyword density"
            )

        # ponytail: TARGET_DENSITY_MIN/MAX checked against aggregate, not per-keyword percentages
        aggregate_density_pct = round((aggregate_count / total_word_count) * 100, 2)
        if target_keywords and aggregate_density_pct < KeywordDensityOptimizer.TARGET_DENSITY_MIN:
            recommendations.append(
                f"Increase overall keyword usage (current aggregate: {aggregate_density_pct}%, target: "
                f"{KeywordDensityOptimizer.TARGET_DENSITY_MIN}%-{KeywordDensityOptimizer.TARGET_DENSITY_MAX}%)"
            )
        elif aggregate_density_pct > KeywordDensityOptimizer.TARGET_DENSITY_MAX:
            recommendations.append(
                f"Reduce over-stuffed keywords overall (current aggregate: {aggregate_density_pct}%, max target: "
                f"{KeywordDensityOptimizer.TARGET_DENSITY_MAX}%)"
            )

        return {
            "total_resume_words": total_word_count,
            "keyword_counts": keyword_counts,
            "keyword_densities": densities,
            "recommendations": recommendations,
            "is_optimal": len(recommendations) == 0
        }
