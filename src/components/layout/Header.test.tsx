import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { Header } from "./Header";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}));
vi.mock("@/components/automation/ActivityButton", () => ({ ActivityButton: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));

describe("Header accessibility contract", () => {
  it("exposes labelled navigation and an operable features menu", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    const features = screen.getByRole("button", { name: /features/i });
    expect(features).toHaveAttribute("aria-haspopup", "menu");
    expect(features).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(features);
    expect(features).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toHaveAttribute("id", "features-menu");
  });

  it("labels the mobile navigation trigger", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: /open menu/i });
    expect(trigger).toHaveAttribute("aria-controls", "mobile-navigation");
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Mobile navigation" })).toBeInTheDocument();
  });
});
