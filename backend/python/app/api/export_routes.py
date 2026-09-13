"""
Export routes for the Tayari AI Engine (JSON, DOCX, Typst PDF, Resume PDF).
"""
import asyncio
import io
import logging
import sys
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.schemas import ExportRequest
from app.auth.dependencies import get_current_user
from app.export.json_exporter import JSONExporter
from app.services import docx_builder
from app.services.llm_service import LLMNotConfiguredError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Export"])


def _get_llm_json():
    main_mod = sys.modules.get("app.main")
    if main_mod and hasattr(main_mod, "llm_json"):
        return getattr(main_mod, "llm_json")
    from app.services.llm_service import llm_json
    return llm_json


@router.post("/api/v1/export/json")
async def export_json(
    payload: ExportRequest,
    _user_id: str = Depends(get_current_user),
):
    """Export resume as JSON."""
    try:
        data = JSONExporter.export(payload.resume_json)
        return {"data": data.decode("utf-8")}
    except Exception as exc:
        logger.error("export/json failed: %s", exc)
        raise HTTPException(status_code=500, detail="JSON export failed") from exc


class DocxExportRequest(BaseModel):
    text: str
    title: Optional[str] = "Resume"


@router.post("/api/v1/export/docx")
async def export_docx(
    payload: DocxExportRequest,
    _user_id: str = Depends(get_current_user),
):
    """Export resume as ATS-safe DOCX."""
    try:
        buf = docx_builder.build_resume_docx(payload.text, payload.title)
        import base64
        return {"data": base64.b64encode(buf.getvalue()).decode("utf-8")}
    except Exception as exc:
        logger.error("export/docx failed: %s", exc)
        raise HTTPException(status_code=500, detail="DOCX export failed") from exc


class TypstExportRequest(BaseModel):
    profile_data: dict
    template: Optional[str] = "executive"


@router.post("/api/v1/export/typst-pdf")
@router.post("/api/export/typst-pdf")
async def export_typst_pdf_endpoint(
    payload: TypstExportRequest,
    _user_id: str = Depends(get_current_user),
):
    """Compile profile/resume JSON into single-page Typst PDF."""
    from app.export.typst_exporter import generate_typst_code, compile_typst_to_pdf
    try:
        code = generate_typst_code(payload.profile_data, template=payload.template or "executive")
        pdf_bytes = await asyncio.to_thread(compile_typst_to_pdf, code)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="resume_typst.pdf"'},
        )
    except Exception as exc:
        logger.error("typst pdf export failed: %s", exc)
        raise HTTPException(status_code=500, detail="Typst PDF export failed") from exc


class GenerateResumePdfRequest(BaseModel):
    resume_text: str
    profile_data: Optional[dict] = None
    analysis: dict
    applied_suggestions: list[str] = []
    job_description: Optional[str] = None
    template: Optional[str] = "professional"


class OptimizedProfileExperience(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    dates: Optional[str] = None
    bullets: list[str] = []


class OptimizedProfileEducation(BaseModel):
    degree: Optional[str] = None
    school: Optional[str] = None
    year: Optional[str] = None


class OptimizedProfile(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    location: Optional[str] = None
    summary: Optional[str] = None
    skills: list[str] = []
    experience: list[OptimizedProfileExperience] = []
    education: list[OptimizedProfileEducation] = []


_UI_TEMPLATE_MAP = {
    "modern": "modern_tech",
    "professional": "executive_slate",
    "creative": "creative_compact",
    "minimal": "minimalist_ats",
    "tech": "faang_single_page",
    "executive": "executive",
}
_TEMPLATE_FALLBACK = "executive_slate"


def _resolve_template(template: str) -> str:
    return _UI_TEMPLATE_MAP.get(template or "", _TEMPLATE_FALLBACK)


def _format_dates(start: Optional[str], end: Optional[str]) -> str:
    if start and end:
        return f"{start} \u2013 {end}"
    return start or end or ""


def _map_profile_keys(profile_data: dict) -> dict:
    mapped = {
        "full_name": profile_data.get("full_name") or profile_data.get("name"),
        "email": profile_data.get("email"),
        "phone": profile_data.get("phone"),
        "linkedin": profile_data.get("linkedin"),
        "location": profile_data.get("location"),
        "summary": profile_data.get("summary"),
    }
    raw_skills = profile_data.get("skills")
    if isinstance(raw_skills, list):
        mapped["skills"] = [s.get("name") if isinstance(s, dict) else s for s in raw_skills if s]
    raw_exp = profile_data.get("experience")
    if isinstance(raw_exp, list):
        experience = []
        for item in raw_exp:
            if not isinstance(item, dict):
                continue
            bullets = item.get("bullets") or item.get("achievements") or []
            if not bullets and item.get("description"):
                bullets = [item["description"]]
            experience.append({
                "title": item.get("title"),
                "company": item.get("company"),
                "dates": item.get("dates") or _format_dates(item.get("startDate"), item.get("endDate")),
                "bullets": bullets,
            })
        mapped["experience"] = experience
    raw_edu = profile_data.get("education")
    if isinstance(raw_edu, list):
        education = []
        for item in raw_edu:
            if not isinstance(item, dict):
                continue
            education.append({
                "degree": item.get("degree"),
                "school": item.get("school") or item.get("institution"),
                "year": item.get("year"),
            })
        mapped["education"] = education
    return mapped


@router.post("/api/v1/resumes/generate-pdf")
@router.post("/api/resumes/generate-pdf")
async def generate_resume_pdf_endpoint(
    payload: GenerateResumePdfRequest,
    _user_id: str = Depends(get_current_user),
):
    """LLM-optimize resume content, render it to a PDF via local Typst, return base64."""
    if not payload.resume_text or not payload.analysis:
        raise HTTPException(status_code=400, detail="resume_text and analysis are required")
    if len(payload.resume_text) > 50_000:
        raise HTTPException(status_code=400, detail="resume_text exceeds 50000 characters")
    if payload.job_description and len(payload.job_description) > 20_000:
        raise HTTPException(status_code=400, detail="job_description exceeds 20000 characters")
    if len(payload.applied_suggestions) > 50:
        raise HTTPException(status_code=400, detail="applied_suggestions exceeds 50 items")

    analysis = payload.analysis
    system_prompt = (
        "You are an expert resume writer. Your task is to optimize and improve the given resume "
        "based on the analysis feedback and applied suggestions. Make improvements subtle but "
        "impactful. Add missing keywords naturally where appropriate. Quantify achievements with "
        "specific numbers where possible. Return the optimized resume as a single JSON profile "
        "object (full_name, email, phone, linkedin, location, summary, skills, experience, education)."
    )
    user_prompt = f"Original Resume:\n{payload.resume_text}\n\n"
    if payload.job_description:
        user_prompt += f"Target Job Description:\n{payload.job_description}\n\n"
    if not payload.profile_data:
        user_prompt += (
            "No parsed profile is available: construct the complete resume profile "
            "(full_name, email, phone, linkedin, location, summary, skills, experience, education) "
            "from the resume text alone.\n\n"
        )
    user_prompt += (
        "Analysis Summary:\n"
        f"- Overall Score: {analysis.get('overall_score', 'N/A')}/100\n"
        f"- {analysis.get('summary_recommendation', '')}\n"
    )
    missing_keywords = analysis.get("missing_keywords") or []
    if missing_keywords:
        user_prompt += f"\nMissing keywords to naturally incorporate: {', '.join(str(k) for k in missing_keywords)}\n"
    if payload.applied_suggestions:
        suggestions = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(payload.applied_suggestions))
        user_prompt += f"\nApplied suggestions to incorporate:\n{suggestions}"

    llm_json_fn = _get_llm_json()
    try:
        optimized = await llm_json_fn(system_prompt, user_prompt, response_model=OptimizedProfile)
        profile = _map_profile_keys(payload.profile_data) if payload.profile_data else {}
        for key, value in optimized.model_dump(exclude_none=True).items():
            if value:
                profile[key] = value

        from app.export.typst_exporter import generate_typst_code, compile_typst_to_pdf
        code = generate_typst_code(profile, template=_resolve_template(payload.template))
        pdf_bytes = await asyncio.to_thread(compile_typst_to_pdf, code)
        if not pdf_bytes:
            raise HTTPException(status_code=500, detail="PDF compilation returned no bytes")
        import base64
        return {"pdf_base64": base64.b64encode(pdf_bytes).decode("ascii")}
    except LLMNotConfiguredError as exc:
        logger.error("resumes/generate-pdf: LLM not configured/available: %s", exc)
        return JSONResponse(status_code=503, content={"error": "ai_service_unavailable"})
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("resumes/generate-pdf failed: %s", exc)
        raise HTTPException(status_code=502, detail="Resume PDF generation failed") from exc


@router.post("/api/v1/typst/compile")
async def typst_compile_endpoint(
    payload: dict,
    _user_id: str = Depends(get_current_user),
):
    """Generate Typst code and compile into PDF binary or plain string."""
    from app.export.typst_exporter import generate_typst_code, compile_typst_to_pdf
    template = payload.get("template", "modern_tech")
    resume_data = payload.get("resume_data", payload)
    typst_code = ""
    try:
        typst_code = generate_typst_code(resume_data, template=template)
        pdf_bytes = await asyncio.to_thread(compile_typst_to_pdf, typst_code)
        if isinstance(pdf_bytes, bytes) and len(pdf_bytes) > 0:
            import base64
            return {
                "template": template,
                "typst_code": typst_code,
                "pdf_available": True,
                "pdf_data": base64.b64encode(pdf_bytes).decode("utf-8"),
            }
        return {
            "template": template,
            "typst_code": typst_code,
            "pdf_available": False,
        }
    except Exception as exc:
        logger.warning("typst compilation unavailable: %s", exc)
        return {
            "template": template,
            "typst_code": typst_code,
            "pdf_available": False,
            "error": str(exc),
        }
