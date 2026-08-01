import { apiFetch } from "./client";

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

export async function matchCandidateBank(questionText: string, customQa?: Record<string, string>): Promise<any> {
  return apiFetch<any>("/v1/candidate-bank/match", {
    method: "POST",
    body: JSON.stringify({ question_text: questionText, custom_qa: customQa || {} }),
  });
}
