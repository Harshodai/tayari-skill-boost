import { describe, it, expect } from "bun:test";
import { isLinkedInUrl } from "@/lib/agent/linkedinUrl";

// Cross-layer parity with backend/python/app/services/linkedin_policy.py:
// that layer normalizes hosts with host.rstrip(".") — ALL trailing dots —
// and test_linkedin_policy.py pins the identical inputs. ApplyAgent must
// classify the same URLs the same way, including multiple-terminal-dot
// forms ("linkedin.com..."), which DNS treats as the same origin as
// "linkedin.com".
const MULTI_DOT_LINKEDIN = [
  "https://linkedin.com.../jobs/view/123",
  "https://www.linkedin.com../jobs/view/456",
  "https://sub.linkedin.com.../jobs/view/789",
  "//linkedin.com.../jobs/view/123",
];

describe("ApplyAgent isLinkedInUrl — cross-layer with linkedin_policy.py", () => {
  for (const url of MULTI_DOT_LINKEDIN) {
    it(`classifies ${url} as LinkedIn (Python layer asserts the same)`, () => {
      const result = isLinkedInUrl(url);
      expect(result.isLinkedIn).toBe(true);
      expect(result.normalizedUrl).toContain("linkedin.com/jobs");
    });
  }

  it("strips every terminal dot from the canonicalized URL", () => {
    expect(isLinkedInUrl("https://linkedin.com.../jobs/view/123").normalizedUrl).toBe(
      "https://linkedin.com/jobs/view/123",
    );
  });

  it("keeps non-LinkedIn multi-dot hosts as not LinkedIn", () => {
    expect(isLinkedInUrl("https://evil.com.../jobs/view/123").isLinkedIn).toBe(false);
    expect(isLinkedInUrl("https://evil.com.../jobs/view/123").normalizedUrl).toBe("");
  });
});
