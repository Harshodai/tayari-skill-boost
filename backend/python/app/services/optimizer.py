from __future__ import annotations
"""Resume tailoring/optimization with a reflexion loop (advanced agent pattern).

Pattern: GENERATE -> SCORE (deterministic ATS engine) -> CRITIQUE with concrete,
measurable gaps -> REFINE (one pass). The deterministic scorer acts as the judge,
so the loop converges on real ATS improvements instead of LLM self-praise.
Shared by the Resume Optimizer endpoints and the Auto-Pilot automation engine.
"""
import logging

from app.services.ats_engine import heuristic_ats_score
from app.services.llm_service import llm_complete, extract_json
from app.guardrails import PipelineGate
from app.telemetry import stage_complete, stage_fail
import uuid

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


async def optimize_with_reflection(resume_text: str, job_description: str | None = None,
                                   target_role: str | None = None,
                                   job_label: str | None = None) -> dict:
    """Returns {optimized_text, changes, keywords_added, estimated_score,
    new_heuristic_score, refinement_passes}."""
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
    passes = 1

    # ---- pass 2 (conditional): CRITIQUE -> REFINE --------------------------
    if heuristic["score"] < SCORE_TARGET:
        feedback = _gap_feedback(heuristic)
        logger.info("Reflexion pass triggered (score %s < %s)", heuristic["score"], SCORE_TARGET)
        refine_msg = (
            f"You previously optimized this resume:\n{optimized[:9000]}{context}\n\n"
            f"An ATS scan of YOUR version found these concrete gaps "
            f"(score {heuristic['score']}/100):\n{feedback}\n\n"
            "Produce an improved version that fixes every gap above while staying "
            "100% truthful. Keep everything that already works.\n\n" + OUTPUT_FORMAT)
        try:
            raw2 = await llm_complete(OPTIMIZE_SYSTEM, refine_msg, tier="smart")
            optimized2, meta2 = _parse_marked_output(raw2)
            heuristic2 = heuristic_ats_score(optimized2, jd)
            passes = 2
            if heuristic2["score"] >= heuristic["score"]:  # keep only real improvements
                optimized, heuristic = optimized2, heuristic2
                meta["changes"] = (meta.get("changes", []) + meta2.get("changes", []))[:8]
                meta["keywords_added"] = list(dict.fromkeys(
                    meta.get("keywords_added", []) + meta2.get("keywords_added", [])))[:20]
                meta["estimated_score"] = meta2.get("estimated_score", meta.get("estimated_score"))
        except Exception as exc:
            logger.warning("Reflexion refine pass failed, keeping pass-1 output: %s", exc)

    result = {
        "optimized_text": optimized,
        "changes": meta.get("changes", []),
        "keywords_added": meta.get("keywords_added", []),
        "estimated_score": meta.get("estimated_score"),
        "new_heuristic_score": heuristic["score"],
        "refinement_passes": passes,
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
        # Still return the result but annotate with guardrails info so caller can decide
    else:
        stage_complete(
            stage_name="optimizer_guardrails",
            trace_id=trace_id,
            latency_ms=0,
            status="passed",
        )

    result["guardrails"] = g_result
    return result
