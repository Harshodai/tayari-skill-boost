import React from 'react';
import { useGamification } from '@/hooks/useGamification';

export const GamificationBadge: React.FC = () => {
  const { streak, xp } = useGamification();

  return (
    <div className="flex items-center space-x-2 rounded-lg bg-purple-100 px-3 py-1 text-sm text-purple-800">
      <span className="font-medium">🔥 {streak}‑day streak</span>
      <span className="ml-2">⚡ {xp} XP</span>
    </div>
  );
};
