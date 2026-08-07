import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { getAuthRateLimit } from "@/api/auth";

const mockFetch = mock(() => Promise.resolve(new Response()));
const originalFetch = globalThis.fetch;

// ponytail: mock @/api/client's apiFetch directly so the test is isolated from
// cross-file mock.module("@/api") leaks (e.g. ResumeGraph.test.tsx replaces the
// whole @/api barrel). We exercise the real getAuthRateLimit against a stubbed
// fetch, not a stubbed apiFetch.
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

describe("getAuthRateLimit", () => {
  it("calls /v1/auth/rate-limit with the encoded email", async () => {
    const payload = { allowed: true, remainingAttempts: 5, blockedUntil: null };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    });
    const result = await getAuthRateLimit("user@example.com");
    expect(result.allowed).toBe(true);
    expect(result.remainingAttempts).toBe(5);
    expect(result.blockedUntil).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/auth/rate-limit?email=user%40example.com"),
      expect.any(Object)
    );
  });

  it("preserves blockedUntil ISO timestamp when present", async () => {
    const payload = {
      allowed: false,
      remainingAttempts: 0,
      blockedUntil: "2026-08-07T12:00:00Z",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    });
    const result = await getAuthRateLimit("locked@example.com");
    expect(result.allowed).toBe(false);
    expect(result.blockedUntil).toBe("2026-08-07T12:00:00Z");
  });
});