import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

describe("Pricing Page - Credit Packs & Zero Risk Guarantee", () => {
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
    expect(screen.getByText("$49")).toBeInTheDocument();
    expect(screen.getByText("($1.40/sub)")).toBeInTheDocument();
    expect(screen.getByText("Most Popular")).toBeInTheDocument();

    // Power pack checks
    expect(screen.getByText("Power Pack")).toBeInTheDocument();
    expect(screen.getByText("$99")).toBeInTheDocument();
    expect(screen.getByText("($0.99/sub)")).toBeInTheDocument();
  });

  it("renders the Zero Risk Guarantee message prominently", async () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    );

    const guarantee = screen.getByTestId("zero-risk-guarantee");
    expect(guarantee).toBeInTheDocument();
    expect(guarantee.textContent).toContain(
      "Zero Risk: 1 Credit is debited ONLY when a verified submission receipt with ATS confirmation code is generated. Failed or unverifiable applications are $0.00 / 0 credits."
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
    expect(balanceElem).toBeInTheDocument();
    expect(balanceElem.textContent).toContain("42 Verified Submission Credits");
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
});
