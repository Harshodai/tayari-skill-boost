import { apiFetch } from "./client";

export interface CoverLetter {
  id: string;
  user_id: string;
  job_title: string;
  company_name: string;
  content: string;
  job_url?: string;
  resume_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCoverLetterPayload {
  job_title: string;
  company_name: string;
  content: string;
  job_url?: string;
  resume_id?: string | null;
}

export async function listCoverLetters(): Promise<CoverLetter[]> {
  return apiFetch<CoverLetter[]>("/v1/cover-letters");
}

export async function getCoverLetter(id: string): Promise<CoverLetter> {
  return apiFetch<CoverLetter>(`/v1/cover-letters/${id}`);
}

export async function createCoverLetter(payload: CreateCoverLetterPayload): Promise<CoverLetter> {
  return apiFetch<CoverLetter>("/v1/cover-letters", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteCoverLetter(id: string): Promise<{ status: string; id: string }> {
  return apiFetch<{ status: string; id: string }>(`/v1/cover-letters/${id}`, {
    method: "DELETE",
  });
}
