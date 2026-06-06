"""
N-gram analysis for multi-word phrase matching between resume and JD.
"""
import re
from typing import List, Set
from app.schemas import NGramAnalysis


class NGramAnalyzer:
    """Extracts and compares n-grams between resume and job description."""

    @staticmethod
    def extract_ngrams(text: str, n: int = 2) -> Set[str]:
        """Extract n-grams from text, return as set of normalized strings."""
        # Clean text
        text = re.sub(r"[^\w\s-]", " ", text.lower())
        tokens = [t for t in text.split() if len(t) > 1]
        if len(tokens) < n:
            return set()
        return {" ".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)}

    def analyze(self, resume_text: str, jd_text: str) -> NGramAnalysis:
        """Compare 2-grams to 5-grams between resume and JD."""
        jd_grams: Set[str] = set()
        resume_grams: Set[str] = set()

        for n in range(2, 6):
            jd_grams.update(self.extract_ngrams(jd_text, n))
            resume_grams.update(self.extract_ngrams(resume_text, n))

        matched = sorted(resume_grams & jd_grams)
        missing = sorted(jd_grams - resume_grams)

        return NGramAnalysis(matched=matched, missing=missing)
