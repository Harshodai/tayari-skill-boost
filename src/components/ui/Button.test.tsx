import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Button } from "./button";

afterEach(() => {
    cleanup();
});

describe("Button Component", () => {
    it("renders with default props", () => {
        render(<Button>Click me</Button>);
        const button = screen.getByRole("button", { name: /click me/i });
        expect(button).toBeDefined();
        expect(button.className).toContain("bg-primary");
    });

    it("renders with destructive variant", () => {
        render(<Button variant="destructive">Delete</Button>);
        const button = screen.getByRole("button", { name: /delete/i });
        expect(button.className).toContain("bg-destructive");
    });

    it("renders with outline variant", () => {
        render(<Button variant="outline">Cancel</Button>);
        const button = screen.getByRole("button", { name: /cancel/i });
        expect(button.className).toContain("border-primary");
    });

    it("handles click events", () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>Click me</Button>);
        const button = screen.getByRole("button", { name: /click me/i });

        fireEvent.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("is disabled when disabled prop is passed", () => {
        render(<Button disabled>Disabled</Button>);
        const button = screen.getByRole("button", { name: /disabled/i });
        expect(button.disabled).toBe(true);
    });
});
