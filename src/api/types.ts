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
  resume_id: string | number;
  jd_id: string | number;
}

export interface APIError {
  error: string;
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
  submission_mode?: string;
  apply_url?: string;
  notes_log?: Array<{ at: string; text: string }>;
  voice_notes?: Array<{ at: string; url: string; transcript?: string }>;
  interview_research?: Record<string, any>;
  created_at: string;
  updated_at: string;
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
