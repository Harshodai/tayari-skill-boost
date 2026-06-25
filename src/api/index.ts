import type {
  Resume,
  JobDescription,
  AnalysisResult,
  CreateResumeRequest,
  CreateJDRequest,
  AnalyzeRequest,
  Profile,
  SavedJob,
  AutopilotRun,
  Application,
  AutopilotSchedule,
  DashboardStats,
} from "./types";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const USE_SELF_HOSTED = import.meta.env.VITE_USE_SELF_HOSTED === "true";

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// =============================================================================
// Resumes
// =============================================================================

export async function createResume(
  payload: CreateResumeRequest
): Promise<Resume> {
  return apiFetch<Resume>("/v1/resumes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listResumes(): Promise<Resume[]> {
  return apiFetch<Resume[]>("/v1/resumes");
}

export async function getResume(id: number | string): Promise<Resume> {
  return apiFetch<Resume>(`/v1/resumes/${id}`);
}

export async function updateResume(
  id: number | string,
  payload: CreateResumeRequest
): Promise<Resume> {
  return apiFetch<Resume>(`/v1/resumes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteResume(
  id: number | string
): Promise<void> {
  const response = await fetch(`${API_URL}/v1/resumes/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
}

// =============================================================================
// Job Descriptions
// =============================================================================

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
  const response = await fetch(`${API_URL}/v1/job-descriptions/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
}

// =============================================================================
// Analysis
// =============================================================================

export async function analyzeResume(
  payload: AnalyzeRequest
): Promise<Record<string, any>> {
  return apiFetch<Record<string, any>>("/v1/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listAnalysisHistory(): Promise<AnalysisResult[]> {
  return apiFetch<AnalysisResult[]>("/v1/analyze/history");
}

export async function getAnalysis(
  id: number | string
): Promise<AnalysisResult> {
  return apiFetch<AnalysisResult>(`/v1/analyze/${id}`);
}

// =============================================================================
// Profile
// =============================================================================

export async function getProfile(): Promise<Profile> {
  return apiFetch<Profile>("/v1/profile");
}

export async function updateProfile(payload: Partial<Profile>): Promise<{ updated_at: string }> {
  return apiFetch<{ updated_at: string }>("/v1/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// Job Search
// =============================================================================

export async function searchJobs(payload: Record<string, any>): Promise<Record<string, any>> {
  return apiFetch<Record<string, any>>("/api/jobs/search", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function agentSearch(payload: Record<string, any>): Promise<any> {
  return apiFetch<any>("/api/jobs/agent-search", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function saveJob(payload: { dedupe_key: string; job: Record<string, any>; status?: string }): Promise<{ saved_id: number; status: string }> {
  return apiFetch<{ saved_id: number; status: string }>("/api/jobs/save", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listSavedJobs(status?: string): Promise<SavedJob[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<SavedJob[]>(`/api/jobs/saved${query}`);
}

export async function deleteSavedJob(id: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/jobs/saved/${id}`, {
    method: "DELETE",
  });
}

// =============================================================================
// Autopilot
// =============================================================================

export async function startAutopilot(payload: Record<string, any>): Promise<{ run_id: string; db_id: number; status: string }> {
  return apiFetch<{ run_id: string; db_id: number; status: string }>("/api/autopilot/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listAutopilotRuns(): Promise<AutopilotRun[]> {
  return apiFetch<AutopilotRun[]>("/api/autopilot/runs");
}

export async function getAutopilotRun(id: string): Promise<AutopilotRun> {
  return apiFetch<AutopilotRun>(`/api/autopilot/runs/${id}`);
}

// =============================================================================
// Applications (Kanban)
// =============================================================================

export async function createApplication(payload: Partial<Application>): Promise<{ id: number; application_id: string; status: string }> {
  return apiFetch<{ id: number; application_id: string; status: string }>("/api/autopilot/applications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listApplications(status?: string): Promise<Application[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<Application[]>(`/api/autopilot/applications${query}`);
}

export async function getApplication(id: string): Promise<Application> {
  return apiFetch<Application>(`/api/autopilot/applications/${id}`);
}

export async function updateApplication(id: string, payload: { status: string }): Promise<{ application_id: string; status: string }> {
  return apiFetch<{ application_id: string; status: string }>(`/api/autopilot/applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteApplication(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/autopilot/applications/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
}

export async function downloadApplicationResume(id: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/autopilot/applications/${id}/resume-docx`, {
    headers: getHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.blob();
}

// =============================================================================
// Autopilot Schedules
// =============================================================================

export async function createSchedule(payload: Partial<AutopilotSchedule>): Promise<{ id: number; schedule_id: string }> {
  return apiFetch<{ id: number; schedule_id: string }>("/api/autopilot/schedules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listSchedules(): Promise<AutopilotSchedule[]> {
  return apiFetch<AutopilotSchedule[]>("/api/autopilot/schedules");
}

export async function updateSchedule(id: string, payload: Partial<AutopilotSchedule>): Promise<{ schedule_id: string; status: string }> {
  return apiFetch<{ schedule_id: string; status: string }>(`/api/autopilot/schedules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteSchedule(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/autopilot/schedules/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
}

// =============================================================================
// Resume AI Enhancements
// =============================================================================

export async function optimizeResume(id: number | string, jobDescription?: string): Promise<Record<string, any>> {
  return apiFetch<Record<string, any>>(`/v1/resumes/${id}/optimize`, {
    method: "POST",
    body: JSON.stringify({ job_description: jobDescription }),
  });
}

export async function deepATS(id: number | string, jobDescription?: string): Promise<Record<string, any>> {
  return apiFetch<Record<string, any>>(`/v1/resumes/${id}/ats-deep`, {
    method: "POST",
    body: JSON.stringify({ job_description: jobDescription }),
  });
}

export async function exportResume(id: number | string): Promise<Blob> {
  const response = await fetch(`${API_URL}/v1/resumes/${id}/export`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.blob();
}

// =============================================================================
// Dashboard Stats
// =============================================================================

export async function dashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/api/dashboard/stats");
}

// =============================================================================
// Multipart Resume Upload (archive compatible)
// =============================================================================

export async function uploadResumeMultipart(file: File): Promise<Resume> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/api/resumes/upload`, {
    method: "POST",
    headers: {
      Authorization: getHeaders()["Authorization"] || "",
    },
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<Resume>;
}

// =============================================================================
// Re-export mode flag for consumers
// =============================================================================

export { USE_SELF_HOSTED };

// =============================================================================
// Cover Letter
// =============================================================================

export async function generateCoverLetter(payload: {
  resume_text: string;
  job_title: string;
  company: string;
  job_description: string;
  tone?: string;
}): Promise<{
  cover_letter: string;
  word_count: number;
  bullet_references: string[];
  tone: string;
  job_title: string;
  company_name: string;
}> {
  return apiFetch("/v1/cover-letter/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// Communication Suite
// =============================================================================

export async function fetchCommunicationSuggestions(): Promise<{
  suggestions: Array<{
    application_id: string;
    job_title: string;
    company_name: string;
    status: string;
    days_since: number;
    suggestion_type: string;
    timing_note: string;
  }>;
}> {
  return apiFetch("/v1/communication/suggestions");
}

export async function generateCommunication(payload: {
  comm_type: string;
  resume_text?: string;
  job_title: string;
  company_name: string;
  application_id?: string;
  recipient_name?: string;
  discussion_points?: string[];
  offer_details?: Record<string, any>;
  days_since?: number;
}): Promise<{
  subject: string;
  body: string;
  word_count: number;
  type: string;
  timing_note: string;
  talking_points?: string[];
}> {
  return apiFetch("/v1/communication/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// Interview AI
// =============================================================================

export async function generateInterviewPrep(payload: {
  application_id?: string;
  interview_type: string;
  resume_text?: string;
  job_title?: string;
  company_name?: string;
  job_description?: string;
}): Promise<{
  questions: Array<{
    question: string;
    category: string;
    source_bullet?: string;
    skill?: string;
    star_suggested?: Record<string, string>;
    suggested_answer?: string;
    suggested_approach?: string;
    requirements?: string;
  }>;
  interview_type: string;
  company_specific?: Record<string, any>;
  skills_tested?: string[];
}> {
  return apiFetch("/v1/interview/prep", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// =============================================================================
// Resume Knowledge Graph
// =============================================================================

export async function extractResumeKnowledgeGraph(resumeId: number | string): Promise<{
  entities: Record<string, any>;
  achievements: Array<Record<string, any>>;
  timeline: Array<Record<string, any>>;
  llm_enhanced: boolean;
}> {
  return apiFetch(`/v1/resumes/${resumeId}/knowledge-graph`, {
    method: "POST",
  });
}

// =============================================================================
// Profile Import (PDF/DOCX)
// =============================================================================

export async function importProfilePDF(file: File): Promise<{
  headline?: string;
  summary?: string;
  skills: string[];
  experience_years?: number;
  desired_roles: string[];
  locations: string[];
  companies: string[];
  job_titles: string[];
  certifications: string[];
}> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/v1/profile/import-pdf`, {
    method: "POST",
    headers: {
      Authorization: getHeaders()["Authorization"] || "",
    },
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// =============================================================================
// Career Intelligence
// =============================================================================

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

// =============================================================================
// Predictive Funnel Analytics
// =============================================================================

export interface ResumeVariant {
  id: number;
  resume_id: number;
  name: string;
  original_text: string;
  scores: {
    formatting_score: number;
    metrics_score: number;
    readability_score: number;
    keyword_score: number;
    overall_score: number;
  };
  pulls: number;
  conversions: number;
  created_at: string;
}

export interface BanditStat {
  variant_id: number;
  name: string;
  resume_title: string;
  pulls: number;
  conversions: number;
}

export async function createResumeVariant(resumeId: number | string, payload: { name: string; original_text: string }): Promise<ResumeVariant> {
  return apiFetch<ResumeVariant>(`/v1/resumes/${resumeId}/variants`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listResumeVariants(resumeId: number | string): Promise<ResumeVariant[]> {
  return apiFetch<ResumeVariant[]>(`/v1/resumes/${resumeId}/variants`);
}

export async function getFunnelData(): Promise<Record<string, number>> {
  return apiFetch<Record<string, number>>("/v1/analytics/funnel");
}

export async function getBanditStats(): Promise<BanditStat[]> {
  return apiFetch<BanditStat[]>("/v1/analytics/bandit-stats");
}

// =============================================================================
// Knowledge Hub (Omni-Save)
// =============================================================================

export interface SavedPost {
  id: string;
  user_id: string;
  url: string;
  note: string;
  source: string;
  title: string;
  summary: string;
  tags: string[];
  category: string;
  is_interview_related: boolean;
  created_at: string;
}

export async function listSaves(category?: string): Promise<SavedPost[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch<SavedPost[]>(`/saves${query}`);
}

export async function createSave(payload: { url: string; note?: string; source?: string }): Promise<SavedPost> {
  return apiFetch<SavedPost>("/saves", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteSave(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/saves/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
}

// =============================================================================
// Application Extra Features
// =============================================================================

export async function addApplicationNote(id: string, note: string): Promise<any> {
  return apiFetch<any>(`/applications/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function deleteApplicationNote(id: string, noteId: string): Promise<any> {
  const response = await fetch(`${API_URL}/applications/${id}/notes/${noteId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json().catch(() => ({ success: true }));
}

export async function getApplicationInterviewQuestions(id: string): Promise<any> {
  return apiFetch<any>(`/applications/${id}/interview-questions`, {
    method: "POST",
  });
}

export async function parseApplicationEmail(emailText: string): Promise<any> {
  return apiFetch<any>("/applications/parse-email", {
    method: "POST",
    body: JSON.stringify({ email_text: emailText }),
  });
}

export async function uploadApplicationVoice(id: string, audioBlob: Blob): Promise<any> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  const response = await fetch(`${API_URL}/applications/${id}/voice`, {
    method: "POST",
    headers: {
      Authorization: getHeaders()["Authorization"] || "",
    },
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// =============================================================================
// Gmail Integration
// =============================================================================

export interface GmailStatusResponse {
  enabled: boolean;
  connected: boolean;
  message?: string;
}

export async function getGmailStatus(): Promise<GmailStatusResponse> {
  return apiFetch<GmailStatusResponse>("/gmail/status");
}

export async function getGmailLogin(): Promise<{ auth_url: string }> {
  return apiFetch<{ auth_url: string }>("/gmail/login");
}

export async function syncGmail(): Promise<any> {
  return apiFetch<any>("/gmail/sync", {
    method: "POST",
  });
}

export async function disconnectGmail(): Promise<any> {
  return apiFetch<any>("/gmail/disconnect", {
    method: "POST",
  });
}



