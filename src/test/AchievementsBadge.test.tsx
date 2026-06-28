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
  // Use role query for the region container
  const region = screen.getByRole('region', { name: /achievements progress/i });
  expect(region).toBeInTheDocument();
  expect(screen.getByText(/Level 3/i)).toBeInTheDocument();
  const bar = screen.getByTestId('xp-bar');
  expect(bar).toHaveStyle('width: 100%');
});
