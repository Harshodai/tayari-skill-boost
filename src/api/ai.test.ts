import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { streamInterviewCopilotHints } from "@/api/ai";

const mockFetch = mock(() => Promise.resolve(new Response()));
const originalFetch = globalThis.fetch;

// ponytail: stub globalThis.fetch — the real client reads localStorage for
// the auth token; under --dom it exists, standalone it does not.
const originalLocalStorage = (globalThis as any).localStorage;

beforeEach(() => {
  mockFetch.mockClear();
  globalThis.fetch = mockFetch as any;
  if (originalLocalStorage === undefined) {
    (globalThis as any).localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalLocalStorage === undefined) {
    delete (globalThis as any).localStorage;
  }
});

function sseResponse(frames: string[]): Response {
  const body = frames.join("\n\n") + "\n\n";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("streamInterviewCopilotHints", () => {
  it("parses progressive SSE events in order", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        'data: {"type":"question_type","value":"Behavioral"}',
        'data: {"type":"hints","value":["Start with impact"]}',
        'data: {"type":"done"}',
      ])
    );

    const events: string[] = [];
    await streamInterviewCopilotHints(
      { interviewer_transcript: "Describe a project" },
      (e) => events.push(e.type)
    );

    expect(events).toEqual(["question_type", "hints", "done"]);
    const [url, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v1/interview/copilot/stream");
    expect(options.method).toBe("POST");
  });

  it("throws on non-2xx response", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{"error":"ai_service_unavailable"}', { status: 503 })
    );

    await expect(
      streamInterviewCopilotHints({ interviewer_transcript: "x" }, () => {})
    ).rejects.toThrow();
  });
});
