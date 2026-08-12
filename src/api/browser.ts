import { API_URL, ApiError, apiFetch, getHeaders } from "./client";

/**
 * WS-06 kill switch — terminate the isolated browser session for a run.
 *
 * Bounded by a short client timeout (the server bounds itself too) and it
 * surfaces failures instead of swallowing them: a silent kill switch is worse
 * than no kill switch. 403 means the run belongs to another account.
 */
export async function cancelBrowserRun(runId: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${API_URL}/v1/browser/automation/cancel`, {
      method: "POST",
      headers: { ...getHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId }),
      signal: controller.signal,
    });
    if (response.status === 401) throw new Error("Sign in again to stop this run.");
    if (response.status === 403) throw new Error("This run belongs to another account.");
    if (!response.ok) throw new Error(`Failed to stop run (HTTP ${response.status})`);
    const body = (await response.json().catch(() => ({}))) as { terminated?: boolean };
    return Boolean(body.terminated);
  } finally {
    clearTimeout(timer);
  }
}


export interface BrowserRunEvent {
  sequence_no: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface BrowserControlState {
  run_id: string;
  run_type: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  current_step: string | null;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  cancellation_requested: boolean;
  cancellation_requested_at: string | null;
  cancellation_reason: string | null;
  cancellation_acknowledged: boolean;
  cancellation_acknowledged_at: string | null;
  worker_lease_expires_at: string | null;
  lease_active: boolean;
  events: BrowserRunEvent[];
}

/** Read durable, candidate-owned state for a browser-assisted run. */
export async function getBrowserRunControlState(runId: string, eventLimit = 100): Promise<BrowserControlState> {
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) throw new Error("A browser run ID is required.");
  const boundedLimit = Math.max(1, Math.min(Math.trunc(eventLimit), 200));
  try {
    return await apiFetch<BrowserControlState>(
      `/v1/browser/automation/runs/${encodeURIComponent(normalizedRunId)}/control?event_limit=${boundedLimit}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      throw new Error("This run belongs to another account.");
    }
    if (error instanceof ApiError && error.status === 404) {
      throw new Error("This run is unavailable for this account.");
    }
    throw error;
  }
}

export interface BrowserStreamEvent {
  type: "screenshot" | "done" | "error";
  data?: string;
  step?: number;
  url?: string;
  title?: string;
  result?: string;
  error?: string;
  message?: string;
}

// ponytail: SSE over the Go gateway — fetch + ReadableStream parse (POST
// body required, so no EventSource). Progressive screenshots surface as
// the browser agent completes each step.
export async function streamBrowserAgent(
  instruction: string,
  onEvent: (event: BrowserStreamEvent) => void,
  signal?: AbortSignal,
  maxSteps = 25,
  runId?: string
): Promise<void> {
  const response = await fetch(`${API_URL}/v1/browser/automation/stream`, {
    method: "POST",
    headers: { ...getHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ instruction, max_steps: maxSteps, run_id: runId || null }),
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
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(6)) as BrowserStreamEvent);
      } catch {
        // skip malformed frames
      }
    }
  }
}
