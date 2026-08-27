import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// handleUnauthorized used to dispatch a global "auth:unauthorized" event on
// EVERY 401 from the Go gateway, regardless of auth mode. AuthContext.tsx
// listens for that event and clears the whole app's client-side user/session
// state. In Supabase mode, the Go gateway is a secondary API called with a
// forwarded Supabase token -- a 401 from one gateway call (wrong Go/Supabase
// config, a route needing a scope this token lacks, a transient backend
// issue) does NOT mean the user's real Supabase session is invalid, but the
// blanket dispatch signed the user out of the whole app anyway, breaking
// unrelated direct-Supabase features (e.g. src/components/jobs/
// SavedSearches.tsx) that never called the Go gateway at all. Verified live:
// a single 401 from /api/v1/agent/runs/active reliably reset AuthContext's
// user to null moments after a real, valid Supabase sign-in.
describe("handleUnauthorized", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    dispatchSpy = vi.spyOn(window, "dispatchEvent");
    localStorage.setItem("auth_token", "some-token");
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("dispatches a global sign-out in self-hosted mode (Go issues the only session)", async () => {
    vi.stubEnv("VITE_USE_SELF_HOSTED", "true");
    const { handleUnauthorized } = await import("./client");

    expect(() => handleUnauthorized()).toThrow("Session expired");

    const dispatchedTypes = dispatchSpy.mock.calls.map((call) => (call[0] as Event).type);
    expect(dispatchedTypes).toContain("auth:unauthorized");
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("does NOT dispatch a global sign-out in Supabase mode (Go is a secondary API)", async () => {
    vi.stubEnv("VITE_USE_SELF_HOSTED", "false");
    const { handleUnauthorized } = await import("./client");

    expect(() => handleUnauthorized()).toThrow("Session expired");

    const dispatchedTypes = dispatchSpy.mock.calls.map((call) => (call[0] as Event).type);
    expect(dispatchedTypes).not.toContain("auth:unauthorized");
    // Still clears the Go-specific token -- only the app-wide sign-out
    // broadcast is skipped, not the gateway-token cleanup.
    expect(localStorage.getItem("auth_token")).toBeNull();
  });
});
