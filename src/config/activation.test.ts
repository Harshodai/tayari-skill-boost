import { describe, it, expect } from "bun:test";
import { isUserActivated, INITIAL_ACTIVATION_STATE, ActivationState } from "./activation";

describe("isUserActivated", () => {
  it("returns false when events are missing", () => {
    expect(isUserActivated(INITIAL_ACTIVATION_STATE)).toBe(false);
  });

  it("returns true when both events occur within 180s session boundary", () => {
    const now = 1000000;
    const state: ActivationState = {
      ...INITIAL_ACTIVATION_STATE,
      first_score_seen: true,
      first_tailor: true,
      session_start_time: now,
      first_score_seen_at: now + 30000,
      first_tailor_at: now + 180000, // 180s boundary
    };
    expect(isUserActivated(state)).toBe(true);
  });

  it("returns false when event occurs after 180s boundary", () => {
    const now = 1000000;
    const state: ActivationState = {
      ...INITIAL_ACTIVATION_STATE,
      first_score_seen: true,
      first_tailor: true,
      session_start_time: now,
      first_score_seen_at: now + 30000,
      first_tailor_at: now + 180001, // 180.001s > 180s
    };
    expect(isUserActivated(state)).toBe(false);
  });

  it("returns false for cross-session events with invalid timestamps", () => {
    const now = 1000000;
    const state: ActivationState = {
      ...INITIAL_ACTIVATION_STATE,
      first_score_seen: true,
      first_tailor: true,
      session_start_time: now,
      first_score_seen_at: now - 5000, // Before session start
      first_tailor_at: now + 5000,
    };
    expect(isUserActivated(state)).toBe(false);
  });

  it("returns false when any required timestamp is missing", () => {
    const now = 1000000;
    const stateMissingScoreTimestamp: ActivationState = {
      ...INITIAL_ACTIVATION_STATE,
      first_score_seen: true,
      first_tailor: true,
      session_start_time: now,
      first_tailor_at: now + 5000,
    };
    expect(isUserActivated(stateMissingScoreTimestamp)).toBe(false);
  });
});
