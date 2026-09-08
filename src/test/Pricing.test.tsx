import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import Pricing from "@/pages/Pricing";
import * as apiModule from "@/api";
import * as AuthContext from "@/contexts/AuthContext";

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

describe("Pricing Page - Credit Packs & Transparent Credit Policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: null,
      profile: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      signup: vi.fn(),
    } as any);
  });

  it("renders the 3 credit packs with pricing, submissions, and unit prices", async () => {
    vi.spyOn(apiModule, "apiFetch").mockImplementation((path: string) => {
      if (path === "/v1/billing/credits/packs") {
        return Promise.resolve([
          {
            id: "starter",
            name: "Starter Pack",
            credits: 10,
            price: 19,
            price_formatted: "$19",
            unit_price: "$1.90/sub",
            description: "Targeted applications",
            features: ["10 Verified Submissions"],
          },
          {
            id: "pro",
            name: "Pro Pack",
            credits: 35,
            price: 49,
            price_formatted: "$49",
            unit_price: "$1.40/sub",
            popular: true,
            description: "Active search",
            features: ["35 Verified Submissions"],
          },
          {
            id: "power",
            name: "Power Pack",
            credits: 100,
            price: 99,
            price_formatted: "$99",
            unit_price: "$0.99/sub",
            best_value: true,
            description: "Aggressive search",
            features: ["100 Verified Submissions"],
          },
        ]);
      }
      return Promise.reject(new Error("Unknown route"));
    });

    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    );

    // Starter pack checks
    expect(await screen.findByText("Starter Pack")).toBeInTheDocument();
    expect(screen.getByText("$19")).toBeInTheDocument();
    expect(screen.getByText("($1.90/sub)")).toBeInTheDocument();

    // Pro pack checks
    expect(screen.getByText("Pro Pack")).toBeInTheDocument();
    expect(within(screen.getByTestId("pricing-card-pro")).getByText("$49")).toBeInTheDocument();
    expect(screen.getByText("($1.40/sub)")).toBeInTheDocument();
    expect(screen.getAllByText("Active search").length).toBeGreaterThan(0);

    // Power pack checks
    expect(screen.getByText("Power Pack")).toBeInTheDocument();
    expect(screen.getByText("$99")).toBeInTheDocument();
    expect(screen.getByText("($0.99/sub)")).toBeInTheDocument();
  });

  it("renders the transparent credit policy prominently", async () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    );

    const guarantee = screen.getByTestId("zero-risk-guarantee");
    expect(guarantee).toBeInTheDocument();
    expect(guarantee.textContent).toContain(
      "Transparent credit policy: 1 credit is debited only when a verified submission receipt with an ATS confirmation code is generated. Failed or unverifiable applications are $0.00 / 0 credits."
    );
  });

  it("fetches and displays the logged-in user credit balance dynamically", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: { id: "user-123", email: "candidate@tayari.io" },
      profile: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      signup: vi.fn(),
    } as any);

    vi.spyOn(apiModule, "apiFetch").mockImplementation((path: string) => {
      if (path === "/v1/billing/credits") {
        return Promise.resolve({ balance: 42, credits: 42 });
      }
      if (path === "/v1/billing/credits/packs") {
        return Promise.reject(new Error("Self-hosted"));
      }
      return Promise.reject(new Error("Not found"));
    });

    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    );

    const balanceElem = await screen.findByTestId("user-credit-balance");
    await waitFor(() => {
      expect(balanceElem.textContent).toContain("42 Verified Submission Credits");
    });
  });

  it("gracefully falls back to default packs when billing is self-hosted or endpoint fails", async () => {
    vi.spyOn(apiModule, "apiFetch").mockRejectedValue(new Error("Billing unavailable in self-hosted"));

    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    );

    expect(await screen.findByText("Starter Pack")).toBeInTheDocument();
    expect(screen.getByText("Pro Pack")).toBeInTheDocument();
    expect(screen.getByText("Power Pack")).toBeInTheDocument();
    expect(screen.getByText("($1.90/sub)")).toBeInTheDocument();
    expect(screen.getByText("($1.40/sub)")).toBeInTheDocument();
    expect(screen.getByText("($0.99/sub)")).toBeInTheDocument();
  });

  it("redirects unauthenticated users to auth with pack parameter on checkout click", async () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    );

    const starterCard = await screen.findByTestId("pricing-card-starter");
    const buyButton = starterCard.querySelector("button")!;
    fireEvent.click(buyButton);

    expect(mockNavigate).toHaveBeenCalledWith("/auth?pack=starter");
  });

  it("shows billing unavailable and disables authenticated purchase when the deployment reports billing disabled", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: { id: "user-123", email: "candidate@tayari.io" },
      profile: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      signup: vi.fn(),
    } as any);
    vi.spyOn(apiModule, "apiFetch").mockResolvedValue({ packs: [], billing_enabled: false } as any);

    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    );

    expect(await screen.findByTestId("billing-unavailable")).toBeInTheDocument();
    const unavailableButtons = screen.getAllByRole("button", { name: "Billing unavailable" });
    expect(unavailableButtons).toHaveLength(3);
    unavailableButtons.forEach((button) => expect(button).toBeDisabled());
  });

  it("initiates checkout session for authenticated users", async () => {
    vi.spyOn(AuthContext, "useAuth").mockReturnValue({
      user: { id: "user-123", email: "candidate@tayari.io" },
      profile: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      signup: vi.fn(),
    } as any);

    vi.spyOn(apiModule, "apiFetch").mockResolvedValue({ packs: [], billing_enabled: true } as any);
    const apiFetchResponseSpy = vi.spyOn(apiModule, "apiFetchResponse").mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://checkout.stripe.com/test-session" }),
    } as any);

    // Mock window.location
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, href: "", origin: "http://localhost:3000" } as any;

    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    );

    const proCard = await screen.findByTestId("pricing-card-pro");
    const buyButton = proCard.querySelector("button")!;
    fireEvent.click(buyButton);

    await waitFor(() => {
      expect(apiFetchResponseSpy).toHaveBeenCalledWith(
        "/v1/billing/create-checkout-session",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            plan: "pro",
            pack_id: "pro",
            return_url: "http://localhost:3000/pricing",
          }),
        })
      );
      expect(window.location.href).toBe("https://checkout.stripe.com/test-session");
    });

    window.location = originalLocation;
  });

  describe("Freemium Monthly Plans & Billing Tabs", () => {
    it("renders the 4 monthly tiers (Free, Pro, Team, Enterprise) on the default tab", async () => {
      render(
        <MemoryRouter>
          <Pricing />
        </MemoryRouter>
      );

      // Monthly plans tab is active by default
      const monthlyTab = screen.getByRole("tab", { name: /Monthly Plans/i });
      const packsTab = screen.getByRole("tab", { name: /Verified Submission Packs/i });
      expect(monthlyTab).toHaveAttribute("aria-selected", "true");
      expect(packsTab).toHaveAttribute("aria-selected", "false");

      // Free tier
      const freeCard = screen.getByTestId("pricing-card-free");
      expect(freeCard).toBeInTheDocument();
      expect(within(freeCard).getByText("Free")).toBeInTheDocument();
      expect(within(freeCard).getByText("$0")).toBeInTheDocument();
      expect(within(freeCard).getByText("3 AI resume optimizations / mo")).toBeInTheDocument();
      expect(within(freeCard).getByText("Instant ATS reverse scan")).toBeInTheDocument();
      expect(within(freeCard).getByText("Ghost-job detection")).toBeInTheDocument();
      expect(within(freeCard).getByText("Job search tracker")).toBeInTheDocument();
      expect(within(freeCard).getByRole("button", { name: "Start Free" })).toBeInTheDocument();

      // Pro tier (Marked Popular)
      const proCard = screen.getByTestId("pricing-card-monthly-pro");
      expect(proCard).toBeInTheDocument();
      expect(within(proCard).getByText("Pro")).toBeInTheDocument();
      expect(within(proCard).getByText("$12")).toBeInTheDocument();
      expect(within(proCard).getByText("Popular")).toBeInTheDocument();
      expect(within(proCard).getByText("Unlimited reflective resume optimizations")).toBeInTheDocument();
      expect(within(proCard).getByText("Targeted cover letter generation")).toBeInTheDocument();
      expect(within(proCard).getByText("Career roadmap milestones")).toBeInTheDocument();
      expect(within(proCard).getByText("Priority AI speed")).toBeInTheDocument();
      expect(within(proCard).getByText("DOCX & Typst PDF export")).toBeInTheDocument();
      expect(within(proCard).getByRole("button", { name: "Get Pro ($12/mo)" })).toBeInTheDocument();

      // Team tier
      const teamCard = screen.getByTestId("pricing-card-monthly-team");
      expect(teamCard).toBeInTheDocument();
      expect(within(teamCard).getByText("Team")).toBeInTheDocument();
      expect(within(teamCard).getByText("$49")).toBeInTheDocument();
      expect(within(teamCard).getByText("Multi-seat team dashboard")).toBeInTheDocument();
      expect(within(teamCard).getByText("Bulk candidate resume processing")).toBeInTheDocument();
      expect(within(teamCard).getByText("Outplacement analytics")).toBeInTheDocument();
      expect(within(teamCard).getByText("Priority email support")).toBeInTheDocument();
      expect(within(teamCard).getByRole("button", { name: "Get Team ($49/mo)" })).toBeInTheDocument();

      // Enterprise tier
      const enterpriseCard = screen.getByTestId("pricing-card-enterprise");
      expect(enterpriseCard).toBeInTheDocument();
      expect(within(enterpriseCard).getByText("Enterprise")).toBeInTheDocument();
      expect(within(enterpriseCard).getByText("Custom")).toBeInTheDocument();
      expect(within(enterpriseCard).getByText("Custom ATS integrations")).toBeInTheDocument();
      expect(within(enterpriseCard).getByText("White-label candidate portal")).toBeInTheDocument();
      expect(within(enterpriseCard).getByText("API access")).toBeInTheDocument();
      expect(within(enterpriseCard).getByText("SSO")).toBeInTheDocument();
      expect(within(enterpriseCard).getByText("Dedicated SLA")).toBeInTheDocument();
      expect(within(enterpriseCard).getByRole("button", { name: "Contact Sales" })).toBeInTheDocument();
    });

    it("handles Free tier CTA redirection for unauthenticated and authenticated users", () => {
      // Unauthenticated
      const { unmount } = render(
        <MemoryRouter>
          <Pricing />
        </MemoryRouter>
      );
      const freeCard = screen.getByTestId("pricing-card-free");
      fireEvent.click(within(freeCard).getByRole("button", { name: "Start Free" }));
      expect(mockNavigate).toHaveBeenCalledWith("/auth");
      unmount();

      // Authenticated
      vi.spyOn(AuthContext, "useAuth").mockReturnValue({
        user: { id: "user-123", email: "candidate@tayari.io" },
        profile: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        signup: vi.fn(),
      } as any);

      render(
        <MemoryRouter>
          <Pricing />
        </MemoryRouter>
      );
      const authFreeCard = screen.getByTestId("pricing-card-free");
      fireEvent.click(within(authFreeCard).getByRole("button", { name: "Start Free" }));
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });

    it("redirects unauthenticated users to /auth with proper plan query params", () => {
      render(
        <MemoryRouter>
          <Pricing />
        </MemoryRouter>
      );

      const proCard = screen.getByTestId("pricing-card-monthly-pro");
      fireEvent.click(within(proCard).getByRole("button", { name: "Get Pro ($12/mo)" }));
      expect(mockNavigate).toHaveBeenCalledWith("/auth?plan=pro");

      const teamCard = screen.getByTestId("pricing-card-monthly-team");
      fireEvent.click(within(teamCard).getByRole("button", { name: "Get Team ($49/mo)" }));
      expect(mockNavigate).toHaveBeenCalledWith("/auth?plan=team");
    });

    it("scrolls to contact sales section when Enterprise CTA is clicked", () => {
      const scrollIntoViewMock = vi.fn();
      const focusMock = vi.fn();
      const originalGetElementById = document.getElementById;
      document.getElementById = vi.fn((id: string) => {
        if (id === "contact-sales-section") {
          return { scrollIntoView: scrollIntoViewMock } as any;
        }
        if (id === "contact-sales-email") {
          return { focus: focusMock } as any;
        }
        return null;
      });

      render(
        <MemoryRouter>
          <Pricing />
        </MemoryRouter>
      );

      const enterpriseCard = screen.getByTestId("pricing-card-enterprise");
      fireEvent.click(within(enterpriseCard).getByRole("button", { name: "Contact Sales" }));

      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth" });
      expect(focusMock).toHaveBeenCalled();

      document.getElementById = originalGetElementById;
    });

    it("toggles tabs between Monthly Plans and Verified Submission Packs", async () => {
      render(
        <MemoryRouter>
          <Pricing />
        </MemoryRouter>
      );

      const monthlyTab = screen.getByRole("tab", { name: /Monthly Plans/i });
      const packsTab = screen.getByRole("tab", { name: /Verified Submission Packs/i });

      expect(monthlyTab).toHaveAttribute("aria-selected", "true");
      expect(packsTab).toHaveAttribute("aria-selected", "false");

      fireEvent.mouseDown(packsTab, { button: 0 });

      await waitFor(() => {
        expect(packsTab).toHaveAttribute("aria-selected", "true");
        expect(monthlyTab).toHaveAttribute("aria-selected", "false");
      });
    });
  });
});
