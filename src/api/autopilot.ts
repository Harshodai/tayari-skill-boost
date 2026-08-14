import { apiFetch } from "./client";
import type { AutopilotRun, Application, AutopilotSchedule } from "./types";

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

export async function createApplication(payload: Partial<Application>): Promise<{ id: number; application_id: string; status: string }> {
  return apiFetch<{ id: number; application_id: string; status: string }>("/applications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listApplications(status?: string): Promise<Application[]> {
  const query = status ? `?stage=${encodeURIComponent(status)}` : "";
  return apiFetch<Application[]>(`/applications${query}`);
}

export async function getApplication(id: string): Promise<Application> {
  return apiFetch<Application>(`/applications/${id}`);
}

export async function updateApplication(id: string, payload: { status: string }): Promise<{ application_id: string; status: string }> {
  return apiFetch<{ application_id: string; status: string }>(`/applications/${id}/stage`, {
    method: "PATCH",
    body: JSON.stringify({ stage: payload.status }),
  });
}

export async function deleteApplication(id: string): Promise<void> {
  return apiFetch<void>(`/applications/${id}`, {
    method: "DELETE",
  });
}

export async function downloadApplicationResume(id: string): Promise<Blob> {
  return apiFetch<Blob>(`/applications/${id}/resume-docx`, {
    asBlob: true,
  });
}

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
  return apiFetch<void>(`/autopilot/schedules/${id}`, {
    method: "DELETE",
  });
}

export async function addApplicationNote(id: string, note: string): Promise<any> {
  return apiFetch<any>(`/applications/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ text: note }),
  });
}

export async function deleteApplicationNote(id: string, noteId: string): Promise<any> {
  return apiFetch<any>(`/applications/${id}/notes/${noteId}`, {
    method: "DELETE",
  });
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
  return apiFetch<any>(`/applications/${id}/voice`, {
    method: "POST",
    body: formData,
  });
}

export interface OneShotExecuteRequest {
  user_id?: string;
  job_title: string;
  company_name?: string;
  job_description: string;
  resume_text: string;
  target_url?: string;
  application_id?: string;
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
    target_url: string | null;
    stealth_readiness: string;
    field_mapping: Record<string, string | null>;
    answer_version?: number | null;
    answer_records?: Array<Record<string, unknown>>;
    unresolved_sensitive_fields?: string[];
    shadow_approval_required: boolean;
    submission_blocked?: boolean;
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

export interface ApprovalUpdateRequest {
  status: "approved" | "rejected";
  reviewer_comment?: string;
  form_fields?: Record<string, string>;
}

export async function updateApproval(
  approvalId: string,
  payload: ApprovalUpdateRequest
): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/v1/approvals/${approvalId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
