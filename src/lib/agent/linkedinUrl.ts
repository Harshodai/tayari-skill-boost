// LinkedIn URL classification shared by ApplyAgent's start flow and the
// ApplyAgentLinkedIn test.

// ponytail: strip ALL trailing dots ("linkedin.com.", "linkedin.com...") —
// each is the same origin as "linkedin.com" to DNS but fails a plain string
// comparison. Mirrors linkedin_policy.py's host.rstrip(".") so both layers
// classify identical inputs identically (cross-layer parity is pinned by
// src/test/ApplyAgentLinkedIn.test.ts + test_linkedin_policy.py).
export const isLinkedInUrl = (url: string): { isLinkedIn: boolean; normalizedUrl: string } => {
  const trimmed = url.trim();
  if (!trimmed) return { isLinkedIn: false, normalizedUrl: "" };
  try {
    const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase().replace(/\.+$/, "");
    const isLinkedIn =
      host === "linkedin.com" ||
      host === "www.linkedin.com" ||
      host.endsWith(".linkedin.com");
    if (!isLinkedIn) return { isLinkedIn: false, normalizedUrl: "" };
    // ponytail: https-only — an http LinkedIn URL is a downgrade/MITM risk
    // for a page the agent will enter credentials on. Recognized, but no
    // safe URL to run against.
    if (parsed.protocol !== "https:") return { isLinkedIn: true, normalizedUrl: "" };
    // Canonicalize the host so the run opens the dot-stripped origin.
    if (parsed.hostname !== host) parsed.hostname = host;
    return { isLinkedIn: true, normalizedUrl: parsed.toString() };
  } catch {
    return { isLinkedIn: false, normalizedUrl: "" };
  }
};
