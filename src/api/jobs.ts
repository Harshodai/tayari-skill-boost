import { apiFetchResponse } from "@/api";
import { apiFetch, getHeaders, checkResponse, API_URL } from "./client";
import type { JobDescription, CreateJDRequest, SavedJob } from "./types";

export async function createJD(payload: CreateJDRequest): Promise<JobDescription> {
  return apiFetch<JobDescription>("/v1/job-descriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listJDs(): Promise<JobDescription[]> {
  return apiFetch<JobDescription[]>("/v1/job-descriptions");
}

export async function getJD(id: number | string): Promise<JobDescription> {
  return apiFetch<JobDescription>(`/v1/job-descriptions/${id}`);
}

export async function updateJD(
  id: number | string,
  payload: CreateJDRequest
): Promise<JobDescription> {
  return apiFetch<JobDescription>(`/v1/job-descriptions/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteJD(id: number | string): Promise<void> {
  const response = await apiFetchResponse(`/v1/job-descriptions/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  await checkResponse(response);
}

export interface RoleIntelligence {
  family?: string | null;
  expanded_queries?: string[];
  adjacent_roles?: string[];
  confidence?: "high" | "medium" | "low" | "unknown";
  clarification_question?: string | null;
}

export interface PreparationMaterial {
  status?: "draft" | "grounded" | "unavailable";
  role_family?: string | null;
  focus_areas?: string[];
  evidence_to_prepare?: string[];
  practice_prompts?: string[];
  counterfactuals?: string[];
  grounded_in?: string;
}

export interface JobSearchResult {
  title: string;
  company: string;
  location?: string;
  url?: string;
  source?: string;
  snippet?: string;
  description?: string;
  job_type?: string;
  posted_at?: string;
  salary?: string;
  score?: number | null;
  fit_score?: number | null;
  match_score?: number | null;
  matched_skills?: string[];
  missing_skills?: string[];
  match_reason?: string;
  match_reasons?: string[];
  dedupe_key?: string;
  external_id?: string;
  source_channel?: string;
  role_intelligence?: RoleIntelligence;
  preparation_material?: PreparationMaterial;
  [key: string]: unknown;
}

export interface JobSearchResponse {
  query?: string;
  location?: string;
  total_found?: number;
  engine?: string;
  role_intelligence?: RoleIntelligence;
  results?: JobSearchResult[];
  jobs?: JobSearchResult[];
  report?: { jobs?: JobSearchResult[] };
  agent_trace?: Array<{ step: string; detail: string; at?: string }>;
  events?: Array<{ type?: string; message?: string; [key: string]: unknown } | any>;
  result?: JobSearchResponse;
  memory_used?: boolean;
  memory_tiers_used?: string[];
  memory_truncated?: boolean;
  [key: string]: unknown;
}

export async function searchJobs(payload: Record<string, unknown>): Promise<JobSearchResponse> {
  return apiFetch<JobSearchResponse>("/jobs/search", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function agentSearch(payload: Record<string, unknown>): Promise<JobSearchResponse> {
  return apiFetch<JobSearchResponse>("/jobs/agent-search", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function saveJob(payload: { dedupe_key: string; job: Record<string, any>; status?: string }): Promise<{ saved_id: number; status: string }> {
  return apiFetch<{ saved_id: number; status: string }>("/jobs/save", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listSavedJobs(status?: string): Promise<SavedJob[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<SavedJob[]>(`/jobs/saved${query}`);
}

export async function deleteSavedJob(id: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/jobs/saved/${id}`, {
    method: "DELETE",
  });
}

export type FeedbackType = "liked" | "disliked" | "applied" | "skipped" | "saved";

export interface PreferenceProfile {
  user_id: string;
  preferred_titles: string[];
  preferred_companies: string[];
  counts: { liked: number; applied: number; skipped: number };
  skill_weights: Record<string, number>;
  updated_at?: string;
}

export interface FeedbackEvent {
  job_id: string;
  job_title?: string;
  company_name?: string;
  feedback_type: FeedbackType;
  feedback_source?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export async function postJobFeedback(payload: {
  job_id: string;
  feedback_type: FeedbackType;
  job_title?: string;
  company_name?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/v1/preferences/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listJobFeedback(feedback_type?: FeedbackType): Promise<{ events: FeedbackEvent[] }> {
  const query = feedback_type ? `?feedback_type=${encodeURIComponent(feedback_type)}` : "";
  return apiFetch<{ events: FeedbackEvent[] }>(`/v1/preferences/feedback${query}`);
}

export interface CareerIntelligenceRequest {
  resume_id?: number;
  job_description_id?: number;
  job_description_text?: string;
  target_role?: string;
  location?: string;
}

export interface SkillsGapResponse {
  match_score: number;
  matched_skills: string[];
  adjacent_skills: string[];
  missing_skills: string[];
  required_skills: string[];
}

export interface LearningRecommendation {
  skill: string;
  title: string;
  url: string;
  provider: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  cost_type: 'free' | 'paid';
}

export interface LearningPathResponse {
  recommendations: LearningRecommendation[];
}

export interface SalaryBenchmarkResponse {
  role: string;
  location: string;
  salary_min: number;
  salary_median: number;
  salary_max: number;
  currency: string;
  confidence: string;
}

export async function getSkillsGap(payload: CareerIntelligenceRequest): Promise<SkillsGapResponse> {
  return apiFetch<SkillsGapResponse>("/v1/career-intelligence/skills-gap", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getLearningPath(payload: CareerIntelligenceRequest): Promise<LearningPathResponse> {
  return apiFetch<LearningPathResponse>("/v1/career-intelligence/learning-path", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSalaryBenchmark(payload: CareerIntelligenceRequest): Promise<SalaryBenchmarkResponse> {
  return apiFetch<SalaryBenchmarkResponse>("/v1/career-intelligence/salary-benchmark", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function detectAtsSignature(url: string, htmlSnippet: string = ""): Promise<any> {
  return apiFetch<any>("/v1/ats/detect", {
    method: "POST",
    body: JSON.stringify({ url, html_snippet: htmlSnippet }),
  });
}

export async function lookupRecruiterIntelligence(
  companyName: string,
  jobTitle: string,
  hiringManagerName?: string,
  userName?: string,
  userSkills?: string[]
): Promise<any> {
  return apiFetch<any>("/v1/recruiter/lookup", {
    method: "POST",
    body: JSON.stringify({
      company_name: companyName,
      job_title: jobTitle,
      hiring_manager_name: hiringManagerName,
      user_name: userName || "Candidate",
      user_skills: userSkills || [],
    }),
  });
}
