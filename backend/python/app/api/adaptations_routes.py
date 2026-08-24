"""Master Adaptations API Gateway Router.

Exposes REST endpoints for all architectural adaptations:
- Profile auto-expansion (/expand)
- Quiet application follow-up inspection (/outcome followup)
- CodeGraph AST symbol indexing & impact analysis
- ATS PDF parseability validation
- Truth subspace vector alignment scoring
- Sub-graph React Flow visualizer data export
- Salary benchmarking & negotiation counter-offer generator
- Multi-role agent squad orchestration
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel, Field
try:
    import networkx as nx
except ImportError:
    nx = None


from app.services.profile_expander import ProfileExpander
from app.services.followup_generator import FollowupGenerator
from app.services.codegraph_service import CodeGraphEngine
from app.guardrails.ats_pdf_validator import ATSPDFValidator
from app.scoring.truth_subspace import TruthSubspaceEngine
from app.export.graph_visualizer import GraphVisualizer
from app.services.negotiation_engine import NegotiationEngine
from app.a2a.agent_squad import AgentSquadOrchestrator

logger = logging.getLogger(__name__)

adaptations_router = APIRouter(prefix="/api/v1/adaptations", tags=["adaptations"])


class ProfileExpandRequest(BaseModel):
    github_username: str = Field(..., json_schema_extra={"example": "octocat"})


class FollowupCheckRequest(BaseModel):
    applications: List[Dict[str, Any]] = Field(default_factory=list)
    candidate_name: Optional[str] = None


class CodeGraphIndexRequest(BaseModel):
    filename: str = Field(..., json_schema_extra={"example": "main.py"})
    code_content: str = Field(..., json_schema_extra={"example": "def main(): pass"})
    target_symbol: Optional[str] = None


class TruthSubspaceRequest(BaseModel):
    candidate_text: str
    jd_text: str
    vocabulary: List[str] = Field(default_factory=list)


class NegotiationRequest(BaseModel):
    company: str
    role: str
    offered_salary: int
    target_salary: int
    candidate_name: Optional[str] = None


class SquadRunRequest(BaseModel):
    resume_text: str
    jd_text: str
    company: str = ""
    role: str = ""


@adaptations_router.post("/profile-expand")
async def profile_expand_endpoint(req: ProfileExpandRequest):
    """Run public GitHub profile expansion to discover implicit skills."""
    if not req.github_username.strip():
        raise HTTPException(status_code=400, detail="github_username is required")
    result = await ProfileExpander.expand_from_github(req.github_username)
    if result.get("status") != "success":
        # ponytail: non-success status (e.g. GitHub fetch failure) is an upstream error -> 502
        raise HTTPException(status_code=502, detail=result.get("message", "GitHub profile expansion failed"))
    return result


@adaptations_router.post("/followup-check")
def followup_check_endpoint(req: FollowupCheckRequest):
    """Identify quiet applications and draft follow-up messages."""
    stale_apps = FollowupGenerator.inspect_applications(req.applications)
    drafts = []
    for app in stale_apps:
        draft = FollowupGenerator.draft_followup_message(
            company=app["company"],
            role=app["role"],
            candidate_name=req.candidate_name,
            followup_number=app["followup_count"] + 1
        )
        drafts.append(draft)
    return {"stale_applications_count": len(stale_apps), "stale_applications": stale_apps, "drafts": drafts}


@adaptations_router.post("/codegraph-index")
def codegraph_index_endpoint(req: CodeGraphIndexRequest):
    """Parse codebase AST, build symbol graph, and calculate impact radius."""
    engine = CodeGraphEngine()
    try:
        idx_res = engine.index_source_code(req.filename, req.code_content)
    except ValueError as exc:
        # ponytail: invalid source input surfaces as a client error, not a 500
        raise HTTPException(status_code=400, detail=f"Invalid source code: {exc}") from exc
    if idx_res.get("status") != "success":
        message = idx_res.get("message", "Failed to index source code")
        if "networkx" in message:
            # ponytail: missing dependency is server unavailability, not a client error
            raise HTTPException(status_code=503, detail="Code indexing unavailable: networkx module not installed")
        raise HTTPException(status_code=400, detail=message)
    impact = None
    if req.target_symbol:
        impact = engine.get_impact_radius(req.target_symbol)
    return {"index_result": idx_res, "impact_radius": impact}


@adaptations_router.post("/truth-subspace")
def truth_subspace_endpoint(req: TruthSubspaceRequest):
    """Calculate vector centroid distance in truth subspace."""
    vocab = req.vocabulary or ["python", "go", "react", "kubernetes", "aws", "docker", "sql"]
    return TruthSubspaceEngine.compute_subspace_alignment(req.candidate_text, req.jd_text, vocab)


@adaptations_router.get("/graph-visualizer")
def graph_visualizer_endpoint():
    """Export sample NetworkX candidate graph into React Flow node-edge JSON."""
    if nx is None:
        return {"nodes": [], "edges": [], "total_nodes": 0, "total_edges": 0}
    G = nx.DiGraph()
    G.add_node("Candidate", type="person", name="Sample Candidate")

    G.add_node("skill:python", type="skill", name="Python")
    G.add_node("skill:go", type="skill", name="Go")
    G.add_node("company:google", type="company", name="Google")
    G.add_edge("Candidate", "skill:python", relationship="HAS_SKILL")
    G.add_edge("Candidate", "skill:go", relationship="HAS_SKILL")
    G.add_edge("Candidate", "company:google", relationship="APPLIED_TO")
    return GraphVisualizer.to_react_flow_json(G)


@adaptations_router.post("/negotiation-script")
def negotiation_script_endpoint(req: NegotiationRequest):
    """Benchmark salary and generate counter-offer email script."""
    if req.offered_salary <= 0 or req.target_salary <= 0:
        raise HTTPException(status_code=400, detail="offered_salary and target_salary must be positive")
    try:
        bench = NegotiationEngine.benchmark_salary(req.role)
        script = NegotiationEngine.generate_counter_offer_script(
            company=req.company,
            role=req.role,
            offered_salary=req.offered_salary,
            target_salary=req.target_salary,
            candidate_name=req.candidate_name
        )
    except ValueError as exc:
        # ponytail: salary math is int-only at the boundary; ValueError guards future service validation
        raise HTTPException(status_code=400, detail=f"Invalid negotiation inputs: {exc}") from exc
    return {"benchmark": bench, "negotiation_script": script}


@adaptations_router.post("/squad-run")
async def squad_run_endpoint(req: SquadRunRequest):
    """Produce an approval-required multi-agent resume review package.

    This endpoint does not search external portals, control a browser, or submit
    an application. Its completed state means the returned artifacts are ready
    for candidate review.
    """
    orchestrator = AgentSquadOrchestrator()
    try:
        return await orchestrator.execute_squad_workflow(req.resume_text, req.jd_text, req.company, req.role)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class SemanticRoleMatchRequest(BaseModel):
    target_role: str = Field(..., json_schema_extra={"example": "Data Engineer"})
    job_title: str = Field(..., json_schema_extra={"example": "Analytics Platform Wrangler"})
    job_description: str = Field(..., json_schema_extra={"example": "Building PySpark, Airflow, and Snowflake pipelines."})


@adaptations_router.post("/semantic-role-match")
def semantic_role_match_endpoint(req: SemanticRoleMatchRequest):
    """Classify non-standard job titles against target roles using semantic description matching."""
    from app.scoring.semantic_role_matcher import SemanticRoleMatcher
    return SemanticRoleMatcher.classify_posting(req.target_role, req.job_title, req.job_description)


class HybridJobSearchRequest(BaseModel):
    query_role: str = Field(..., json_schema_extra={"example": "Data Engineer"})
    job_postings: List[Dict[str, Any]] = Field(..., json_schema_extra={"example": [{"title": "Analytics Platform Wrangler", "description": "ETL pipelines using PySpark and Airflow"}]})
    candidate_skills: Optional[List[str]] = Field(None, json_schema_extra={"example": ["Python", "SQL", "Airflow"]})


@adaptations_router.post("/hybrid-job-search")
def hybrid_job_search_endpoint(req: HybridJobSearchRequest):
    """Search and rank job postings using hybrid vector, graph RAG, and LLM intent matching."""
    from app.scoring.hybrid_job_search_engine import HybridJobSearchEngine
    try:
        return HybridJobSearchEngine.search_and_rank_postings(
            query_role=req.query_role,
            job_postings=req.job_postings,
            candidate_skills=req.candidate_skills
        )
    except ValueError as exc:
        # ponytail: empty skills surface as a client error, not a 500
        raise HTTPException(status_code=400, detail=f"Invalid hybrid job search inputs: {exc}") from exc



