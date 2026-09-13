export interface ResumeSection {
  name: string;
  score: number;
  suggestions: string[];
}

export interface PerAtsEstimate {
  estimates: Record<string, number>; // { workday, greenhouse, icims }
  band: number; // ± confidence band
  confidence: string; // "±8"
  plateau_note: string | null;
}

export interface KeywordStuffingPenalty {
  count: number;
  penalty_points: number;
  flagged_keywords: Array<{
    keyword: string;
    count: number;
    example?: string;
    penalty?: number;
  }>;
}

export interface ScoreBreakdown {
  structural_ats: number;
  semantic_fit: number;
  experience_relevance: number;
  achievement_quality: number;
  seniority_alignment: number | 'aligned' | 'under' | 'over';
  keyword_coverage: number;
  keyword_stuffing_penalty: KeywordStuffingPenalty;
  unsupported_claims_count: number;
  confidence_band: 'high' | 'medium' | 'low';
  human_rationale: string;
}

export interface ResumeAnalysisResult {
  overallScore: number;
  sections: ResumeSection[];
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryRecommendation: string;
  // ponytail: optional — present when the analysis path runs Python ats_engine
  // (heuristic_ats_score). Absent on pure-Go analyzer paths; UI falls back to
  // the per-ATS offset heuristic.
  per_ats?: PerAtsEstimate;
  score_breakdown?: ScoreBreakdown;
}

export interface AnalyzeResumeRequest {
  resumeText: string;
  jobDescription: string;
  customInstructions?: string;
  aiOptions: {
    emphasizeKeywords: boolean;
    quantifyAchievements: boolean;
    optimizeFormat: boolean;
    tailorSummary: boolean;
  };
}

export interface AnalyzeResumeResponse {
  success: boolean;
  data?: ResumeAnalysisResult;
  parsedResume?: ParsedResume;
  error?: string;
}

// Types for structured resume parsing
export interface ParsedResume {
  name: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  summary?: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: string[];
  projects?: ProjectEntry[];
}

export interface ExperienceEntry {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  description?: string;
  achievements: string[];
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
  gpa?: string;
}

export interface ProjectEntry {
  name: string;
  description?: string;
  technologies: string[];
}

// Types for analysis history
export interface ResumeAnalysisRecord {
  id: string;
  user_id: string;
  resume_filename: string;
  job_title?: string;
  company_name?: string;
  overall_score: number;
  analysis_data: ResumeAnalysisResult;
  parsed_resume?: ParsedResume;
  resume_text?: string;
  job_description?: string;
  created_at: string;
}