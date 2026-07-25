/**
 * Tayari Platform Activation Metric Definition (Mission M11)
 *
 * DEFINITION:
 * activated = (first_score_seen AND first_tailor) completed within first user session (<= 180 seconds / 3 min to value).
 *
 * This metric gates all feature development and product decisions.
 */

export interface ActivationState {
  install_completed: boolean;
  resume_uploaded: boolean;
  first_score_seen: boolean;
  first_tailor: boolean;
  first_queue: boolean;
  first_board_move: boolean;
  wow_moment: boolean; // score improved >= 15 pts
  session_start_time?: number;
  first_score_seen_at?: number;
  first_tailor_at?: number;
}

export const INITIAL_ACTIVATION_STATE: ActivationState = {
  install_completed: true,
  resume_uploaded: false,
  first_score_seen: false,
  first_tailor: false,
  first_queue: false,
  first_board_move: false,
  wow_moment: false,
};

export function isUserActivated(state: ActivationState): boolean {
  if (!state.first_score_seen || !state.first_tailor) {
    return false;
  }
  if (
    state.session_start_time === undefined ||
    state.first_score_seen_at === undefined ||
    state.first_tailor_at === undefined
  ) {
    return false;
  }

  const scoreDiff = state.first_score_seen_at - state.session_start_time;
  const tailorDiff = state.first_tailor_at - state.session_start_time;

  return (
    scoreDiff >= 0 &&
    scoreDiff <= 180000 &&
    tailorDiff >= 0 &&
    tailorDiff <= 180000
  );
}

export function trackAnalyticsEvent(eventName: string, payload?: Record<string, any>): void {
  if (typeof window !== "undefined" && (window as any).posthog) {
    (window as any).posthog.capture(eventName, payload);
  }
  // Self-hosted privacy event logging fallback
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Analytics Event] ${eventName}`, payload || {});
  }
}
