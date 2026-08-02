"""Unit tests for LayeredMemoryEngine L3 persona retrieval."""

from app.memory.memory_distillation import LayeredMemoryEngine


def test_fresh_engine_absent_user_node_returns_empty_persona():
    engine = LayeredMemoryEngine(user_id="u-missing")

    persona = engine.get_l3_persona()

    assert persona["user_id"] == "u-missing"
    assert persona["skills"] == []
    assert persona["companies"] == []
    assert persona["titles"] == []
    assert persona["target_role"] == "Software Engineer"
    assert persona["location_preference"] == "Remote / Any"
    assert persona["graph_summary"] == {"total_nodes": 0, "total_edges": 0}


def test_absent_user_node_with_only_l0_session_returns_empty_persona():
    engine = LayeredMemoryEngine(user_id="u-l0-only")
    engine.add_l0_session(session_id="s1", raw_text="hello")

    persona = engine.get_l3_persona()

    assert persona["skills"] == []
    assert persona["companies"] == []
    assert persona["titles"] == []
    assert persona["target_role"] == "Software Engineer"
    assert persona["location_preference"] == "Remote / Any"
    assert persona["graph_summary"] == {"total_nodes": 1, "total_edges": 0}


def test_present_user_node_returns_distilled_lists():
    engine = LayeredMemoryEngine(user_id="u-present")
    engine.distill_l1_facts(
        skills=["Python", "Go"],
        companies=["Acme"],
        titles=["Engineer"],
    )

    persona = engine.get_l3_persona()

    assert persona["skills"] == ["python", "go"]
    assert persona["companies"] == ["Acme"]
    assert persona["titles"] == ["Engineer"]
    assert persona["target_role"] == "Software Engineer"
    assert persona["location_preference"] == "Remote / Any"
    assert persona["graph_summary"] == {"total_nodes": 5, "total_edges": 4}


def test_present_user_node_without_edges_returns_empty_lists():
    engine = LayeredMemoryEngine(user_id="u-bare")
    engine.distill_l1_facts(skills=[], companies=[], titles=[])

    persona = engine.get_l3_persona()

    assert persona["skills"] == []
    assert persona["companies"] == []
    assert persona["titles"] == []
    assert persona["graph_summary"] == {"total_nodes": 1, "total_edges": 0}


def test_present_user_node_with_l2_context_uses_goal_overrides():
    engine = LayeredMemoryEngine(user_id="u-goal")
    engine.distill_l1_facts(skills=["Python"], companies=[], titles=[])
    engine.set_l2_context(target_role="Data Scientist", desired_location="Berlin", min_salary=120000)

    persona = engine.get_l3_persona()

    assert persona["skills"] == ["python"]
    assert persona["target_role"] == "Data Scientist"
    assert persona["location_preference"] == "Berlin"
