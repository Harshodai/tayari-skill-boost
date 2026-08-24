import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from app.services.career_ops_evaluator import evaluate_job_candidate
from app.services.llm_service import LLMNotConfiguredError


def _mock_engine(map_reduce_json_result=None, map_reduce_json_side_effect=None):
    engine = MagicMock()
    engine.condense = AsyncMock(return_value="condensed jd")
    if map_reduce_json_side_effect is not None:
        engine.map_reduce_json = AsyncMock(side_effect=map_reduce_json_side_effect)
    else:
        engine.map_reduce_json = AsyncMock(return_value=map_reduce_json_result)
    engine.map_reduce = AsyncMock(return_value="draft cover letter")
    return engine


@pytest.mark.asyncio
async def test_evaluate_job_candidate_does_not_fabricate_empty_report_on_failure():
    # ponytail: regression test for a real fabrication bug — Blocks A-F used
    # to catch ANY exception (including an unconfigured LLM) and continue with
    # eval_data = {}, returning HTTP 200 with an empty evaluation that looked
    # like "the candidate has no findings" rather than "the evaluation never
    # ran." A missing evaluation must fail loudly.
    with patch("app.services.career_ops_evaluator._engine_llm", return_value=_mock_engine(map_reduce_json_side_effect=LLMNotConfiguredError("unconfigured"))):
        with pytest.raises(LLMNotConfiguredError):
            await evaluate_job_candidate(
                user_id="user-1", resume_text="resume", title="Engineer", company="Acme",
                location="Remote", description="job description",
            )


@pytest.mark.asyncio
async def test_evaluate_job_candidate_marks_legitimacy_check_unavailable_not_fabricated():
    # ponytail: regression test — the legitimacy sub-check used to fall back to
    # a plausible-sounding "Proceed with Caution" verdict on failure, presented
    # as if it were a real signal-derived judgment about the employer.
    engine = _mock_engine(map_reduce_json_result={"block_a": {}})
    with patch("app.services.career_ops_evaluator._engine_llm", return_value=engine), \
         patch("app.services.career_ops_evaluator.check_job_legitimacy", new_callable=AsyncMock, side_effect=RuntimeError("provider down")):
        report = await evaluate_job_candidate(
            user_id="user-1", resume_text="resume", title="Engineer", company="Acme",
            location="Remote", description="job description",
        )
    assert report["block_g"]["legitimacy_tier"] == "Unavailable"
    assert report["block_g"]["check_failed"] is True


@pytest.mark.asyncio
async def test_evaluate_job_candidate_happy_path():
    engine = _mock_engine(map_reduce_json_result={"block_a": {"summary": "strong fit"}})
    with patch("app.services.career_ops_evaluator._engine_llm", return_value=engine), \
         patch("app.services.career_ops_evaluator.check_job_legitimacy", new_callable=AsyncMock, return_value={"legitimacy_tier": "Verified", "signals": [], "context_notes": ""}):
        report = await evaluate_job_candidate(
            user_id="user-1", resume_text="resume", title="Engineer", company="Acme",
            location="Remote", description="job description",
        )
    assert report["block_a"]["summary"] == "strong fit"
    assert report["block_g"]["legitimacy_tier"] == "Verified"
    assert report["cover_letter_draft"] == "draft cover letter"
