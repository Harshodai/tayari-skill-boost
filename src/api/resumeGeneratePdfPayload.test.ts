import { describe, expect, it } from "bun:test";
import { buildGenerateResumePdfPayload } from "./resumes";
import type { ParsedResume, ResumeAnalysisResult } from "../types/resume";

describe("buildGenerateResumePdfPayload", () => {
  const analysis: ResumeAnalysisResult = {
    overallScore: 72,
    sections: [],
    matchedKeywords: ["Go"],
    missingKeywords: ["Kubernetes", "Docker"],
    summaryRecommendation: "Add quantified achievements.",
  };

  const profile: ParsedResume = {
    name: "Jane Doe",
    email: "jane@example.com",
    experience: [
      {
        title: "Senior Engineer",
        company: "Acme",
        startDate: "2020",
        endDate: "2024",
        achievements: ["Reduced p99 latency by 40%"],
      },
    ],
    education: [{ degree: "B.S.", institution: "State U", year: "2018" }],
    skills: ["Python", "Go"],
  };

  it("emits exactly the Python contract keys with snake_case analysis", () => {
    const payload = buildGenerateResumePdfPayload({
      resumeText: "Jane Doe\nSenior Engineer.",
      profileData: profile,
      analysis,
      appliedSuggestions: ["Add Kubernetes"],
      jobDescription: "Senior backend engineer.",
      template: "professional",
    });

    expect(Object.keys(payload).sort()).toEqual([
      "analysis",
      "applied_suggestions",
      "job_description",
      "profile_data",
      "resume_text",
      "template",
    ]);
    expect(payload.analysis).toEqual({
      overall_score: 72,
      missing_keywords: ["Kubernetes", "Docker"],
      summary_recommendation: "Add quantified achievements.",
    });
    expect(payload.resume_text).toBe("Jane Doe\nSenior Engineer.");
    expect(payload.profile_data).toEqual(profile);
    expect(payload.applied_suggestions).toEqual(["Add Kubernetes"]);
    expect(payload.job_description).toBe("Senior backend engineer.");
    expect(payload.template).toBe("professional");
  });

  it("passes null profile_data through unchanged", () => {
    const payload = buildGenerateResumePdfPayload({
      resumeText: "Jane Doe\nSenior Engineer.",
      profileData: null,
      analysis,
      appliedSuggestions: [],
      template: "minimal",
    });

    expect(payload.profile_data).toBeNull();
  });
});
