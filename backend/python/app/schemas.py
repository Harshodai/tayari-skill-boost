"""
Shared Pydantic models for the Python AI Engine.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# --- Resume / JD ---

class ParsedSection(BaseModel):
    section: str
    content: str


class ResumeParsed(BaseModel):
    contact: Dict[str, Optional[str]] = Field(default_factory=dict)
    summary: Optional[str] = None
    experience: List[str] = Field(default_factory=list)
    education: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    projects: List[str] = Field(default_factory=list)
    raw_text: Optional[str] = None


class JobDescription(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    text: str


# --- ATS Analysis ---

class KeywordAnalysis(BaseModel):
    found: List[str] = Field(default_factory=list)
    missing: List[str] = Field(default_factory=list)
    density: Dict[str, float] = Field(default_factory=dict)
    total_jd_keywords: int = 0
    matched_count: int = 0


class NGramAnalysis(BaseModel):
    matched: List[str] = Field(default_factory=list)
    missing: List[str] = Field(default_factory=list)


class FormattingAnalysis(BaseModel):
    single_column: bool = True
    standard_font: bool = True
    no_complex_tables: bool = True
    parsing_risk: bool = False
    score: float = 0.0


class SectionCompleteness(BaseModel):
    has_contact: bool = False
    has_summary: bool = False
    has_experience: bool = False
    has_education: bool = False
    has_skills: bool = False
    score: float = 0.0


class ScoreBreakdown(BaseModel):
    keyword_match: float = 0.0
    ngram_match: float = 0.0
    keyword_density: float = 0.0
    section_completeness: float = 0.0
    formatting_compliance: float = 0.0


class ATSAnalysisResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    breakdown: ScoreBreakdown
    keywords: KeywordAnalysis
    ngrams: NGramAnalysis
    formatting: FormattingAnalysis
    section_completeness: SectionCompleteness
    recommendations: List[str] = Field(default_factory=list)


class QuickScoreResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    matched_keywords: int = 0
    missing_keywords: int = 0
    summary: str


# --- Strategic / Entity ---

class ExtractedEntity(BaseModel):
    name: str
    category: str  # e.g., "programming_language", "framework", "tool", "certification"


class EntitiesResponse(BaseModel):
    skills: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)


class HiddenSkill(BaseModel):
    skill: str
    evidence: str
    confidence: str  # "high", "medium", "low"


class StrategicAnalysisResponse(BaseModel):
    hidden_skills: List[HiddenSkill] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    templates: List[str] = Field(default_factory=list)
    placement_recommendations: List[str] = Field(default_factory=list)
    ai_risk_flags: List[str] = Field(default_factory=list)


class KeywordInjection(BaseModel):
    bullet_index: int
    original: str
    suggestion: str
    inserted_keywords: List[str]
    preserves_voice: bool = True


class AIProofingAnalysis(BaseModel):
    risk_score: int = Field(ge=0, le=100)
    flagged_phrases: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)


class ExportRequest(BaseModel):
    resume_json: Dict[str, Any]


class ExportResponse(BaseModel):
    download_url: Optional[str] = None
    deltas: List[str] = Field(default_factory=list)
    status: str = "pending"
