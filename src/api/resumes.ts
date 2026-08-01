import { apiFetch, getHeaders, checkResponse, API_URL } from "./client";
import type {
  Resume,
  JobDescription,
  AnalysisResult,
  CreateResumeRequest,
  CreateJDRequest,
  AnalyzeRequest,
} from "./types";

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
  const response = await fetch(`${API_URL}/v1/resumes/${id}`, {
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

export async function listAnalysisHistory(): Promise<AnalysisResult[]> {
  return apiFetch<AnalysisResult[]>("/v1/analyze/history");
}

export async function getAnalysis(id: number | string): Promise<AnalysisResult> {
  return apiFetch<AnalysisResult>(`/v1/analyze/${id}`);
}

export async function optimizeResume(id: number | string, jobDescription?: string): Promise<Record<string, any>> {
  return apiFetch<Record<string, any>>(`/v1/resumes/${id}/optimize`, {
    method: "POST",
    body: JSON.stringify({ job_description: jobDescription }),
  });
}

export async function deepATS(id: number | string, jobDescription?: string): Promise<Record<string, any>> {
  return apiFetch<Record<string, any>>(`/v1/resumes/${id}/ats-deep`, {
    method: "POST",
    body: JSON.stringify({ job_description: jobDescription }),
  });
}

export async function exportResume(id: number | string): Promise<Blob> {
  const response = await fetch(`${API_URL}/v1/resumes/${id}/export`, {
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
    formatting_score: number;
    metrics_score: number;
    readability_score: number;
    keyword_score: number;
    overall_score: number;
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
