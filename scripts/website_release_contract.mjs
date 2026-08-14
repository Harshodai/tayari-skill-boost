import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const src = path.join(root, "src");
const dist = path.join(root, "dist");
const failures = [];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const sourceFiles = walk(src).filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes(".test."));
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  if (/\bfetch\s*\(/.test(text) && !relative.endsWith("src/api/client.ts") && !relative.endsWith("src/lib/mcp/tools/_client.ts")) {
    failures.push(`${relative}: direct fetch bypasses the shared API client`);
  }
  if (!relative.includes("src/test/") && !relative.endsWith("src/lib/mcp/tools/_client.ts") && /http:\/\/(?:localhost|127\.0\.0\.1)/.test(text)) {
    failures.push(`${relative}: client source contains a localhost/loopback fallback`);
  }
}

const publicClaimFiles = [
  "src/components/landing/CTASection.tsx",
  "src/components/landing/GhostJobStat.tsx",
  "src/components/landing/ReceiptShowcase.tsx",
  "src/components/landing/FAQSection.tsx",
  "src/components/landing/ProductsSection.tsx",
  "src/components/layout/Footer.tsx",
  "src/components/GmailConnectModal.tsx",
  "src/pages/Auth.tsx",
  "src/pages/FreeAtsScan.tsx",
  "src/pages/Privacy.tsx",
  "src/pages/TypstResumeStudio.tsx",
  "src/pages/CandidateAnswerBank.tsx",
];
const forbiddenPublicClaims = [
  "join thousands of engineers",
  "100% local self-hosting support",
  "no public model training guarantee",
  "every submission produces an immutable receipt",
  "the only tool that proves what it sent",
  "100% ats compliant",
  "zero layout break",
  "100% precision with zero hallucinations",
  "read-only permission guarantee",
  "sign up for unlimited scans",
];
for (const relative of publicClaimFiles) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    failures.push(`${relative}: public claim contract file is missing`);
    continue;
  }
  const text = fs.readFileSync(file, "utf8").toLowerCase();
  for (const claim of forbiddenPublicClaims) {
    if (text.includes(claim)) failures.push(`${relative}: unsupported public claim remains: ${claim}`);
  }
}

const app = fs.readFileSync(path.join(src, "App.tsx"), "utf8");
if (!app.includes('path="/free-scan"')) failures.push("App.tsx: canonical /free-scan route missing");
if (!app.includes('path="/free-ats-scan"') || !app.includes('to="/free-scan"')) failures.push("App.tsx: /free-ats-scan compatibility redirect missing");

const nginx = fs.readFileSync(path.join(root, "nginx.conf"), "utf8");
const caddy = fs.readFileSync(path.join(root, "Caddyfile"), "utf8");
for (const header of ["Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Content-Security-Policy"]) {
  if (!nginx.includes(header) || !caddy.includes(header)) failures.push(`${header}: missing from Nginx or Caddy`);
}

if (fs.existsSync(dist)) {
  const assets = walk(dist);
  if (assets.some((file) => file.endsWith(".map"))) failures.push("dist: source maps are present in the production artifact");
  const jsAssets = assets.filter((file) => file.endsWith(".js"));
  const largest = Math.max(0, ...jsAssets.map((file) => fs.statSync(file).size));
  const total = jsAssets.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  if (largest > 900 * 1024) failures.push(`dist: largest JavaScript asset is ${largest} bytes, above 921600-byte budget`);
  if (total > 6 * 1024 * 1024) failures.push(`dist: JavaScript total is ${total} bytes, above 6291456-byte budget`);
  for (const file of assets.filter((candidate) => /\.(js|html|css)$/.test(candidate))) {
    const text = fs.readFileSync(file, "utf8");
    if (/http:\/\/(?:localhost:8080|localhost:11434|127\.0\.0\.1:8085)/.test(text)) failures.push(`${path.relative(root, file)}: release asset contains a Tayari development URL`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}
console.log("website release contract: PASS");
