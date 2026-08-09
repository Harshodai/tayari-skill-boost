import { apiFetch } from "./client";

export interface VerificationStatus {
  status: "unverified" | "verified";
  truthful_score: number | null;
  red_flags: string[];
  screening_score: number | null;
  strengths: string[];
  gaps: string[];
  sample_questions: string[];
  verified_at: string | null;
}

export async function submitVerification(resumeText: string): Promise<VerificationStatus> {
  return apiFetch<VerificationStatus>("/v1/verification/submit", {
    method: "POST",
    body: JSON.stringify({ resume_text: resumeText }),
  });
}

export async function getVerificationStatus(): Promise<VerificationStatus> {
  return apiFetch<VerificationStatus>("/v1/verification/status");
}