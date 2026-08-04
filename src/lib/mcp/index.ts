import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProfileTool from "./tools/get-profile";
import searchJobsTool from "./tools/search-jobs";
import listApplicationsTool from "./tools/list-applications";
import saveJobTool from "./tools/save-job";
import optimizeResumeTool from "./tools/optimize-resume";
import getAtsScoreTool from "./tools/get-ats-score";
import generateCoverLetterTool from "./tools/generate-cover-letter";
import getPipelineTool from "./tools/get-pipeline";
import addToPipelineTool from "./tools/add-to-pipeline";
import getInterviewQuestionsTool from "./tools/get-interview-questions";
import getSkillGapsTool from "./tools/get-skill-gaps";
import getMarketSalaryTool from "./tools/get-market-salary";
import checkCompanyTool from "./tools/check-company";
import reportOutcomeTool from "./tools/report-outcome";

// Build the Supabase issuer from the project ref. Prefer the Vite build-time
// ref (inlined as a literal for the frontend build); fall back to the edge
// runtime's injected SUPABASE_URL (https://<project-ref>.supabase.co) so the
// deployed edge function gets a valid issuer even when the build-time ref
// was empty (the historical bundle shipped `projectRef = ""` → issuer
// "https://.supabase.co/auth/v1", which no OAuth server ever answers to).
//
// ponytail: the SUPABASE_URL fallback is parsed and its hostname validated
// against the expected *.supabase.co domain before the project ref is
// extracted. A missing, malformed, or unexpected-hostname value leaves
// projectRef empty rather than emitting a garbage issuer.
function projectRefFromSupabaseUrl(): string {
  const raw = String(process.env.SUPABASE_URL ?? "");
  if (!raw) return "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return "";
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "supabase.co" || !host.endsWith(".supabase.co")) return "";
  return parsed.hostname.replace(/\.supabase\.co$/, "");
}

const projectRef =
  (import.meta.env.VITE_SUPABASE_PROJECT_ID &&
  import.meta.env.VITE_SUPABASE_PROJECT_ID !== "project-ref-unset"
    ? import.meta.env.VITE_SUPABASE_PROJECT_ID
    : projectRefFromSupabaseUrl()) || "";

export default defineMcp({
  name: "tayari-mcp",
  title: "Tayari",
  version: "0.2.0",
  instructions:
    "Tayari is an AI job-prep and application-automation platform. Tools cover the full funnel: profile, saved jobs, pipeline management, resume optimization, ATS scoring, cover letter generation, interview prep, skill gap analysis, salary benchmarks, company intelligence, and outcome reporting.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    // Read profile & pipeline
    getProfileTool,
    getPipelineTool,
    listApplicationsTool,
    // Job management
    searchJobsTool,
    saveJobTool,
    addToPipelineTool,
    // AI-powered tools
    optimizeResumeTool,
    getAtsScoreTool,
    generateCoverLetterTool,
    getInterviewQuestionsTool,
    getSkillGapsTool,
    // Market intelligence
    getMarketSalaryTool,
    checkCompanyTool,
    // Outcome loop (M2)
    reportOutcomeTool,
  ],
});
