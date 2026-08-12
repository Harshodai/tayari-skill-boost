import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAuthRateLimit } from "@/api/auth";

const mockFetch = vi.fn(() => Promise.resolve(new Response()));
const originalFetch = globalThis.fetch;
const storage = new Map<string, string>();

// ponytail: the real @/api/client reads localStorage for the auth token.
// Under --dom (full suite) localStorage exists as a readonly DOM getter; in
// standalone runs it does not — install a stub only when missing. Either way,
// clear the active storage before each test and restore the module-load
// snapshot after, so auth tokens and other entries cannot leak between tests.
const originalLocalStorage = (globalThis as any).localStorage;
const originalStorageSnapshot: [string, string][] =
  originalLocalStorage === undefined
    ? []
    : Array.from({ length: originalLocalStorage.length }, (_, i) => {
        const key = originalLocalStorage.key(i);
        return [key, originalLocalStorage.getItem(key)];
      });

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
  } else {
    originalLocalStorage.clear();
  }
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalLocalStorage === undefined) {
    delete (globalThis as any).localStorage;
  } else {
    originalLocalStorage.clear();
    for (const [key, value] of originalStorageSnapshot) {
      originalLocalStorage.setItem(key, value);
    }
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
      expect.stringContaining("/v1/auth/rate-limit"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "user@example.com" }),
      })
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