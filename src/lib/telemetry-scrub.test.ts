import { describe, it, expect } from "vitest";
import { redactSensitiveKeys, truncateConsoleMessage, SENSITIVE_KEY_PATTERN, sanitizeBreadcrumbs } from "./telemetry-scrub";

describe("telemetry-scrub", () => {
  describe("redactSensitiveKeys", () => {
    it("redacts a resume body sitting on a Sentry breadcrumb/extra payload", () => {
      const result = redactSensitiveKeys({
        resumeText: "John Doe\n123 Main St\n555-1234\nExperienced engineer...",
        userId: "abc-123",
      });
      expect(result?.resumeText).toBe("[REDACTED]");
      expect(result?.userId).toBe("abc-123");
    });

    it("redacts job description, cover letter, password, token, secret, and answer fields", () => {
      const result = redactSensitiveKeys({
        jobDescriptionText: "We are hiring...",
        coverLetterDraft: "Dear hiring manager...",
        password: "hunter2",
        authToken: "eyJhbGciOi...",
        apiSecret: "sk-live-...",
        candidateAnswerBank: "My greatest weakness is...",
        harmless: "keep me",
      });
      expect(result?.jobDescriptionText).toBe("[REDACTED]");
      expect(result?.coverLetterDraft).toBe("[REDACTED]");
      expect(result?.password).toBe("[REDACTED]");
      expect(result?.authToken).toBe("[REDACTED]");
      expect(result?.apiSecret).toBe("[REDACTED]");
      expect(result?.candidateAnswerBank).toBe("[REDACTED]");
      expect(result?.harmless).toBe("keep me");
    });

    it("passes through undefined and non-object input unchanged", () => {
      expect(redactSensitiveKeys(undefined)).toBeUndefined();
    });

    it("does not mutate the input object (defensive copy)", () => {
      const original = { password: "hunter2" };
      const result = redactSensitiveKeys(original);
      expect(original.password).toBe("hunter2");
      expect(result?.password).toBe("[REDACTED]");
    });

    // -----------------------------------------------------------------------
    // DATA-008: nested / deep PII tests
    // -----------------------------------------------------------------------

    it("DATA-008: redacts nested object PII (SENTINEL_8A73_PRIVATE must not escape)", () => {
      const payload = { outer: { resumeText: "SENTINEL_8A73_PRIVATE" } } as Record<string, unknown>;
      const result = redactSensitiveKeys(payload);
      // outer is not safe → entire value is [REDACTED] (key preserved)
      expect(result?.outer).toBe("[REDACTED]");
      // Confirm the sentinel is not present anywhere in the serialised output
      expect(JSON.stringify(result)).not.toContain("SENTINEL_8A73_PRIVATE");
    });

    it("DATA-008: redacts PII inside an array of objects (email value redacted)", () => {
      // Arrays sit inside a non-safe key, so the whole value is redacted.
      const payload = { items: [{ email: "test@example.com", safeField: "ok" }] } as Record<string, unknown>;
      const result = redactSensitiveKeys(payload);
      // `items` is not on the SAFE_KEYS allowlist → [REDACTED]
      expect(result?.items).toBe("[REDACTED]");
      expect(JSON.stringify(result)).not.toContain("test@example.com");
    });

    it("DATA-008: redacts a long string value (>100 chars) even on a safe key", () => {
      const longString = "A".repeat(200);
      const result = redactSensitiveKeys({ status: longString });
      // `status` is on SAFE_KEYS but the value exceeds MAX_SAFE_STRING_LENGTH
      expect(result?.status).toBe("[REDACTED]");
    });

    it("DATA-008: does NOT redact a short safe string value", () => {
      const result = redactSensitiveKeys({ status: "completed" });
      expect(result?.status).toBe("completed");
    });

    it("DATA-008: safe keys pass through with their values preserved", () => {
      const result = redactSensitiveKeys({ request_id: "abc123", status: "ok" });
      expect(result?.request_id).toBe("abc123");
      expect(result?.status).toBe("ok");
    });

    it("DATA-008: cycle-safe — circular reference does not throw", () => {
      const obj: Record<string, unknown> = { status: "ok" };
      obj.self = obj; // circular reference
      expect(() => redactSensitiveKeys(obj)).not.toThrow();
    });
  });

  describe("SENSITIVE_KEY_PATTERN", () => {
    it("matches the real field-name shapes used across the resume/JD/answer-bank flows", () => {
      for (const key of ["resumeText", "resume_id", "coverLetter", "cover_letter_draft", "jobDescription", "job_description_text", "password", "refreshToken", "clientSecret", "candidateAnswer"]) {
        expect(SENSITIVE_KEY_PATTERN.test(key)).toBe(true);
      }
    });

    it("does not match unrelated field names", () => {
      for (const key of ["userId", "email", "createdAt", "status", "companyName"]) {
        expect(SENSITIVE_KEY_PATTERN.test(key)).toBe(false);
      }
    });
  });

  describe("truncateConsoleMessage", () => {
    it("leaves short messages untouched", () => {
      expect(truncateConsoleMessage("short message")).toBe("short message");
    });

    it("truncates a long console breadcrumb (e.g. an accidentally logged resume) to 200 chars + marker", () => {
      const longResume = "A".repeat(500);
      const result = truncateConsoleMessage(longResume);
      expect(result.length).toBeLessThan(longResume.length);
      expect(result.startsWith("A".repeat(200))).toBe(true);
      expect(result.endsWith("...[truncated]")).toBe(true);
    });
  });

  describe("sanitizeBreadcrumbs — DATA-008", () => {
    it("DATA-008: fully replaces console breadcrumb message with [console redacted]", () => {
      const breadcrumbs = [
        { type: "console", message: "resume text here" },
        { type: "navigation", message: "user navigated to /dashboard" },
      ];
      const result = sanitizeBreadcrumbs(breadcrumbs);
      expect(result[0].message).toBe("[console redacted]");
      // Non-console breadcrumbs are left untouched
      expect(result[1].message).toBe("user navigated to /dashboard");
    });

    it("DATA-008: sanitizes breadcrumb data payloads via redactSensitiveKeys", () => {
      const breadcrumbs = [
        {
          type: "http",
          data: { resumeText: "secret body", status: "200" } as Record<string, unknown>,
        },
      ];
      const result = sanitizeBreadcrumbs(breadcrumbs);
      expect(result[0].data?.resumeText).toBe("[REDACTED]");
      expect(result[0].data?.status).toBe("200");
    });
  });
});
