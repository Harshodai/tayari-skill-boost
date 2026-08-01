
import os

from fastapi import APIRouter, Form, File, UploadFile, HTTPException
from typing import Optional
from pydantic import BaseModel

from app.schemas import ATSAnalysisResponse, QuickScoreResponse
from app.parsers.document_parser import ResumeParser, ParsedResume
from app.analysis.similarity import KeywordAnalyzer
from app.analysis.ngram_analyzer import NGramAnalyzer
from app.scoring.ats_scorer import ATSScorer

router = APIRouter()

keyword_analyzer = KeywordAnalyzer()
ngram_analyzer = NGramAnalyzer()
ats_scorer = ATSScorer()

# ponytail: env-tunable upload cap; magic bytes cover the two accepted formats.
# Upgrade path: add mime whitelist + per-extension size knobs if new formats arrive.
_MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
_ALLOWED_EXT = ("pdf", "docx")
_MAGIC = {
    "pdf": (b"%PDF",),
    "docx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),  # zip container signatures
}


def _validate_upload(upload: UploadFile, data: bytes) -> str:
    """Enforce size + extension whitelist + magic-byte check. Returns normalized extension."""
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Uploaded file exceeds size limit")
    name = (upload.filename or "").lower()
    ext = name.rsplit(".", 1)[-1] if "." in name else ""
    if ext not in _ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Only .pdf and .docx files are accepted")
    if not data.startswith(_MAGIC[ext]):
        raise HTTPException(status_code=400, detail="File content does not match its extension")
    return ext


class AnalyzeRequest(BaseModel):
    resume_text: Optional[str] = None
    job_description: Optional[str] = None

@router.post("/api/v1/ats/analyze", response_model=ATSAnalysisResponse)
async def ats_analyze(
    resume_text: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None),
    resume_file: Optional[UploadFile] = File(None),
    jd_file: Optional[UploadFile] = File(None),
):
    """Full ATS analysis: parse (if files), score, and recommend."""
    # ingest resume
    resume_parsed: Optional[ParsedResume] = None
    if resume_file:
        data = await resume_file.read()
        ext = _validate_upload(resume_file, data)
        resume_parsed = ResumeParser.parse_file(data, ext)
        resume_text = resume_parsed.raw_text or ""
    elif resume_text:
        resume_parsed = ResumeParser.parse_text(resume_text)
    else:
        raise HTTPException(status_code=400, detail="Provide resume_text or resume_file")

    # ingest JD
    if jd_file:
        data = await jd_file.read()
        ext = _validate_upload(jd_file, data)
        jd_parsed = ResumeParser.parse_file(data, ext)
        jd_text = jd_parsed.raw_text or ""
    elif not job_description:
        raise HTTPException(status_code=400, detail="Provide job_description or jd_file")
    else:
        jd_text = job_description

    keywords = keyword_analyzer.analyze(resume_text, jd_text)
    ngrams = ngram_analyzer.analyze(resume_text, jd_text)
    result = ats_scorer.score(keywords, ngrams, resume_parsed, resume_text)
    return result

@router.post("/api/v1/ats/score", response_model=QuickScoreResponse)
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

@router.post("/api/v1/ats/keywords")
async def ats_keywords(payload: AnalyzeRequest):
    """Extract and compare keywords."""
    keywords = keyword_analyzer.analyze(
        payload.resume_text or "", payload.job_description or ""
    )
    return keywords

@router.post("/api/v1/parser/parse")
async def parse_document(resume_file: UploadFile = File(...)):
    """Parse PDF or DOCX file and return raw text."""
    data = await resume_file.read()
    ext = _validate_upload(resume_file, data)
    parsed = ResumeParser.parse_file(data, ext)
    return {"text": parsed.raw_text or ""}


@router.post("/api/v1/ats/evaluate-5d")
async def ats_evaluate_5d(payload: AnalyzeRequest):
    """Evaluate 5-dimension fit (Technical, Experience, Culture, Compensation, Logistics)."""
    from app.services.ats_engine import evaluate_5d_fit
    if not payload.resume_text or not payload.job_description:
        raise HTTPException(status_code=400, detail="Provide resume_text and job_description")
    return evaluate_5d_fit(payload.resume_text, payload.job_description)

