"""
Tayari AI Engine — FastAPI entry point.
"""
import os
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.schemas import (
    ATSAnalysisResponse,
    QuickScoreResponse,
    EntitiesResponse,
    StrategicAnalysisResponse,
    AIProofingAnalysis,
    ExportRequest,
    ExportResponse,
)
from app.parsers.document_parser import ResumeParser, ParsedResume
from app.analysis.similarity import KeywordAnalyzer
from app.analysis.ngram_analyzer import NGramAnalyzer
from app.scoring.ats_scorer import ATSScorer
from app.extraction.entity_extractor import EntityExtractor, KeywordInjector
from app.ai_proofing.detector import AIProofingDetector
from app.llm.strategic_analyzer import StrategicAnalyzer
from app.export.pdf_exporter import PDFExporter
from app.export.json_exporter import JSONExporter

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Tayari AI Engine",
    version="1.0.0",
    description="Python AI Engine for the Tayari Resume Optimizer",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services (singletons)
keyword_analyzer = KeywordAnalyzer()
ngram_analyzer = NGramAnalyzer()
ats_scorer = ATSScorer()
entity_extractor = EntityExtractor()
ai_proofing = AIProofingDetector()
strategic_analyzer = StrategicAnalyzer()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    model_status: str


@app.get("/health", response_model=HealthResponse)
@app.get("/api/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="ok",
        service="python-ai-engine",
        version="1.0.0",
        model_status="loaded" if strategic_analyzer.llm_url else "llm_not_configured",
    )


# ---------------------------------------------------------------------------
# ATS Core Routes
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    resume_text: Optional[str] = None
    job_description: Optional[str] = None


@app.post("/api/v1/ats/analyze", response_model=ATSAnalysisResponse)
async def ats_analyze(
    resume_text: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None),
    resume_file: Optional[UploadFile] = File(None),
    jd_file: Optional[UploadFile] = File(None),
):
    """Full ATS analysis: parse (if files), score, and recommend."""
    # --- ingest resume ---
    resume_parsed: Optional[ParsedResume] = None
    if resume_file:
        data = await resume_file.read()
        resume_parsed = ResumeParser.parse_file(data, resume_file.content_type or "pdf")
        resume_text = resume_parsed.raw_text or ""
    elif not resume_text:
        raise HTTPException(status_code=400, detail="Provide resume_text or resume_file")

    # --- ingest JD ---
    if jd_file:
        data = await jd_file.read()
        jd_text = data.decode("utf-8", errors="ignore")
    elif not job_description:
        raise HTTPException(status_code=400, detail="Provide job_description or jd_file")
    else:
        jd_text = job_description

    # --- run pipeline ---
    keywords = keyword_analyzer.analyze(resume_text, jd_text)
    ngrams = ngram_analyzer.analyze(resume_text, jd_text)
    result = ats_scorer.score(keywords, ngrams, resume_parsed, resume_text)
    return result


@app.post("/api/v1/ats/score", response_model=QuickScoreResponse)
async def ats_score(payload: AnalyzeRequest):
    """Quick score with minimal metadata."""
    keywords = keyword_analyzer.analyze(payload.resume_text or "", payload.job_description or "")
    total = keywords.total_jd_keywords or 1
    return QuickScoreResponse(
        score=round((keywords.matched_count / total) * 100),
        matched_keywords=keywords.matched_count,
        missing_keywords=len(keywords.missing),
        summary=f"Matched {keywords.matched_count}/{total} keywords",
    )


@app.post("/api/v1/ats/keywords")
async def ats_keywords(payload: AnalyzeRequest):
    """Extract and compare keywords."""
    keywords = keyword_analyzer.analyze(
        payload.resume_text or "", payload.job_description or ""
    )
    return keywords


# ---------------------------------------------------------------------------
# Strategic / Entity Routes
# ---------------------------------------------------------------------------

@app.post("/api/v1/strategic/analyze", response_model=StrategicAnalysisResponse)
async def strategic_analyze(payload: AnalyzeRequest):
    """Strategic LLM analysis (hidden skills, templates, recommendations)."""
    return await strategic_analyzer.analyze(
        payload.resume_text or "", payload.job_description or ""
    )


@app.post("/api/v1/strategic/entities", response_model=EntitiesResponse)
async def strategic_entities(payload: AnalyzeRequest):
    """Extract entities from resume or JD."""
    text = payload.resume_text or payload.job_description or ""
    return entity_extractor.extract(text)


@app.post("/api/v1/strategic/inject")
async def strategic_inject(
    experience_bullets: list[str],
    missing_keywords: list[str],
):
    """Suggest keyword injection points."""
    injector = KeywordInjector()
    return injector.suggest_injections(experience_bullets, missing_keywords)


@app.post("/api/v1/strategic/ai-proof", response_model=AIProofingAnalysis)
async def ai_proof(payload: AnalyzeRequest):
    """Analyze resume for AI-detection risks."""
    return ai_proofing.analyze(payload.resume_text or "")


# ---------------------------------------------------------------------------
# Export Routes
# ---------------------------------------------------------------------------

@app.post("/api/v1/export/json")
async def export_json(payload: ExportRequest):
    """Export resume as JSON."""
    data = JSONExporter.export(payload.resume_json)
    return {"data": data.decode("utf-8")}


@app.post("/api/v1/export/pdf")
async def export_pdf(payload: ExportRequest):
    """Export resume as PDF (ATS-safe)."""
    try:
        pdf_bytes = PDFExporter.export(payload.resume_json)
        return {"size": len(pdf_bytes), "status": "generated"}
    except ImportError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Plugin registration (backward compat)
# ---------------------------------------------------------------------------

from app.plugins import register_plugins  # noqa: E402


register_plugins(app)


if __name__ == "__main__":
    import uvicorn  # noqa: E402

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
