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

// Build the Supabase issuer from the project ref at build time. Vite inlines
// VITE_SUPABASE_PROJECT_ID as a literal, keeping this file import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

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
