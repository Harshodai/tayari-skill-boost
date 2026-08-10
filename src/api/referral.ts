import { apiFetch } from "./client";

export type ReferralKind = "intro" | "referral" | "followup" | "thanks";

export interface ReferralDraftResult {
  fit_score: number;
  subject: string;
  email: string;
  linkedin: string;
  rationale: string;
}

export interface ReferralDraftPayload {
  contact: {
    name: string;
    title?: string;
    company?: string;
    relationship: string;
    notes?: string;
  };
  job: {
    title: string;
    company?: string;
    description?: string;
  };
  user_context: {
    full_name?: string;
    headline?: string;
    skills?: string[];
    proof_points?: string;
  };
  kind: ReferralKind;
}

export async function createReferralDraft(payload: ReferralDraftPayload): Promise<ReferralDraftResult> {
  return apiFetch<ReferralDraftResult>("/v1/referral/draft", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}