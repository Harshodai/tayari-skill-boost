import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("ResumeUpload.tsx cloud-path removal", () => {
  const source = readFileSync(new URL("./ResumeUpload.tsx", import.meta.url), "utf8");

  it("no longer references the analyze-resume edge function", () => {
    expect(source).not.toContain("functions.invoke");
    expect(source).not.toContain("analyze-resume");
  });

  it("no longer branches on USE_SELF_HOSTED for analysis", () => {
    expect(source).not.toContain("if (USE_SELF_HOSTED)");
  });
});
