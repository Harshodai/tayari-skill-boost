import { useEffect, useState } from 'react';

/**
 * Simple gamification hook – tracks daily streak of app usage.
 * Stores lastVisit date and current streak in localStorage.
 * Future: integrate with backend for persistent user stats.
 */
export function useGamification() {
  const [streak, setStreak] = useState<number>(0);
  const [xp, setXp] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [achievements, setAchievements] = useState<string[]>([]);

  // Load achievements from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('achievements');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setAchievements(parsed);
      } catch {
        // ignore malformed data
      }
    }
  }, []);

  useEffect(() => {
    const today = new Date().toDateString();
    const last = localStorage.getItem('gamification_lastVisit');
    const prevStreak = parseInt(localStorage.getItem('gamification_streak') || '0', 10);
    if (last === today) {
      setStreak(prevStreak);
    } else if (last) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (last === yesterday) {
        const newStreak = prevStreak + 1;
        setStreak(newStreak);
        localStorage.setItem('gamification_streak', String(newStreak));
      } else {
        setStreak(1);
        localStorage.setItem('gamification_streak', '1');
      }
    } else {
      setStreak(1);
      localStorage.setItem('gamification_streak', '1');
    }
    localStorage.setItem('gamification_lastVisit', today);
    // XP calculation based on streak
    setXp(streak * 100);
    // Level calculation
    const computedLevel = Math.floor(streak / 5) + 1;
    setLevel(computedLevel);
  }, [streak]);

  return { streak, xp, level, achievements };
}
