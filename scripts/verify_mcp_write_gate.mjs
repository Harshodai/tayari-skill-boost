import fs from "node:fs";

const sourceFiles = [
  "src/lib/mcp/tools/_write-gate.ts",
  "src/lib/mcp/tools/save-job.ts",
  "src/lib/mcp/tools/add-to-pipeline.ts",
  "src/lib/mcp/tools/optimize-resume.ts",
  "src/lib/mcp/tools/generate-cover-letter.ts",
  "src/lib/mcp/tools/report-outcome.ts",
];
const source = sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\\n");
const required = [
  "function requireMcpWriteTool",
  "CAPABILITY_MCP_WRITE_TOOLS",
  "authenticated MCP context required",
  "MCP write tools are disabled by launch scope",
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`MCP write gate marker missing from source: ${marker}`);
}
for (const file of sourceFiles.slice(1)) {
  const content = fs.readFileSync(file, "utf8");
  if (!content.includes("requireMcpWriteTool")) {
    throw new Error(`MCP write tool is not protected by the shared gate: ${file}`);
  }
}

const generatedPath = "supabase/functions/mcp/index.ts";
if (fs.existsSync(generatedPath)) {
  const generated = fs.readFileSync(generatedPath, "utf8");
  for (const marker of ["CAPABILITY_MCP_WRITE_TOOLS", "MCP write tools are disabled by launch scope"]) {
    if (!generated.includes(marker)) {
      throw new Error(`Generated MCP bundle is missing the write gate marker: ${marker}`);
    }
  }
}

console.log(`MCP write gate verified for ${sourceFiles.length - 1} write tools and generated bundle`);
