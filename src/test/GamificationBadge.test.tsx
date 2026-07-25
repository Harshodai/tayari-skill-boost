import { mock, test, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { GamificationBadge } from "@/components/GamificationBadge";

mock.module("@/hooks/useGamification", () => ({
  useGamification: () => ({ streak: 5, xp: 500 }),
}));

test("renders gamification badge with correct values", () => {
  render(<GamificationBadge />);
  expect(screen.getByText(/5.*streak/i)).toBeInTheDocument();
  expect(screen.getByText(/500 XP/i)).toBeInTheDocument();
});
