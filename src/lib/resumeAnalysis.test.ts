import { describe, expect, it } from "vitest";
import { aiOptionsToFocusText, buildAnalyzePayload, normalizeGoAnalysis } from "./resumeAnalysis";

describe("normalizeGoAnalysis", () => {
  const pythonResponse = {
    result: {
      overall_score: 73,
      section_scores: { skills_match: 81.4, experience_relevance: 66.2, education_fit: 50, formatting: 90.9 },
      matched_keywords: ["React", "TypeScript"],
      missing_keywords: ["GraphQL"],
      recommendations: [
        "Add keyword React to your summary.",
        "Quantify experience bullet metrics.",
        "Improve formatting with standard headings.",
      ],
      summary: "Strong match overall; education needs work.",
    },
  };

  it("maps Python shape to the UI contract", () => {
    const result = normalizeGoAnalysis(pythonResponse);
    expect(result.overallScore).toBe(73);
    expect(result.sections.map((s) => s.name)).toEqual([
      "Skills Match",
      "Experience Relevance",
      "Education Fit",
      "Formatting",
    ]);
    expect(result.sections.map((s) => s.score)).toEqual([81, 66, 50, 91]);
    expect(result.sections[0].suggestions).toEqual(["Add keyword React to your summary."]);
    expect(result.sections[1].suggestions).toEqual(["Quantify experience bullet metrics."]);
    expect(result.sections[3].suggestions).toEqual(["Improve formatting with standard headings."]);
    expect(result.matchedKeywords).toEqual(["React", "TypeScript"]);
    expect(result.missingKeywords).toEqual(["GraphQL"]);
    expect(result.summaryRecommendation).toBe("Strong match overall; education needs work.");
  });

  it("returns zeros and empty arrays for an empty payload", () => {
    const result = normalizeGoAnalysis({});
    expect(result.overallScore).toBe(0);
    expect(result.sections).toEqual([]);
    expect(result.matchedKeywords).toEqual([]);
    expect(result.missingKeywords).toEqual([]);
    expect(result.summaryRecommendation).toBe("Analysis complete.");
  });

  it("falls back to joined recommendations when summary is absent", () => {
    const result = normalizeGoAnalysis({ result: { overall_score: 50, recommendations: ["Fix A", "Fix B"] } });
    expect(result.summaryRecommendation).toBe("Fix A Fix B");
  });

  it("passes through per_ats when present", () => {
    const result = normalizeGoAnalysis({ result: {}, per_ats: { estimates: {}, band: 5 } });
    expect(result.per_ats).toEqual({ estimates: {}, band: 5 });
  });
});

describe("aiOptionsToFocusText", () => {
  it("renders all four focus areas", () => {
    const text = aiOptionsToFocusText({
      emphasizeKeywords: true,
      quantifyAchievements: true,
      optimizeFormat: true,
      tailorSummary: true,
    });
    expect(text).toContain("keyword matching");
    expect(text).toContain("quantifiable metrics");
    expect(text).toContain("formatting improvements");
    expect(text).toContain("tailoring the resume summary");
    expect(text.startsWith("Focus areas based on user preferences:")).toBe(true);
  });

  it("returns empty string when all toggles are off", () => {
    expect(aiOptionsToFocusText({ emphasizeKeywords: false, quantifyAchievements: false, optimizeFormat: false, tailorSummary: false })).toBe("");
  });

  it("renders only the enabled subset", () => {
    const text = aiOptionsToFocusText({ emphasizeKeywords: true, quantifyAchievements: false, optimizeFormat: false, tailorSummary: false });
    expect(text).toContain("keyword matching");
    expect(text).not.toContain("quantifiable metrics");
  });
});

describe("buildAnalyzePayload", () => {
  const options = { emphasizeKeywords: true, quantifyAchievements: true, optimizeFormat: false, tailorSummary: false };

  it("combines custom instructions with focus text", () => {
    const payload = buildAnalyzePayload(7, 9, "Be concise.", options);
    expect(payload.resume_id).toBe(7);
    expect(payload.jd_id).toBe(9);
    expect(payload.custom_instructions).toContain("Be concise.");
    expect(payload.custom_instructions).toContain("Focus areas based on user preferences:");
  });

  it("returns only custom instructions when all toggles are off", () => {
    const payload = buildAnalyzePayload(7, 9, "Be concise.", { emphasizeKeywords: false, quantifyAchievements: false, optimizeFormat: false, tailorSummary: false });
    expect(payload.custom_instructions).toBe("Be concise.");
  });

  it("returns focus text when custom instructions are empty", () => {
    const payload = buildAnalyzePayload(7, 9, "", options);
    expect(payload.custom_instructions).toContain("Focus areas based on user preferences:");
    expect(payload.custom_instructions).not.toContain("\n\n\n");
  });
});
