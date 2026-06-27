import { render, screen } from '@testing-library/react';
import { AchievementsBadge } from '@/components/AchievementsBadge';

// Mock useGamification hook
jest.mock('@/hooks/useGamification', () => ({
  useGamification: () => ({
    streak: 12,
    xp: 1200,
    level: 3,
    achievements: ['First Login', 'Top Performer'],
  }),
}));

test('renders achievements badge with correct level and XP bar width', () => {
  render(<AchievementsBadge />);
  expect(screen.getByText(/Level 3/i)).toBeInTheDocument();
  const bar = screen.getByTestId('xp-bar');
  // Expect width style to be 100% because xp 1200 exceeds the 500 per level cap
  expect(bar).toHaveStyle('width: 100%');
});
