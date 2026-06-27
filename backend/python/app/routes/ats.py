
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
        resume_parsed = ResumeParser.parse_file(data, resume_file.content_type or "pdf")
        resume_text = resume_parsed.raw_text or ""
    elif not resume_text:
        raise HTTPException(status_code=400, detail="Provide resume_text or resume_file")

    # ingest JD
    if jd_file:
        data = await jd_file.read()
        jd_text = data.decode("utf-8", errors="ignore")
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
