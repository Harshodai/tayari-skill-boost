"""
TF-IDF + Cosine Similarity engine for resume vs. job description comparison.
"""
import math
import re
from typing import Dict, List, Set
from collections import Counter

from app.schemas import KeywordAnalysis


class KeywordAnalyzer:
    """Analyzes keyword overlap and density using TF-IDF."""

    STOP_WORDS = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "as", "is", "are", "was", "were", "be",
        "been", "being", "have", "has", "had", "do", "does", "did", "will",
        "would", "could", "should", "may", "might", "must", "can", "this",
        "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
        "me", "him", "her", "us", "them", "my", "your", "his", "its", "our",
        "their", "what", "which", "who", "when", "where", "why", "how", "all",
        "any", "both", "each", "few", "more", "most", "other", "some", "such",
        "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
        "just",
    }

    def analyze(self, resume_text: str, jd_text: str) -> KeywordAnalysis:
        if not resume_text or not jd_text:
            return KeywordAnalysis(total_jd_keywords=0, matched_count=0)

        resume_tokens = self._tokenize(resume_text)
        jd_tokens = self._tokenize(jd_text)

        jd_vocab = set(jd_tokens)
        total_jd_keywords = len(jd_vocab)

        if total_jd_keywords == 0:
            return KeywordAnalysis(total_jd_keywords=0, matched_count=0)

        all_docs = [resume_tokens, jd_tokens]
        resume_counter = Counter(resume_tokens)

        matched: List[str] = []
        missing: List[str] = []
        density: Dict[str, float] = {}

        for term in jd_vocab:
            tf = self._compute_tf(term, resume_tokens)
            idf = self._compute_idf(term, all_docs)
            tfidf = tf * idf
            density[term] = round(tfidf, 4)

            if resume_counter.get(term, 0) > 0:
                matched.append(term)
            else:
                missing.append(term)

        return KeywordAnalysis(
            found=sorted(matched),
            missing=sorted(missing),
            density=density,
            total_jd_keywords=total_jd_keywords,
            matched_count=len(matched),
        )

    def _tokenize(self, text: str) -> List[str]:
        text = re.sub(r"[^\w\s-]", " ", text.lower())
        tokens = [t for t in text.split() if t and t not in self.STOP_WORDS and len(t) > 1]
        return tokens

    def _compute_tf(self, term: str, tokens: List[str]) -> float:
        count = tokens.count(term)
        return count / max(len(tokens), 1)

    def _compute_idf(self, term: str, docs: List[List[str]]) -> float:
        docs_with = sum(1 for d in docs if term in d)
        return math.log((1 + len(docs)) / (1 + docs_with)) + 1.0
