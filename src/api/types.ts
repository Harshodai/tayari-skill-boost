/**
 * Types for the Go backend API.
 * These mirror the backend response shapes.
 */

// --- Core models ---

export interface Resume {
  id: number;
  user_id: string;
  title: string;
  original_text?: string;
  parsed_json?: string;
  file_url?: string;
  file_type: string;
  status: string; // uploaded | parsed | optimized
  created_at: string;
  updated_at: string;
}

export interface JobDescription {
  id: number;
  user_id: string;
  title: string;
  company?: string;
  text: string;
  created_at: string;
}

export interface AnalysisResult {
  id: number;
  user_id: string;
  resume_id: number;
  job_description_id: number;
  score: number;
  breakdown?: Record<string, any>;
  keyword_matches?: string[];
  recommendations?: string[];
  created_at: string;
}

// --- Request / Response shapes ---

export interface CreateResumeRequest {
  title: string;
  original_text: string;
  file_type: string;
}

export interface CreateJDRequest {
  title: string;
  company: string;
  text: string;
}

export interface AnalyzeRequest {
  resume_id?: string | number;
  jd_id?: string | number;
  resume_text?: string;
  job_description?: string;
  custom_instructions?: string;
}

export interface ImportedJobDescription {
  url: string;
  title?: string;
  job_description: string;
}

export interface APIError {
  error: string;
}

// ponytail: shared ledger-detail shape so PrivacyReadiness/Settings can render
// ledger entries with a precise, compatible detail type instead of Record<string, unknown>.
export interface PrivacyLedgerDetail {
  is_local?: boolean;
  provider?: string;
  pii_redacted?: string[];
  tokens_used?: number;
  archive_type?: string;
  mode?: string;
}

export interface PrivacyLedgerEntry {
  id: string;
  action: string;
  resource: string;
  detail?: PrivacyLedgerDetail;
  created_at: string;
}

// --- MVP: Profile, Job Search, Saved Jobs, Autopilot, Applications ---

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  email: string;
  headline?: string;
  summary?: string;
  skills?: string[];
  desired_roles?: string[];
  locations?: string[];
  experience_years?: number;
  open_to_remote?: boolean;
  links?: Record<string, any>;
  // ponytail: career-goal fields mirror the Onboarding wizard payload (P0 audit fix Q3)
  transition_type?: "same_domain" | "cross_domain";
  current_title?: string;
  target_level?: string;
  current_industry?: string;
  target_industry?: string;
  transferable_skills?: string[];
  created_at: string;
  updated_at?: string;
}

export interface DashboardStats {
  resumes_count: number;
  saved_jobs_count: number;
  applications_count: number;
  interviews_count: number;
  profile_completion_pct: number;
}

export interface SavedJob {
  id: number;
  user_id: string;
  dedupe_key: string;
  job: Record<string, any>;
  status: string;
  saved_at: string;
  updated_at: string;
}

export interface AutopilotRun {
  run_id: string;
  config?: Record<string, any>;
  status: string;
  progress: number;
  current_step?: string;
  logs?: string[];
  applications_created: number;
  error?: string;
  created_at: string;
  updated_at: string;
  applications?: Application[];
}

export interface Application {
  id: number | string;
  application_id: string;
  user_id: string;
  run_id?: string;
  job?: Record<string, any>;
  /** Convenience denormalised fields (mirror of job.title/company/location) */
  title?: string;
  company?: string;
  location?: string;
  tailored_resume_text?: string;
  cover_letter?: string;
  changes?: Record<string, any>;
  keywords_added?: string[];
  ats_score_before: number;
  ats_score_after: number;
  is_dream_company: boolean;
  status: string;
  /** Kanban stage alias (saved/applied/interview/offer/rejected) */
  stage?: string;
  url?: string;
  notes?: string;
  submission_mode?: string;
  apply_url?: string;
  notes_log?: Array<{ at: string; text: string }>;
  voice_notes?: Array<{ at: string; url: string; transcript?: string }>;
  interview_research?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// --- Guardrails ---

export interface GuardrailResult {
  all_passed: boolean;
  results: {
    truthfulness: {
      passed: boolean;
      violations: string[];
    };
    keyword_stuffing: {
      passed: boolean;
      density_score: number;
      flagged_keywords: string[];
    };
    pii: {
      passed: boolean;
      pii_found: Array<{
        type: string;
        match: string;
        position: number;
      }>;
    };
  };
}

export interface OptimizationSummary {
  semantic_score_before?: number;
  semantic_score_after?: number;
  avg_star_score?: number;
  buzzwords_cleaned?: number;
}

export interface StarBulletReview {
  bullet: string;
  star_score?: number;
  star_grade?: string;
  suggestion?: string;
}

export interface KeywordMatrixItem {
  keyword: string;
  in_resume: boolean;
}

export interface ResumeOptimizationResponse {
  [key: string]: unknown;
  optimized_text?: string;
  optimized_resume?: string;
  result?: string;
  new_heuristic_score?: number;
  refinement_passes?: number;
  guardrails?: GuardrailResult;
  alignment_report?: { is_aligned?: boolean };
  optimization_summary?: OptimizationSummary;
  semantic_similarity_after?: { interpretation?: string };
  star_analysis?: { bullets_scored?: number; bullets_needing_improvement?: StarBulletReview[] };
  keyword_matrix?: {
    hard_skill_coverage?: number;
    hard_skills_matrix?: KeywordMatrixItem[];
    soft_skills_matrix?: KeywordMatrixItem[];
  };
  injectable_keywords?: string[];
  non_injectable_keywords?: string[];
  removed_ai_phrases?: Array<{ buzzword: string; replacement?: string }>;
  metric_suggestions?: string[];
}

export interface DeepATSResponse {
  [key: string]: unknown;
  score?: number;
  ats_score?: number;
  checks?: Record<string, { passed?: boolean }>;
  recommendations?: string[];
}

export interface TruthfulnessResponse {
  [key: string]: unknown;
  all_passed?: boolean;
  violations?: string[];
}

export interface OptimizeResponse {
  optimized_resume?: string;
  result?: string;
  changes?: Record<string, any>;
  keywords_added?: string[];
  estimated_score?: number;
  guardrails?: GuardrailResult;
}

export interface AutopilotSchedule {
  id: number;
  schedule_id: string;
  user_id: string;
  frequency: string;
  config?: Record<string, any>;
  active: boolean;
  next_run_at?: string;
  last_run_at?: string;
  created_at: string;
}
