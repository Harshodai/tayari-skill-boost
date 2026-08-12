import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamBrowserAgent } from "@/api/browser";

const mockFetch = vi.fn(() => Promise.resolve(new Response()));
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
  return new Response(frames.join("\n\n") + "\n\n", {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("streamBrowserAgent", () => {
  it("parses screenshot and done events in order", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        'data: {"type":"screenshot","step":1,"data":"aGVsbG8=","url":"https://example.com/jobs/1"}',
        'data: {"type":"done","result":"Applied to the role."}',
      ])
    );

    const events: string[] = [];
    await streamBrowserAgent("Apply to the job", (e) => events.push(e.type));

    expect(events).toEqual(["screenshot", "done"]);
    const [url, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v1/browser/automation/stream");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body as string);
    expect(body.instruction).toBe("Apply to the job");
  });

  it("throws on non-2xx response", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{"error":"ai_service_unavailable"}', { status: 503 })
    );

    await expect(streamBrowserAgent("x", () => {})).rejects.toThrow();
  });
});
