import fs from "node:fs";
import path from "node:path";

const dir = "dist/assets";
if (!fs.existsSync(dir)) {
  console.error("dist/assets is missing; run pnpm build first");
  process.exit(1);
}
const files = fs.readdirSync(dir).filter((name) => name.endsWith(".js"));
const sizes = files.map((name) => ({ name, bytes: fs.statSync(path.join(dir, name)).size }));
const largest = sizes.toSorted((a, b) => b.bytes - a.bytes)[0];
const mainBudget = 650 * 1024;
if (largest && largest.bytes > mainBudget) {
  console.error(`Largest JavaScript chunk ${largest.name} is ${largest.bytes} bytes; budget is ${mainBudget}`);
  process.exit(1);
}
if (!files.some((name) => name.startsWith("charts-"))) {
  console.error("Expected a dedicated charts chunk after performance split");
  process.exit(1);
}
console.log(`Bundle budget passed: largest=${largest?.name ?? "none"}, bytes=${largest?.bytes ?? 0}`);
