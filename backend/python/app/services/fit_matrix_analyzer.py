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
from app.services.skill_taxonomy import (
    ASYMMETRIC_TRANSFER,
    TAXONOMY,
    _SURFACE_TO_CANONICAL,
    extract_skills,
)
from app.services.skill_graph import ADJACENCY


_COMPETENCY_CLUSTERS: dict[str, set[str]] = {
    "analytics_data": {
        "data analysis", "clinical analytics", "risk analytics", "product analytics",
        "business analytics", "financial analytics", "analytics", "sql", "bi", "metrics",
        "reporting", "statistics", "pandas", "data visualization", "quantitative analysis",
        "data science",
    },
    "product_strategy": {
        "product strategy", "product management", "product discovery", "roadmap",
        "market research", "feature prioritization", "stakeholder management",
        "user research", "clinical workflows", "customer journeys",
    },
    "engineering_backend": {
        "backend", "microservices", "python", "go", "golang", "java", "c++", "rust",
        "c#", "distributed systems", "rest api", "databases", "sql", "postgresql",
        "mysql", "system design", "scalability", "caching",
    },
    "engineering_frontend": {
        "frontend", "javascript", "typescript", "react", "vue", "angular", "nextjs",
        "web development", "ui", "ux", "html", "css",
    },
    "cloud_infrastructure": {
        "cloud", "aws", "gcp", "azure", "devops", "docker", "kubernetes", "ci/cd",
        "terraform", "linux", "monitoring", "sre", "infrastructure",
    },
    "ai_ml": {
        "machine learning", "deep learning", "ai", "llm", "nlp", "computer vision",
        "data science", "pytorch", "tensorflow",
    },
    "leadership_management": {
        "leadership", "project management", "agile", "scrum", "stakeholder management",
        "communication", "team lead", "mentoring", "people management", "collaboration",
    },
}

_STOPWORDS = {"and", "or", "in", "of", "to", "for", "with", "a", "an", "the", "on", "at", "by", "as"}


def _check_resume_evidence(skill: str, r_text: str) -> bool:
    """Check whether a transferable skill is evidenced in the candidate resume text."""
    if not skill or not r_text:
        return False
    s_norm = skill.strip().lower()

    # 1. Exact phrase / boundary match
    pattern = r"(?<!\w)" + re.escape(s_norm) + r"(?!\w)"
    if re.search(pattern, r_text):
        return True

    # 2. Canonical taxonomy match
    extracted = extract_skills(r_text)
    canonical = _SURFACE_TO_CANONICAL.get(s_norm)
    if canonical and canonical in extracted:
        return True

    if canonical and canonical in TAXONOMY:
        synonyms = TAXONOMY[canonical][0]
        for syn in synonyms:
            if re.search(r"(?<!\w)" + re.escape(syn) + r"(?!\w)", r_text):
                return True

    # 3. Token / stem level evidence for multi-word or compound skills
    tokens = [w for w in re.findall(r"[a-z0-9+#]+", s_norm) if w not in _STOPWORDS and len(w) >= 3]
    if not tokens:
        return False

    matched_tokens = 0
    for tok in tokens:
        if re.search(r"(?<!\w)" + re.escape(tok) + r"(?!\w)", r_text):
            matched_tokens += 1
        elif len(tok) >= 5 and re.search(r"(?<!\w)" + re.escape(tok[:5]) + r"\w*", r_text):
            matched_tokens += 1

    if len(tokens) == 1:
        return matched_tokens == 1
    return matched_tokens >= 1 and (matched_tokens / len(tokens) >= 0.5)


def _derive_transferability_score(source_skill: str, target_skill: str) -> float | None:
    """Derive transferability score based on validated correlation/overlap between skills.

    Returns a score between 0.60 and 0.95 if validated correlation exists, or None.
    """
    src_norm = source_skill.strip().lower()
    tgt_norm = target_skill.strip().lower()

    if src_norm == tgt_norm:
        return 0.95

    score: float | None = None

    # 1. Direct token match / token overlap
    src_tokens = set(re.findall(r"[a-z0-9+#]+", src_norm)) - _STOPWORDS
    tgt_tokens = set(re.findall(r"[a-z0-9+#]+", tgt_norm)) - _STOPWORDS
    shared_tokens = src_tokens & tgt_tokens
    if shared_tokens:
        overlap_ratio = len(shared_tokens) / max(len(src_tokens | tgt_tokens), 1)
        token_score = round(0.65 + 0.25 * overlap_ratio, 2)
        score = max(score or 0.0, token_score)

    # 2. Canonical taxonomy / Asymmetric transfer mapping
    src_c = _SURFACE_TO_CANONICAL.get(src_norm, src_norm)
    tgt_c = _SURFACE_TO_CANONICAL.get(tgt_norm, tgt_norm)
    if src_c == tgt_c and src_c:
        score = max(score or 0.0, 0.95)

    if src_c in ASYMMETRIC_TRANSFER and tgt_c in ASYMMETRIC_TRANSFER[src_c]:
        weight = ASYMMETRIC_TRANSFER[src_c][tgt_c]
        score = max(score or 0.0, max(0.60, min(0.95, round(weight, 2))))

    # 3. Adjacency in TAXONOMY or ADJACENCY graph
    if src_c in TAXONOMY and tgt_c in TAXONOMY[src_c][1]:
        score = max(score or 0.0, 0.80)
    elif tgt_c in TAXONOMY and src_c in TAXONOMY[tgt_c][1]:
        score = max(score or 0.0, 0.75)

    if src_norm in ADJACENCY and tgt_norm in ADJACENCY[src_norm]:
        score = max(score or 0.0, 0.75)
    elif src_c in ADJACENCY and tgt_c in ADJACENCY[src_c]:
        score = max(score or 0.0, 0.75)

    # 4. Shared competency cluster
    for cluster_skills in _COMPETENCY_CLUSTERS.values():
        if (src_norm in cluster_skills or src_c in cluster_skills) and (
            tgt_norm in cluster_skills or tgt_c in cluster_skills
        ):
            score = max(score or 0.0, 0.70)
            break

    if score is not None:
        return min(0.95, max(0.60, round(score, 2)))
    return None


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
            # Location unknown — handled below in risk section
            pass

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
            "transition_fit": {
                "transition_type": "unknown",
                "explanation": "No required skills extracted; transition fit cannot be assessed.",
                "transfer_matrix": [],
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

    # 7. Transition fit and cross-domain skill transfer matrix
    transferable_skills = (profile_preferences or {}).get("transferable_skills") or []
    transition_type = (profile_preferences or {}).get("transition_type") or "same_domain"
    cur_title = (profile_preferences or {}).get("current_title") or ""
    tgt_level = (profile_preferences or {}).get("target_level") or ""
    cur_ind = (profile_preferences or {}).get("current_industry") or ""
    tgt_ind = (profile_preferences or {}).get("target_industry") or ""

    if transition_type == "cross_domain":
        if cur_ind or tgt_ind:
            trans_why = f"Cross-domain transition from {cur_ind or 'current sector'} to {tgt_ind or 'target sector'}: leverages {len(transferable_skills)} transferable competencies for {job.get('title', 'target role')}."
        else:
            trans_why = f"Cross-domain transition leveraging {len(transferable_skills)} transferable competencies for {job.get('title', 'target role')}."
    elif cur_title:
        trans_why = f"Same-domain progression from {cur_title} towards {tgt_level or 'advanced'} responsibilities in {job.get('title', 'this role')}."
    else:
        trans_why = f"Alignment based on candidate competencies and target requirements for {job.get('title', 'this role')}."

    transfer_matrix = []
    for miss in missing_skills:
        for trans in transferable_skills:
            has_evidence = _check_resume_evidence(trans, r_text)
            derived_score = _derive_transferability_score(trans, miss) if has_evidence else None

            if has_evidence and derived_score is not None:
                transfer_matrix.append({
                    "source_skill": trans,
                    "target_skill": miss,
                    "status": "verified",
                    "transferability_score": derived_score,
                    "rationale": f"Candidate competence in '{trans}' translates to domain execution in '{miss}'.",
                })
            else:
                transfer_matrix.append({
                    "source_skill": trans,
                    "target_skill": miss,
                    "status": "unverified",
                    "transferability_score": None,
                    "rationale": f"Transfer from '{trans}' to '{miss}' is unverified without resume evidence or verified skill mapping.",
                })

    transfer_matrix.sort(
        key=lambda x: (x["status"] == "verified", x.get("transferability_score") or 0.0),
        reverse=True,
    )

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
        "transition_fit": {
            "transition_type": transition_type,
            "explanation": trans_why,
            "transfer_matrix": transfer_matrix[:6],
        },
    }
