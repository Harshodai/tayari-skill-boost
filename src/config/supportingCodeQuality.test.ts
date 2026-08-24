import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

describe("supporting-code quality safeguards", () => {
  it("provides a visible global focus indicator for keyboard navigation", () => {
    expect(stylesheet).toContain(":focus-visible");
    expect(stylesheet).toContain("outline: 3px solid hsl(var(--ring))");
    expect(stylesheet).toContain("outline-offset: 3px");
  });

  it("keeps animated and smooth-scrolling surfaces motion-aware", () => {
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesheet).toContain("animation-duration: 1ms !important");
    expect(stylesheet).toContain("scroll-behavior: auto !important");
  });

  it("limits hover-only lift effects to pointer devices and protects mobile overflow", () => {
    expect(stylesheet).toContain("@media (hover: hover) and (pointer: fine)");
    expect(stylesheet).toContain("#root {");
    expect(stylesheet).toContain("min-height: 100dvh");
    expect(stylesheet).toContain("overflow-x: clip");
  });
});
