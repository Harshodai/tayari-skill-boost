import { apiFetchResponse } from "@/api";
import { apiFetch, getHeaders, checkResponse, API_URL } from "./client";
import type { Profile, DashboardStats } from "./types";
import type { PreferenceProfile } from "./jobs";

export async function getProfile(): Promise<Profile> {
  return apiFetch<Profile>("/v1/profile");
}

export async function updateProfile(payload: Partial<Profile>): Promise<{ updated_at: string }> {
  return apiFetch<{ updated_at: string }>("/v1/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function dashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/dashboard/stats");
}

export async function trendingSkills(): Promise<Array<{ skill: string; popularity: number }>> {
  return apiFetch<Array<{ skill: string; popularity: number }>>("/v1/career-intelligence/trending-skills");
}

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

export async function getChain(userId: string): Promise<ChainResponse> {
  return apiFetch<ChainResponse>(`/v1/chain/${encodeURIComponent(userId)}`);
}

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
  const response = await apiFetchResponse(`/v1/career-ops/portals/${portalId}`, {
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
  const response = await apiFetchResponse(`/v1/profile/import-pdf`, {
    method: "POST",
    headers: {
      Authorization: getHeaders()["Authorization"] || "",
    },
    body: formData,
  });
  await checkResponse(response);
  return response.json();
}

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
  provenance?: {
    classification?: "human_only" | "ai_assisted" | "ai_generated" | "ai_transformed" | "machine_imported" | "unknown" | "disputed";
    policy_version?: string;
  };

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
  const response = await apiFetchResponse(`/saves/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  await checkResponse(response);
}

export interface GmailStatusResponse {
  enabled: boolean;
  connected: boolean;
  email?: string;
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

export interface GoogleWorkspaceStatusResponse {
  enabled: boolean;
  connected: boolean;
  capability: string;
  read_only: boolean;
  message?: string;
}

export async function getGoogleCalendarStatus(): Promise<GoogleWorkspaceStatusResponse> {
  return apiFetch<GoogleWorkspaceStatusResponse>("/google/calendar/status");
}

export async function getGoogleCalendarLogin(): Promise<{ auth_url: string; scope: string; read_only: boolean }> {
  return apiFetch<{ auth_url: string; scope: string; read_only: boolean }>("/google/calendar/login");
}

export async function syncGoogleCalendar(): Promise<any> {
  return apiFetch<any>("/google/calendar/sync", { method: "POST" });
}

export async function disconnectGoogleCalendar(): Promise<any> {
  return apiFetch<any>("/google/calendar/disconnect", { method: "POST" });
}

export async function getGoogleDriveStatus(): Promise<GoogleWorkspaceStatusResponse> {
  return apiFetch<GoogleWorkspaceStatusResponse>("/google/drive/status");
}

export async function getGoogleDriveLogin(): Promise<{ auth_url: string; scope: string; read_only: boolean }> {
  return apiFetch<{ auth_url: string; scope: string; read_only: boolean }>("/google/drive/login");
}

export async function syncGoogleDrive(): Promise<any> {
  return apiFetch<any>("/google/drive/sync", { method: "POST" });
}

export async function disconnectGoogleDrive(): Promise<any> {
  return apiFetch<any>("/google/drive/disconnect", { method: "POST" });
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
