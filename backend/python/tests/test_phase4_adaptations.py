"""Unit tests for Phase 4 advanced adaptations."""

import pytest
try:
    import networkx as nx
except ImportError:
    nx = None

from app.services.template_registry import TemplateRegistry
from app.services.negotiation_engine import NegotiationEngine
from app.export.graph_visualizer import GraphVisualizer
from app.a2a.agent_squad import AgentSquadOrchestrator
from app.services.hermes.domain_rules import DomainRulesEngine


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
    orchestrator = AgentSquadOrchestrator()
    res = await orchestrator.execute_squad_workflow("CV text", "JD text", "Acme", "Dev")
    assert res["status"] == "COMPLETED"
    assert "Scout" in res["agents_executed"]


def test_domain_rules_engine():
    res1 = DomainRulesEngine.detect_scraping_failure("Normal job posting text here with details.")
    assert res1["is_blocked"] is False

    res2 = DomainRulesEngine.detect_scraping_failure("<html><body>Verify you are human Cloudflare</body></html>")
    assert res2["is_blocked"] is True
    assert res2["requires_browser_fallback"] is True
