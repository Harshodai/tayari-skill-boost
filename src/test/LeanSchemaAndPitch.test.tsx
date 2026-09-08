import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("Lean MVP 12-Core Schema (scripts/lean-schema-12.sql)", () => {
  const schemaPath = resolve(process.cwd(), "scripts/lean-schema-12.sql");
  const schemaContent = readFileSync(schemaPath, "utf8");

  const expected12Tables = [
    "profiles",
    "user_roles",
    "resumes",
    "tailored_resumes",
    "resume_analyses",
    "saved_jobs",
    "scraped_jobs",
    "application_attempts",
    "interview_sessions",
    "credits",
    "billing_transactions",
    "agent_runs",
  ];

  it("exists on disk and has content", () => {
    expect(existsSync(schemaPath)).toBe(true);
    expect(schemaContent.length).toBeGreaterThan(500);
  });

  it("contains exactly the 12 core production tables", () => {
    // Extract all CREATE TABLE statements (public.<table> or <table>)
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
    const matches = [...schemaContent.matchAll(createTableRegex)];
    const createdTables = matches.map((m) => m[1].toLowerCase());

    // Must match exactly the 12 tables
    expect(createdTables).toHaveLength(12);
    for (const table of expected12Tables) {
      expect(createdTables).toContain(table);
    }
  });

  it("enables and forces Row Level Security on all 12 core tables", () => {
    for (const table of expected12Tables) {
      const enableRlsRegex = new RegExp(
        `ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
        "i"
      );
      const forceRlsRegex = new RegExp(
        `ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`,
        "i"
      );

      expect(enableRlsRegex.test(schemaContent)).toBe(true);
      expect(forceRlsRegex.test(schemaContent)).toBe(true);
    }
  });

  it("strictly prohibits public USING (true) policies (zero unrestricted read access)", () => {
    // Comments stripped to avoid false matches
    const noComments = schemaContent
      .replace(/--[^\n]*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    const usingTrueRegex = /using\s*\(\s*true\s*\)/i;
    expect(usingTrueRegex.test(noComments)).toBe(false);
  });

  it("enforces strict owner-scoped policies referencing auth.uid()", () => {
    const policyRegex = /CREATE\s+POLICY\s+([a-zA-Z0-9_]+)\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)[\s\S]*?(?=CREATE\s+POLICY|REVOKE|COMMIT|$)/gi;
    const policies = [...schemaContent.matchAll(policyRegex)];

    expect(policies.length).toBeGreaterThanOrEqual(12);
    for (const policy of policies) {
      const policySql = policy[0];
      expect(policySql).toMatch(/auth\.uid\(\)/i);
    }
  });

  it("revokes all permissions from anon and grants least privilege to authenticated and service_role", () => {
    expect(schemaContent).toMatch(/REVOKE\s+ALL\s+ON\s+TABLE[\s\S]*?FROM\s+anon/i);
    expect(schemaContent).toMatch(/GRANT\s+ALL\s+ON\s+TABLE[\s\S]*?TO\s+service_role/i);
    expect(schemaContent).toMatch(/GRANT\s+SELECT[\s\S]*?TO\s+authenticated/i);
  });

  it("contains foreign key tie between application_attempts and agent_runs", () => {
    expect(schemaContent).toMatch(/application_attempts/i);
    expect(schemaContent).toMatch(/agent_runs/i);
    expect(schemaContent).toMatch(/REFERENCES\s+public\.agent_runs\(run_id\)/i);
  });
});

describe("Lean Deployment Documentation (docs/LEAN_DEPLOYMENT.md)", () => {
  const deployDocPath = resolve(process.cwd(), "docs/LEAN_DEPLOYMENT.md");
  const deployDocContent = readFileSync(deployDocPath, "utf8");

  it("references scripts/lean-schema-12.sql as the recommended rapid setup script", () => {
    expect(deployDocContent).toContain("scripts/lean-schema-12.sql");
    expect(deployDocContent).toMatch(/Lean MVP 12-Core Schema/i);
    expect(deployDocContent).toMatch(/recommended rapid setup/i);
  });

  it("highlights the 12-table lean schema efficiency over the 58-table development history", () => {
    expect(deployDocContent).toMatch(/12 production-critical tables/i);
    expect(deployDocContent).toMatch(/58-table/i);
  });
});

describe("VC Pitch Deck & Investor Narrative (docs/VC_PITCH.md)", () => {
  const pitchPath = resolve(process.cwd(), "docs/VC_PITCH.md");
  const pitchContent = readFileSync(pitchPath, "utf8");

  it("exists on disk and has comprehensive investor narrative", () => {
    expect(existsSync(pitchPath)).toBe(true);
    expect(pitchContent.length).toBeGreaterThan(1500);
  });

  it("features the recommended VC pitch pivot to application infrastructure layer", () => {
    expect(pitchContent).toMatch(/AI-native application infrastructure layer/i);
    expect(pitchContent).toMatch(/not a resume tool/i);
  });

  it("documents Executive Summary, ATS filtering, and the candidate truthfulness crisis", () => {
    expect(pitchContent).toMatch(/Executive Summary/i);
    expect(pitchContent).toMatch(/ATS/i);
    expect(pitchContent).toMatch(/Workday|Greenhouse|Lever|Ashby/i);
    expect(pitchContent).toMatch(/truthfulness/i);
  });

  it("quantifies the market opportunity with $6.69B in 2026 to $14.82B in 2030 at 22.3% CAGR", () => {
    expect(pitchContent).toMatch(/\$6\.69\s*Billion|\$6\.69B/i);
    expect(pitchContent).toMatch(/\$14\.82\s*Billion|\$14\.82B/i);
    expect(pitchContent).toMatch(/22\.3%\s*CAGR/i);
    expect(pitchContent).toMatch(/TAM/i);
    expect(pitchContent).toMatch(/SAM/i);
    expect(pitchContent).toMatch(/SOM/i);
  });

  it("articulates all 4 pillars of the technical moat", () => {
    expect(pitchContent).toMatch(/Hermes 4-Tier Keyless Scraping/i);
    expect(pitchContent).toMatch(/Reflective Self-Scoring/i);
    expect(pitchContent).toMatch(/Knowledge Graph Skill Extraction/i);
    expect(pitchContent).toMatch(/Truthfulness Compliance Gate/i);
    expect(pitchContent).toMatch(/AUTONOMOUS_SUBMIT_ENABLED=false/i);
    expect(pitchContent).toMatch(/SHA-256/i);
  });

  it("outlines the business and monetization model across tiers and affiliations", () => {
    expect(pitchContent).toMatch(/Free.*\$0/i);
    expect(pitchContent).toMatch(/Pro.*\$12/i);
    expect(pitchContent).toMatch(/Team.*\$49/i);
    expect(pitchContent).toMatch(/Pay-Per-Application/i);
    expect(pitchContent).toMatch(/Course Affiliate/i);
  });

  it("details the lean unit economics and cloud architecture (Vercel + Railway + Managed PostgreSQL)", () => {
    expect(pitchContent).toMatch(/Vercel/i);
    expect(pitchContent).toMatch(/Railway/i);
    expect(pitchContent).toMatch(/Supabase|Neon/i);
    expect(pitchContent).toMatch(/12-Core Table Lean Schema/i);
    expect(pitchContent).toMatch(/Gross Margin/i);
  });

  it("provides 6-month milestones from 1,000 MAU to $5K MRR and Seed round readiness", () => {
    expect(pitchContent).toMatch(/1,000\s*MAU/i);
    expect(pitchContent).toMatch(/\$1,000\s*MRR|\$1K\s*MRR/i);
    expect(pitchContent).toMatch(/5,000\s*MAU/i);
    expect(pitchContent).toMatch(/\$5,000\s*MRR|\$5K\s*MRR/i);
    expect(pitchContent).toMatch(/Seed/i);
  });
});

describe("Programmatic Competitor Comparison Engine", () => {
  it("verifies CompareTool.tsx exists and is registered in src/pages", () => {
    const pagesDir = resolve(process.cwd(), "src/pages");
    expect(existsSync(resolve(pagesDir, "CompareTool.tsx"))).toBe(true);
  });

  it("verifies structured comparison datasets exist for major competitors", () => {
    const dataPath = resolve(process.cwd(), "src/data/comparisonsData.ts");
    expect(existsSync(dataPath)).toBe(true);
    const content = readFileSync(dataPath, "utf8");
    expect(content).toContain("jobscan");
    expect(content).toContain("teal");
    expect(content).toContain("simplify");
    expect(content).toContain("rezi");
  });
});
