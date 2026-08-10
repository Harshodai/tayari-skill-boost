import { API_URL, getHeaders } from "./client";

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
  maxSteps = 25
): Promise<void> {
  const response = await fetch(`${API_URL}/v1/browser/automation/stream`, {
    method: "POST",
    headers: { ...getHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ instruction, max_steps: maxSteps }),
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
