"""PipelineGate — orchestrate all guardrails."""
from typing import Optional

from .truthfulness import check_truthfulness
from .keyword_stuffing import check_keyword_stuffing
from .pii_detector import check_pii


class PipelineGate:
    """Runs all guardrails against optimized (and optionally original) resume text."""

    def __init__(self, skip_pii: bool = False, require_truthfulness: bool = True):
        self.skip_pii = skip_pii
        self.require_truthfulness = require_truthfulness

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

        Truthfulness cannot be verified without ``original_text``. When it is
        missing the check is reported as ``passed: False`` with
        ``verified: False`` — an unverifiable claim must never be rendered as a
        clean pass, because callers (and the UI) treat ``all_passed`` as
        permission to auto-submit. Set ``require_truthfulness=False`` only for
        surfaces that explicitly present "not verified" to the user.
        """
        results = {}

        # Truthfulness (needs original text — cannot be faked as a pass)
        if original_text:
            results["truthfulness"] = {
                **check_truthfulness(original_text, optimized_text),
                "verified": True,
            }
        else:
            results["truthfulness"] = {
                "passed": not self.require_truthfulness,
                "verified": False,
                "violations": [
                    "original_text not provided — truthfulness could NOT be verified"
                ],
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
