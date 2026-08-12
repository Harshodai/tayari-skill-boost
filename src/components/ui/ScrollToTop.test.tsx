import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ScrollToTop } from "./ScrollToTop";

// Mock window.scrollTo
const scrollToMock = vi.fn();
global.window.scrollTo = scrollToMock;

afterEach(() => {
    cleanup();
});

describe("ScrollToTop Component", () => {
    it("is initially hidden", () => {
        render(<ScrollToTop />);
        const button = screen.getByRole("button", { name: /scroll to top/i });
        expect(button.className).toContain("opacity-0");
    });

    it("becomes visible after scrolling", () => {
        render(<ScrollToTop />);
        const button = screen.getByRole("button", { name: /scroll to top/i });

        // Simulate scroll by defining property and dispatching event
        Object.defineProperty(window, "scrollY", { value: 400, writable: true });
        fireEvent.scroll(window);

        // We expect the class to change.
        expect(button.className).toContain("opacity-100");
    });

    it("scrolls to top when clicked", () => {
        render(<ScrollToTop />);

        // Scroll to make it visible first
        Object.defineProperty(window, "scrollY", { value: 400, writable: true });
        fireEvent.scroll(window);

        const button = screen.getByRole("button", { name: /scroll to top/i });

        fireEvent.click(button);
        expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
});
