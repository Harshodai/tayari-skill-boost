import fs from "node:fs";
import { spawnSync } from "node:child_process";

const baselinePath = ".lint-warning-baseline";
const baseline = Number.parseInt(fs.readFileSync(baselinePath, "utf8").trim(), 10);
if (!Number.isFinite(baseline)) throw new Error(`Invalid lint baseline in ${baselinePath}`);

const result = spawnSync("pnpm", ["lint"], { encoding: "utf8" });
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const summary = output.match(/✖\s+(\d+)\s+problems?/);
const warnings = summary ? Number.parseInt(summary[1], 10) : 0;
process.stdout.write(output);
console.log(`Lint warning budget: ${warnings}/${baseline}`);

if (result.status !== 0) process.exit(result.status ?? 1);
if (warnings > baseline) {
  console.error(`Lint warning count increased from ${baseline} to ${warnings}`);
  process.exit(1);
}
