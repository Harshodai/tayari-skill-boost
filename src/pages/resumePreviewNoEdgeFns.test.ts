import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("ResumePreviewModal.tsx edge-function removal (Typst-only)", () => {
  const source = readFileSync(new URL("../components/resume/ResumePreviewModal.tsx", import.meta.url), "utf8");

  it("no longer invokes the generate-resume-pdf edge function", () => {
    expect(source).not.toContain("functions.invoke");
    expect(source).not.toContain("generate-resume-pdf");
  });

  it("no longer references supabase or the LaTeX surface", () => {
    expect(source).not.toContain("supabase.");
    expect(source).not.toContain("LaTeXSourceView");
    expect(source).not.toContain("acceptThirdPartyCompilation");
  });
});

describe("src/api/resumes.ts Go-pdf helper", () => {
  const source = readFileSync(new URL("../api/resumes.ts", import.meta.url), "utf8");

  it("exports generateResumePdf", () => {
    expect(source).toContain("generateResumePdf");
  });
});

describe("ResumeTemplates.tsx stale LaTeX-era surface removal", () => {
  const source = readFileSync(new URL("./ResumeTemplates.tsx", import.meta.url), "utf8");

  it("no longer posts to the dead /v1/export/pdf route", () => {
    expect(source).not.toContain("/v1/export/pdf");
    expect(source).not.toContain("functions.invoke");
  });

  it("no longer shows the fake compilation-step progress (LaTeX-era theater)", () => {
    expect(source).not.toContain("compilationSteps");
    expect(source).not.toContain("Converting to LaTeX");
    expect(source).not.toContain("updateStepStatus");
  });

  it("uses the shared Go generate-pdf helper", () => {
    expect(source).toContain("generateResumePdf");
    expect(source).toContain("buildGenerateResumePdfPayload");
  });
});
