import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    const featuresMenuTrigger = screen.getByRole("button", { name: /features/i });
    expect(featuresMenuTrigger).toHaveAttribute("aria-haspopup", "menu");
    expect(featuresMenuTrigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(featuresMenuTrigger);
    expect(featuresMenuTrigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toHaveAttribute("id", "features-menu");
  });

  it("opens a menu from the keyboard and restores focus when Escape closes it", async () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    const featuresMenuTrigger = screen.getByRole("button", { name: /features/i });
    featuresMenuTrigger.focus();
    fireEvent.keyDown(featuresMenuTrigger, { key: "ArrowDown" });

    const firstMenuItem = screen.getByRole("menuitem", { name: /resume optimizer/i });
    await waitFor(() => expect(firstMenuItem).toHaveFocus());

    fireEvent.keyDown(firstMenuItem, { key: "Escape" });
    await waitFor(() => expect(featuresMenuTrigger).toHaveFocus());
    expect(featuresMenuTrigger).toHaveAttribute("aria-expanded", "false");
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
    const dialog = screen.getByRole("dialog", { name: "Mobile navigation" });
    expect(dialog).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Mobile navigation" })).not.toBeInTheDocument();
  });
});
