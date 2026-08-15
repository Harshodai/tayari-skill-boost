import { describe, it, expect } from "vitest";
// @ts-expect-error importing CommonJS module from extension directory
import { normalizeUrl, DEFAULT_CONFIG } from "../../extension/options.js";

describe("Extension options normalizeUrl", () => {
  it("preserves query-string values ending with a slash while removing pathname trailing slashes", () => {
    const input = "http://localhost:8085/api/?next=/";
    const normalized = normalizeUrl(input, DEFAULT_CONFIG.apiUrl);
    expect(normalized).toBe("http://localhost:8085/api?next=/");
  });

  it("preserves multiple query parameters including ones ending with a slash", () => {
    const input = "https://app.example.com/login/?redirect=/dashboard/&ref=header/";
    const normalized = normalizeUrl(input, "https://app.example.com");
    expect(normalized).toBe("https://app.example.com/login?redirect=/dashboard/&ref=header/");
  });

  it("removes trailing slashes from path with no query string", () => {
    expect(normalizeUrl("http://localhost:8085/api/", DEFAULT_CONFIG.apiUrl)).toBe("http://localhost:8085/api");
    expect(normalizeUrl("http://localhost:8085/api", DEFAULT_CONFIG.apiUrl)).toBe("http://localhost:8085/api");
  });

  it("normalizes root paths without trailing slashes", () => {
    expect(normalizeUrl("http://localhost:8083/", DEFAULT_CONFIG.appUrl)).toBe("http://localhost:8083");
    expect(normalizeUrl("http://localhost:8083", DEFAULT_CONFIG.appUrl)).toBe("http://localhost:8083");
  });

  it("strips hash fragments from normalized URL", () => {
    expect(normalizeUrl("https://app.example.com/auth#section", "")).toBe("https://app.example.com/auth");
  });

  it("rejects non-localhost HTTP URLs and falls back", () => {
    expect(normalizeUrl("http://evil.com/api", DEFAULT_CONFIG.apiUrl)).toBe(DEFAULT_CONFIG.apiUrl);
  });
});
