"""
Proprietary 0-100 ATS scoring engine.
"""
from typing import List, Optional

from app.schemas import (
    ATSAnalysisResponse,
    ScoreBreakdown,
    KeywordAnalysis,
    NGramAnalysis,
    FormattingAnalysis,
    SectionCompleteness,
)
from app.parsers.document_parser import ParsedResume


class ATSScorer:
    """Composite scorer producing a 0-100 proprietary score."""

    def __init__(self):
        self.weights = {
            "keyword_match": 0.30,
            "ngram_match": 0.25,
            "keyword_density": 0.20,
            "section_completeness": 0.15,
            "formatting_compliance": 0.10,
        }

    def score(self, keywords: KeywordAnalysis, ngrams: NGramAnalysis,
              resume: Optional[ParsedResume], resume_text: Optional[str]) -> ATSAnalysisResponse:
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

        composite = (
            keyword_score * self.weights["keyword_match"]
            + ngram_score * self.weights["ngram_match"]
            + density_score * self.weights["keyword_density"]
            + sections.score * self.weights["section_completeness"]
            + formatting.score * self.weights["formatting_compliance"]
        )
        composite = min(max(round(composite), 0), 100)

        recommendations = self._generate_recommendations(keywords, ngrams, sections, formatting)

        return ATSAnalysisResponse(
            score=composite,
            breakdown=ScoreBreakdown(
                keyword_match=keyword_score,
                ngram_match=ngram_score,
                keyword_density=density_score,
                section_completeness=sections.score,
                formatting_compliance=formatting.score,
            ),
            keywords=keywords,
            ngrams=ngrams,
            formatting=formatting,
            section_completeness=sections,
            recommendations=recommendations,
        )

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
        present = sum([has_contact, bool(resume.summary), bool(resume.experience),
                       bool(resume.education), bool(resume.skills)])
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
    def _generate_recommendations(keywords: KeywordAnalysis, ngrams: NGramAnalysis,
                                  sections: SectionCompleteness,
                                  formatting: FormattingAnalysis) -> List[str]:
        recs = []
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
