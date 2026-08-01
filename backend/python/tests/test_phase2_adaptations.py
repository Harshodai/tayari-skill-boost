"""Unit tests for Phase 2 advanced adaptations."""

import pytest
from app.services.profile_expander import ProfileExpander
from app.services.followup_generator import FollowupGenerator
from app.services.codegraph_service import CodeGraphEngine
from app.services.skill_library import SkillLibrary
from app.services.hermes.thompson_proxy_sampler import ThompsonProxySampler
from app.export.pipeline_dashboard_generator import PipelineDashboardGenerator


@pytest.mark.asyncio
async def test_profile_expander_empty_username():
    result = await ProfileExpander.expand_from_github("")
    assert result["status"] == "error"


def test_followup_generator_quiet_apps():
    apps = [
        {"id": "1", "company": "Acme Inc", "role": "Senior Engineer", "status": "submitted", "last_updated_at": "2026-01-01T00:00:00Z", "followup_count": 0},
        {"id": "2", "company": "Beta Tech", "role": "Tech Lead", "status": "rejected", "last_updated_at": "2026-01-01T00:00:00Z", "followup_count": 0}
    ]
    quiet = FollowupGenerator.inspect_applications(apps)
    assert len(quiet) == 1
    assert quiet[0]["company"] == "Acme Inc"


def test_followup_draft():
    draft = FollowupGenerator.draft_followup_message("Acme Inc", "Senior Engineer", "Harshodai")
    assert "Acme Inc" in draft["subject"]
    assert "Harshodai" in draft["body"]


def test_codegraph_engine():
    engine = CodeGraphEngine()
    sample_code = """
def calculate_metrics(data):
    return len(data)

class DataProcessor:
    def process(self):
        pass
"""
    result = engine.index_source_code("sample.py", sample_code)
    assert result["status"] == "success"
    assert result["functions_count"] == 2
    assert result["classes_count"] == 1


    impact = engine.get_impact_radius("calculate_metrics")
    assert impact["symbol"] == "calculate_metrics"


def test_skill_library():
    library = SkillLibrary()
    library.register_skill(
        name="interview_prep",
        description="STAR interview prep",
        trigger_conditions=["interview", "prep"],
        execution_steps=["step 1", "step 2"]
    )
    matched = library.match_skill("Need help with interview practice")
    assert matched is not None
    assert matched["name"] == "interview_prep"


def test_thompson_proxy_sampler():
    sampler = ThompsonProxySampler(["http://proxy1.com", "http://proxy2.com"])
    chosen = sampler.select_proxy("example.com")
    assert chosen in ["http://proxy1.com", "http://proxy2.com"]

    sampler.record_result("example.com", chosen, success=True)


def test_pipeline_dashboard_generator():
    stats = {"total_applications": 5, "interviews": 2, "offers": 1}
    apps = [{"company": "Acme", "role": "Dev", "status": "interviewing", "last_updated_at": "2026-08-01"}]
    html = PipelineDashboardGenerator.generate_html_report(stats, apps)
    assert "<title>Tayari Skill Boost — Pipeline Analytics</title>" in html
    assert "Acme" in html
