import { apiFetch } from "@/api";

export type InterviewExperienceCategory =
  | "behavioral"
  | "technical"
  | "system_design"
  | "culture"
  | "hr"
  | "other";

export type InterviewExperienceVisibility = "private" | "connections" | "public";

export interface SharedInterviewExperience {
  id: string;
  user_id: string;
  company: string;
  role: string;
  question_text: string;
  answer_text: string;
  category: InterviewExperienceCategory;
  visibility: InterviewExperienceVisibility;
  upvotes: number;
  created_at: string;
}

export interface CreateSharedInterviewExperiencePayload {
  company: string;
  role: string;
  question_text: string;
  answer_text: string;
  category: InterviewExperienceCategory;
  visibility: InterviewExperienceVisibility;
}

export function listSharedInterviewExperiences(company = "") {
  const query = company ? `?company=${encodeURIComponent(company)}` : "";
  return apiFetch<SharedInterviewExperience[]>(`/v1/feed/interview-questions${query}`);
}

export function createSharedInterviewExperience(payload: CreateSharedInterviewExperiencePayload) {
  return apiFetch<{ id: string }>("/v1/interview-questions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function upvoteSharedInterviewExperience(id: string) {
  return apiFetch<{ upvoted: boolean; upvotes: number }>(`/v1/interview-questions/${id}/upvote`, {
    method: "POST",
  });
}
