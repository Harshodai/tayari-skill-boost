"""Unit tests for Phase 10 advanced adaptations."""

import pytest
try:
    import networkx as nx
except ImportError:
    nx = None

from app.services.hermes.stealth_cookie_jar import StealthCookieJar
from app.scoring.keyword_density_optimizer import KeywordDensityOptimizer
from app.services.mock_interview_simulator import MockInterviewSimulator
from app.memory.relational_graph_adapter import RelationalGraphAdapter


def test_stealth_cookie_jar():
    jar = StealthCookieJar()
    jar.set_cookies("example.com", [{"name": "session", "value": "abc"}])
    cookies = jar.get_cookies("example.com")
    assert len(cookies) == 1
    assert cookies[0]["name"] == "session"


def test_keyword_density_optimizer():
    resume = "Python Developer with Python experience in Python microservices."
    keywords = ["Python", "Go"]
    res = KeywordDensityOptimizer.analyze_keyword_density(resume, keywords)

    assert res["keyword_counts"]["Python"] == 3
    assert res["keyword_counts"]["Go"] == 0
    assert len(res["recommendations"]) > 0


def test_mock_interview_simulator():
    session = MockInterviewSimulator.generate_interview_session("Senior Engineer")
    assert session["total_questions"] == 6
    assert len(session["technical_questions"]) == 3

    eval_res = MockInterviewSimulator.evaluate_answer(
        "Tell me about a project.",
        "In this Situation I had a Task to optimize backend latency across several high-throughput microservices. I led the Action to rewrite DB queries and introduce caching layers, which achieved the Result of 50% faster API response times across the platform."
    )
    assert eval_res["star_framework_detected"] is True
    assert eval_res["score"] >= 80



def test_relational_graph_adapter():
    if nx is not None:
        G = nx.DiGraph()
        G.add_node("u1", type="person", name="User")
        G.add_node("s1", type="skill", name="Python")
        G.add_edge("u1", "s1", relationship="HAS_SKILL")

        res = RelationalGraphAdapter.to_relational_tables(G, "u1")
        assert res["nodes_count"] == 2
        assert res["edges_count"] == 1
        assert res["nodes_table"][0]["user_id"] == "u1"
