export interface HermesDigestFilters {
  query?: string;
  location?: string;
  remoteOnly?: boolean;
  minScore?: number;
}

export interface HermesDigestPreferences {
  enabled: boolean;
  frequency: "weekly";
  day: string;
  filters?: HermesDigestFilters;
  updatedAt: string;
}

export const HERMES_DIGEST_STORAGE_KEY = "tayari_weekly_hermes_digest";

const DEFAULT_PREFERENCES: HermesDigestPreferences = {
  enabled: false,
  frequency: "weekly",
  day: "Tuesday",
  updatedAt: "",
};

export function getHermesDigestPreferences(): HermesDigestPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }
  try {
    const raw = localStorage.getItem(HERMES_DIGEST_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      day: "Tuesday",
      frequency: "weekly",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function setHermesDigestPreferences(
  updates: Partial<HermesDigestPreferences>
): HermesDigestPreferences {
  const current = getHermesDigestPreferences();
  const next: HermesDigestPreferences = {
    ...current,
    ...updates,
    day: "Tuesday",
    frequency: "weekly",
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(HERMES_DIGEST_STORAGE_KEY, JSON.stringify(next));
    // Also broadcast storage event for same-window listeners if needed
    window.dispatchEvent(new Event("tayari_hermes_digest_updated"));
  }

  return next;
}

export function toggleHermesDigest(
  enabled: boolean,
  filters?: HermesDigestFilters
): {
  preferences: HermesDigestPreferences;
  toastMessage: string;
  toastDescription: string;
} {
  const preferences = setHermesDigestPreferences({
    enabled,
    ...(filters !== undefined ? { filters } : {}),
  });

  if (enabled) {
    return {
      preferences,
      toastMessage: "Weekly Hermes Job Digest Activated",
      toastDescription:
        "Hermes will scan 4 tiers of direct ATS boards and email you top matches every Tuesday",
    };
  }

  return {
    preferences,
    toastMessage: "Weekly Hermes Job Digest Paused",
    toastDescription:
      "You can re-enable digests anytime from Job Search or Settings.",
  };
}
