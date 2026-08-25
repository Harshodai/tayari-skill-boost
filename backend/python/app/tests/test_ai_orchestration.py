import asyncio

import pytest

from app.services.ai_orchestration import (
    SwarmStep,
    choose_tier,
    normalize_tier,
    run_bounded_swarm,
)
from app.services import llm_service


def test_task_kind_routing_is_explicit_and_conservative():
    assert choose_tier(task_kind="bulk_extract").resolved_tier == "cheap"
    assert choose_tier(task_kind="agent_plan").resolved_tier == "smart"
    assert choose_tier(task_kind="safety_review").resolved_tier == "deep"
    assert choose_tier(task_kind="general").resolved_tier == "fast"
    assert choose_tier(tier="smart", task_kind="bulk_extract").resolved_tier == "smart"


def test_unknown_tier_fails_closed_to_fast():
    assert normalize_tier("not-a-real-tier") == "fast"
    assert normalize_tier("reasoning") == "smart"
    assert normalize_tier("max") == "deep"


def test_tier_overrides_preserve_unsuffixed_fallback(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "synthetic-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "base/model")
    monkeypatch.setenv("OPENROUTER_MODEL_FAST", "fast/model")
    monkeypatch.setenv("OPENROUTER_MODEL_SMART", "smart/model")
    monkeypatch.delenv("OPENROUTER_MODEL_CHEAP", raising=False)
    monkeypatch.delenv("OPENROUTER_MODEL_DEEP", raising=False)

    assert llm_service.build_provider("cheap")._model == "fast/model"
    assert llm_service.build_provider("fast")._model == "fast/model"
    assert llm_service.build_provider("smart")._model == "smart/model"
    assert llm_service.build_provider("deep")._model == "smart/model"


def test_routing_snapshot_never_exposes_provider_secret(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "do-not-return-this")
    monkeypatch.setenv("OPENROUTER_MODEL", "safe/model")
    snapshot = llm_service.routing_snapshot()
    assert snapshot["secrets_exposed"] is False
    assert "do-not-return-this" not in str(snapshot)
    assert snapshot["tiers"]["fast"]["available"] is True


@pytest.mark.asyncio
async def test_bounded_swarm_preserves_order_and_isolates_failure():
    started = 0
    peak = 0
    active = 0
    lock = asyncio.Lock()

    async def worker(step: SwarmStep):
        nonlocal started, peak, active
        async with lock:
            started += 1
            active += 1
            peak = max(peak, active)
        await asyncio.sleep(0.001)
        async with lock:
            active -= 1
        if step.role == "failure":
            raise RuntimeError("specialist unavailable")
        return {"role": step.role}

    outcomes = await run_bounded_swarm(
        [
            SwarmStep("a", "first", {}),
            SwarmStep("b", "failure", {}),
            SwarmStep("c", "third", {}),
        ],
        worker,
        max_parallel=2,
        timeout_seconds=1,
    )

    assert started == 3
    assert peak <= 2
    assert [item.step_id for item in outcomes] == ["a", "b", "c"]
    assert outcomes[0].status == "completed"
    assert outcomes[1].status == "failed"
    assert outcomes[2].status == "completed"


def test_swarm_batch_is_bounded():
    steps = [SwarmStep(str(i), "role", {}) for i in range(13)]

    async def worker(step):
        return step.step_id

    with pytest.raises(ValueError, match="maximum of 12"):
        asyncio.run(run_bounded_swarm(steps, worker))
