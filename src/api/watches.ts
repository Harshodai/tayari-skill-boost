import { apiFetch } from "./client";

export interface JobWatch {
  id: number;
  watch_id: string;
  user_id: string;
  query_title: string;
  location: string;
  salary_floor: number;
  schedule_tier: "hourly" | "daily" | "weekly" | string;
  is_active: boolean;
  last_run_at?: string | null;
  last_match_count?: number | null;
  created_at: string;
}

export async function listJobWatches(): Promise<JobWatch[]> {
  return apiFetch<JobWatch[]>("/v1/watches");
}

export async function createJobWatch(payload: {
  query_title: string;
  location?: string;
  salary_floor?: number;
  schedule_tier?: JobWatch["schedule_tier"];
}): Promise<JobWatch> {
  return apiFetch<JobWatch>("/v1/watches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateJobWatch(
  id: number | string,
  input: {
    query_title?: string;
    location?: string;
    salary_floor?: number;
    schedule_tier?: JobWatch["schedule_tier"];
    is_active?: boolean;
  }
): Promise<JobWatch> {
  return apiFetch<JobWatch>(`/v1/watches/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteJobWatch(id: number | string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/v1/watches/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}
