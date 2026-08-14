import { apiFetchResponse } from "@/api";
import { apiFetch, API_URL, getHeaders } from "./client";

function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return "SRC-" + Math.abs(hash).toString(36).padStart(6, "0");
}

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

export interface SavedArticleItem {
  id: string;
  title: string;
  author: string;
  platform: 'substack' | 'medium' | 'linkedin' | 'custom_url';
  category: string;
  summary: string[];
  url: string;
  saved_at: string;
}

interface SavedSourceResponse {
  id?: string;
  canonical_url?: string;
  title?: string;
  author?: string;
  source_platform?: SavedArticleItem['platform'];
  primary_category?: string;
  summary_bullets?: string[];
  saved_at?: string;
}

function formatSavedSource(source: SavedSourceResponse): SavedArticleItem {
  return {
    id: source.id || stableHash(source.canonical_url || source.title || "unknown"),
    title: source.title || "Saved Source",
    author: source.author || "Unknown",
    platform: source.source_platform || "custom_url",
    category: source.primary_category || "Uncategorised",
    summary: source.summary_bullets || [],
    url: source.canonical_url || "#",
    saved_at: source.saved_at || "Recently",
  };
}

export async function fetchSavedArticles(): Promise<{ success: boolean; sources: SavedArticleItem[] }> {
  return apiFetch<{ success: boolean; sources: SavedSourceResponse[] }>("/v1/saves", {
    method: "GET",
  }).then((res) => ({ success: true, sources: (res.sources || []).map(formatSavedSource) }));
}

export async function importPublicArticle(url: string): Promise<{ success: boolean; source: SavedArticleItem }> {
  return apiFetch<{ success: boolean; source: SavedSourceResponse }>("/v1/saves/import", {
    method: "POST",
    body: JSON.stringify({ url: url.trim() }),
  }).then((res) => ({ success: res.success, source: formatSavedSource(res.source) }));
}

export async function deleteSavedArticle(sourceId: string): Promise<{ success: boolean; deleted: boolean; source_id: string }> {
  return apiFetch<{ success: boolean; deleted: boolean; source_id: string }>(`/v1/saves/${encodeURIComponent(sourceId)}`, {
    method: "DELETE",
  });
}

/** @deprecated Use importPublicArticle for one candidate-selected public URL. */
export async function syncSavedPosts(platforms?: string[], url?: string): Promise<{ success: boolean; count: number; sources: SavedArticleItem[] }> {
  return apiFetch<{ success: boolean; count: number; sources: SavedSourceResponse[] }>("/v1/saves/sync", {
    method: "POST",
    body: JSON.stringify({ platforms: platforms || [], urls: url?.trim() ? [url.trim()] : [] }),
  }).then((res) => ({
    success: res.success,
    count: res.count || 0,
    sources: (res.sources || []).map(formatSavedSource),
  }));
}

export interface KnowledgeHubQueryResponse {
  answer: string;
  citations: Array<{
    tag: string;
    source_id?: string;
    title: string;
    author: string;
    url: string;
    excerpt?: string;
  }>;
}

export async function queryKnowledgeHub(query: string): Promise<KnowledgeHubQueryResponse> {
  return apiFetch<KnowledgeHubQueryResponse>("/v1/knowledge-hub/query", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}


export interface CopilotStreamEvent {
  type: "question_type" | "hints" | "star" | "metrics" | "done" | "error";
  value?: unknown;
  error?: string;
  message?: string;
}

// ponytail: SSE over the Go gateway — fetch + ReadableStream parse, no
// EventSource (POST body required). Progressive events surface as they arrive.
export async function streamInterviewCopilotHints(
  payload: Record<string, unknown>,
  onEvent: (event: CopilotStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await apiFetchResponse(`/v1/interview/copilot/stream`, {
    method: "POST",
    headers: { ...getHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text ? `HTTP ${response.status}: ${text}` : `HTTP ${response.status}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming unsupported");
  const decoder = new TextDecoder();
  let buffer = "";
  const parseFrame = (frame: string) => {
    const line = frame.split("\n").find((l) => l.startsWith("data:"));
    if (!line) return;
    const payload = line.slice("data:".length).trimStart();
    if (!payload) return;
    try {
      onEvent(JSON.parse(payload) as CopilotStreamEvent);
    } catch {
      // skip malformed frames
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      parseFrame(chunk);
    }
  }
  parseFrame(buffer);
}
