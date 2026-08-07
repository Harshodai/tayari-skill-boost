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
