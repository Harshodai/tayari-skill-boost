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
  unread?: boolean;
  is_unread?: boolean;
  unread_count?: number;
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

export interface MemoryControl {
  id: string;
  job_id: string;
  job_title?: string | null;
  company_name?: string | null;
  feedback_type: "liked" | "disliked" | "applied" | "skipped" | "saved" | string;
  feedback_source: "manual" | "auto_detected" | string;
  confidence: "user_confirmed" | "user_inferred" | "system_inferred" | string;
  is_active: boolean;
  expires_at?: string | null;
  corrected_at?: string | null;
  created_at?: string | null;
}

export async function listMemoryControls(limit = 100): Promise<MemoryControl[]> {
  const response = await apiFetch<{ controls: MemoryControl[] }>(`/v1/preferences/controls?limit=${Math.max(1, Math.min(limit, 200))}`);
  return response.controls || [];
}

export async function updateMemoryControl(
  controlId: string,
  input: { is_active?: boolean; confidence?: MemoryControl["confidence"]; expires_at?: string | null },
): Promise<MemoryControl> {
  const response = await apiFetch<{ control: MemoryControl }>(`/v1/preferences/controls/${encodeURIComponent(controlId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return response.control;
}

export async function deleteMemoryControl(controlId: string): Promise<{ deleted: boolean; control_id: string }> {
  return apiFetch<{ deleted: boolean; control_id: string }>(`/v1/preferences/controls/${encodeURIComponent(controlId)}`, {
    method: "DELETE",
  });
}

export interface PracticeOutcome {
  id: string;
  application_id?: string | null;
  practice_session_id: string;
  completion_status: "started" | "partial" | "completed" | "skipped" | string;
  confidence: number;
  interview_outcome: "unknown" | "no_interview" | "screen" | "technical" | "onsite" | "offer" | "rejected" | string;
  correction_note?: string | null;
  consent_acknowledged: boolean;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function recordPracticeOutcome(input: Omit<PracticeOutcome, "id" | "created_at" | "updated_at">): Promise<PracticeOutcome> {
  const response = await apiFetch<{ outcome: PracticeOutcome }>("/v1/preparation/outcomes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.outcome;
}

export async function listPracticeOutcomes(limit = 100): Promise<PracticeOutcome[]> {
  const response = await apiFetch<{ outcomes: PracticeOutcome[] }>(`/v1/preparation/outcomes?limit=${Math.max(1, Math.min(limit, 200))}`);
  return response.outcomes || [];
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

export interface GmailSyncOptions {
  query?: string;
  after?: string;
  before?: string;
  max_results?: number;
}

export async function syncGmail(options: GmailSyncOptions = {}): Promise<any> {
  return apiFetch<any>("/gmail/sync", {
    method: "POST",
    headers: { ...getHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(options),
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


export interface AutomationDefinition {
  id: string;
  name: string;
  objective: string;
  trigger_type: string;
  status: string;
  policy_version: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: string;
  definition_id: string;
  status: string;
  version: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationApproval {
  id: string;
  run_id?: string;
  action_type: string;
  risk_tier: string;
  summary: string;
  status: string;
  expires_at: string;
  decision_channel?: string;
  decided_at?: string;
  created_at: string;
}

export interface NotificationPreferences {
  email_enabled: boolean;
  email_address?: string;
  whatsapp_enabled: boolean;
  phone_e164?: string;
  whatsapp_wa_id?: string;
  whatsapp_verified?: boolean;
  whatsapp_opt_in: boolean;
  locale: string;
  quiet_hours: Record<string, unknown>;
  fallback_order: string[];
}

export async function startWhatsAppLink(phone_e164: string, consent: boolean): Promise<{ ok: boolean; expires_at: string; next: string; phone_e164: string; provider_message_id: string }> {
  return apiFetch("/v1/notification-preferences/whatsapp/link", {
    method: "POST",
    body: JSON.stringify({ phone_e164, consent }),
  });
}

export async function confirmWhatsAppLink(code: string): Promise<{ ok: boolean; whatsapp_enabled: boolean; whatsapp_opt_in: boolean }> {
  return apiFetch("/v1/notification-preferences/whatsapp/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function listAutomations(): Promise<{ automations: AutomationDefinition[] }> {
  return apiFetch<{ automations: AutomationDefinition[] }>("/v1/automations");
}

export async function createAutomation(payload: {
  name: string;
  objective: string;
  trigger_type: string;
  trigger_config?: Record<string, unknown>;
  tool_allowlist?: string[];
  approval_policy?: Record<string, unknown>;
  retention_days?: number;
  budget?: Record<string, unknown>;
}): Promise<{ id: string; status: string; approval_required: boolean }> {
  return apiFetch("/v1/automations", { method: "POST", body: JSON.stringify(payload) });
}

export async function createAutomationRun(automationId: string, idempotencyKey: string): Promise<AutomationRun & { approval_required: boolean }> {
  return apiFetch(`/v1/automations/${encodeURIComponent(automationId)}/runs`, {
    method: "POST",
    body: JSON.stringify({ idempotency_key: idempotencyKey }),
  });
}

export interface AutomationEvent {
  sequence_no?: number;
  event_id?: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}
export async function getAutomationRun(runId: string): Promise<AutomationRun> {
  return apiFetch<AutomationRun>(`/v1/automation-runs/${encodeURIComponent(runId)}`);
}
export async function listAutomationEvents(runId: string): Promise<{ events: AutomationEvent[] }> {
  return apiFetch<{ events: AutomationEvent[] }>(`/v1/automation-runs/${encodeURIComponent(runId)}/events`);
}
export async function listAutomationApprovals(): Promise<{ approvals: AutomationApproval[] }> {
  return apiFetch<{ approvals: AutomationApproval[] }>("/v1/approvals");
}

export async function decideAutomationApproval(id: string, decision: "approve" | "deny"): Promise<{ id: string; status: string; decision_channel: string }> {
  return apiFetch(`/v1/approvals/${encodeURIComponent(id)}/${decision}`, { method: "POST", body: JSON.stringify({}) });
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return apiFetch<NotificationPreferences>("/v1/notification-preferences");
}

export async function updateNotificationPreferences(payload: Partial<NotificationPreferences>): Promise<{ ok: boolean; whatsapp_opt_in: boolean }> {
  return apiFetch("/v1/notification-preferences", { method: "PUT", body: JSON.stringify(payload) });
}

export async function notifyApproval(id: string, channel: "email" | "whatsapp"): Promise<{ ok: boolean; delivery_status: string; provider: string }> {
  return apiFetch(`/v1/approvals/${encodeURIComponent(id)}/notify`, {
    method: "POST",
    body: JSON.stringify({ channel }),
  });
}
