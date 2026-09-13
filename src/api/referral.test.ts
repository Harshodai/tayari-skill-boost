import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createReferralDraft } from "@/api/referral";

const mockFetch = vi.fn(() => Promise.resolve(new Response()));
const originalFetch = globalThis.fetch;

// ponytail: mock @/api/client's apiFetch directly so the test is isolated from
// cross-file vi.mock("@/api") leaks (same pattern as RateLimiter.test.ts).
vi.mock("@/api/client", () => ({
  apiFetch: async (path: string, options: any = {}) => {
    // ponytail: bun's mock.module is process-global and never unloads, so this
    // stub leaks into every later test file. Delegate to whatever
    // globalThis.fetch is *at call time* (this file installs mockFetch in
    // beforeEach) so later files' own fetch stubs keep working.
    const response = await globalThis.fetch(`${"/api"}${path}`, options);
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

describe("referral api", () => {
  it("POSTs contact/job/kind to /v1/referral/draft", async () => {
    const result = {
      fit_score: 88,
      subject: "Referral ask for Acme",
      email: "Hi Alice...",
      linkedin: "Hi Alice!",
      rationale: "Former manager",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(result),
      json: async () => result,
    } as any);

    const payload = {
      contact: { name: "Alice Chen", relationship: "Worked together at Acme" },
      job: { title: "Senior Backend Engineer", company: "Acme" },
      user_context: { full_name: "Jane Doe", skills: ["Go"], proof_points: "Shipped payments service" },
      kind: "referral" as const,
    };

    const resp = await createReferralDraft(payload);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/referral/draft");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body as string);
    expect(body.contact.name).toBe("Alice Chen");
    expect(body.contact.relationship).toBe("Worked together at Acme");
    expect(body.kind).toBe("referral");
    expect(body.user_context.proof_points).toContain("payments");
    expect(resp.fit_score).toBe(88);
    expect(resp.email).toContain("Alice");
  });
});