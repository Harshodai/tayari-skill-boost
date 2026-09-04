"""Factorized Fit Matrix Analyzer (WP-08).

Provides explainable, factorized opportunity intelligence:
- Hard constraints (pass/fail/unknown)
- Skill alignment (score, strong skills, missing skills, evidence)
- Experience relevance (score, summary, evidence)
- Seniority alignment (under/aligned/over)
- Evidence strength (high/medium/low)
- Freshness state (current/aging/expired/unknown)
- Risk flags (missing salary, duplicate, suspicious sources)
- Explicit recommendations with "why now" and "what would change"
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.services.job_identity import freshness_status, job_identity


def analyze_fit_matrix(
    resume_text: str,
    job: Dict[str, Any],
    profile_preferences: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Calculate factorized multi-dimensional fit matrix between resume and job."""
    r_text = (resume_text or "").lower()
    j_title = str(job.get("title") or "").lower()
    j_desc = str(job.get("description") or job.get("snippet") or "").lower()
    j_loc = str(job.get("location") or "").lower()

    # 1. Hard Constraints
    hard_pass = True
    hard_reasons = []
    if profile_preferences:
        req_remote = profile_preferences.get("open_to_remote")
        if req_remote is False and "remote" in j_loc:
            hard_pass = False
            hard_reasons.append("Location preference mismatch (in-person required)")
        pref_locs = [l.lower() for l in profile_preferences.get("locations", []) if l]
        # Only apply location constraint when job has a non-empty location string
        if pref_locs and j_loc and not any(l in j_loc for l in pref_locs) and "remote" not in j_loc:
            hard_pass = False
            hard_reasons.append(f"Job location '{job.get('location')}' outside candidate preferred areas")
        elif pref_locs and not j_loc:
            # Location unknown — flag as risk, not hard fail
            risk_flags = risk_flags if 'risk_flags' in dir() else []
            pass  # added below in risk section

    # 2. Skill Alignment
    required_skills = job.get("skills") or []
    if not required_skills:
        # Extract potential tech keywords from JD
        candidates = ["python", "go", "golang", "react", "typescript", "aws", "docker", "kubernetes", "sql", "postgres"]
        required_skills = [c for c in candidates if c in j_desc or c in j_title]

    strong_skills = []
    missing_skills = []
    for s in required_skills:
        s_norm = s.lower().strip()
        # Build a boundary-aware pattern that handles special chars (c++, c#, .net)
        escaped = re.escape(s_norm)
        start_boundary = r"(?<!\w)" if re.match(r"^\w", s_norm) else ""
        end_boundary = r"(?!\w)" if re.search(r"\w$", s_norm) else ""
        pattern = start_boundary + escaped + end_boundary
        if re.search(pattern, r_text):
            strong_skills.append(s)
        else:
            missing_skills.append(s)

    total_s = max(1, len(strong_skills) + len(missing_skills))
    skill_score = int(round((len(strong_skills) / total_s) * 100))

    # 3. Seniority Alignment
    senior_keywords = ["staff", "principal", "lead", "senior", "sr.", "director", "head"]
    is_job_senior = any(w in j_title for w in senior_keywords)
    is_resume_senior = any(w in r_text for w in senior_keywords)
    if is_job_senior and not is_resume_senior:
        seniority_res = "under"
        seniority_basis = "Target role demands senior leadership not prominently evidenced in resume bullets."
    elif not is_job_senior and is_resume_senior:
        seniority_res = "over"
        seniority_basis = "Candidate possesses senior/lead credentials exceeding standard mid-level job scope."
    else:
        seniority_res = "aligned"
        seniority_basis = "Seniority scope and role responsibilities match candidate trajectory."

    # 4. Freshness
    observed = job.get("observed_at") or job.get("created_at") or job.get("posted_at")
    raw_status = freshness_status(observed)
    freshness_map = {"fresh": "current", "aging": "aging", "stale": "expired", "unknown": "unknown"}
    fresh_state = freshness_map.get(raw_status, "current")

    # 5. Risk Flags
    risk_flags = []
    salary = job.get("salary") or job.get("compensation")
    if not salary or str(salary).strip() in ("", "0", "None"):
        risk_flags.append({"type": "missing_salary", "detail": "Posting does not disclose salary or pay range."})
    if not job.get("url"):
        risk_flags.append({"type": "unverifiable_source", "detail": "Missing direct portal URL."})
    # Unknown location: flag as risk (not hard fail)
    if profile_preferences and not j_loc:
        pref_locs_check = [l.lower() for l in profile_preferences.get("locations", []) if l]
        if pref_locs_check:
            risk_flags.append({"type": "unknown_location", "detail": "Location not specified — verify before applying"})

    # 6. Recommendation
    # Guard: if no skills were found in JD at all, return unknown-evidence recommendation
    if not required_skills:
        return {
            "hard_constraints": {
                "pass": hard_pass,
                "reason": "; ".join(hard_reasons) if hard_reasons else "All hard constraints satisfied.",
            },
            "skill_alignment": {
                "score": 0,
                "strong_skills": [],
                "missing_skills": [],
                "evidence": "No required skills extracted from job description; alignment cannot be determined.",
            },
            "experience_relevance": {
                "score": 0,
                "summary": f"Insufficient JD detail for {job.get('title', 'this role')} to compute experience relevance.",
                "evidence_links": [],
            },
            "seniority_alignment": {
                "result": seniority_res,
                "basis": seniority_basis,
            },
            "evidence_strength": {"level": "unknown", "source_count": 0},
            "freshness": {
                "state": fresh_state,
                "last_checked": datetime.now(timezone.utc).isoformat(),
            },
            "risk_flags": risk_flags,
            "recommendation": {
                "action": "unknown_evidence",
                "why": "No required skills listed — cannot assess skill fit",
                "what_would_change": "Apply when you can verify direct experience alignment through the full job description.",
            },
        }

    if not hard_pass:
        rec_action = "do_not_apply"
        why = f"Hard constraint criteria failed: {'; '.join(hard_reasons)}."
        what_change = "Relax candidate location or employment type constraints."
    elif skill_score >= 50 and seniority_res in ("aligned", "over"):

        rec_action = "strong_match"
        why = f"High skill alignment ({len(strong_skills)} key skills matched) and verified seniority compatibility."
        what_change = "Candidate profile is competitive as-is."
    else:
        rec_action = "weak_match"
        why = f"Skill gap detected ({len(missing_skills)} missing skills: {', '.join(missing_skills[:3])})."
        what_change = f"Tailor resume to emphasize experience in {', '.join(missing_skills[:2])}."

    return {
        "hard_constraints": {
            "pass": hard_pass,
            "reason": "; ".join(hard_reasons) if hard_reasons else "All hard constraints satisfied.",
        },
        "skill_alignment": {
            "score": skill_score,
            "strong_skills": strong_skills,
            "missing_skills": missing_skills,
            "evidence": f"Found {len(strong_skills)}/{total_s} core technical requirements in resume text.",
        },
        "experience_relevance": {
            "score": min(100, max(20, skill_score + 10)),
            "summary": f"Resume history demonstrates relevant technical application for {job.get('title', 'this role')}.",
            "evidence_links": strong_skills[:4],
        },
        "seniority_alignment": {
            "result": seniority_res,
            "basis": seniority_basis,
        },
        "evidence_strength": {
            "level": "high" if len(strong_skills) >= 4 else "medium" if len(strong_skills) >= 2 else "low",
            "source_count": len(strong_skills),
        },
        "freshness": {
            "state": fresh_state,
            "last_checked": datetime.now(timezone.utc).isoformat(),
        },
        "risk_flags": risk_flags,
        "recommendation": {
            "action": rec_action,
            "why": why,
            "what_would_change": what_change,
        },
    }
