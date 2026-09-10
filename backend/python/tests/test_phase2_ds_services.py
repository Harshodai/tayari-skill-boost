import os
import pytest
from unittest.mock import AsyncMock, patch

from app.services.career_intelligence import skill_gap_analysis, career_trajectory
from app.services.career_trajectory_predictor import CareerTrajectoryPredictor
from app.services.voice_coach import (
    analyze_transcript_metrics,
    analyze_response_sentiment,
    VoiceFeedbackResult,
)
from app.services.response_sentiment_analyzer import ResponseSentimentAnalyzer
from app.services.token_compressor import TokenCompressor
from app.services.cover_letter import (
    get_template_registry,
    format_with_template,
    CoverLetterGenerator,
)
from app.services.template_registry import TemplateRegistry
from app.services.job_providers import get_portal_scaffolder
from app.services.portal_scaffolder import PortalScaffolder
from app.services.optimizer import optimize_with_reflection
from app.services.style_delta_logger import StyleDeltaLogger


# ---------------------------------------------------------------------------
# Task DS3: Career Intelligence + CareerTrajectoryPredictor
# ---------------------------------------------------------------------------

def test_ds3_career_intelligence_milestone_prediction():
    result = skill_gap_analysis(
        user_skills=["Python", "SQL"],
        target_role="Software Engineer",
        current_title="Software Engineer",
        years_experience=3.5,
    )
    assert "target_role" in result
    assert "missing_skills" in result
    assert "predicted_milestone" in result
    milestone = result["predicted_milestone"]
    assert milestone["current_title"] == "Software Engineer"
    assert milestone["predicted_next_title"] == "Senior Engineer"
    assert milestone["years_experience"] == 3.5
    assert milestone["promotion_readiness_score"] == 70.0
    assert "recommended_focus" in milestone
    assert len(milestone["recommended_focus"]) > 0


def test_ds3_career_trajectory_function():
    milestone = career_trajectory("Junior Engineer", years_experience=1.5)
    assert milestone["predicted_next_title"] == "Software Engineer"
    assert milestone["promotion_readiness_score"] == 30.0


# ---------------------------------------------------------------------------
# Task DS4: Voice Coach + ResponseSentimentAnalyzer
# ---------------------------------------------------------------------------

def test_ds4_voice_coach_sentiment_integration():
    transcript = "We had an issue where system latency increased. I engineered a cache that improved throughput by 40%."
    res = analyze_transcript_metrics(transcript, duration_seconds=30.0)

    assert isinstance(res, VoiceFeedbackResult)
    assert hasattr(res, "sentiment")
    assert isinstance(res.sentiment, dict)
    assert "category" in res.sentiment
    assert "confidence" in res.sentiment


def test_ds4_voice_coach_response_sentiment_classification():
    offer_text = "Congratulations! We are pleased to offer you the Senior Engineer position."
    sentiment = analyze_response_sentiment(offer_text)
    assert sentiment["category"] == "OFFER"
    assert sentiment["confidence"] >= 0.90

    invite_text = "We would like to schedule an interview with our team next week."
    sentiment2 = analyze_response_sentiment(invite_text)
    assert sentiment2["category"] == "INTERVIEW_INVITE"


# ---------------------------------------------------------------------------
# Task DS5: LLM Service + TokenCompressor
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ds5_llm_service_token_compressor(monkeypatch):
    from app.services.llm_service import llm_complete

    # Mock provider so we don't need live LLM credentials
    class DummyProvider:
        provider_name = "dummy"
        async def complete(self, sys_msg, usr_msg, max_tokens=800, temperature=0.3):
            return f"ECHO: {usr_msg}"
        def active_engine_label(self):
            return "dummy"

    monkeypatch.setattr("app.services.llm_service.build_provider", lambda tier="fast": DummyProvider())
    monkeypatch.setenv("LLM_MAX_INPUT_CHARS", "150")

    long_prompt = "Alpha " * 100  # 600 chars > 150 limit
    response = await llm_complete(
        system_message="System prompt",
        user_message=long_prompt,
    )

    assert "[... Context Compressed ...]" in response
    assert len(response) < len(long_prompt)


# ---------------------------------------------------------------------------
# Task DS6: Cover Letter + TemplateRegistry
# ---------------------------------------------------------------------------

def test_ds6_template_registry_integration():
    registry = get_template_registry()
    assert isinstance(registry, TemplateRegistry)
    templates = registry.list_templates()
    assert len(templates) >= 2
    template_ids = [t["template_id"] for t in templates]
    assert "modern_latex_cv" in template_ids
    assert "clean_typst_cv" in template_ids


def test_ds6_cover_letter_formatting_with_template():
    raw_letter = "Dear Hiring Team,\n\nI am excited to apply for the Backend Engineer position at Acme Corp."

    # Format using latex template
    latex_out = format_with_template(
        cover_letter_text=raw_letter,
        template_id="modern_latex_cv",
        job_title="Backend Engineer",
        company_name="Acme Corp",
    )
    assert "modern_latex_cv" in get_template_registry().get_template("modern_latex_cv")["template_id"]
    assert "Cover Letter: Backend Engineer at Acme Corp" in latex_out
    assert raw_letter in latex_out

    # Format using typst template
    typst_out = CoverLetterGenerator.format_with_template(
        cover_letter_text=raw_letter,
        template_id="clean_typst_cv",
        job_title="Backend Engineer",
        company_name="Acme Corp",
    )
    assert "= Cover Letter" in typst_out
    assert raw_letter in typst_out


# ---------------------------------------------------------------------------
# Task DS7: Job Providers + PortalScaffolder
# ---------------------------------------------------------------------------

def test_ds7_portal_scaffolder_integration():
    scaffolder = get_portal_scaffolder()
    assert isinstance(scaffolder, PortalScaffolder)

    # Scaffold a test portal
    scaffolded = scaffolder.scaffold_portal(
        portal_name="tech_jobs_co",
        base_url="https://techjobs.example.com",
        search_url_template="https://techjobs.example.com/search?q={query}",
        job_card_selector=".job-card",
        title_selector=".title",
        company_selector=".company",
    )
    assert scaffolded["name"] == "tech_jobs_co"
    assert scaffolder.get_portal("tech_jobs_co") is not None
    assert any(p["name"] == "tech_jobs_co" for p in scaffolder.list_portals())


# ---------------------------------------------------------------------------
# Task DS8: Optimizer + StyleDeltaLogger
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ds8_optimizer_style_delta_metrics(monkeypatch):
    from app.schemas import OptimizedResumePayloadSchema

    optimized_text_sample = (
        "Professional Summary\nSenior Software Engineer with 5+ years experience.\n\n"
        "Experience\nAcme Corp | Senior Software Engineer | 2021 - Present\n"
        "• Spearheaded distributed microservices migration to Go and Kubernetes.\n"
        "• Architected event-driven architecture reducing p99 latency by 45%.\n"
        "• Engineered high-throughput streaming pipelines processing 2M messages/second.\n"
        "• Deployed automated CI/CD workflows and optimized cloud infrastructure.\n\n"
        "Skills\nGo, Kubernetes, Docker, PostgreSQL, Redis, CI/CD"
    )

    mock_payload = OptimizedResumePayloadSchema(
        changes=["Added metrics and action verbs"],
        keywords_added=["Kubernetes", "Go"],
        estimated_score=88,
        optimized_text=optimized_text_sample,
    )

    class MockLongContext:
        async def condense(self, text, **kwargs):
            return text
        async def map_reduce_json(self, *args, **kwargs):
            return mock_payload
        async def map_reduce(self, *args, **kwargs):
            return optimized_text_sample

    monkeypatch.setattr("app.services.optimizer.LongContextClient", lambda: MockLongContext())
    # Bypass redis caching
    monkeypatch.setattr("app.services.optimizer.get_optimizer_result", AsyncMock(return_value=None))
    monkeypatch.setattr("app.services.optimizer.set_optimizer_result", AsyncMock(return_value=None))

    resume = """Experience
Acme Corp | Software Engineer | 2021 - Present
• Worked on microservices migration to Go and Kubernetes.
• Helped with architecture and latency reduction.
• Handled streaming data pipelines and messages.
• Maintained deployment workflows."""

    jd = "Looking for a Senior Go Engineer with Kubernetes and distributed systems experience."

    result = await optimize_with_reflection(
        resume_text=resume,
        job_description=jd,
        target_role="Senior Software Engineer",
    )

    assert "style_metrics" in result
    style_metrics = result["style_metrics"]
    assert "initial" in style_metrics
    assert "optimized" in style_metrics
    assert "delta" in style_metrics

    assert "action_verb_count" in style_metrics["initial"]
    assert "action_verb_count" in style_metrics["optimized"]
    assert "action_verb_ratio_delta" in style_metrics["delta"]
    assert "improved_action_density" in style_metrics["delta"]
    # The mock optimized text has spearheaded, architected, engineered, deployed, optimized
    assert style_metrics["delta"]["improved_action_density"] is True

    # Check optimization summary includes style delta
    summary = result.get("optimization_summary", {})
    assert "action_verb_ratio_delta" in summary
    assert "improved_action_density" in summary
