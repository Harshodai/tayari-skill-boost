import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { submitVerification, getVerificationStatus } from "@/api/verification";

const mockFetch = mock(() => Promise.resolve(new Response()));
const originalFetch = globalThis.fetch;

// ponytail: mock @/api/client's apiFetch directly so the test is isolated from
// cross-file mock.module("@/api") leaks (same pattern as RateLimiter.test.ts).
mock.module("@/api/client", () => ({
  apiFetch: async (path: string, options: any = {}) => {
    const response = await mockFetch(`${"/api"}${path}`, options);
    const text = await (response as any).text();
    return text ? JSON.parse(text) : undefined;
  },
  API_URL: "/api",
}));

beforeEach(() => {
  mockFetch.mockClear();
  globalThis.fetch = mockFetch as any;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("verification api", () => {
  it("POSTs resume_text to /v1/verification/submit", async () => {
    const row = {
      status: "verified",
      truthful_score: 84,
      red_flags: [],
      screening_score: 73,
      strengths: ["Distributed systems"],
      gaps: [],
      sample_questions: [],
      verified_at: "2026-08-07T00:00:00Z",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(row),
      json: async () => row,
    } as any);

    const result = await submitVerification("Jane Doe\nSenior Engineer at Acme.");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/verification/submit");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body as string);
    expect(body.resume_text).toContain("Jane Doe");
    expect(result.status).toBe("verified");
    expect(result.truthful_score).toBe(84);
  });

  it("GETs /v1/verification/status and maps unverified shape", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        status: "unverified",
        truthful_score: null,
        red_flags: [],
        screening_score: null,
        strengths: [],
        gaps: [],
        sample_questions: [],
        verified_at: null,
      }),
      json: async () => ({
        status: "unverified",
        truthful_score: null,
        red_flags: [],
        screening_score: null,
        strengths: [],
        gaps: [],
        sample_questions: [],
        verified_at: null,
      }),
    } as any);

    const result = await getVerificationStatus();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as unknown as [string];
    expect(url).toBe("/api/v1/verification/status");
    expect(result.status).toBe("unverified");
    expect(result.truthful_score).toBeNull();
  });
});