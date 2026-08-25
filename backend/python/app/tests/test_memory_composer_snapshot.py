import pytest

from app.services import memory_composer


@pytest.mark.asyncio
async def test_snapshot_reports_contributing_tiers_without_content_leak(monkeypatch):
    async def working(user_id, conversation_id):
        return "[conversation summary] private context"

    async def procedural(user_id):
        return "[user preferences] preferred roles: data engineer"

    async def episodic(user_id):
        return "[recent feedback] liked: data engineer"

    async def semantic(user_id, query):
        return "[similar past docs] resume snippet"

    monkeypatch.setattr(memory_composer, "_fetch_working", working)
    monkeypatch.setattr(memory_composer, "_fetch_procedural", procedural)
    monkeypatch.setattr(memory_composer, "_fetch_episodic", episodic)
    monkeypatch.setattr(memory_composer, "_fetch_semantic", semantic)

    snapshot = await memory_composer.compose_context_snapshot(
        "user-1", query="data engineer", conversation_id="conversation-1", char_budget=500
    )

    assert snapshot.tiers_used == ("working", "procedural", "episodic", "semantic")
    assert snapshot.truncated is False
    assert snapshot.char_budget == 500
    assert "private context" in snapshot.context


@pytest.mark.asyncio
async def test_snapshot_marks_budget_truncation(monkeypatch):
    async def value(*args):
        return "[working] " + ("long private value " * 20)

    monkeypatch.setattr(memory_composer, "_fetch_working", value)
    monkeypatch.setattr(memory_composer, "_fetch_procedural", lambda *args: _empty())
    monkeypatch.setattr(memory_composer, "_fetch_episodic", lambda *args: _empty())
    monkeypatch.setattr(memory_composer, "_fetch_semantic", lambda *args: _empty())

    snapshot = await memory_composer.compose_context_snapshot("user-1", char_budget=48)

    assert snapshot.tiers_used == ("working",)
    assert snapshot.truncated is True
    assert len(snapshot.context) <= 49
    assert snapshot.context.endswith("…")


async def _empty():
    return ""
