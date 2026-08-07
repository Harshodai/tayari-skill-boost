// ponytail: the Python analyze_text_endpoint returns {"result": {...}} with
// overall_score/section_scores/matched_keywords; the UI contract is
// overallScore/sections/matchedKeywords. The old normalizer read a legacy
// score/breakdown shape that Python no longer produces — that mismatch made
// every self-hosted analysis render a 0% score. This module owns the mapping
// plus the aiOptions focus-area text ported from the deleted analyze-resume
// edge function, so ResumeUpload.tsx stays a thin caller.

export interface NormalizedAnalysis {
  overallScore: number;
  sections: { name: string; score: number; suggestions: string[] }[];
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryRecommendation: string;
  per_ats?: unknown;
}

export interface AnalyzeOptions {
  emphasizeKeywords: boolean;
  quantifyAchievements: boolean;
  optimizeFormat: boolean;
  tailorSummary: boolean;
}

const SECTION_CONFIG: { name: string; key: string; filter: string }[] = [
  { name: "Skills Match", key: "skills_match", filter: "keyword" },
  { name: "Experience Relevance", key: "experience_relevance", filter: "experience" },
  { name: "Education Fit", key: "education_fit", filter: "education" },
  { name: "Formatting", key: "formatting", filter: "format" },
];

export function normalizeGoAnalysis(raw: unknown): NormalizedAnalysis {
  const payload = (raw as { result?: Record<string, unknown> })?.result ?? (raw as Record<string, unknown>) ?? {};
  const sectionScores = (payload.section_scores ?? {}) as Record<string, number>;
  const recommendations: string[] = Array.isArray(payload.recommendations)
    ? (payload.recommendations as string[])
    : [];

  const sections: { name: string; score: number; suggestions: string[] }[] = [];
  for (const cfg of SECTION_CONFIG) {
    if (sectionScores[cfg.key] === undefined) continue;
    sections.push({
      name: cfg.name,
      score: Math.round(sectionScores[cfg.key]),
      suggestions: recommendations.filter((r: string) => r.toLowerCase().includes(cfg.filter)),
    });
  }

  const overallScore = typeof payload.overall_score === "number" ? payload.overall_score : 0;
  const summary = typeof payload.summary === "string" ? payload.summary : "";
  const summaryRecommendation =
    summary || (recommendations.length > 0 ? recommendations.join(" ") : "Analysis complete.");

  return {
    overallScore,
    sections,
    matchedKeywords: Array.isArray(payload.matched_keywords) ? (payload.matched_keywords as string[]) : [],
    missingKeywords: Array.isArray(payload.missing_keywords) ? (payload.missing_keywords as string[]) : [],
    summaryRecommendation,
    per_ats: (raw as { per_ats?: unknown })?.per_ats,
  };
}

export function aiOptionsToFocusText(options: AnalyzeOptions): string {
  const parts: string[] = [];
  if (options.emphasizeKeywords) {
    parts.push("- Pay special attention to keyword matching between resume and job description. Identify specific keywords that are present and missing.");
  }
  if (options.quantifyAchievements) {
    parts.push("- Look for opportunities to add quantifiable metrics and numbers to achievements. Suggest specific ways to quantify accomplishments.");
  }
  if (options.optimizeFormat) {
    parts.push("- Evaluate formatting, structure, and readability. Suggest formatting improvements.");
  }
  if (options.tailorSummary) {
    parts.push("- Provide suggestions for tailoring the resume summary/objective to better match this specific job.");
  }
  if (parts.length === 0) return "";
  return `Focus areas based on user preferences:\n${parts.join("\n")}`;
}

export function buildAnalyzePayload(
  resumeId: number | string,
  jdId: number | string,
  customInstructions: string,
  aiOptions: AnalyzeOptions
): { resume_id: number | string; jd_id: number | string; custom_instructions: string } {
  const focus = aiOptionsToFocusText(aiOptions);
  const combined = [customInstructions, focus].filter(Boolean).join("\n\n");
  return { resume_id: resumeId, jd_id: jdId, custom_instructions: combined };
}
