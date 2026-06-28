/**
 * Types for gamification statistics.
 */
export interface GamificationStats {
  /** Number of consecutive days the app has been visited. */
  streak: number;
  /** Experience points earned based on streak. */
  xp: number;
  /** Current level derived from streak. */
  level: number;
  /** List of achievement identifiers. */
  achievements: string[];
}

/**
 * Simple gamification hook – tracks daily streak of app usage using localStorage.
 *
 * Returns an immutable {@link GamificationStats} object on each render.
 * No React state is used; values are computed synchronously.
 */
export function useGamification(): GamificationStats {
  // Load achievements safely
  const achievements: string[] = (() => {
    const stored = localStorage.getItem('achievements');
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const today = new Date().toDateString();
  const lastVisit = localStorage.getItem('gamification_lastVisit');
  const prevStreak = parseInt(localStorage.getItem('gamification_streak') ?? '0', 10);

  let streak = 1;
  if (lastVisit === today) {
    streak = prevStreak;
  } else if (lastVisit) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (lastVisit === yesterday) {
      streak = prevStreak + 1;
    }
  }

  // Persist updated values
  localStorage.setItem('gamification_lastVisit', today);
  localStorage.setItem('gamification_streak', String(streak));

  const xp = streak * 100;
  const level = Math.floor(streak / 5) + 1;

  // Return a new immutable object each call
  return { streak, xp, level, achievements };
}
