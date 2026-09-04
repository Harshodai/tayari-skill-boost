import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchComputerReplay, getBrowserRunControlState, streamBrowserAgent } from "@/api/browser";

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

describe("getBrowserRunControlState", () => {
  it("requests the candidate-owned control snapshot with an encoded run ID and bounded history", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      run_id: "run/a",
      status: "running",
      progress: 20,
      current_step: "Reviewing form",
      cancellation_requested_at: null,
      cancellation_reason: null,
      cancellation_acknowledged_at: null,
      worker_lease_expires_at: null,
      events: [],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const state = await getBrowserRunControlState("run/a", 999);

    expect(state.status).toBe("running");
    const [url, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v1/browser/automation/runs/run%2Fa/control?event_limit=200");
    expect(options.method).toBeUndefined();
  });
});

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

describe("fetchComputerReplay", () => {
  it("passes the after cursor through and returns next_after", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ events: [], next_after: 7 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const out = await fetchComputerReplay("r1", 3);

    const [url] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/v1/computer/runs/r1/events?after=3");
    expect(out.next_after).toBe(7);
    expect(out.events).toEqual([]);
  });

  it("rejects empty run ids and clamps negative cursors to zero", async () => {
    await expect(fetchComputerReplay("   ", 0)).rejects.toThrow();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ events: [], next_after: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    await fetchComputerReplay("r1", -5);
    const [url] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("after=0");
  });
});
