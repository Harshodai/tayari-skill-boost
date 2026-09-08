import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  getHermesDigestPreferences,
  setHermesDigestPreferences,
  toggleHermesDigest,
  HERMES_DIGEST_STORAGE_KEY,
} from "@/lib/hermesDigest";

describe("Weekly Hermes Job Match Digest Re-engagement", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default preferences with weekly Tuesday schedule when unconfigured", () => {
    const prefs = getHermesDigestPreferences();
    expect(prefs.enabled).toBe(false);
    expect(prefs.frequency).toBe("weekly");
    expect(prefs.day).toBe("Tuesday");
  });

  it("updates and retrieves persistent preferences in localStorage", () => {
    setHermesDigestPreferences({
      enabled: true,
      filters: {
        query: "Senior Product Manager",
        location: "Remote",
        remoteOnly: true,
        minScore: 70,
      },
    });

    const stored = getHermesDigestPreferences();
    expect(stored.enabled).toBe(true);
    expect(stored.frequency).toBe("weekly");
    expect(stored.day).toBe("Tuesday");
    expect(stored.filters?.query).toBe("Senior Product Manager");
    expect(stored.filters?.remoteOnly).toBe(true);

    const raw = localStorage.getItem(HERMES_DIGEST_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).enabled).toBe(true);
  });

  it("triggers instant confirmation toast with schedule details when toggled on", () => {
    const result = toggleHermesDigest(true, {
      query: "Fintech PM",
      remoteOnly: true,
    });

    expect(result.preferences.enabled).toBe(true);
    expect(result.toastMessage).toContain("Activated");
    expect(result.toastDescription).toBe(
      "Hermes will scan 4 tiers of direct ATS boards and email you top matches every Tuesday"
    );
  });

  it("updates status cleanly when toggled off", () => {
    toggleHermesDigest(true);
    const turnedOff = toggleHermesDigest(false);

    expect(turnedOff.preferences.enabled).toBe(false);
    expect(turnedOff.toastMessage).toContain("Paused");
    expect(getHermesDigestPreferences().enabled).toBe(false);
  });

  it("propagates error and avoids dispatch when localStorage.setItem fails", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const setItemSpy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError: storage full");
    });

    try {
      expect(() => {
        setHermesDigestPreferences({ enabled: true });
      }).toThrow("QuotaExceededError: storage full");

      expect(dispatchSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "tayari_hermes_digest_updated" })
      );

      expect(() => {
        toggleHermesDigest(true);
      }).toThrow("QuotaExceededError: storage full");
    } finally {
      setItemSpy.mockRestore();
      dispatchSpy.mockRestore();
    }
  });
});
