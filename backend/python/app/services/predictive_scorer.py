import re
from typing import Dict, Any

class PredictiveScorer:
    """Deterministic heuristic rubric for resume variants.

    NOT a trained model: no application outcomes are used to fit these weights,
    so the output is a structural quality signal, not a callback probability.
    Surface it as such — see ``scoring_method`` in the returned dict.
    """

    @staticmethod
    def score_resume(resume_text: str, job_description: str = "") -> Dict[str, Any]:
        """
        Calculates a multi-dimensional heuristic score for a resume variant
        against an optional job description.

        ``keyword_score`` is ``None`` when no job description is supplied, and
        the overall score is renormalized over the remaining components.
        """
        # 1. Formatting Score (bullet counts, length, section markers)
        lines = [line.strip() for line in resume_text.split("\n") if line.strip()]
        bullet_count = sum(1 for line in lines if line.startswith(("-", "*", "•", "o")))
        
        # Section markers
        sections = ["experience", "education", "skills", "projects", "summary", "languages", "certifications"]
        section_count = 0
        for line in lines:
            if len(line) < 30 and any(s in line.lower() for s in sections):
                section_count += 1

        formatting_score = 50 + (bullet_count * 2) + (section_count * 5)
        formatting_score = min(max(formatting_score, 30), 100)

        # 2. Metrics Density Score (checking quantitative accomplishments: %, $, numbers)
        metric_pattern = re.compile(r'(\d+%|\$\d+|\b\d+\b)')
        metric_matches = metric_pattern.findall(resume_text)
        metric_count = len(metric_matches)
        
        metrics_score = 40 + (metric_count * 3)
        metrics_score = min(max(metrics_score, 20), 100)

        # 3. Readability Score (average sentence length, word size)
        sentences = [s.strip() for s in re.split(r'[.!?]', resume_text) if s.strip()]
        words = resume_text.split()
        
        avg_sentence_len = len(words) / max(len(sentences), 1)
        avg_word_len = sum(len(w) for w in words) / max(len(words), 1)

        # Penalize extremely long or short sentences/words
        readability_score = 100
        if avg_sentence_len > 25 or avg_sentence_len < 8:
            readability_score -= 20
        if avg_word_len > 7 or avg_word_len < 4:
            readability_score -= 20
        readability_score = min(max(readability_score, 40), 100)

        # 4. Keyword Match Score (overlap with job description)
        # Only defined when a JD is supplied — there is nothing to match against
        # otherwise, and inventing a placeholder number here silently inflates
        # overall_score (this component carries 40% of the weight).
        keyword_score = None
        if job_description:
            # Simple unique word overlap (ignoring common small words)
            stop_words = {"and", "the", "a", "of", "to", "in", "for", "with", "on", "at", "by", "an", "is", "are", "was", "were", "that", "this", "or", "as"}

            resume_words = set(w.lower() for w in re.findall(r'\b[a-zA-Z]{3,}\b', resume_text) if w.lower() not in stop_words)
            jd_words = set(w.lower() for w in re.findall(r'\b[a-zA-Z]{3,}\b', job_description) if w.lower() not in stop_words)

            overlap = resume_words.intersection(jd_words)
            keyword_score = int((len(overlap) / len(jd_words)) * 100) if jd_words else 0
            keyword_score = min(max(keyword_score, 0), 100)

        # 5. Overall Score (weighted combination)
        # Keyword matching and metric achievements dominate callback outcomes.
        # With no JD the keyword component is dropped and the remaining weights
        # are renormalized, so the score stays comparable instead of being
        # padded by a stand-in value.
        weighted = (
            (formatting_score * 0.15) +
            (metrics_score * 0.30) +
            (readability_score * 0.15)
        )
        total_weight = 0.60
        if keyword_score is not None:
            weighted += keyword_score * 0.40
            total_weight = 1.00

        overall_score = int(weighted / total_weight)
        overall_score = min(max(overall_score, 0), 100)

        return {
            "formatting_score": formatting_score,
            "metrics_score": metrics_score,
            "readability_score": readability_score,
            "keyword_score": keyword_score,
            "jd_provided": bool(job_description),
            "scoring_method": "heuristic",
            "overall_score": overall_score
        }
