"""Unit tests for Phase 4 advanced adaptations."""

import pytest
from unittest.mock import AsyncMock, patch
try:
    import networkx as nx
except ImportError:
    nx = None

from app.services.template_registry import TemplateRegistry
from app.services.negotiation_engine import NegotiationEngine
from app.export.graph_visualizer import GraphVisualizer
from app.a2a.agent_squad import AgentSquadOrchestrator
from app.services.hermes.domain_rules import DomainRulesEngine
from app.services.llm_service import LLMNotConfiguredError


def test_template_registry():
    registry = TemplateRegistry()
    templates = registry.list_templates()
    assert len(templates) >= 2

    tmpl = registry.get_template("modern_latex_cv")
    assert tmpl is not None
    assert tmpl["engine"] == "latex"


def test_negotiation_engine():
    bench = NegotiationEngine.benchmark_salary("Senior Software Engineer", level="senior")
    assert bench["percentiles"]["50th"] > 100000

    script = NegotiationEngine.generate_counter_offer_script("Acme", "Senior Engineer", 140000, 160000)
    assert script["difference"] == 20000
    assert "Acme" in script["email_script"]


def test_graph_visualizer():
    G = nx.DiGraph()
    G.add_node("Candidate", type="person", label="John")
    G.add_node("skill:python", type="skill", name="python")
    G.add_edge("Candidate", "skill:python", relationship="HAS_SKILL")

    rf_data = GraphVisualizer.to_react_flow_json(G)
    assert rf_data["total_nodes"] == 2
    assert rf_data["total_edges"] == 1
    assert rf_data["nodes"][0]["data"]["type"] in ["person", "skill"]


@pytest.mark.asyncio
async def test_agent_squad_orchestrator():
    # ponytail: this used to call the real OptimizerAgent -> LongContextClient
    # -> live LLM chain and assert status == "completed" unconditionally,
    # which only ever passed in an environment with a real LLM provider
    # configured -- non-deterministic in CI, and misaligned with the
    # orchestrator's own correct fail-closed design (see
    # test_agent_squad_orchestrator_fails_closed_without_llm below). Mock at
    # the agent boundary so the orchestrator's OWN dispatch/audit/response
    # logic is what's under test, not the live optimizer/truth-gate chain.
    fake_optimizer_result = {
        "agent": "OptimizerAgent",
        "action": "optimize_resume",
        "payload": {"optimized_text": "Tailored resume text.", "changes": ["Added Python keyword"], "estimated_score": 82},
    }
    fake_truth_result = {
        "agent": "TruthGateAgent",
        "action": "check_authenticity",
        "payload": {"is_truthful": True, "risk_score": 5, "flags": []},
    }
    with patch("app.a2a.agent_squad.handle_optimizer_message", new_callable=AsyncMock, return_value=fake_optimizer_result), \
         patch("app.a2a.agent_squad.handle_truth_gate_message", new_callable=AsyncMock, return_value=fake_truth_result):
        orchestrator = AgentSquadOrchestrator()
        res = await orchestrator.execute_squad_workflow("CV text", "JD text", "Acme", "Dev")
    assert res["status"] == "completed"
    assert res["agents_executed"] == ["OptimizerAgent", "TruthGateAgent"]
    assert res["candidate_approval_required"] is True
    assert res["submission_permitted"] is False
    assert "optimizer" in res["outputs"]
    assert "truth_gate" in res["outputs"]


@pytest.mark.asyncio
async def test_agent_squad_orchestrator_fails_closed_without_llm():
    # ponytail: proves the orchestrator's actual fail-closed behavior --
    # when the optimizer agent can't run (e.g. LLMNotConfiguredError), the
    # squad must report status:"failed" with no agents_executed and no
    # submission permitted, never a fabricated "completed" review package.
    with patch("app.a2a.agent_squad.handle_optimizer_message", new_callable=AsyncMock, side_effect=LLMNotConfiguredError("unconfigured")):
        orchestrator = AgentSquadOrchestrator()
        res = await orchestrator.execute_squad_workflow("CV text", "JD text", "Acme", "Dev")
    assert res["status"] == "failed"
    assert res["agents_executed"] == []
    assert res["submission_permitted"] is False
    assert res["outputs"] == {}


def test_domain_rules_engine():
    res1 = DomainRulesEngine.detect_scraping_failure("Normal job posting text here with details.")
    assert res1["is_blocked"] is False

    res2 = DomainRulesEngine.detect_scraping_failure("<html><body>Verify you are human Cloudflare</body></html>")
    assert res2["is_blocked"] is True
    assert res2["requires_browser_fallback"] is True
