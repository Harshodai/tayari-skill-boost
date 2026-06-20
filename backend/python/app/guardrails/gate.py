"""PipelineGate — orchestrate all guardrails."""
from typing import Optional

from .truthfulness import check_truthfulness
from .keyword_stuffing import check_keyword_stuffing
from .pii_detector import check_pii


class PipelineGate:
    """Runs all guardrails against optimized (and optionally original) resume text."""

    def __init__(self, skip_pii: bool = False):
        self.skip_pii = skip_pii

    def check(
        self,
        optimized_text: str,
        original_text: Optional[str] = None,
        job_description: Optional[str] = None,
    ) -> dict:
        """Run all guardrails and return consolidated results.

        Returns:
            {
                "all_passed": bool,
                "results": {
                    "truthfulness": {...},
                    "keyword_stuffing": {...},
                    "pii": {...},
                },
            }
        """
        results = {}

        # Truthfulness (needs original text)
        if original_text is not None:
            results["truthfulness"] = check_truthfulness(original_text, optimized_text)
        else:
            results["truthfulness"] = {
                "passed": True,
                "violations": ["original_text not provided — truthfulness skipped"],
            }

        # Keyword stuffing
        results["keyword_stuffing"] = check_keyword_stuffing(optimized_text)

        # PII
        if self.skip_pii:
            results["pii"] = {"passed": True, "pii_found": []}
        else:
            results["pii"] = check_pii(optimized_text)

        all_passed = all(
            r.get("passed", False) for r in results.values()
        )

        return {"all_passed": all_passed, "results": results}
