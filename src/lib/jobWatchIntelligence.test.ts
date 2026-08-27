import { describe, it, expect } from "vitest";
import { suggestScheduleTier, formatNextCheck, isDuplicateWatch } from "./jobWatchIntelligence";

describe("suggestScheduleTier", () => {
  it("suggests hourly for urgent/immediate-hire phrasing", () => {
    expect(suggestScheduleTier("Urgent: Backend Engineer")).toBe("hourly");
    expect(suggestScheduleTier("Software Engineer - Hiring Now")).toBe("hourly");
    expect(suggestScheduleTier("Immediate Start Data Analyst")).toBe("hourly");
  });

  it("suggests weekly for senior/executive titles", () => {
    expect(suggestScheduleTier("Staff Software Engineer")).toBe("weekly");
    expect(suggestScheduleTier("Director of Engineering")).toBe("weekly");
    expect(suggestScheduleTier("VP of Product")).toBe("weekly");
    expect(suggestScheduleTier("Chief Technology Officer")).toBe("weekly");
  });

  it("defaults to daily for ordinary titles", () => {
    expect(suggestScheduleTier("Software Engineer")).toBe("daily");
    expect(suggestScheduleTier("Product Manager")).toBe("daily");
  });

  it("defaults to daily for an empty title", () => {
    expect(suggestScheduleTier("")).toBe("daily");
    expect(suggestScheduleTier("   ")).toBe("daily");
  });

  it("does not false-positive senior on unrelated substrings", () => {
    // "Vice" alone should not trigger the VP pattern without "vice president"
    expect(suggestScheduleTier("Device Engineer")).toBe("daily");
  });
});

describe("formatNextCheck", () => {
  it("shows 'Checking soon' when the interval has already elapsed", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatNextCheck(twoDaysAgo, "daily")).toBe("Checking soon");
  });

  it("shows 'Checking soon' for a watch that has never run", () => {
    expect(formatNextCheck(null, "hourly")).toBe("Checking soon");
  });

  it("shows a minute estimate for an hourly watch checked recently", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatNextCheck(fiveMinAgo, "hourly")).toMatch(/^Next check in ~\d+m$/);
  });

  it("shows an hour estimate for a daily watch checked recently", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(formatNextCheck(oneHourAgo, "daily")).toMatch(/^Next check in ~\d+h$/);
  });

  it("falls back to the daily interval for an unrecognized tier", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(formatNextCheck(oneHourAgo, "monthly")).toMatch(/^Next check in ~\d+h$/);
  });
});

describe("isDuplicateWatch", () => {
  const existing = [
    { query_title: "Backend Engineer", location: "Remote" },
    { query_title: "Product Manager", location: "New York" },
  ];

  it("detects an exact match", () => {
    expect(isDuplicateWatch(existing, "Backend Engineer", "Remote")).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(isDuplicateWatch(existing, "  backend engineer  ", "REMOTE")).toBe(true);
  });

  it("treats empty location as remote", () => {
    expect(isDuplicateWatch(existing, "Backend Engineer", "")).toBe(true);
  });

  it("returns false for a genuinely new title", () => {
    expect(isDuplicateWatch(existing, "Data Scientist", "Remote")).toBe(false);
  });

  it("returns false for the same title in a different location", () => {
    expect(isDuplicateWatch(existing, "Backend Engineer", "Berlin")).toBe(false);
  });
});
