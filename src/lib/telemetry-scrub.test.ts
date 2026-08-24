import { describe, it, expect } from "vitest";
import { redactSensitiveKeys, truncateConsoleMessage, SENSITIVE_KEY_PATTERN } from "./telemetry-scrub";

describe("telemetry-scrub", () => {
  describe("redactSensitiveKeys", () => {
    it("redacts a resume body sitting on a Sentry breadcrumb/extra payload", () => {
      const result = redactSensitiveKeys({
        resumeText: "John Doe\n123 Main St\n555-1234\nExperienced engineer...",
        userId: "abc-123",
      });
      expect(result?.resumeText).toBe("[redacted]");
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
      expect(result?.jobDescriptionText).toBe("[redacted]");
      expect(result?.coverLetterDraft).toBe("[redacted]");
      expect(result?.password).toBe("[redacted]");
      expect(result?.authToken).toBe("[redacted]");
      expect(result?.apiSecret).toBe("[redacted]");
      expect(result?.candidateAnswerBank).toBe("[redacted]");
      expect(result?.harmless).toBe("keep me");
    });

    it("passes through undefined and non-object input unchanged", () => {
      expect(redactSensitiveKeys(undefined)).toBeUndefined();
    });

    it("does not mutate the input object (defensive copy)", () => {
      const original = { password: "hunter2" };
      const result = redactSensitiveKeys(original);
      expect(original.password).toBe("hunter2");
      expect(result?.password).toBe("[redacted]");
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
});
