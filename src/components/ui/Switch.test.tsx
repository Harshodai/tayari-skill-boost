import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Switch } from "./switch";

afterEach(() => {
    cleanup();
});

describe("Switch Component", () => {
    it("renders correctly", () => {
        render(<Switch aria-label="Toggle" />);
        const switchEl = screen.getByRole("switch", { name: /toggle/i });
        expect(switchEl).toBeDefined();
    });

    it("toggles state when clicked", () => {
        const handleCheckedChange = vi.fn();
        render(<Switch onCheckedChange={handleCheckedChange} aria-label="Toggle" />);
        const switchEl = screen.getByRole("switch", { name: /toggle/i });

        // Initial state is unchecked
        expect(switchEl.dataset.state).toBe("unchecked");

        // Click to toggle
        fireEvent.click(switchEl);
        expect(handleCheckedChange).toHaveBeenCalledWith(true);
        // Note: In a real app, the parent controls the state, but Radix primitives might update local state or we mock the state change if it was controlled.
        // For uncontroller/default behavior or just checking the event firing is enough here. 
    });

    it("renders as disabled", () => {
        render(<Switch disabled aria-label="Toggle" />);
        const switchEl = screen.getByRole("switch", { name: /toggle/i });
        expect(switchEl.disabled).toBe(true);
    });
});
