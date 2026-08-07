import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..");

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
