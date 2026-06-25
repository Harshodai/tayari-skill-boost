"""JobTheory MCP skill server.

Exposes Job Tayari actions as MCP tools so a locally-running agent (Hermes Agent, Claude
Desktop, Cursor, etc.) can search jobs, research companies, optimize resumes, and manage the
Interview Board on the user's behalf — all in Review Mode (never auto-submits).

Run on the USER's machine:

    pip install mcp httpx
    export JOBTHEORY_URL="http://localhost:8080"
    export JOBTHEORY_TOKEN="<paste access_token from localStorage>"
    python server.py
"""
import os
import httpx
from mcp.server.fastmcp import FastMCP

BASE = os.environ.get("JOBTHEORY_URL", "http://localhost:8080").rstrip("/")
TOKEN = os.environ.get("JOBTHEORY_TOKEN", "")

mcp = FastMCP("jobtheory")


def _headers():
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def _get(path):
    r = httpx.get(f"{BASE}/api{path}", headers=_headers(), timeout=60)
    r.raise_for_status()
    return r.json()


def _post(path, body):
    r = httpx.post(f"{BASE}/api{path}", headers=_headers(), json=body, timeout=120)
    r.raise_for_status()
    return r.json()


@mcp.tool()
def get_context() -> dict:
    """Get the signed-in user's profile, preferences, and latest resume text."""
    return _get("/v1/hermes/context")


@mcp.tool()
def search_jobs(query: str, location: str = "", remote_only: bool = False, limit: int = 20) -> dict:
    """Search aggregated job boards and AI-rank results against the user's profile."""
    return _post("/v1/jobs/search", {
        "query": query, "location": location, "remote_only": remote_only,
        "sources": ["remotive", "arbeitnow", "adzuna"], "limit": limit,
    })


@mcp.tool()
def company_research(company: str, role: str = "") -> dict:
    """AI briefing on a company: overview, culture, salary estimate, pros/cons, interview tips."""
    return _post("/v1/career-intelligence/salary-benchmark", {"target_role": role, "location": company})


@mcp.tool()
def save_job(title: str, company: str = "", location: str = "", url: str = "", description: str = "") -> dict:
    """Save a job to the user's saved list."""
    return _post("/v1/jobs/save", {
        "dedupe_key": f"{company}-{title}-{location || 'unknown'}",
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
def list_applications() -> list:
    """List all applications on the user's Interview Board."""
    return _get("/v1/applications")


@mcp.tool()
def queue_autopilot(title: str, company: str, location: str = "", url: str = "", job_description: str = "") -> dict:
    """Review Mode: queue a job for application and auto-generate a tailored cover letter. Never auto-submits."""
    return _post("/v1/review-queue/queue", {
        "job": {
            "title": title, "company": company, "location": location, "url": url, "description": job_description,
        },
        "apply_url": url,
        "notes": "Queued via MCP integration"
    })


@mcp.tool()
def analyze_resume(resume_id: str, job_description: str) -> dict:
    """Run a semantic-ATS analysis of a resume against a job description."""
    return _post(f"/v1/resumes/{resume_id}/ats-deep", {
        "job_description": job_description
    })


if __name__ == "__main__":
    mcp.run()
