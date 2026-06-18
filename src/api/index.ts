import type {
  Resume,
  JobDescription,
  AnalysisResult,
  CreateResumeRequest,
  CreateJDRequest,
  AnalyzeRequest,
} from "./types";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const USE_SELF_HOSTED = import.meta.env.VITE_USE_SELF_HOSTED === "true";

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// =============================================================================
// Resumes
// =============================================================================

export async function createResume(
  payload: CreateResumeRequest
): Promise<Resume> {
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

export async function deleteResume(
  id: number | string
): Promise<void> {
  const response = await fetch(`${API_URL}/v1/resumes/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
}

// =============================================================================
// Job Descriptions
// =============================================================================

export async function createJD(payload: CreateJDRequest): Promise<JobDescription> {
  return apiFetch<JobDescription>("/v1/job-descriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listJDs(): Promise<JobDescription[]> {
  return apiFetch<JobDescription[]>("/v1/job-descriptions");
}

export async function getJD(id: number | string): Promise<JobDescription> {
  return apiFetch<JobDescription>(`/v1/job-descriptions/${id}`);
}

export async function updateJD(
  id: number | string,
  payload: CreateJDRequest
): Promise<JobDescription> {
  return apiFetch<JobDescription>(`/v1/job-descriptions/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteJD(id: number | string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/job-descriptions/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
}

// =============================================================================
// Analysis
// =============================================================================

export async function analyzeResume(
  payload: AnalyzeRequest
): Promise<Record<string, any>> {
  return apiFetch<Record<string, any>>("/v1/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listAnalysisHistory(): Promise<AnalysisResult[]> {
  return apiFetch<AnalysisResult[]>("/v1/analyze/history");
}

export async function getAnalysis(
  id: number | string
): Promise<AnalysisResult> {
  return apiFetch<AnalysisResult>(`/v1/analyze/${id}`);
}

// =============================================================================
// Re-export mode flag for consumers
// =============================================================================

export { USE_SELF_HOSTED };
