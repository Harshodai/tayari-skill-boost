import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      files.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe("branding: AutoPilot is the single product name (V6)", () => {
  const offenders = sourceFiles(SRC).filter(
    (f) => !/\.test\.(ts|tsx)$/.test(f) && readFileSync(f, "utf8").includes("Apply Assist")
  );

  it("no user-visible 'Apply Assist' remains in src/", () => {
    expect(offenders.map((f) => f.replace(SRC, ""))).toEqual([]);
  });

  it("nav still points AutoPilot at its route", () => {
    const features = readFileSync(join(SRC, "config", "features.ts"), "utf8");
    expect(features).toContain('label: "AutoPilot", href: "/jobs/autopilot"');
  });
});

describe("branding: Job Tayari is the single product name (P0)", () => {
  const productNameOffenders = sourceFiles(SRC).filter(
    (f) => !/\.test\.(ts|tsx)$/.test(f) && /Tayari Skill Boost/.test(readFileSync(f, "utf8"))
  );

  it("no user-visible 'Tayari Skill Boost' remains in src/", () => {
    expect(productNameOffenders.map((f) => f.replace(SRC, ""))).toEqual([]);
  });

  it("index.html title uses Job Tayari", () => {
    const html = readFileSync(join(SRC, "..", "index.html"), "utf8");
    expect(html).toContain("<title>Job Tayari");
  });

  // ponytail: centralized product-label rule — the word "Tayari" may only
  // appear as "Job Tayari" or "JobTayari". The files below are pre-existing
  // legacy offenders (bare "Tayari" in identifiers/legacy copy) outside this
  // fix's scope; migrate them in follow-up branding work. Any NEW bare
  // "Tayari" in a file not on this list fails the gate.
  const legacyBareTayariFiles = [
    "/App.tsx",
    "/config/activation.ts",
    "/components/pipeline/ChainStrip.tsx",
    "/components/landing/SocialProofSection.tsx",
    "/components/landing/FeaturesSection.tsx",
    "/components/layout/AppShell.tsx",
    "/components/pet/TayariPet.tsx",
    "/components/pet/petFrames.ts",
    "/components/pet/index.ts",
    "/components/GmailConnectModal.tsx",
    "/components/ai/AskTayariButton.tsx",
    "/components/Logo.tsx",
    "/components/automation/ActivityDrawer.tsx",
    "/components/TayariComputerControlRoom.tsx",
    "/lib/mcp/tools/get-profile.ts",
    "/lib/mcp/index.ts",
    "/pages/Index.tsx",
    "/pages/Networking.tsx",
    "/pages/OneShotPipeline.tsx",
    "/pages/ComponentShowcase.tsx",
    "/pages/AgentPanel.tsx",
    "/pages/Omnisave.tsx",
    "/pages/ExtensionOnboarding.tsx",
    "/pages/KnowledgeHub.tsx",
    "/pages/InterviewBoard.tsx",
    "/pages/Privacy.tsx",
    "/pages/CandidateAnswerBank.tsx",
    "/pages/Landing.tsx",
    "/pages/OAuthConsent.tsx",
    "/pages/AdvisorDashboard.tsx",
    "/pages/PrivacyReadiness.tsx",
    "/pages/About.tsx",
  ];

  // ponytail: token-boundary rule — a "Tayari" occurrence is only the brand
  // when it completes an exact "Job Tayari" / "JobTayari" token: "Job" must be
  // a whole word immediately before (rejects "LegacyJobTayari") and nothing
  // may follow the "Tayari" (rejects "JobTayariX", "Job TayariX"). Any other
  // occurrence is a bare-Tayari offender.
  const hasBareTayari = (content: string): boolean => {
    const tayariRe = /Tayari/g;
    let m: RegExpExecArray | null;
    while ((m = tayariRe.exec(content)) !== null) {
      const before = content.slice(Math.max(0, m.index - 20), m.index);
      const after = content.slice(m.index + m[0].length, m.index + m[0].length + 20);
      const jobMatch = before.match(/Job\s?$/u);
      const valid =
        jobMatch !== null &&
        (jobMatch.index === 0 || !/[\p{L}\p{N}_]/u.test(before[jobMatch.index - 1])) &&
        !/[\p{L}\p{N}_]/u.test(after[0] ?? "");
      if (!valid) return true;
    }
    return false;
  };

  const bareTayariOffenders = sourceFiles(SRC).filter(
    (f) =>
      !/\.test\.(ts|tsx)$/.test(f) &&
      !legacyBareTayariFiles.includes(f.replace(SRC, "")) &&
      hasBareTayari(readFileSync(f, "utf8"))
  );

  it("no bare 'Tayari' label remains (must be 'Job Tayari' or 'JobTayari')", () => {
    expect(bareTayariOffenders.map((f) => f.replace(SRC, ""))).toEqual([]);
  });
});
