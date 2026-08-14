#!/usr/bin/env node
/**
 * Security regression scanner.
 *
 * Runs a deterministic, offline set of security checks and compares the result
 * against a committed baseline (security/baseline.json). The build fails when a
 * NEW finding appears — findings already in the baseline are reported but do not
 * fail, so the gate catches regressions instead of pre-existing debt.
 *
 * Usage:
 *   node scripts/security_scan.mjs                 # check, exit 1 on new findings
 *   node scripts/security_scan.mjs --update-baseline
 *   node scripts/security_scan.mjs --json
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const BASELINE = path.join(ROOT, "security", "baseline.json");
const args = process.argv.slice(2);
const UPDATE = args.includes("--update-baseline");
const JSON_OUT = args.includes("--json");
const ENFORCE_PRODUCTION = process.env.SECURITY_BASELINE_ENFORCE === "true";

const findings = [];

function add({ scanner, severity, title, file, detail }) {
  const id = createHash("sha256")
    .update([scanner, title, file ?? ""].join("|"))
    .digest("hex")
    .slice(0, 16);
  findings.push({ id, scanner, severity, title, file: file ?? null, detail });
}

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p);

/* ------------------------------------------------------------------ */
/* 1. Dependency vulnerabilities (high + critical)                      */
/* ------------------------------------------------------------------ */
function scanDependencies() {
  let raw = "";
  try {
    raw = execFileSync("bun", ["audit", "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (err) {
    // `bun audit` exits non-zero when vulnerabilities exist; the report is
    // still on stdout. Only a missing report is a real failure.
    raw = err.stdout?.toString() ?? "";
    if (!raw.trim()) {
      add({
        scanner: "dependencies",
        severity: "low",
        title: "Dependency audit could not run",
        detail: "bun audit produced no report; dependency risk is unverified.",
      });
      return;
    }
  }
  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    return;
  }
  // npm-style reports nest advisories under `vulnerabilities`; Bun emits a
  // package-keyed object at the top level. Treat both shapes as untrusted input
  // and never convert a valid report into a clean result by accident.
  const advisories = report.vulnerabilities ?? report.advisories ?? report;
  for (const [pkg, info] of Object.entries(advisories)) {
    const entries = Array.isArray(info) ? info : [info];
    for (const entry of entries) {
      const severity = String(entry.severity ?? "unknown").toLowerCase();
      if (!["high", "critical"].includes(severity)) continue;
      add({
        scanner: "dependencies",
        severity,
        title: `Vulnerable dependency: ${pkg}`,
        file: "package.json",
        detail: entry.title ?? entry.url ?? `${severity} severity advisory for ${pkg}`,
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* 2. Database policy regressions in migrations                         */
/* ------------------------------------------------------------------ */
const CREATE_TABLE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?("?[a-zA-Z_][\w]*"?)/gi;
const CREATE_POLICY = /create\s+policy\b[\s\S]*?(?=create\s+policy\b|$)/gi;

function scanMigrations() {
  const dirs = [
    path.join(ROOT, "supabase", "migrations"),
    path.join(ROOT, "backend", "db", "migrations"),
  ];
  for (const dir of dirs) {
    for (const file of walk(dir, (f) => f.endsWith(".sql"))) {
      const sql = fs.readFileSync(file, "utf8");
      const lower = sql.toLowerCase();
      for (const match of sql.matchAll(CREATE_TABLE)) {
        const table = match[1].replace(/"/g, "").toLowerCase();
        if (!lower.includes(`enable row level security`) || !lower.includes(table)) {
          add({
            scanner: "database",
            severity: "critical",
            title: `Table "${table}" created without row level security`,
            file: rel(file),
            detail: "Every public table must enable RLS in the same migration.",
          });
        }
        const grantsTable = new RegExp(
          `grant\\s+[\\s\\S]*?\\bon\\s+(?:table\\s+)?(?:public\\.)?"?${table}"?\\b`,
          "i",
        );
        if (!grantsTable.test(sql)) {
          add({
            scanner: "database",
            severity: "high",
            title: `Table "${table}" created without GRANT statements`,
            file: rel(file),
            detail: "The Data API needs explicit GRANTs or every request fails.",
          });
        }
      }
      for (const policy of sql.matchAll(CREATE_POLICY)) {
        const block = policy[0];
        if (!/using\s*\(\s*true\s*\)/i.test(block)) continue;
        const roleClause = block.match(/\bto\s+([^\s]+(?:\s*,\s*[^\s]+)*)/i)?.[1] ?? "";
        const roles = roleClause.toLowerCase().split(/\s*,\s*/).filter(Boolean);
        const serviceOnly = roles.length > 0 && roles.every((role) => role === "service_role");
        if (serviceOnly) continue;
        add({
          scanner: "database",
          severity: "high",
          title: "Policy grants unrestricted read access (USING true)",
          file: rel(file),
          detail: "Scope policies to auth.uid() or an explicit role check; service_role-only policies are allowed.",
        });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 3. Client-side secret exposure                                       */
/* ------------------------------------------------------------------ */
const CLIENT_FORBIDDEN = [
  { pattern: /SUPABASE_SERVICE_ROLE_KEY/, title: "Service role key referenced in client code" },
  { pattern: /LOVABLE_API_KEY/, title: "Gateway API key referenced in client code" },
  { pattern: /\bsk_live_[A-Za-z0-9]{8,}/, title: "Live secret key literal in client code" },
  { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, title: "Private key literal in client code" },
];

function scanClientSecrets() {
  const files = walk(path.join(ROOT, "src"), (f) => /\.(ts|tsx|js|jsx)$/.test(f));
  for (const file of files) {
    if (file.includes(".test.")) continue;
    const content = fs.readFileSync(file, "utf8");
    for (const rule of CLIENT_FORBIDDEN) {
      if (rule.pattern.test(content)) {
        add({
          scanner: "secrets",
          severity: "critical",
          title: rule.title,
          file: rel(file),
          detail: "Server-only credentials must never ship in the browser bundle.",
        });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 4. Edge function hygiene                                             */
/* ------------------------------------------------------------------ */
function scanEdgeFunctions() {
  const dir = path.join(ROOT, "supabase", "functions");
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "_shared") continue;
    const index = path.join(dir, entry.name, "index.ts");
    if (!fs.existsSync(index)) continue;
    const src = fs.readFileSync(index, "utf8");
    const usesServiceRole = /SUPABASE_SERVICE_ROLE_KEY/.test(src);
    const verifiesJwt = /getUser\s*\(|auth\.getUser|Authorization/.test(src);
    if (usesServiceRole && !verifiesJwt) {
      add({
        scanner: "edge-functions",
        severity: "critical",
        title: `Edge function "${entry.name}" uses the service role without verifying the caller`,
        file: rel(index),
        detail: "Validate the caller's JWT before using elevated credentials.",
      });
    }
    if (!/corsHeaders/.test(src)) {
      add({
        scanner: "edge-functions",
        severity: "low",
        title: `Edge function "${entry.name}" does not set CORS headers`,
        file: rel(index),
        detail: "Browser calls will fail without CORS headers on every response.",
      });
    }
  }
}

/* ------------------------------------------------------------------ */

scanDependencies();
scanMigrations();
scanClientSecrets();
scanEdgeFunctions();

findings.sort((a, b) => a.id.localeCompare(b.id));

if (UPDATE) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(
    BASELINE,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2)}\n`,
  );
  console.log(`Baseline updated: ${findings.length} accepted finding(s).`);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE)
  ? JSON.parse(fs.readFileSync(BASELINE, "utf8"))
  : { findings: [] };
const known = new Set(baseline.findings.map((f) => f.id));
const current = new Set(findings.map((f) => f.id));
const added = findings.filter((f) => !known.has(f.id));
const resolved = baseline.findings.filter((f) => !current.has(f.id));

if (JSON_OUT) {
  console.log(JSON.stringify({ findings, added, resolved }, null, 2));
} else {
  console.log(`Security scan: ${findings.length} finding(s), ${known.size} baselined.`);
  for (const f of resolved) console.log(`  resolved  [${f.severity}] ${f.title}`);
  for (const f of added) {
    console.log(`  NEW       [${f.severity}] ${f.title}${f.file ? ` (${f.file})` : ""}`);
    console.log(`            ${f.detail}`);
  }
}

const unresolvedCriticalOrHigh = findings.filter((finding) => ["critical", "high"].includes(finding.severity));
if (ENFORCE_PRODUCTION && unresolvedCriticalOrHigh.length > 0) {
  console.error(
    `\nProduction security gate blocked: ${unresolvedCriticalOrHigh.length} critical/high finding(s) remain. ` +
      "Remediate them or remove the affected feature from the production launch scope.",
  );
  process.exit(1);
}

if (added.length > 0) {
  console.error(
    `\n${added.length} new security finding(s) introduced. Fix them, or run ` +
      `"bun run security:baseline" to accept them with justification in review.`,
  );
  process.exit(1);
}

console.log("No new security findings.");
