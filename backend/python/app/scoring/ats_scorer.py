"""
Proprietary 0-100 ATS scoring engine with transparent multidimensional breakdown
and keyword stuffing penalties.
"""
import re
from typing import List, Optional, Dict, Any

from app.schemas import (
    ATSAnalysisResponse,
    ScoreBreakdown,
    KeywordStuffingPenalty,
    KeywordAnalysis,
    NGramAnalysis,
    FormattingAnalysis,
    SectionCompleteness,
)
from app.parsers.document_parser import ParsedResume
from app.services.ats_engine import ACTION_VERBS, STOPWORDS, TECH_SKILL_WHITELIST


class ATSScorer:
    """Composite scorer producing a 0-100 proprietary score with trust-first breakdown."""

    def __init__(self):
        self.weights = {
            "keyword_match": 0.30,
            "ngram_match": 0.25,
            "keyword_density": 0.20,
            "section_completeness": 0.15,
            "formatting_compliance": 0.10,
        }

    def score(
        self,
        keywords: KeywordAnalysis,
        ngrams: NGramAnalysis,
        resume: Optional[ParsedResume],
        resume_text: Optional[str],
        job_description: Optional[str] = None,
    ) -> ATSAnalysisResponse:
        if keywords.total_jd_keywords > 0:
            kw_ratio = keywords.matched_count / keywords.total_jd_keywords
        else:
            kw_ratio = 0.0
        keyword_score = round(kw_ratio * 100, 2)

        total_ngrams = len(ngrams.matched) + len(ngrams.missing)
        if total_ngrams > 0:
            ngram_ratio = len(ngrams.matched) / total_ngrams
        else:
            ngram_ratio = 0.0
        ngram_score = round(ngram_ratio * 100, 2)

        if keywords.density:
            avg_density = sum(keywords.density.values()) / len(keywords.density)
            density_score = min(round(avg_density * 500, 2), 100)
        else:
            density_score = 0.0

        formatting = self._check_formatting(resume_text)
        sections = self._check_sections(resume)

        # Baseline composite before stuffing deduction
        composite = (
            keyword_score * self.weights["keyword_match"]
            + ngram_score * self.weights["ngram_match"]
            + density_score * self.weights["keyword_density"]
            + sections.score * self.weights["section_completeness"]
            + formatting.score * self.weights["formatting_compliance"]
        )

        # Detect keyword stuffing in resume bullets
        stuffing_result = self._detect_keyword_stuffing(
            resume_text=resume_text,
            job_description=job_description,
            resume=resume,
            matched_keywords=keywords.found,
            missing_keywords=keywords.missing,
        )

        penalty_pts = stuffing_result["penalty_points"]
        adjusted_composite = max(0, min(100, round(composite - penalty_pts)))

        # Compute transparent trust dimensions
        structural_ats = round(0.5 * formatting.score + 0.5 * sections.score, 2)
        semantic_fit = round(0.6 * ngram_score + 0.4 * keyword_score, 2)

        lower_text = (resume_text or "").lower()
        verb_hits = sum(1 for v in ACTION_VERBS if v in lower_text)
        exp_base = 100.0 if sections.has_experience else 0.0
        experience_relevance = round(min(100.0, exp_base * 0.6 + min(verb_hits * 4.0, 40.0)), 2)

        quantified_matches = re.findall(r"\d+\s*%|\$\s*\d|\d+[kKmM]\+?|\b\d{2,}\b", resume_text or "")
        achievement_quality = round(min(100.0, len(quantified_matches) * 15.0), 2)

        seniority_alignment = "aligned"
        keyword_coverage = keyword_score

        # Confidence band
        text_len = len(resume_text or "")
        if adjusted_composite >= 75 and text_len >= 400:
            confidence_band = "high"
        elif adjusted_composite >= 50 and text_len >= 200:
            confidence_band = "medium"
        else:
            confidence_band = "low"

        # Human rationale
        rationale_parts = []
        if adjusted_composite >= 80:
            rationale_parts.append(
                f"Strong overall match ({adjusted_composite}%). Candidate demonstrates robust experience relevance ({experience_relevance}%) and solid keyword alignment ({keyword_coverage}%)."
            )
        elif adjusted_composite >= 60:
            rationale_parts.append(
                f"Moderate match ({adjusted_composite}%). Good baseline alignment, but further keyword and achievement quantification can elevate recruiter visibility."
            )
        else:
            rationale_parts.append(
                f"Low match ({adjusted_composite}%). Notable keyword gaps and structural/content improvements required to pass ATS screening."
            )

        if penalty_pts > 0:
            stuffed_names = [item["keyword"] for item in stuffing_result["flagged_keywords"][:3]]
            rationale_parts.append(
                f"Penalty of -{penalty_pts} pts applied due to repetitive keyword usage in bullets ({', '.join(stuffed_names)})."
            )
        else:
            rationale_parts.append("No unnatural keyword stuffing detected across resume bullets.")

        if keywords.missing:
            rationale_parts.append(
                f"Priority keywords to integrate: {', '.join(keywords.missing[:5])}."
            )

        human_rationale = " ".join(rationale_parts)

        stuffing_penalty_model = KeywordStuffingPenalty(
            count=stuffing_result["count"],
            penalty_points=stuffing_result["penalty_points"],
            flagged_keywords=stuffing_result["flagged_keywords"],
        )

        breakdown = ScoreBreakdown(
            # Legacy fields
            keyword_match=keyword_score,
            ngram_match=ngram_score,
            keyword_density=density_score,
            section_completeness=sections.score,
            formatting_compliance=formatting.score,
            # WP-01 dimensions
            structural_ats=structural_ats,
            semantic_fit=semantic_fit,
            experience_relevance=experience_relevance,
            achievement_quality=achievement_quality,
            keyword_coverage=keyword_coverage,
            keyword_stuffing_penalty=stuffing_penalty_model,
            confidence_band=confidence_band,
            human_rationale=human_rationale,
            seniority_alignment=None,
            unsupported_claims_count=None,
        )

        recommendations = self._generate_recommendations(
            keywords, ngrams, sections, formatting, stuffing_result
        )

        return ATSAnalysisResponse(
            score=adjusted_composite,
            breakdown=breakdown,
            score_breakdown=breakdown,
            keywords=keywords,
            ngrams=ngrams,
            formatting=formatting,
            section_completeness=sections,
            recommendations=recommendations,
        )

    @classmethod
    def _extract_bullets(cls, resume_text: Optional[str], resume: Optional[ParsedResume]) -> List[str]:
        """Extract all candidate bullet points from resume text and structured experience."""
        bullets = []
        if resume_text:
            for line in resume_text.splitlines():
                line = line.strip()
                match = re.match(r"^[\s•\-\*\u2022\u2023\u25E6\u2043\u2219]+\s*(.+)$", line)
                if match:
                    bullet_text = match.group(1).strip()
                    if bullet_text:
                        bullets.append(bullet_text)
        if resume and hasattr(resume, "experience") and resume.experience:
            for exp in resume.experience:
                if isinstance(exp, str):
                    for line in exp.splitlines():
                        line = line.strip()
                        match = re.match(r"^[\s•\-\*\u2022\u2023\u25E6\u2043\u2219]+\s*(.+)$", line)
                        bullet_candidate = match.group(1).strip() if match else line
                        if bullet_candidate and bullet_candidate not in bullets:
                            bullets.append(bullet_candidate)
        # If no bullet markers found, treat sentences/lines in experience or body as bullets
        if not bullets and resume_text:
            for line in resume_text.splitlines():
                line = line.strip()
                if len(line) > 25 and not line.isupper() and not line.endswith(":"):
                    bullets.append(line)
        return bullets

    @classmethod
    def _detect_keyword_stuffing(
        cls,
        resume_text: Optional[str],
        job_description: Optional[str],
        resume: Optional[ParsedResume],
        matched_keywords: Optional[List[str]] = None,
        missing_keywords: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Detect keywords appearing >3 times across resume bullets that match JD verbatim."""
        bullets = cls._extract_bullets(resume_text, resume)
        if not bullets:
            return {"count": 0, "penalty_points": 0.0, "flagged_keywords": []}

        # Build candidate keyword set from verbatim JD text
        jd_terms = set()
        if job_description and job_description.strip():
            # Extract 1-3 word potential terms from JD
            for token in re.findall(r"[a-zA-Z][a-zA-Z0-9+#./\-]{1,}", job_description.lower()):
                if token in TECH_SKILL_WHITELIST or (token not in STOPWORDS and len(token) > 2):
                    jd_terms.add(token)
            # Also extract bigrams verbatim from JD
            words = [
                w
                for w in re.findall(r"[a-zA-Z][a-zA-Z0-9+#.\-]*", job_description.lower())
                if w not in STOPWORDS and len(w) > 2
            ]
            for a, b in zip(words, words[1:]):
                jd_terms.add(f"{a} {b}")

        # Also add verified matched keywords from JD analysis if provided
        if matched_keywords:
            for kw in matched_keywords:
                if kw and (not job_description or kw.lower() in job_description.lower()):
                    jd_terms.add(kw.lower())

        if not jd_terms:
            return {"count": 0, "penalty_points": 0.0, "flagged_keywords": []}

        raw_flagged = []
        total_penalty = 0.0

        from collections import Counter
        # Pre-lowercase and tokenize bullets once (O(bullets), not O(terms×bullets))
        bullet_data = []
        for orig_b in bullets:
            low_b = orig_b.lower()
            tokens = re.findall(r"[a-z0-9+#./\-]+", low_b)
            pairs = [f"{a} {b}" for a, b in zip(tokens, tokens[1:])]
            bullet_data.append((orig_b, Counter(tokens + pairs)))

        for term in sorted(jd_terms):
            term_count = 0
            first_example = None

            for orig_b, counts in bullet_data:
                occurrences = counts[term]
                if occurrences > 0:
                    term_count += occurrences
                    if first_example is None:
                        first_example = orig_b

            if term_count > 3:
                # Penalty: 2 points per excess occurrence over 3, capped at 15 per keyword
                excess = term_count - 3
                kw_penalty = min(15.0, excess * 2.0)
                raw_flagged.append({
                    "keyword": term,
                    "count": term_count,
                    "example": first_example or "",
                    "penalty": kw_penalty,
                })

        # De-duplicate overlaps (shorter fully contained in longer)
        flagged = []
        for item in raw_flagged:
            kw = item["keyword"]
            is_contained = any(
                kw != other["keyword"] and re.search(r'\b' + re.escape(kw) + r'\b', other["keyword"])
                for other in raw_flagged
            )
            if not is_contained:
                flagged.append(item)
                total_penalty += item["penalty"]

        # Total penalty capped at 30 points
        total_penalty = min(30.0, round(total_penalty, 2))

        return {
            "count": len(flagged),
            "penalty_points": total_penalty,
            "flagged_keywords": flagged,
        }

    @staticmethod
    def _check_formatting(text: Optional[str]) -> FormattingAnalysis:
        single_column = True
        standard_font = True
        no_complex_tables = True

        if text:
            table_hints = 0
            for line in text.splitlines():
                if "|" in line or "\t" in line:
                    table_hints += 1
            if table_hints > 3:
                no_complex_tables = False

        score = 100.0 if (single_column and standard_font and no_complex_tables) else 50.0
        return FormattingAnalysis(
            single_column=single_column,
            standard_font=standard_font,
            no_complex_tables=no_complex_tables,
            parsing_risk=not no_complex_tables,
            score=round(score, 2),
        )

    @staticmethod
    def _check_sections(resume: Optional[ParsedResume]) -> SectionCompleteness:
        if not resume:
            return SectionCompleteness(score=0.0)
        has_contact = bool(resume.contact and sum(1 for v in resume.contact.values() if v) > 0)
        present = sum([
            has_contact,
            bool(resume.summary),
            bool(resume.experience),
            bool(resume.education),
            bool(resume.skills),
        ])
        score = round((present / 5.0) * 100, 2)
        return SectionCompleteness(
            has_contact=has_contact,
            has_summary=bool(resume.summary),
            has_experience=bool(resume.experience),
            has_education=bool(resume.education),
            has_skills=bool(resume.skills),
            score=score,
        )

    @staticmethod
    def _generate_recommendations(
        keywords: KeywordAnalysis,
        ngrams: NGramAnalysis,
        sections: SectionCompleteness,
        formatting: FormattingAnalysis,
        stuffing: Optional[Dict[str, Any]] = None,
    ) -> List[str]:
        recs = []
        if stuffing and stuffing.get("penalty_points", 0) > 0:
            stuffed = [k["keyword"] for k in stuffing.get("flagged_keywords", [])[:3]]
            recs.append(
                f"Reduce repetitive keyword stuffing in bullet points ({', '.join(stuffed)}) to avoid algorithmic penalties."
            )
        if keywords.missing:
            recs.append(f"Add missing keywords: {', '.join(keywords.missing[:10])}")
        if ngrams.missing:
            recs.append(f"Include key phrases: {', '.join(ngrams.missing[:5])}")
        if not sections.has_experience:
            recs.append("Add a detailed work experience section with bullet points.")
        if not sections.has_education:
            recs.append("Include your education details.")
        if not sections.has_skills:
            recs.append("List relevant technical skills explicitly.")
        if formatting.parsing_risk:
            recs.append("Simplify resume format: avoid tables and use a single column layout.")
        return recs
