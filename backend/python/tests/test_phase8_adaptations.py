"""Unit tests for Phase 8 advanced adaptations."""

import pytest
try:
    import networkx as nx
except ImportError:
    nx = None

from app.guardrails.legitimacy_checker import LegitimacyChecker
from app.scoring.graph_traversal import GraphTraversalEngine
from app.a2a.agent_audit_trail import AgentAuditTrail
from app.services.hermes.rate_limit_controller import RateLimitController


def test_legitimacy_checker():
    res1 = LegitimacyChecker.evaluate_posting_legitimacy("Dev", "Good job", days_posted=5)
    assert res1["is_ghost_job_risk"] is False

    res2 = LegitimacyChecker.evaluate_posting_legitimacy("Dev", "Fast-paced environment self-starter team player", days_posted=50, is_reposted=True)
    assert res2["is_ghost_job_risk"] is True
    assert res2["ghost_job_risk_score"] >= 50


def test_graph_traversal_engine():
    if nx is not None:
        G = nx.DiGraph()
        G.add_edge("Candidate", "skill:python")
        G.add_edge("skill:python", "role:senior_dev")

        path_res = GraphTraversalEngine.find_skill_pathways(G, "Candidate", "role:senior_dev")
        assert path_res["has_path"] is True
        assert path_res["path_length"] == 2


def test_agent_audit_trail():
    trail = AgentAuditTrail()
    entry = trail.record_agent_action("Builder", "tailor_resume", {"user": "u1"}, {"status": "ok"})
    assert entry["agent_name"] == "Builder"

    logs = trail.get_logs("Builder")
    assert len(logs) == 1


def test_rate_limit_controller():
    controller = RateLimitController(max_tokens=2, refill_rate_per_sec=1.0)
    assert controller.allow_request("example.com") is True
    assert controller.allow_request("example.com") is True
    assert controller.allow_request("example.com") is False
