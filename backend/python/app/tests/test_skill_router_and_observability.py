"""Tests for WP-06 (Langfuse LLM Observability) and WP-12 (Multi-Agent Skill Router)."""
import logging
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.agent.skill_router import (
    SkillRouter,
    SkillTaskType,
    LatencyTarget,
    route_skill,
    resolve_model_tier,
    get_routing_info,
    extract_latency_target_from_headers,
)
from app.agent.subagent_orchestrator import SubagentOrchestrator
from app.services import llm_service
from app.services.llm_service import (
    daily_cost_tracker,
    calculate_llm_cost,
    estimate_tokens,
    get_model_pricing,
)
from app.telemetry.langfuse_client import (
    LangfuseTelemetryClient,
    get_langfuse_client,
)
from app.telemetry import metrics


# ===========================================================================
# WP-12: Multi-Agent Skill Router Tests
# ===========================================================================

def test_model_routing_for_fast_vs_quality_targets():
    """Verify model routing for fast, balanced, and quality targets across task types."""
    assert resolve_model_tier(SkillTaskType.ATS_SCORE, LatencyTarget.BALANCED) is None
    assert resolve_model_tier(SkillTaskType.ATS_SCORE, LatencyTarget.FAST) is None
    assert resolve_model_tier(SkillTaskType.ATS_SCORE, LatencyTarget.QUALITY) is None

    assert resolve_model_tier(SkillTaskType.JOB_DISCOVERY_EXTRACTION, LatencyTarget.BALANCED) == "cheap"
    assert resolve_model_tier(SkillTaskType.JOB_DISCOVERY_EXTRACTION, LatencyTarget.FAST) == "cheap"
    assert resolve_model_tier(SkillTaskType.JOB_DISCOVERY_EXTRACTION, LatencyTarget.QUALITY) == "fast"

    assert resolve_model_tier(SkillTaskType.COMPANY_BRIEF_EXTRACTION, LatencyTarget.BALANCED) == "cheap"
    assert resolve_model_tier(SkillTaskType.COMPANY_BRIEF_EXTRACTION, LatencyTarget.FAST) == "cheap"
    assert resolve_model_tier(SkillTaskType.COMPANY_BRIEF_EXTRACTION, LatencyTarget.QUALITY) == "fast"

    assert resolve_model_tier(SkillTaskType.RESUME_ANALYSIS, LatencyTarget.BALANCED) == "smart"
    assert resolve_model_tier(SkillTaskType.RESUME_ANALYSIS, LatencyTarget.FAST) == "fast"
    assert resolve_model_tier(SkillTaskType.RESUME_ANALYSIS, LatencyTarget.QUALITY) == "deep"

    assert resolve_model_tier(SkillTaskType.COVER_LETTER, LatencyTarget.BALANCED) == "smart"
    assert resolve_model_tier(SkillTaskType.COVER_LETTER, LatencyTarget.FAST) == "fast"
    assert resolve_model_tier(SkillTaskType.COVER_LETTER, LatencyTarget.QUALITY) == "deep"

    assert resolve_model_tier(SkillTaskType.INTERVIEW_QUESTIONS, LatencyTarget.BALANCED) == "smart"
    assert resolve_model_tier(SkillTaskType.INTERVIEW_QUESTIONS, LatencyTarget.FAST) == "fast"
    assert resolve_model_tier(SkillTaskType.INTERVIEW_QUESTIONS, LatencyTarget.QUALITY) == "deep"

    assert resolve_model_tier(SkillTaskType.FIT_MATRIX_DIMENSION, LatencyTarget.BALANCED) == "fast"
    assert resolve_model_tier(SkillTaskType.FIT_MATRIX_DIMENSION, LatencyTarget.FAST) == "cheap"
    assert resolve_model_tier(SkillTaskType.FIT_MATRIX_DIMENSION, LatencyTarget.QUALITY) == "smart"


def test_header_extraction_for_latency_target():
    """Verify X-Latency-Target header extraction and parsing."""
    headers_fast = {"X-Latency-Target": "fast"}
    assert extract_latency_target_from_headers(headers_fast) == LatencyTarget.FAST

    headers_quality = {"x-latency-target": "quality"}
    assert extract_latency_target_from_headers(headers_quality) == LatencyTarget.QUALITY

    headers_empty = {}
    assert extract_latency_target_from_headers(headers_empty) == LatencyTarget.BALANCED


def test_routing_diagnostics():
    """Verify structured routing diagnostics information."""
    info_ats = get_routing_info(SkillTaskType.ATS_SCORE)
    assert info_ats["is_deterministic"] is True
    assert "0 LLM calls" in info_ats["model_descriptor"]

    info_extract = get_routing_info(SkillTaskType.JOB_DISCOVERY_EXTRACTION, LatencyTarget.BALANCED)
    assert info_extract["is_deterministic"] is False
    assert info_extract["effective_tier"] == "cheap"


@pytest.mark.asyncio
async def test_ats_score_executes_zero_llm_calls():
    """Verify that ats_score routes to deterministic heuristic scorer with ZERO LLM calls and 0 cost."""
    payload = {
        "resume_text": "Experienced Python Engineer specializing in AWS, Docker, and PostgreSQL with 5 years experience.",
        "job_description": "We are looking for a Python Engineer with AWS and Docker skills.",
    }

    res = await route_skill(SkillTaskType.ATS_SCORE, payload)
    assert isinstance(res, dict)
    assert "score" in res
    assert 0 <= res["score"] <= 100
    assert res["llm_calls"] == 0
    assert res["cost_usd"] == 0.0
    assert res["execution_mode"] == "deterministic_heuristic"


@pytest.mark.asyncio
async def test_subagent_orchestrator_integration():
    """Verify SubagentOrchestrator delegates tasks to SkillRouter."""
    orch = SubagentOrchestrator()
    res = await orch.route_task(
        task_type="ats_score",
        payload={
            "resume_text": "Full Stack Engineer, Python, React, TypeScript.",
            "job_description": "Seeking Full Stack Engineer with Python and React.",
        },
    )
    assert res["llm_calls"] == 0
    assert "score" in res


# ===========================================================================
# WP-06: Langfuse LLM Observability Tests
# ===========================================================================

def test_fail_open_langfuse_client_when_keys_are_missing():
    """Verify Langfuse client is disabled and fail-open when keys are missing."""
    client = LangfuseTelemetryClient()
    client.reset()
    client.initialize()
    assert client.is_enabled is False

    record = client.trace_llm_call(
        trace_id="test-trace-1",
        model="test-model",
        prompt_tokens=100,
        completion_tokens=50,
        latency_ms=120.5,
        cost_usd=0.0002,
    )
    assert record is not None
    assert record["trace_id"] == "test-trace-1"
    assert record["total_tokens"] == 150
    assert len(client.get_recent_traces()) == 1


def test_fail_open_langfuse_client_on_remote_or_sdk_exception():
    """Verify Langfuse client catches exceptions during trace emission and does not fail."""
    mock_sdk = MagicMock()
    mock_sdk.trace.side_effect = RuntimeError("Langfuse API unavailable")

    client = LangfuseTelemetryClient()
    client._public_key = "pk-mock"
    client._secret_key = "sk-mock"
    client._enabled = True
    client._initialized = True
    client._sdk_client = mock_sdk

    record = client.trace_llm_call(
        trace_id="fail-open-trace",
        model="gpt-4o",
        prompt_tokens=200,
        completion_tokens=100,
        latency_ms=300.0,
    )
    assert record["trace_id"] == "fail-open-trace"


def test_token_pricing_and_estimation():
    """Verify token pricing tables and fast approximation logic."""
    assert estimate_tokens("") == 0
    assert estimate_tokens("12345678") == 2

    in_sonnet, out_sonnet = get_model_pricing("anthropic/claude-3-5-sonnet")
    assert in_sonnet == 3.00
    assert out_sonnet == 15.00

    in_flash, out_flash = get_model_pricing("google/gemini-2.0-flash")
    assert in_flash == 0.10
    assert out_flash == 0.40

    cost = calculate_llm_cost("claude-3.5-sonnet", 1000, 1000)
    assert pytest.approx(cost, 0.0001) == 0.018


@pytest.mark.asyncio
async def test_llm_complete_records_trace_metrics_and_fails_open():
    """Verify llm_complete records trace metrics via langfuse_client while succeeding."""
    mock_provider = MagicMock()
    mock_provider.active_engine_label.return_value = "anthropic/claude-3-5-sonnet"
    mock_provider.complete = AsyncMock(return_value="Valid mock completion")

    client = get_langfuse_client()
    client.reset()

    with patch.object(llm_service, "build_provider", return_value=mock_provider):
        result = await llm_service.llm_complete(
            system_message="System prompt",
            user_message="User prompt",
            session_id="trace-test-123",
        )

    assert result == "Valid mock completion"
    traces = client.get_recent_traces()
    assert len(traces) == 1
    assert traces[0]["trace_id"] == "trace-test-123"
    assert traces[0]["model"] == "anthropic/claude-3-5-sonnet"
    assert traces[0]["prompt_tokens"] > 0
    assert traces[0]["cost_usd"] > 0


@pytest.mark.asyncio
async def test_daily_cost_alert_trigger():
    """Verify that exceeding daily budget triggers alert counter without failing request."""
    mock_provider = MagicMock()
    mock_provider.active_engine_label.return_value = "anthropic/claude-3-5-sonnet"
    mock_provider.complete = AsyncMock(return_value="A long generated response")

    daily_cost_tracker.reset()
    with patch.dict("os.environ", {"MAX_DAILY_LLM_COST_USD": "0.000001"}), \
         patch.object(llm_service, "build_provider", return_value=mock_provider):
        res = await llm_service.llm_complete(
            system_message="Sys prompt",
            user_message="User prompt",
            _user_id="budget_user_test",
        )

    assert res == "A long generated response"
    snapshot = metrics.snapshot()
    assert snapshot["counters"].get("llm_daily_cost_budget_exceeded_total", 0) >= 1
