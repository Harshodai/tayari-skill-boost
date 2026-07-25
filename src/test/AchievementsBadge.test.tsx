import { mock, test, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { AchievementsBadge } from "@/components/AchievementsBadge";

mock.module("@/hooks/useGamification", () => ({
  useGamification: () => ({
    streak: 12,
    xp: 1200,
    level: 3,
    achievements: ["First Login", "Top Performer"],
  }),
}));

test("renders achievements badge with correct level and XP bar width", () => {
  render(<AchievementsBadge />);
  expect(screen.getByText(/Level 3/i)).toBeInTheDocument();
  const bar = screen.getByTestId("xp-bar");
  expect(bar).toBeInTheDocument();
  expect(bar.style.width).toBe("40%");
});
