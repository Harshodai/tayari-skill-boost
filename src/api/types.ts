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
