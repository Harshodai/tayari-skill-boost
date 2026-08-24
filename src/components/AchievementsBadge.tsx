import React from 'react';
import { useGamification } from '@/hooks/useGamification';

export const AchievementsBadge: React.FC = () => {
  const { streak, xp, level, achievements } = useGamification();

  // Simple XP progress towards next level (assuming each level requires 500 XP)
  const xpForNextLevel = 500;
  const progress = Math.min(100, (xp % xpForNextLevel) / xpForNextLevel * 100);

  return (
    <section role="region" aria-label="Achievements progress" className="flex flex-col items-start space-y-2 p-4" style={{ backgroundColor: 'var(--secondary)' }}>
      <div className="text-sm font-medium text-primary">Level {level}</div>
      <div className="w-full bg-primary/20 rounded h-2 overflow-hidden">
        <div
          data-testid="xp-bar"
          className="h-2"
          style={{ backgroundColor: 'var(--accent)', width: `${progress}%` }}
        />
      </div>
      {achievements.length > 0 && (
        <ul className="mt-2 text-xs text-primary list-disc list-inside">
          {achievements.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
    </section>
  );
};