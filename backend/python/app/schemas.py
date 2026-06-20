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


class CoverLetterRequest(BaseModel):
    resume_text: str
    job_title: str
    company: str
    job_description: str
    tone: Optional[str] = "formal"


class CoverLetterResponse(BaseModel):
    cover_letter: str
    word_count: int
    bullet_references: List[str] = Field(default_factory=list)
    tone: str = "formal"
    job_title: str
    company_name: str


class CommunicationRequest(BaseModel):
    comm_type: str  # follow-up, thank-you, negotiation, status-check
    resume_text: str
    job_title: str
    company_name: str
    recipient_name: Optional[str] = None
    discussion_points: Optional[List[str]] = None
    offer_details: Optional[Dict[str, Any]] = None
    days_since: int = 3


class CommunicationResponse(BaseModel):
    subject: str
    body: str
    word_count: int
    type: str
    timing_note: str
    talking_points: Optional[List[str]] = None


class InterviewPrepRequest(BaseModel):
    resume_text: str
    job_title: str
    company_name: Optional[str] = None
    job_description: Optional[str] = None
    interview_type: str = "behavioral"  # behavioral, technical, system-design


class InterviewQuestion(BaseModel):
    question: str
    category: str
    source_bullet: Optional[str] = None
    skill: Optional[str] = None
    star_suggested: Optional[Dict[str, str]] = None
    suggested_answer: Optional[str] = None
    suggested_approach: Optional[str] = None
    requirements: Optional[str] = None


class InterviewPrepResponse(BaseModel):
    questions: List[InterviewQuestion] = Field(default_factory=list)
    interview_type: str
    company_specific: Optional[Dict[str, Any]] = None
    skills_tested: Optional[List[str]] = None


class KnowledgeGraphRequest(BaseModel):
    resume_text: str


class KnowledgeGraphResponse(BaseModel):
    entities: Dict[str, Any] = Field(default_factory=dict)
    achievements: List[Dict[str, Any]] = Field(default_factory=list)
    timeline: List[Dict[str, Any]] = Field(default_factory=list)
    llm_enhanced: bool = False


class ProfileImportResponse(BaseModel):
    headline: Optional[str] = None
    summary: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    experience_years: Optional[int] = None
    desired_roles: List[str] = Field(default_factory=list)
    locations: List[str] = Field(default_factory=list)
    companies: List[str] = Field(default_factory=list)
    job_titles: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
