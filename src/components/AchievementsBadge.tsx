import React from 'react';
import { useGamification } from '@/hooks/useGamification';

export const AchievementsBadge: React.FC = () => {
  const { streak, xp, level, achievements } = useGamification();

  // Simple XP progress towards next level (assuming each level requires 500 XP)
  const xpForNextLevel = 500;
  const progress = Math.min(100, (xp % xpForNextLevel) / xpForNextLevel * 100);

  return (
    <section className="flex flex-col items-start space-y-2 p-4 bg-indigo-50 rounded-lg">
      <div className="text-sm font-medium text-indigo-800">Level {level}</div>
      <div className="w-full bg-indigo-200 rounded h-2 overflow-hidden">
        <div
          data-testid="xp-bar"
          className="bg-indigo-600 h-2"
          style={{ width: `${progress}%` }}
        />
      </div>
      {achievements.length > 0 && (
        <ul className="mt-2 text-xs text-indigo-700 list-disc list-inside">
          {achievements.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
    </section>
  );
};