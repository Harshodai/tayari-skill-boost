import pytest
from app.scoring.ats_scorer import ATSScorer
from app.analysis.similarity import KeywordAnalyzer
from app.analysis.ngram_analyzer import NGramAnalyzer
from app.schemas import KeywordAnalysis, NGramAnalysis, SectionCompleteness, FormattingAnalysis


def test_score_breakdown_contains_all_transparent_dimensions():
    scorer = ATSScorer()
    kw_analyzer = KeywordAnalyzer()
    ngram_analyzer = NGramAnalyzer()

    resume_text = """
    Jane Doe
    jane@example.com | 555-123-4567

    SUMMARY
    Senior Software Engineer with 8 years of experience building distributed systems in Go and Python.

    EXPERIENCE
    Senior Backend Engineer - Tech Corp
    - Designed and implemented microservices handling 50k requests per second using Go and Docker.
    - Improved database throughput by 45% through query optimization and Redis caching.
    - Led a team of 5 engineers to deliver high availability payment pipelines with 99.99% uptime.
    - Streamlined CI/CD automation reducing build times by 30%.

    EDUCATION
    BS in Computer Science - State University, 2018

    SKILLS
    Go, Python, Docker, Kubernetes, Redis, PostgreSQL, Distributed Systems, CI/CD
    """

    jd_text = """
    Looking for a Senior Backend Engineer to join our team.
    Requirements:
    - Strong experience in Go, Python, Docker, and Kubernetes
    - Experience designing distributed systems and microservices
    - Knowledge of Redis and PostgreSQL
    - High availability and CI/CD pipelines
    """

    keywords = kw_analyzer.analyze(resume_text, jd_text)
    ngrams = ngram_analyzer.analyze(resume_text, jd_text)

    response = scorer.score(keywords, ngrams, None, resume_text, job_description=jd_text)

    breakdown = response.score_breakdown or response.breakdown
    assert breakdown is not None

    # Check all required dimensions from WP-01
    assert hasattr(breakdown, "structural_ats")
    assert 0 <= breakdown.structural_ats <= 100
    assert hasattr(breakdown, "semantic_fit")
    assert 0 <= breakdown.semantic_fit <= 100
    assert hasattr(breakdown, "experience_relevance")
    assert 0 <= breakdown.experience_relevance <= 100
    assert hasattr(breakdown, "achievement_quality")
    assert 0 <= breakdown.achievement_quality <= 100
    assert hasattr(breakdown, "seniority_alignment")
    # seniority_alignment is Optional — None means not computed (fabricated value removed)
    assert breakdown.seniority_alignment is None or breakdown.seniority_alignment in ["aligned", "under", "over"] or isinstance(breakdown.seniority_alignment, (int, float))
    assert hasattr(breakdown, "keyword_coverage")
    assert 0 <= breakdown.keyword_coverage <= 100
    assert hasattr(breakdown, "keyword_stuffing_penalty")
    assert hasattr(breakdown, "unsupported_claims_count")
    # unsupported_claims_count is Optional — None means not computed (fabricated value removed)
    assert breakdown.unsupported_claims_count is None or isinstance(breakdown.unsupported_claims_count, int)
    assert hasattr(breakdown, "confidence_band")
    assert breakdown.confidence_band in ["high", "medium", "low"]
    assert hasattr(breakdown, "human_rationale")
    assert len(breakdown.human_rationale) > 20

    # Verify clean resume has no stuffing penalty
    stuffing = breakdown.keyword_stuffing_penalty
    assert stuffing.count == 0
    assert stuffing.penalty_points == 0.0
    assert len(stuffing.flagged_keywords) == 0


def test_keyword_stuffing_detection_flags_excessive_keywords():
    scorer = ATSScorer()
    kw_analyzer = KeywordAnalyzer()
    ngram_analyzer = NGramAnalyzer()

    # Resume with "kubernetes" repeated 5 times across bullets and matching JD verbatim
    stuffed_resume = """
    Alex Smith
    alex@example.com

    EXPERIENCE
    DevOps Engineer - Cloud Inc
    - Deployed microservices using kubernetes clusters in production.
    - Managed kubernetes deployments and automated scaling policies.
    - Monitored kubernetes pods and ingress controllers across multi-cloud regions.
    - Optimized kubernetes node pools to reduce cloud spend by 25%.
    - Trained junior engineers on kubernetes security and Helm chart management.

    EDUCATION
    BS Computer Science

    SKILLS
    Kubernetes, Cloud, Linux
    """

    jd_text = "We need a DevOps Engineer expert in kubernetes and cloud automation."

    keywords = kw_analyzer.analyze(stuffed_resume, jd_text)
    ngrams = ngram_analyzer.analyze(stuffed_resume, jd_text)

    response = scorer.score(keywords, ngrams, None, stuffed_resume, job_description=jd_text)

    breakdown = response.score_breakdown or response.breakdown
    stuffing = breakdown.keyword_stuffing_penalty

    # Verify "kubernetes" is flagged
    assert stuffing.count >= 1
    assert stuffing.penalty_points > 0.0
    flagged = [item["keyword"] for item in stuffing.flagged_keywords]
    assert "kubernetes" in flagged

    # Verify flagged item has term, count (>3), and example snippet
    stuffed_item = next(item for item in stuffing.flagged_keywords if item["keyword"] == "kubernetes")
    assert stuffed_item["count"] >= 4
    assert "kubernetes" in stuffed_item["example"].lower()
    assert stuffed_item["penalty"] > 0.0

    # Verify human rationale mentions penalty
    assert "penalty" in breakdown.human_rationale.lower()
    # Verify recommendations include advice to reduce stuffing
    assert any("stuffing" in r.lower() or "repetitive" in r.lower() for r in response.recommendations)


def test_clean_resume_without_jd_does_not_crash_and_has_clean_breakdown():
    scorer = ATSScorer()
    kw_analyzer = KeywordAnalyzer()
    ngram_analyzer = NGramAnalyzer()

    resume_text = "Experienced Python developer with Django and PostgreSQL experience."
    keywords = kw_analyzer.analyze(resume_text, "")
    ngrams = ngram_analyzer.analyze(resume_text, "")

    response = scorer.score(keywords, ngrams, None, resume_text)
    breakdown = response.score_breakdown
    assert breakdown is not None
    assert breakdown.keyword_stuffing_penalty.penalty_points == 0.0
    assert breakdown.confidence_band in ["high", "medium", "low"]
