import fs from "node:fs";

const source = fs.readFileSync("supabase/functions/mcp/index.ts", "utf8");
const required = [
  "function requireMcpWriteTool",
  "CAPABILITY_MCP_WRITE_TOOLS",
  "authenticated MCP context required",
  "MCP write tools are disabled by launch scope",
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`MCP write gate marker missing: ${marker}`);
}
const writeToolBlocks = source.split(/var [A-Za-z0-9_]+_default = defineTool\d*\(/).slice(1);
const unguarded = writeToolBlocks.filter((block) => {
  const isWrite = block.includes("readOnlyHint: false");
  return isWrite && !block.includes("requireMcpWriteTool");
});
if (unguarded.length) throw new Error(`${unguarded.length} MCP write tool(s) lack the server-side capability gate`);
console.log(`MCP write gate verified for ${writeToolBlocks.length} tool blocks`);
