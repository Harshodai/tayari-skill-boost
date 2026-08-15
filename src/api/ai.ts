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
  offer_details?: Record<string, unknown>;
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
  company_specific?: Record<string, unknown>;
  skills_tested?: string[];
}> {
  return apiFetch("/v1/interview/prep", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function extractResumeKnowledgeGraph(resumeId: number | string): Promise<{
  entities: Record<string, unknown>;
  achievements: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
  llm_enhanced: boolean;
}> {
  return apiFetch(`/v1/resumes/${resumeId}/knowledge-graph`, {
    method: "POST",
  });
}

export async function fetchInterviewCopilotHint(interviewerTranscript: string, role?: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/v1/interview/copilot-hint", {
    method: "POST",
    body: JSON.stringify({ interviewer_transcript: interviewerTranscript, target_role: role }),
  });
}

export async function calculateOfferFinancials(offerData: Record<string, unknown>): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/v1/offer/calculate", {
    method: "POST",
    body: JSON.stringify(offerData),
  });
}

export async function fetchCandidateAnswers(): Promise<{ answers: Record<string, unknown>; version?: number | null; unresolved_sensitive_fields?: string[] }> {
  return apiFetch<{ answers: Record<string, unknown>; version?: number | null; unresolved_sensitive_fields?: string[] }>("/v1/candidate/answers");
}
export async function saveCandidateAnswers(
  answers: Record<string, string>,
  options: { applicationId?: string; confirmSensitive?: boolean } = {},
): Promise<any> {
  return apiFetch<any>("/v1/candidate/answers", {
    method: "PUT",
    body: JSON.stringify({
      answers,
      application_id: options.applicationId,
      confirm_sensitive: options.confirmSensitive ?? false,
    }),
  });
}

export async function matchCandidateBank(questionText: string, customQa?: Record<string, string>): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/v1/candidate-bank/match", {
    method: "POST",
    body: JSON.stringify({ question_text: questionText, custom_qa: customQa || {} }),
  });
}

export interface NlpMetadata {
  category: string;
  topics: string[];
  keyphrases: string[];
  entities: string[];
  summary: string | null;
  confidence: number;
  needs_review: boolean;
  status: "ready" | "needs_review" | "unavailable" | string;
  model: string;
  version: string;
}

export interface SavedArticleItem {
  id: string;
  title: string;
  author: string;
  platform: 'substack' | 'medium' | 'linkedin' | 'instagram' | 'custom_url';
  category: string;
  summary: string[];
  url: string;
  saved_at: string;
  nlp: NlpMetadata;
  tags: string[];
  keyphrases: string[];
  entities: string[];
}

interface SavedSourceResponse {
  id?: string;
  canonical_url?: string;
  title?: string;
  author?: string;
  source_platform?: SavedArticleItem['platform'];
  primary_category?: string;
  secondary_tags?: string[];
  summary_bullets?: string[];
  nlp_metadata?: Partial<NlpMetadata>;
  saved_at?: string;
  highlight_count?: number;
  context_count?: number;
  raw_content?: string;
  clean_markdown?: string;
}

function formatSavedSource(source: SavedSourceResponse): SavedArticleItem {
  const nlp: NlpMetadata = {
    category: source.nlp_metadata?.category || source.primary_category || "Uncategorised",
    topics: source.nlp_metadata?.topics || source.secondary_tags || [],
    keyphrases: source.nlp_metadata?.keyphrases || [],
    entities: source.nlp_metadata?.entities || [],
    summary: source.nlp_metadata?.summary || source.summary_bullets?.[0] || null,
    confidence: source.nlp_metadata?.confidence || 0,
    needs_review: source.nlp_metadata?.needs_review ?? true,
    status: source.nlp_metadata?.status || "needs_review",
    model: source.nlp_metadata?.model || "unavailable",
    version: source.nlp_metadata?.version || "nlp-v1",
  };
  return {
    id: source.id || stableHash(source.canonical_url || source.title || "unknown"),
    title: source.title || "Saved Source",
    author: source.author || "Unknown",
    platform: source.source_platform || "custom_url",
    category: nlp.category,
    summary: source.summary_bullets || (nlp.summary ? [nlp.summary] : []),
    url: source.canonical_url || "#",
    saved_at: source.saved_at || "Recently",
    nlp,
    tags: nlp.topics,
    keyphrases: nlp.keyphrases,
    entities: nlp.entities,
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

export interface KnowledgeHubCitation {
  tag: string;
  source_id?: string;
  title: string;
  author: string;
  url: string;
  excerpt?: string;
  highlight_id?: string;
  evidence_type?: "highlight" | "source_chunk" | string;
}

export interface KnowledgeHubQueryResponse {
  query?: string;
  answer: string;
  citations: KnowledgeHubCitation[];
  retrieved_count?: number;
  has_evidence?: boolean;
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


export type OmniSaveHighlightAction = "evidence" | "question" | "flashcard" | "application";

export interface SourceHighlight {
  id: string;
  source_id: string;
  user_id?: string;
  text_excerpt: string;
  start_offset?: number | null;
  end_offset?: number | null;
  note: string;
  color: string;
  action_type: OmniSaveHighlightAction;
  created_at?: string | null;
  updated_at?: string | null;
}

export type CareerContextType = "role" | "company" | "skill" | "application" | "practice" | "interview_stage";

export interface ContextLink {
  id: string;
  source_id: string;
  user_id?: string;
  context_type: CareerContextType;
  context_id?: string | null;
  context_label: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CareerContextGraphSource {
  id: string;
  title: string;
  author?: string | null;
  platform: SavedArticleItem["platform"] | string;
  url: string;
  category?: string | null;
  tags: string[];
  nlp: Partial<NlpMetadata>;
  saved_at?: string | null;
  highlight_count: number;
}

export interface CareerContextGraphNode {
  id: string;
  type: "source" | CareerContextType | string;
  label: string;
  source?: CareerContextGraphSource;
}

export interface CareerContextGraphEdge {
  source: string;
  target: string;
  type: CareerContextType | string;
}

export interface CareerContextGraph {
  filters: { skill?: string | null; role?: string | null };
  sources: CareerContextGraphSource[];
  context_links: ContextLink[];
  highlights: SourceHighlight[];
  questions: SourceHighlight[];
  practice_sessions: Array<Record<string, unknown>>;
  nodes: CareerContextGraphNode[];
  edges: CareerContextGraphEdge[];
}

export interface CreateSourceHighlightInput {
  text_excerpt: string;
  start_offset?: number;
  end_offset?: number;
  note?: string;
  color?: string;
  action_type?: OmniSaveHighlightAction;
}

export async function createSourceHighlight(
  sourceId: string,
  input: CreateSourceHighlightInput,
): Promise<SourceHighlight> {
  const response = await apiFetch<{ success: boolean; highlight: SourceHighlight }>(
    `/v1/saves/${encodeURIComponent(sourceId)}/highlights`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return response.highlight;
}

export async function listSourceHighlights(sourceId: string): Promise<SourceHighlight[]> {
  const response = await apiFetch<{ success: boolean; highlights: SourceHighlight[] }>(
    `/v1/saves/${encodeURIComponent(sourceId)}/highlights`,
  );
  return response.highlights || [];
}

export async function deleteSourceHighlight(sourceId: string, highlightId: string): Promise<void> {
  await apiFetch(`/v1/saves/${encodeURIComponent(sourceId)}/highlights/${encodeURIComponent(highlightId)}`, {
    method: "DELETE",
  });
}

export async function linkSourceContext(
  sourceId: string,
  input: { context_type: CareerContextType; context_id?: string; context_label: string },
): Promise<ContextLink> {
  const response = await apiFetch<{ success: boolean; context: ContextLink }>(
    `/v1/saves/${encodeURIComponent(sourceId)}/context`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return response.context;
}

export async function listSourceContext(sourceId: string): Promise<ContextLink[]> {
  const response = await apiFetch<{ success: boolean; context: ContextLink[] }>(
    `/v1/saves/${encodeURIComponent(sourceId)}/context`,
  );
  return response.context || [];
}

export async function fetchCareerContextGraph(filters: { skill?: string; role?: string } = {}): Promise<CareerContextGraph> {
  const params = new URLSearchParams();
  if (filters.skill?.trim()) params.set("skill", filters.skill.trim());
  if (filters.role?.trim()) params.set("role", filters.role.trim());
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<CareerContextGraph>(`/v1/context/graph${suffix}`);
}
