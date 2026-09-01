import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import Onboarding from "@/pages/Onboarding";
import * as apiModule from "@/api";
import { BackendUnavailableError, ApiError } from "@/api/client";

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div data-testid="layout-wrapper">{children}</div>,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Onboarding Page - Error Handling & Offline Drafting UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("restores saved draft values from localStorage on mount", async () => {
    localStorage.setItem(
      "tayari_onboarding_draft",
      JSON.stringify({
        transitionType: "same_domain",
        currentTitle: "Staff Software Engineer",
        targetLevel: "Principal Engineer",
        transferableSkills: ["Go", "Kubernetes", "PostgreSQL"],
      })
    );

    vi.spyOn(apiModule, "getProfile").mockRejectedValue(new BackendUnavailableError());

    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );

    // Should show the gateway offline banner since getProfile failed with BackendUnavailableError
    expect(await screen.findByTestId("gateway-offline-banner")).toBeInTheDocument();

    // Advance to step 2 to check restored inputs
    fireEvent.click(screen.getByRole("button", { name: /Next: Role Configuration/i }));

    expect(screen.getByDisplayValue("Staff Software Engineer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Principal Engineer")).toBeInTheDocument();
    expect(screen.getByText("Go")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
  });

  it("displays styled warning banner and exact saved fields list when gateway is offline", async () => {
    vi.spyOn(apiModule, "getProfile").mockRejectedValue(new BackendUnavailableError());

    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );

    const offlineBanner = await screen.findByTestId("gateway-offline-banner");
    expect(offlineBanner).toBeInTheDocument();
    expect(offlineBanner.textContent).toContain(
      "Backend Gateway Offline — Local Mode Active. Your progress is saved locally in your browser storage. Please save again once the backend gateway is available."
    );

    const savedFields = screen.getByTestId("saved-fields-list");
    expect(savedFields).toBeInTheDocument();
    expect(savedFields.textContent).toContain("✓ Career Track (Same Domain)");
    expect(savedFields.textContent).toContain("✓ Career Goal Strategy");
  });

  it("auto-saves user edits to localStorage draft during onboarding steps", async () => {
    vi.spyOn(apiModule, "getProfile").mockResolvedValue({
      id: "user-1",
      email: "user@test.com",
      full_name: "Test User",
      created_at: new Date().toISOString(),
    } as any);

    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );

    // Switch to cross_domain in Step 1
    const crossDomainTrack = await screen.findByTestId("track-cross-domain");
    fireEvent.click(crossDomainTrack);

    // Move to step 2
    fireEvent.click(screen.getByRole("button", { name: /Next: Role Configuration/i }));

    // Type industry values
    const industryInput = screen.getByTestId("input-current-industry");
    fireEvent.change(industryInput, { target: { value: "Finance" } });

    const targetIndustryInput = screen.getByTestId("input-target-industry");
    fireEvent.change(targetIndustryInput, { target: { value: "Artificial Intelligence" } });

    // Verify localStorage draft updated
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("tayari_onboarding_draft") || "{}");
      expect(stored.transitionType).toBe("cross_domain");
      expect(stored.currentIndustry).toBe("Finance");
      expect(stored.targetIndustry).toBe("Artificial Intelligence");
    });
  });

  it("distinguishes validation error (400/422) from gateway outage and displays validation error banner", async () => {
    vi.spyOn(apiModule, "getProfile").mockResolvedValue({
      id: "user-1",
      email: "user@test.com",
      full_name: "Test User",
      created_at: new Date().toISOString(),
    } as any);

    vi.spyOn(apiModule, "updateProfile").mockRejectedValue(
      new ApiError("Invalid transition type or missing required fields", 422)
    );

    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );

    // Move step 1 -> step 2
    fireEvent.click(await screen.findByRole("button", { name: /Next: Role Configuration/i }));

    // Move step 2 -> step 3
    fireEvent.click(screen.getByRole("button", { name: /Next: Review & Launch/i }));

    // Click launch button
    const launchBtn = screen.getByTestId("launch-dashboard-button");
    fireEvent.click(launchBtn);

    // Validation error banner should appear
    const validationBanner = await screen.findByTestId("validation-error-banner");
    expect(validationBanner).toBeInTheDocument();
    expect(validationBanner.textContent).toContain("Profile Validation Error");
    expect(validationBanner.textContent).toContain("Invalid transition type or missing required fields");

    // Should NOT navigate away
    expect(mockNavigate).not.toHaveBeenCalled();

    // Gateway offline banner should NOT be displayed for a validation error
    expect(screen.queryByTestId("gateway-offline-banner")).not.toBeInTheDocument();
  });

  it("allows completing onboarding with local storage when gateway outage occurs on finish", async () => {
    vi.spyOn(apiModule, "getProfile").mockResolvedValue({
      id: "user-1",
      email: "user@test.com",
      full_name: "Test User",
      created_at: new Date().toISOString(),
    } as any);

    // updateProfile fails with 503 gateway outage
    vi.spyOn(apiModule, "updateProfile").mockRejectedValue(new BackendUnavailableError());

    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );

    // Step 1 -> Step 2
    fireEvent.click(await screen.findByRole("button", { name: /Next: Role Configuration/i }));
    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole("button", { name: /Next: Review & Launch/i }));

    // Launch
    const launchBtn = screen.getByTestId("launch-dashboard-button");
    fireEvent.click(launchBtn);

    await waitFor(() => {
      // Local storage saved
      const saved = JSON.parse(localStorage.getItem("tayari_onboarding") || "{}");
      expect(saved.transitionType).toBe("same_domain");
      // Seamlessly proceeds to dashboard in local mode
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });
});
