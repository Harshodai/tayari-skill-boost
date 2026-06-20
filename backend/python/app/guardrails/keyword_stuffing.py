"""Keyword-stuffing guardrail — detect unnatural keyword density."""
import re
from collections import Counter


# Common ATS keywords that are frequently over-stuffed
_HIGH_RISK_KEYWORDS = {
    "python", "java", "javascript", "sql", "aws", "azure", "gcp",
    "machine learning", "deep learning", "data analysis", "data science",
    "project management", "agile", "scrum", "leadership", "teamwork",
    "communication", "problem solving", "critical thinking", "innovation",
    "cloud", "docker", "kubernetes", "ci/cd", "devops", "analytics",
    "optimization", "strategy", "stakeholder", "cross-functional",
    "results-oriented", "detail-oriented", "proactive", "self-motivated",
}


def check_keyword_stuffing(text: str) -> dict:
    """Detect keyword stuffing in resume text.

    Returns {"passed": bool, "density_score": float, "flagged_keywords": [...]}
    """
    text = text or ""
    words = re.findall(r"[a-zA-Z][a-zA-Z+#.\-/]*", text)
    total = len(words)
    if total == 0:
        return {"passed": True, "density_score": 0.0, "flagged_keywords": []}

    lower_words = [w.lower() for w in words]
    counts = Counter(lower_words)

    # Single-word density check
    flagged = []
    for word, count in counts.items():
        if count / total > 0.15:
            flagged.append(f"'{word}' appears {count} times ({count/total:.1%} of words)")

    # Bigram density check (exact phrase)
    bigrams = [f"{a} {b}" for a, b in zip(lower_words, lower_words[1:])]
    bigram_counts = Counter(bigrams)
    for phrase, count in bigram_counts.items():
        if count / max(len(bigrams), 1) > 0.10:
            flagged.append(f"'{phrase}' appears {count} times ({count/max(len(bigrams),1):.1%} of bigrams)")

    # High-risk keyword repetition (not strictly density, but unnatural frequency)
    for hr in _HIGH_RISK_KEYWORDS:
        hr_count = text.lower().count(hr)
        if hr_count >= 5:
            flagged.append(f"High-risk keyword '{hr}' repeated {hr_count} times")

    # Unnatural pattern: same word 3+ times in a single sentence
    sentences = re.split(r"[.!?\n]+", text)
    for s in sentences:
        s_words = re.findall(r"[a-zA-Z][a-zA-Z+#.\-/]*", s.lower())
        if s_words:
            s_counts = Counter(s_words)
            for w, c in s_counts.items():
                if c >= 3 and len(w) > 3:
                    flagged.append(f"'{w}' repeated {c} times in one sentence")

    density_score = min(1.0, len(flagged) / 10.0)
    passed = len(flagged) == 0

    return {
        "passed": passed,
        "density_score": round(density_score, 3),
        "flagged_keywords": flagged[:20],  # cap for readability
    }
