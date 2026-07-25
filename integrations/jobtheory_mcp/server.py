import os
import json
import logging
from typing import Optional, List, Dict, Any
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP Server for Tayari AI Platform
mcp = FastMCP(
    "Tayari Job Search & Career Intelligence MCP",
    instructions=(
        "Tayari MCP Server allows AI assistants (Cursor, Claude Desktop, Ollama) to interact "
        "with your local-first Tayari job search pipeline. Search jobs, analyze skill gaps, "
        "tailor resumes, run truth-gate guardrails, manage your Interview Board, and query "
        "your personal career knowledge graph."
    )
)

TAYARI_API_URL = os.getenv("TAYARI_API_URL", "http://localhost:8085")
TAYARI_API_KEY = os.getenv("TAYARI_API_KEY")
if not TAYARI_API_KEY:
    raise RuntimeError("TAYARI_API_KEY environment variable is required to start Tayari MCP Server.")


def _handle_api_error(e: Exception, path: str) -> dict:
    import urllib.error
    import socket

    if isinstance(e, urllib.error.HTTPError):
        status = e.code
        body = ""
        try:
            body = e.read().decode("utf-8")
        except Exception:
            pass
        logging.error("MCP API HTTP Error [%s] path=%s body=%s", status, path, body)
        if status in (401, 403):
            return {"error": f"Authentication failed (HTTP {status})", "status": status, "path": path}
        elif status == 404:
            return {"error": "Resource not found (HTTP 404)", "status": 404, "path": path}
        return {"error": f"HTTP Error {status}", "status": status, "path": path}
    elif isinstance(e, (urllib.error.URLError, ConnectionError, socket.error)):
        if isinstance(getattr(e, "reason", None), socket.timeout) or isinstance(e, socket.timeout):
            logging.error("MCP API Timeout path=%s err=%s", path, e)
            return {"error": "Request timed out connecting to Tayari backend", "type": "timeout", "path": path}
        logging.error("MCP API Connection Error path=%s err=%s", path, e)
        return {"error": "Backend connection failed", "type": "connection_error", "path": path}
    elif isinstance(e, TimeoutError):
        logging.error("MCP API Timeout Error path=%s err=%s", path, e)
        return {"error": "Request timed out connecting to Tayari backend", "type": "timeout", "path": path}

    logging.error("MCP Unexpected Error path=%s err=%s", path, e)
    return {"error": "Unexpected server error", "type": "unexpected_error", "path": path}


def _get(path: str, params: Optional[dict] = None) -> dict:
    import urllib.request
    import urllib.parse

    url = f"{TAYARI_API_URL.rstrip('/')}{path}"
    if params:
        query_string = urllib.parse.urlencode(params)
        url += f"?{query_string}"

    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {TAYARI_API_KEY}",
            "Accept": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return _handle_api_error(e, path)


def _post(path: str, payload: dict) -> dict:
    import urllib.request

    url = f"{TAYARI_API_URL.rstrip('/')}{path}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {TAYARI_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return _handle_api_error(e, path)


# -------------------------------------------------------------------
# MCP Tools Registration
# -------------------------------------------------------------------

@mcp.tool()
def get_user_profile() -> dict:
    """Retrieve the user's target roles, locations, salary floor, tone preferences, and skill inventory."""
    return _get("/v1/profile")


@mcp.tool()
def search_jobs(query: str, location: str = "Remote", remote_only: bool = True, limit: int = 10) -> dict:
    """Search aggregated job boards and AI-rank results against the user's profile."""
    return _post("/v1/jobs/search", {
        "query": query, "location": location, "remote_only": remote_only,
        "sources": ["remotive", "arbeitnow", "adzuna"], "limit": limit,
    })


@mcp.tool()
def company_research(company: str, role: str = "Software Engineer") -> dict:
    """AI briefing on a company: overview, salary estimate, and role requirements."""
    res = _post("/v1/career-intelligence/salary-benchmark", {"target_role": role, "company": company, "location": "Remote"})
    if isinstance(res, dict) and "error" in res:
        return res
    return {
        "company": company,
        "target_role": role,
        "intelligence": res
    }


@mcp.tool()
def save_job(title: str, company: str = "", location: str = "", url: str = "", description: str = "") -> dict:
    """Save a job to the user's saved list."""
    dedupe_key = f"{company}-{title}-{location or 'unknown'}"
    return _post("/v1/jobs/save", {
        "dedupe_key": dedupe_key,
        "job": {
            "title": title, "company": company, "location": location, "url": url, "description": description,
        },
        "status": "saved"
    })


@mcp.tool()
def add_application(title: str, company: str, location: str = "", url: str = "", stage: str = "saved") -> dict:
    """Add a job to the Interview Board (stages: saved, applied, phone_screen, interview, offer, rejected)."""
    return _post("/v1/applications", {
        "title": title, "company": company, "location": location, "url": url, "stage": stage,
    })


@mcp.tool()
def list_applications(cursor: str = "", limit: int = 20) -> dict:
    """List applications on the user's Interview Board with cursor pagination."""
    params = {"limit": limit}
    if cursor:
        params["cursor"] = cursor
    res = _get("/v1/applications", params=params)
    if isinstance(res, list):
        return {"applications": res[:limit], "next_cursor": None, "total": len(res)}
    elif isinstance(res, dict):
        apps = res.get("applications", res.get("items", []))
        if isinstance(apps, list):
            res["applications"] = apps[:limit]
        return res
    return res


@mcp.tool()
def queue_autopilot(title: str, company: str, location: str = "", url: str = "", job_description: str = "") -> dict:
    """Review Mode: queue a job for application and auto-generate a tailored cover letter. Never auto-submits.

    Note: This tool mutates the user's review queue state.
    """
    return _post("/v1/review-queue/queue", {
        "job": {
            "title": title, "company": company, "location": location, "url": url, "description": job_description,
        },
        "apply_url": url,
        "notes": "Queued via MCP integration"
    })


@mcp.tool()
def optimize_resume(resume_id: str, job_description: str) -> dict:
    """Run Tayari's reflective optimizer loop on a resume against a job description.

    Returns score deltas (before/after) and the tailored text.
    """
    path = f"/v1/resumes/{resume_id}/optimize"
    res = _post(path, {"job_description": job_description})
    if isinstance(res, dict) and "error" in res:
        return res
    return {
        "before_score": res.get("before_score", res.get("original_score")),
        "after_score": res.get("after_score", res.get("score")),
        "iterations": res.get("iterations"),
        "optimized_text": res.get("optimized_text", res.get("resume_text", ""))
    }


@mcp.tool()
def check_guardrails(text: str) -> dict:
    """Run Tayari's authenticity guardrails (truthfulness check & keyword-stuffing detector) on resume or letter text."""
    res = _post("/v1/guardrails/truth-check", {"text": text, "resume_text": text})
    if isinstance(res, dict) and "error" in res:
        return res
    return {
        "is_truthful": res.get("is_truthful", False),
        "keyword_stuffing_detected": res.get("keyword_stuffing_detected", False),
        "flags": res.get("flags", [])
    }


@mcp.tool()
def skill_gap(target_role: str) -> dict:
    """Analyze skill gaps for a target role against the user's inventory and recommend free learning resources."""
    res = _post("/v1/career-intelligence/skills-gap", {"target_role": target_role})
    if isinstance(res, dict) and "error" in res:
        return res
    return {
        "matched_skills": res.get("matched_skills", []),
        "missing_skills": res.get("missing_skills", []),
        "recommended_resources": res.get("recommended_resources", [
            f"FreeCodeCamp {target_role} path",
            "Coursera / edX open audit courses"
        ])
    }


@mcp.tool()
def query_knowledge_graph(question: str) -> dict:
    """Query the user's resume knowledge graph for skill relationships, project details, and experience nodes."""
    res = _get("/v1/knowledge-hub/search", params={"question": question})
    if isinstance(res, dict) and "error" in res:
        return res
    answer = res.get("answer", f"Knowledge graph query results for: {question}") if isinstance(res, dict) else f"Knowledge graph query results for: {question}"
    nodes = res.get("nodes", []) if isinstance(res, dict) else (res if isinstance(res, list) else [])
    return {
        "answer": answer,
        "nodes": nodes
    }


if __name__ == "__main__":
    mcp.run()
