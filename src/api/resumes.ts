import { apiFetchResponse } from "@/api";
import { apiFetch, getHeaders, checkResponse, API_URL } from "./client";
import type {
  Resume,
  JobDescription,
  AnalysisResult,
  CreateResumeRequest,
  CreateJDRequest,
  AnalyzeRequest,
  ImportedJobDescription,
} from "./types";
import type { ParsedResume, ResumeAnalysisResult } from "../types/resume";

export async function createResume(payload: CreateResumeRequest): Promise<Resume> {
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

export async function deleteResume(id: number | string): Promise<void> {
  const response = await apiFetchResponse(`/v1/resumes/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  await checkResponse(response);
}

export async function uploadResumeMultipart(file: File): Promise<Resume> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<Resume>("/v1/resumes/upload", {
    method: "POST",
    body: formData,
  });
}

export async function analyzeResume(payload: AnalyzeRequest): Promise<Record<string, any>> {
  return apiFetch<Record<string, any>>("/v1/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function importJobDescription(url: string): Promise<ImportedJobDescription> {
  return apiFetch<ImportedJobDescription>("/v1/job-descriptions/import", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function listAnalysisHistory(): Promise<AnalysisResult[]> {
  return apiFetch<AnalysisResult[]>("/v1/analyze/history");
}

export async function getAnalysis(id: number | string): Promise<AnalysisResult> {
  return apiFetch<AnalysisResult>(`/v1/analyze/${id}`);
}

export interface OptimizeResumeOptions {
  jobDescription?: string;
  customInstructions?: string;
  targetRole?: string;
  jdUrl?: string;
}

export async function optimizeResume(id: number | string, opts?: OptimizeResumeOptions): Promise<Record<string, any>> {
  return apiFetch<Record<string, any>>(`/v1/resumes/${id}/optimize`, {
    method: "POST",
    body: JSON.stringify({
      job_description: opts?.jobDescription,
      custom_instructions: opts?.customInstructions,
      target_role: opts?.targetRole,
      jd_url: opts?.jdUrl,
    }),
  });
}

export async function deepATS(id: number | string, jobDescription?: string): Promise<Record<string, any>> {
  return apiFetch<Record<string, any>>(`/v1/resumes/${id}/ats-deep`, {
    method: "POST",
    body: JSON.stringify({ job_description: jobDescription }),
  });
}

// ponytail: snake_case analysis matches the Python request contract exactly —
// the UI's ResumeAnalysisResult is camelCase, so mapping happens here in one place.
export interface GenerateResumePdfAnalysis {
  overall_score: number;
  missing_keywords: string[];
  summary_recommendation: string;
}

export interface GenerateResumePdfPayload {
  resume_text: string;
  profile_data: ParsedResume | null;
  analysis: GenerateResumePdfAnalysis;
  applied_suggestions: string[];
  job_description?: string;
  template: string;
}

export interface GenerateResumePdfResponse {
  pdf_base64: string;
}

export interface BuildGenerateResumePdfPayloadArgs {
  resumeText: string;
  profileData: ParsedResume | null;
  analysis: ResumeAnalysisResult;
  appliedSuggestions: string[];
  jobDescription?: string;
  template: string;
}

export function buildGenerateResumePdfPayload({
  resumeText,
  profileData,
  analysis,
  appliedSuggestions,
  jobDescription,
  template,
}: BuildGenerateResumePdfPayloadArgs): GenerateResumePdfPayload {
  return {
    resume_text: resumeText,
    profile_data: profileData,
    analysis: {
      overall_score: analysis.overallScore,
      missing_keywords: analysis.missingKeywords,
      summary_recommendation: analysis.summaryRecommendation,
    },
    applied_suggestions: appliedSuggestions,
    job_description: jobDescription,
    template,
  };
}

export async function generateResumePdf(payload: GenerateResumePdfPayload): Promise<GenerateResumePdfResponse> {
  return apiFetch<GenerateResumePdfResponse>("/v1/resumes/generate-pdf", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function exportResume(id: number | string): Promise<Blob> {
  const response = await apiFetchResponse(`/v1/resumes/${id}/export`, {
    method: "POST",
    headers: getHeaders(),
  });
  await checkResponse(response);
  return response.blob();
}

export async function simulateAtsParsing(resumeText: string): Promise<any> {
  return apiFetch<any>("/v1/ats/simulate", {
    method: "POST",
    body: JSON.stringify({ resume_text: resumeText }),
  });
}

export async function verifyResumeTruthfulness(originalText: string, optimizedText: string): Promise<any> {
  return apiFetch<any>("/v1/guardrails/truth-check", {
    method: "POST",
    body: JSON.stringify({ original_text: originalText, optimized_text: optimizedText }),
  });
}

export interface ResumeVariant {
  id: number;
  resume_id: number;
  name: string;
  original_text: string;
  scores: {
    status?: "available" | "unavailable" | string;
    source?: string;
    error?: string;
    message?: string;
    formatting_score?: number;
    metrics_score?: number;
    readability_score?: number;
    keyword_score?: number;
    overall_score?: number;
  };
  pulls: number;
  conversions: number;
  created_at: string;
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

export interface BanditStat {
  variant_id: number;
  name: string;
  resume_title: string;
  pulls: number;
  conversions: number;
}

export async function getFunnelData(): Promise<Record<string, number>> {
  return apiFetch<Record<string, number>>("/v1/analytics/funnel");
}

export async function getBanditStats(): Promise<BanditStat[]> {
  return apiFetch<BanditStat[]>("/v1/analytics/bandit-stats");
}
