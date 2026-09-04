"""Scenario-Based Career Graph Planner (WP-10).

Provides actionable roadmaps for career transitions:
- role_change
- domain_change
- seniority_increase
- return_to_work
- relocation
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


SCENARIO_PROFILES: Dict[str, Dict[str, Any]] = {
    "role_change": {
        "title": "Role Transition (e.g. Backend to ML / Full-Stack)",
        "effort_weeks": 12,
        "default_missing": ["System Architecture", "Specialized Frameworks", "Production Deployment"],
    },
    "domain_change": {
        "title": "Domain Pivot (e.g. Fintech to Healthcare)",
        "effort_weeks": 8,
        "default_missing": ["Domain Compliance (HIPAA/PCI)", "Industry Data Models", "Sector Terminology"],
    },
    "seniority_increase": {
        "title": "Level Advancement (Senior to Staff / Lead)",
        "effort_weeks": 16,
        "default_missing": ["Cross-team Influence", "Tech Strategy & RFCs", "Mentorship & Hiring"],
    },
    "return_to_work": {
        "title": "Return to Work / Re-entry",
        "effort_weeks": 6,
        "default_missing": ["Modern Tooling Refresh", "Recent Project Proof", "Active Interview Stamina"],
    },
    "relocation": {
        "title": "Geographic / Remote Relocation",
        "effort_weeks": 4,
        "default_missing": ["Local Market Networking", "Time-zone Async Communication", "Work Authorization Proof"],
    },
}


def _apply_market_counts(
    available_roles: List[Dict[str, Any]],
    market_counts: Optional[Dict[str, Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    if not market_counts:
        return available_roles
    out: List[Dict[str, Any]] = []
    for entry in available_roles:
        entry = dict(entry)
        signal = market_counts.get(entry.get("title", ""))
        if (
            isinstance(signal, dict)
            and signal.get("provenance") == "verified"
            and isinstance(signal.get("count"), int)
        ):
            entry["count"] = signal["count"]
            entry["provenance"] = "verified"
            entry["source"] = signal.get("source")
            entry["fetched_at"] = signal.get("fetched_at")
        out.append(entry)
    return out


def _apply_salary_band(
    available_roles: List[Dict[str, Any]],
    salary_band: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    # ponytail: title-match only, no fallback — attaching another role's band
    # would relabel a guess as verified compensation data.
    if not isinstance(salary_band, dict):
        return [dict(e) for e in available_roles]
    if salary_band.get("provenance") != "verified":
        return [dict(e) for e in available_roles]
    if not isinstance(salary_band.get("median"), int):
        return [dict(e) for e in available_roles]
    if "scale" in salary_band and salary_band.get("scale") != "wage":
        return [dict(e) for e in available_roles]
    band_role = str(salary_band.get("role") or "").strip().lower()
    out = [dict(e) for e in available_roles]
    for entry in out:
        if str(entry.get("title", "")).strip().lower() == band_role:
            entry["salary_band"] = salary_band
    return out


def plan_scenario(
    scenario_type: str,
    resume_skills: Optional[List[str]],
    current_title: Optional[str] = None,
    target_role: Optional[str] = None,
    market_counts: Optional[Dict[str, Dict[str, Any]]] = None,
    salary_band: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Generate deterministic, versioned career scenario transition plan."""
    normalized_type = (scenario_type or "").strip().lower()
    if normalized_type not in SCENARIO_PROFILES:
        raise ValueError(f"unsupported scenario_type: {scenario_type!r}")

    profile = SCENARIO_PROFILES[normalized_type]
    skills = [s.strip() for s in (resume_skills or []) if s and s.strip()]

    # Transferable skills from candidate profile
    transferable = []
    for s in skills[:6]:
        transferable.append({
            "skill": s,
            "evidence": f"Illustrative — may have been demonstrated in past experience as {current_title or 'Engineer'}",
            "confidence": None,
        })

    # Missing skills with learning roadmaps
    missing = []
    for idx, s in enumerate(profile["default_missing"]):
        weeks = max(2, profile["effort_weeks"] // max(1, len(profile["default_missing"])))
        missing.append({
            "skill": s,
            "effort_weeks": weeks,
            "learning_path": [
                f"Study foundational concepts for {s}",
                f"Build a portfolio project demonstrating {s}",
                "Document technical design and peer review",
            ],
        })

    available_roles = _apply_salary_band(_apply_market_counts([
        {"title": target_role or f"Target {scenario_type.replace('_', ' ').title()}", "count": 14, "fit": 0.78, "provenance": "illustrative"},
        {"title": f"Associate {target_role or 'Specialist'}", "count": 9, "fit": 0.88, "provenance": "illustrative"},
    ], market_counts), salary_band)


    next_action = f"Complete the first project milestone for '{missing[0]['skill']}' (estimated: {missing[0]['effort_weeks']} weeks)."

    content_for_hash = f"{normalized_type}|{current_title}|{target_role}|{','.join(sorted(skills))}"
    version_hash = hashlib.sha256(content_for_hash.encode("utf-8")).hexdigest()[:16]

    return {
        "scenario": normalized_type,
        "scenario_title": profile["title"],
        "plan_version": f"sp-{version_hash}",
        "confidence": "high" if len(skills) >= 4 else "medium" if len(skills) >= 2 else "low",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "transferable_skills": transferable,
        "missing_skills": missing,
        "available_roles": available_roles,
        "next_action": next_action,
    }
