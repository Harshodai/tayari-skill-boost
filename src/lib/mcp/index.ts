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

// Build the Supabase issuer from the runtime Supabase URL. The URL is parsed
// and its hostname is validated against the canonical single-label
// https://<project-ref>.supabase.co shape before the project ref is extracted.
// A missing, malformed, non-HTTPS, nested-subdomain, or wrong-length value
// leaves projectRef empty and fails closed below. Supabase project refs are
// exactly 20 lowercase alphanumeric characters. Runtime configuration avoids
// baking tenant or environment identifiers into a distributable bundle.
function runtimeSupabaseUrl(): string {
  const runtime = (globalThis as {
    Deno?: { env?: { get?: (key: string) => string | undefined } };
  }).Deno?.env?.get?.("SUPABASE_URL");
  return runtime ?? "";
}

function projectRefFromSupabaseUrl(): string {
  const raw = String(runtimeSupabaseUrl());
  if (!raw) return "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return "";
  }
  if (parsed.protocol !== "https:") return "";
  const host = parsed.hostname.toLowerCase();
  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(host);
  if (!match) return "";
  return match[1];
}

const projectRef = projectRefFromSupabaseUrl() || "";

if (!projectRef) {
  throw new Error("MCP auth issuer is not configured with a valid hosted Supabase project");
}

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
