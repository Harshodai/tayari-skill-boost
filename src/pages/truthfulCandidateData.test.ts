import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("truthful candidate-data contracts", () => {
  it("does not ship fabricated candidate defaults in Typst Resume Studio", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/TypstResumeStudio.tsx"), "utf8");

    expect(source).not.toContain("Alex Mercer");
    expect(source).not.toContain("alex.mercer@example.com");
    expect(source).not.toContain("TechCorp");
    expect(source).not.toContain("DataFlow");
    expect(source).not.toContain("99%");
    expect(source).toContain('useState("")');
  });

  it("keeps Career Roadmap inputs user-controlled and links to the real resume route", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/CareerRoadmap.tsx"), "utf8");

    expect(source).not.toContain('useState<string>("Frontend Engineer")');
    expect(source).not.toContain('useState<string>("US")');
    expect(source).toContain('<Link to="/resume">Upload Resume</Link>');
    expect(source).toContain("Target role required");
  });

  it("keeps One-Shot output within the candidate-controlled review boundary", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/OneShotPipeline.tsx"), "utf8");

    expect(source).not.toContain("Stealth Auto-Apply Payload");
    expect(source).not.toContain("100% Privacy & Local-First Ready");
    expect(source).toContain("Candidate-controlled");
    expect(source).toContain("review required");
  });
});
