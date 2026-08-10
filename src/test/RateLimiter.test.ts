import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { getAuthRateLimit } from "@/api/auth";

const mockFetch = mock(() => Promise.resolve(new Response()));
const originalFetch = globalThis.fetch;
const storage = new Map<string, string>();

// ponytail: the real @/api/client reads localStorage for the auth token.
// Under --dom (full suite) localStorage exists as a readonly DOM getter; in
// standalone runs it does not — install a stub only when missing.
const originalLocalStorage = (globalThis as any).localStorage;

beforeEach(() => {
  mockFetch.mockClear();
  globalThis.fetch = mockFetch as any;
  storage.clear();
  if (originalLocalStorage === undefined) {
    (globalThis as any).localStorage = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    };
  }
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalLocalStorage === undefined) {
    delete (globalThis as any).localStorage;
  }
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