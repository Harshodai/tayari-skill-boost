import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services import career_ops_evaluator

@pytest.mark.asyncio
async def test_evaluate_job_candidate(monkeypatch):
    # Setup LLM mocks
    mock_llm_json = AsyncMock(return_value={
        "archetype": "Agentic",
        "block_a": {
            "domain": "LLMs",
            "function": "Build",
            "seniority": "Senior",
            "remote": "Remote",
            "team_size": "5 developers",
            "tldr": "Implement multi-agent systems."
        },
        "block_b": {
            "mappings": [{"requirement": "Agentic systems", "cv_mapping": "Built multi-agent frameworks"}],
            "gaps": [{"gap": "Kubernetes", "importance": "Nice-to-have", "mitigation": "Learn on the job"}]
        },
        "block_c": {
            "level_detected": "Match",
            "sell_senior_plan": "Highlight agentic architecture design",
            "downlevel_plan": "Negotiate on ownership"
        },
        "block_d": {
            "comp_estimate": "$150k - $180k",
            "demand_trend": "High growth"
        },
        "block_e": {
            "cv_changes": [{"section": "Summary", "current": "Dev", "proposed": "AI Eng", "reason": "Keyword fit"}]
        },
        "block_f": {
            "stories": [{"requirement": "Agents", "situation": "S", "task": "T", "action": "A", "result": "R", "reflection": "Reflect"}]
        }
    })
    
    mock_llm_complete = AsyncMock(return_value="  Here is a draft cover letter.  ")
    
    mock_check_job_legitimacy = AsyncMock(return_value={
        "legitimacy_tier": "High Confidence",
        "signals": [{"signal": "Address validation", "finding": "Valid address", "weight": "Positive"}],
        "context_notes": "Looks good."
    })
    
    monkeypatch.setattr(career_ops_evaluator, "llm_json", mock_llm_json)
    monkeypatch.setattr(career_ops_evaluator, "llm_complete", mock_llm_complete)
    monkeypatch.setattr(career_ops_evaluator, "check_job_legitimacy", mock_check_job_legitimacy)
    
    res = await career_ops_evaluator.evaluate_job_candidate(
        user_id="user_123",
        resume_text="Senior Developer with agentic design experience.",
        title="Senior Agentic AI Engineer",
        company="Antigravity Corp",
        location="Remote",
        description="Build multi-agent frameworks using Python."
    )
    
    assert res["archetype"] == "Agentic"
    assert res["block_a"]["domain"] == "LLMs"
    assert res["block_g"]["legitimacy_tier"] == "High Confidence"
    assert res["cover_letter_draft"] == "Here is a draft cover letter."
    
    mock_llm_json.assert_called_once()
    mock_llm_complete.assert_called_once()
    mock_check_job_legitimacy.assert_called_once()
