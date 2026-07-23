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

export type {
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
};

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

// ponytail: structured error so callers can branch on status; 401 always clears token + redirects.
export class ApiError extends Error {
  status: number;
  body: Record<string, unknown> | undefined;
  constructor(message: string, status: number, body?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function handleUnauthorized(): never {
  localStorage.removeItem("auth_token");
  window.location.href = "/auth?expired=true";
  throw new ApiError("Session expired", 401);
}

async function checkResponse(response: Response): Promise<void> {
  if (response.ok) return;
  if (response.status === 401) handleUnauthorized();
  const error = await response.json().catch(() => ({} as Record<string, unknown>));
  throw new ApiError(
    (error && (error.error as string)) || `HTTP ${response.status}`,
    response.status,
    error
  );
}

export async function apiFetch<T>(
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

  await checkResponse(response);
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
  await checkResponse(response);
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
  await checkResponse(response);
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
  return apiFetch<Record<string, any>>("/jobs/search", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function agentSearch(payload: Record<string, any>): Promise<any> {
  return apiFetch<any>("/jobs/agent-search", {
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

// =============================================================================
// Autopilot
// =============================================================================

export async function startAutopilot(payload: Record<string, any>): Promise<{ run_id: string; db_id: number; status: string }> {
  return apiFetch<{ run_id: string; db_id: number; status: string }>("/autopilot/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listAutopilotRuns(): Promise<AutopilotRun[]> {
  return apiFetch<AutopilotRun[]>("/autopilot/runs");
}

export async function getAutopilotRun(id: string): Promise<AutopilotRun> {
  return apiFetch<AutopilotRun>(`/autopilot/runs/${id}`);
}

// =============================================================================
// Applications (Kanban)
// =============================================================================

export async function createApplication(payload: Partial<Application>): Promise<{ id: number; application_id: string; status: string }> {
  return apiFetch<{ id: number; application_id: string; status: string }>("/autopilot/applications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listApplications(status?: string): Promise<Application[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<Application[]>(`/autopilot/applications${query}`);
}

export async function getApplication(id: string): Promise<Application> {
  return apiFetch<Application>(`/autopilot/applications/${id}`);
}

export async function updateApplication(id: string, payload: { status: string }): Promise<{ application_id: string; status: string }> {
  return apiFetch<{ application_id: string; status: string }>(`/autopilot/applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteApplication(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/autopilot/applications/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  await checkResponse(response);
}

export async function downloadApplicationResume(id: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/autopilot/applications/${id}/resume-docx`, {
    headers: getHeaders(),
  });
  await checkResponse(response);
  return response.blob();
}

// =============================================================================
// Autopilot Schedules
// =============================================================================

export async function createSchedule(payload: Partial<AutopilotSchedule>): Promise<{ id: number; schedule_id: string }> {
  return apiFetch<{ id: number; schedule_id: string }>("/autopilot/schedules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listSchedules(): Promise<AutopilotSchedule[]> {
  return apiFetch<AutopilotSchedule[]>("/autopilot/schedules");
}

export async function updateSchedule(id: string, payload: Partial<AutopilotSchedule>): Promise<{ schedule_id: string; status: string }> {
  return apiFetch<{ schedule_id: string; status: string }>(`/autopilot/schedules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteSchedule(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/autopilot/schedules/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  await checkResponse(response);
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
  await checkResponse(response);
  return response.blob();
}

// =============================================================================
// Dashboard Stats
// =============================================================================

export async function dashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/dashboard/stats");
}

// Trending skills endpoint
export async function trendingSkills(): Promise<Array<{skill: string; popularity: number}>> {
  return apiFetch<Array<{skill: string; popularity: number}>>("/v1/career-intelligence/trending-skills");
}

// =============================================================================
// Memory layer — conversations, preferences, feedback signals
// =============================================================================

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title?: string;
  messages: ConversationMessage[];
  summary?: string;
  context_type: string;
  related_job_id?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type FeedbackType = "liked" | "disliked" | "applied" | "skipped" | "saved";

export interface FeedbackEvent {
  job_id: string;
  job_title?: string;
  company_name?: string;
  feedback_type: FeedbackType;
  feedback_source?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface PreferenceProfile {
  user_id: string;
  preferred_titles: string[];
  preferred_companies: string[];
  counts: { liked: number; applied: number; skipped: number };
  skill_weights: Record<string, number>;
}

export async function listConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>("/v1/conversations");
}

export async function createConversation(payload: {
  title?: string;
  context_type?: string;
  related_job_id?: string;
  messages?: ConversationMessage[];
}): Promise<Conversation> {
  return apiFetch<Conversation>("/v1/conversations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getConversation(id: string): Promise<Conversation> {
  return apiFetch<Conversation>(`/v1/conversations/${id}`);
}

export async function appendConversationMessage(
  id: string,
  message: ConversationMessage
): Promise<Conversation> {
  return apiFetch<Conversation>(`/v1/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(message),
  });
}

export async function updateConversation(
  id: string,
  payload: { title?: string; context_type?: string; is_archived?: boolean }
): Promise<Conversation> {
  return apiFetch<Conversation>(`/v1/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteConversation(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/v1/conversations/${id}`, {
    method: "DELETE",
  });
}

export async function getPreferences(): Promise<PreferenceProfile> {
  return apiFetch<PreferenceProfile>("/v1/preferences");
}

export async function refreshPreferences(): Promise<PreferenceProfile> {
  return apiFetch<PreferenceProfile>("/v1/preferences/refresh", { method: "POST" });
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

// =============================================================================
// K5 — Observable Chain (7-stage pipeline strip)
// =============================================================================

export interface ChainStage {
  key: string;
  label: string;
  href: string;
  count: number;
}

export interface ChainResponse {
  stages: ChainStage[];
  current_stage: string;
  next_action: string;
  stage_count: number;
}

// ponytail: {userId} path param is shape-only server-side (auth context is source of truth, prevents IDOR),
// but we still send it so the route matches. Fault-tolerant: a missing stage degrades to count 0, never 5xx.
export async function getChain(userId: string): Promise<ChainResponse> {
  return apiFetch<ChainResponse>(`/v1/chain/${encodeURIComponent(userId)}`);
}

// =============================================================================
// Multipart Resume Upload (archive compatible)
// =============================================================================

export async function uploadResumeMultipart(file: File): Promise<Resume> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/resumes/upload`, {
    method: "POST",
    headers: {
      Authorization: getHeaders()["Authorization"] || "",
    },
    body: formData,
  });
  await checkResponse(response);
  return response.json() as Promise<Resume>;
}

// =============================================================================
// Re-export mode flag for consumers
// =============================================================================

export { API_URL, USE_SELF_HOSTED };

// =============================================================================
// Cover Letter
// =============================================================================

export async function generateCoverLetter(payload: {
  resume_text: string;
  job_title: string;
  company: string;
  job_description: string;
  tone?: string;
  personal_notes?: string;
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
  comm_id?: number;
}> {
  return apiFetch("/v1/communication/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Audit #6 — response-rate tracking. Mark a persisted comm as responded /
// no_response, and fetch per-type aggregates for the response-rate card.
export async function updateCommunicationResponse(
  commId: number,
  responseStatus: "responded" | "no_response" | "sent",
): Promise<{ ok: boolean; response_status: string }> {
  return apiFetch(`/v1/communications/${commId}/response`, {
    method: "PATCH",
    body: JSON.stringify({ response_status: responseStatus }),
  });
}

export interface CommTypeStat {
  comm_type: string;
  total: number;
  responded: number;
  no_response: number;
  response_rate: number;
}

export async function getCommunicationStats(): Promise<{ stats: CommTypeStat[] }> {
  return apiFetch("/v1/communication/stats");
}

// =============================================================================
// Career Ops
// =============================================================================

export interface CareerOpsPortal {
  id?: number;
  name: string;
  careers_url: string;
  provider: string;
  enabled: boolean;
  keywords_override?: string[];
}

export interface CareerOpsFollowup {
  id: number;
  application_id: string;
  company: string;
  role: string;
  stage: string;
  age_days: number;
  followups_sent: number;
  urgency: string;
  reason: string;
  draft_subject: string;
  draft_body: string;
}

export interface CareerOpsStory {
  requirement: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
}

export async function listCareerOpsPortals(): Promise<{ portals: CareerOpsPortal[] }> {
  return apiFetch("/v1/career-ops/portals");
}

export async function createCareerOpsPortal(payload: { name: string; careers_url: string }): Promise<CareerOpsPortal> {
  return apiFetch<CareerOpsPortal>("/v1/career-ops/portals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCareerOpsPortal(portalId: number, payload: Partial<CareerOpsPortal>): Promise<CareerOpsPortal> {
  return apiFetch<CareerOpsPortal>(`/v1/career-ops/portals/${portalId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCareerOpsPortal(portalId: number): Promise<void> {
  const response = await fetch(`${API_URL}/v1/career-ops/portals/${portalId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  await checkResponse(response);
}

export async function scanCareerOpsPortals(): Promise<{ jobs: any[] }> {
  return apiFetch("/v1/career-ops/scan", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getCareerOpsPatterns(): Promise<any> {
  return apiFetch("/v1/career-ops/patterns");
}

export async function listCareerOpsFollowups(): Promise<{ followups: CareerOpsFollowup[] }> {
  return apiFetch("/v1/career-ops/followups");
}

export async function actionCareerOpsFollowup(applicationId: string, payload: { contact?: string; notes?: string }): Promise<any> {
  return apiFetch("/v1/career-ops/followups/action", {
    method: "POST",
    body: JSON.stringify({ application_id: applicationId, ...payload }),
  });
}

export async function getCareerOpsStoryBank(): Promise<{ stories: CareerOpsStory[] }> {
  return apiFetch("/v1/career-ops/story-bank");
}

export async function saveCareerOpsStoryBank(stories: CareerOpsStory[]): Promise<any> {
  return apiFetch("/v1/career-ops/story-bank", {
    method: "POST",
    body: JSON.stringify({ stories }),
  });
}

export async function deleteCareerOpsStoryBank(index: number): Promise<any> {
  return apiFetch(`/v1/career-ops/story-bank/${index}`, {
    method: "DELETE",
  });
}

export async function getCareerOpsStats(): Promise<Record<string, any>> {
  return apiFetch("/v1/career-ops/stats");
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
  await checkResponse(response);
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
  await checkResponse(response);
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
  await checkResponse(response);
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
  await checkResponse(response);
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

export async function listAPIKeys(): Promise<any> {
  return apiFetch<any>("/api-keys");
}

export async function createAPIKey(name: string, rateLimit?: number): Promise<any> {
  return apiFetch<any>("/api-keys", {
    method: "POST",
    body: JSON.stringify({ name, rate_limit: rateLimit }),
  });
}

export async function revokeAPIKey(id: number): Promise<any> {
  return apiFetch<any>(`/api-keys/${id}`, {
    method: "DELETE",
  });
}

export async function getAPIKeyUsage(id: number): Promise<any> {
  return apiFetch<any>(`/api-keys/usage/${id}`);
}

export interface OneShotExecuteRequest {
  user_id?: string;
  job_title: string;
  company_name?: string;
  job_description: string;
  resume_text: string;
  target_url?: string;
  tone?: string;
}

export interface OneShotExecuteResponse {
  overall_fit_score: number;
  audit: {
    initial_score: number;
    post_tailoring_score: number;
    matched_keywords: string[];
    missing_keywords: string[];
    relevance_level: string;
  };
  tailored_resume: {
    optimized_text: string;
    changes_made: string[];
    word_count: number;
    typst_code?: string;
  };
  cover_letter: string;
  auto_apply_payload: {
    target_url: string;
    stealth_readiness: string;
    field_mapping: Record<string, string>;
    shadow_approval_required: boolean;
  };
  recruiter_intel: {
    company_name: string;
    domain: string;
    target_roles: string[];
    verified_email_patterns: string[];
    email_draft: string;
    linkedin_draft: string;
    outreach_strategy: string;
  };
  interview_kit: Record<string, any>;
  proof_vault: any[];
}

export async function executeOneShotPipeline(payload: OneShotExecuteRequest): Promise<OneShotExecuteResponse> {
  return apiFetch<OneShotExecuteResponse>("/v1/one-shot/execute", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function simulateAtsParsing(resumeText: string): Promise<any> {
  return apiFetch<any>("/v1/ats/simulate", {
    method: "POST",
    body: JSON.stringify({ resume_text: resumeText }),
  });
}

export async function fetchInterviewCopilotHint(interviewerTranscript: string, role?: string): Promise<any> {
  return apiFetch<any>("/v1/interview/copilot-hint", {
    method: "POST",
    body: JSON.stringify({ interviewer_transcript: interviewerTranscript, target_role: role }),
  });
}

export async function calculateOfferFinancials(offerData: any): Promise<any> {
  return apiFetch<any>("/v1/offer/calculate", {
    method: "POST",
    body: JSON.stringify(offerData),
  });
}

export async function fetchCandidateAnswers(): Promise<any> {
  return apiFetch<any>("/v1/candidate/answers");
}




