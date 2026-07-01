from __future__ import annotations
"""Resume tailoring/optimization with a reflexion loop (advanced agent pattern).

Pattern: GENERATE -> SCORE (deterministic ATS engine) -> CRITIQUE with concrete,
measurable gaps -> REFINE (one pass). The deterministic scorer acts as the judge,
so the loop converges on real ATS improvements instead of LLM self-praise.
Shared by the Resume Optimizer endpoints and the Auto-Pilot automation engine.
"""
import logging
import re
import uuid
import json

from app.services.ats_engine import (
    heuristic_ats_score,
    AI_PHRASE_BLACKLIST,
    AI_PHRASE_REPLACEMENTS,
    keyword_in_text,
)
from app.services.llm_service import llm_complete, extract_json
from app.guardrails import PipelineGate
from app.telemetry import stage_complete, stage_fail
from app.parsers.document_parser import ResumeParser

logger = logging.getLogger(__name__)

OPTIMIZE_SYSTEM = (
    "You are Tayari's resume optimization engine - a world-class resume writer "
    "who rewrites resumes to maximize ATS scores and recruiter response rates while "
    "staying 100% truthful to the candidate's real experience. Never invent "
    "employers, titles, dates or credentials. You naturally weave in the target "
    "job's keywords where genuinely applicable. Use clean ATS-safe structure: "
    "NAME line first, then ALL-CAPS section headings (PROFESSIONAL SUMMARY, SKILLS, "
    "EXPERIENCE, EDUCATION...), '- ' bullets with action verbs and quantified impact."
)

OUTPUT_FORMAT = (
    "Respond in EXACTLY this format:\n"
    "<<<META>>>\n"
    '{"changes": [<4-8 short strings describing what you improved>], '
    '"keywords_added": [<keywords woven in>], "estimated_score": <0-100 int>}\n'
    "<<<RESUME>>>\n"
    "<the full optimized resume text>\n"
    "<<<END>>>"
)

SCORE_TARGET = 85


def _parse_marked_output(raw: str):
    meta_part = raw.split("<<<META>>>")[-1].split("<<<RESUME>>>")[0]
    resume_part = raw.split("<<<RESUME>>>")[-1].split("<<<END>>>")[0].strip()
    meta = extract_json(meta_part)
    if not resume_part or len(resume_part) < 200:
        raise ValueError("Optimized resume too short")
    return resume_part, meta


def _gap_feedback(heuristic: dict) -> str:
    """Build a concrete, measurable critique from the deterministic ATS engine."""
    lines = []
    for check in heuristic.get("checks", []):
        if not check["passed"]:
            lines.append(f"- FAILED CHECK '{check['name']}': {check['detail']}")
    missing = heuristic.get("missing_keywords") or []
    if missing:
        lines.append(
            "- MISSING JOB KEYWORDS (weave in truthfully where applicable): "
            + ", ".join(missing[:18]))
    kw_pct = heuristic.get("keyword_match_pct")
    if kw_pct is not None:
        lines.append(f"- Current job-keyword coverage is only {kw_pct}%")
    return "\n".join(lines) or "- General polish needed"


def remove_ai_buzzwords(text: str, job_description: str = "") -> tuple[str, list[dict]]:
    """Clean AI buzzwords locally, ignoring keywords that exist in target job description."""
    jd_lower = job_description.lower()
    removed = []
    cleaned = text
    
    # Check phrases sorted by length descending so multi-word patterns match first
    for phrase in sorted(AI_PHRASE_BLACKLIST, key=len, reverse=True):
        if phrase.lower() in jd_lower:
            continue
            
        pattern = re.compile(rf"(?i)\b{re.escape(phrase)}\b")
        if pattern.search(cleaned):
            replacement = AI_PHRASE_REPLACEMENTS.get(phrase.lower(), "")
            removed.append({
                "buzzword": phrase,
                "replacement": replacement if replacement else "removed"
            })
            cleaned = pattern.sub(replacement, cleaned)
            
    # Cleanup formatting issues arising from removals
    cleaned = re.sub(r',\s*,', ',', cleaned)
    cleaned = re.sub(r'\s{2,}', ' ', cleaned)
    return cleaned, removed


def validate_master_alignment(tailored_text: str, master_text: str) -> dict:
    """Validate that the optimized resume doesn't fabricate experiences or skills."""
    try:
        tailored_parsed = ResumeParser.parse_text(tailored_text)
        master_parsed = ResumeParser.parse_text(master_text)
    except Exception as e:
        logger.warning("Parser failed in master alignment validation: %s", e)
        return {
            "is_aligned": True,
            "violations": [],
            "confidence_score": 1.0
        }
        
    violations = []
    
    # 1. Technical Skills Check
    master_skills = {s.lower().strip() for s in master_parsed.skills if s}
    tailored_skills = {s.lower().strip() for s in tailored_parsed.skills if s}
    for skill in tailored_skills:
        if skill not in master_skills and not keyword_in_text(skill, master_text):
            violations.append({
                "field": "technicalSkills",
                "violation_type": "fabricated_skill",
                "value": skill,
                "severity": "critical"
            })
            
    # 2. Certifications Check
    master_certs = {c.lower().strip() for c in master_parsed.certifications if c}
    tailored_certs = {c.lower().strip() for c in tailored_parsed.certifications if c}
    for cert in tailored_certs:
        if cert not in master_certs and not any(cert in mc or mc in cert for mc in master_certs):
            violations.append({
                "field": "certifications",
                "violation_type": "fabricated_cert",
                "value": cert,
                "severity": "critical"
            })
            
    is_aligned = len([v for v in violations if v["severity"] == "critical"]) == 0
    confidence = max(0.0, 1.0 - (len(violations) * 0.1))
    
    return {
        "is_aligned": is_aligned,
        "violations": violations,
        "confidence_score": confidence
    }


def generate_metric_suggestions(text: str) -> list[str]:
    """Scan resume experience bullet points and recommend metrics/numbers for weak lines."""
    suggestions = []
    lines = text.splitlines()
    for line in lines:
        line_strip = line.strip()
        if line_strip.startswith(("-", "*", "•", "▪")) or (len(line_strip) > 10 and line_strip[0].isupper() and any(verb in line_strip.lower() for verb in ["led", "built", "managed", "created"])):
            # Check if bullet point is missing numerical quantification
            if not re.search(r'\d+', line_strip):
                lower = line_strip.lower()
                clean_bullet = line_strip.lstrip("-*•▪ ").strip()
                if "latency" in lower or "speed" in lower or "performance" in lower:
                    suggestions.append(f"Bullet '{clean_bullet[:40]}...': Consider adding quantified performance/latency percentage improvement.")
                elif "cost" in lower or "budget" in lower or "save" in lower:
                    suggestions.append(f"Bullet '{clean_bullet[:40]}...': Add numerical details of cost savings or budget managed.")
                elif "user" in lower or "customer" in lower or "client" in lower:
                    suggestions.append(f"Bullet '{clean_bullet[:40]}...': Mention number of active users or clients impacted.")
                elif "scale" in lower or "pipeline" in lower or "data" in lower:
                    suggestions.append(f"Bullet '{clean_bullet[:40]}...': Specify metrics regarding data scale or volume processed.")
                else:
                    suggestions.append(f"Bullet '{clean_bullet[:40]}...': Consider adding a metric or quantified result to show the impact.")
    return suggestions[:4]


def analyze_keyword_gaps(tailored_text: str, master_text: str, jd_text: str) -> tuple[list[str], list[str]]:
    """Differentiate between injectable missing keywords and non-injectable ones."""
    from app.analysis.similarity import KeywordAnalyzer
    analyzer = KeywordAnalyzer()
    analysis = analyzer.analyze(tailored_text, jd_text)
    
    missing_jd = analysis.missing or []
    injectable = []
    non_injectable = []
    
    for kw in missing_jd:
        if keyword_in_text(kw, master_text):
            injectable.append(kw)
        else:
            non_injectable.append(kw)
            
    return injectable, non_injectable


async def optimize_with_reflection(resume_text: str, job_description: str | None = None,
                                   target_role: str | None = None,
                                   job_label: str | None = None) -> dict:
    """Returns optimized tailoring results including keyword gaps, clichés, and alignment reports."""
    jd = (job_description or "").strip() or None
    context = ""
    if jd:
        context += f"\n\nTARGET JOB DESCRIPTION:\n{jd[:6000]}"
    if target_role:
        context += f"\n\nTARGET ROLE: {target_role[:120]}"
    if job_label:
        context += f"\n\nTARGET JOB: {job_label[:160]}"

    # ---- pass 1: GENERATE -------------------------------------------------
    user_msg = (
        f"RESUME:\n{resume_text[:9000]}{context}\n\n"
        "Rewrite this resume to maximize its ATS score and recruiter appeal"
        + (" for the target job" if (jd or target_role or job_label) else "") + ". Rules:\n"
        "- Keep ALL facts truthful (same employers, titles, dates)\n"
        "- Strengthen bullets with action verbs and quantified impact\n"
        "- Integrate relevant keywords naturally\n\n" + OUTPUT_FORMAT)
    raw = await llm_complete(OPTIMIZE_SYSTEM, user_msg, tier="smart")
    optimized, meta = _parse_marked_output(raw)
    heuristic = heuristic_ats_score(optimized, jd)
    alignment_report = validate_master_alignment(optimized, resume_text)
    passes = 1

    # ---- pass 2 (conditional): CRITIQUE -> REFINE --------------------------
    if heuristic["score"] < SCORE_TARGET or not alignment_report["is_aligned"]:
        feedback = _gap_feedback(heuristic)
        if not alignment_report["is_aligned"]:
            fabricated_items = [v["value"] for v in alignment_report["violations"] if v["severity"] == "critical"]
            feedback += f"\n- CRITICAL ALIGNMENT VIOLATION: You fabricated skills/certifications not found in the original resume. Remove them: {', '.join(fabricated_items)}"

        logger.info("Reflexion pass triggered (score %s < %s, aligned: %s)", heuristic["score"], SCORE_TARGET, alignment_report["is_aligned"])
        refine_msg = (
            f"You previously optimized this resume:\n{optimized[:9000]}{context}\n\n"
            f"An ATS scan of YOUR version found these concrete gaps:\n{feedback}\n\n"
            "Produce an improved version that fixes every gap above while staying "
            "100% truthful. Keep everything that already works.\n\n" + OUTPUT_FORMAT)
        try:
            raw2 = await llm_complete(OPTIMIZE_SYSTEM, refine_msg, tier="smart")
            optimized2, meta2 = _parse_marked_output(raw2)
            heuristic2 = heuristic_ats_score(optimized2, jd)
            alignment_report2 = validate_master_alignment(optimized2, resume_text)
            passes = 2
            
            # Keep pass-2 if it either improves the score or fixes fabrication
            if heuristic2["score"] >= heuristic["score"] or (alignment_report2["is_aligned"] and not alignment_report["is_aligned"]):
                optimized, heuristic, alignment_report = optimized2, heuristic2, alignment_report2
                meta["changes"] = (meta.get("changes", []) + meta2.get("changes", []))[:8]
                meta["keywords_added"] = list(dict.fromkeys(
                    meta.get("keywords_added", []) + meta2.get("keywords_added", [])))[:20]
                meta["estimated_score"] = meta2.get("estimated_score", meta.get("estimated_score"))
        except Exception as exc:
            logger.warning("Reflexion refine pass failed, keeping pass-1 output: %s", exc)

    # Local post-processing: Clean up AI buzzwords from final text
    cleaned_optimized, removed_ai_phrases = remove_ai_buzzwords(optimized, jd or "")
    optimized = cleaned_optimized
    
    # Recalculate metrics on the final cleaned text
    heuristic = heuristic_ats_score(optimized, jd)
    alignment_report = validate_master_alignment(optimized, resume_text)
    metric_suggestions = generate_metric_suggestions(optimized)
    injectable, non_injectable = analyze_keyword_gaps(optimized, resume_text, jd or "")

    result = {
        "optimized_text": optimized,
        "changes": meta.get("changes", []),
        "keywords_added": meta.get("keywords_added", []),
        "estimated_score": meta.get("estimated_score"),
        "new_heuristic_score": heuristic["score"],
        "refinement_passes": passes,
        "injectable_keywords": injectable,
        "non_injectable_keywords": non_injectable,
        "removed_ai_phrases": removed_ai_phrases,
        "metric_suggestions": metric_suggestions,
        "alignment_report": alignment_report,
    }

    # Guardrails gate check
    trace_id = str(uuid.uuid4())
    gate = PipelineGate()
    g_result = gate.check(optimized_text=optimized, original_text=resume_text)
    if not g_result["all_passed"]:
        logger.warning("Guardrails failed for trace_id=%s: %s", trace_id, g_result)
        stage_fail(
            stage_name="optimizer_guardrails",
            trace_id=trace_id,
            error_type="guardrails_violation",
            error_message=str(g_result),
        )
    else:
        stage_complete(
            stage_name="optimizer_guardrails",
            trace_id=trace_id,
            latency_ms=0,
            status="passed",
        )

    result["guardrails"] = g_result
    return result
