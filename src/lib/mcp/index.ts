import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProfileTool from "./tools/get-profile";
import searchJobsTool from "./tools/search-jobs";
import listApplicationsTool from "./tools/list-applications";
import saveJobTool from "./tools/save-job";

// Build the Supabase issuer from the project ref at build time. Vite inlines
// VITE_SUPABASE_PROJECT_ID as a literal, keeping this file import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "tayari-mcp",
  title: "Tayari",
  version: "0.1.0",
  instructions:
    "Tayari is an AI job-prep platform. Use these tools to read the signed-in user's profile, search their saved jobs, list Interview Board applications by stage, and save new jobs to their board.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfileTool, searchJobsTool, listApplicationsTool, saveJobTool],
});
