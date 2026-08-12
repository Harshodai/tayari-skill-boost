import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./pages/Index", () => ({
  default: () => <main data-testid="index-route">Job Tayari home</main>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/AutomationContext", () => ({
  AutomationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useMigrateAutomationRuns", () => ({
  useMigrateAutomationRuns: () => undefined,
}));

vi.mock("@/components/analytics/RouteAnalytics", () => ({
  RouteAnalytics: () => null,
}));

vi.mock("@/components/automation/ActivityDrawer", () => ({
  ActivityDrawer: () => null,
}));

import App from "./App";

describe("App", () => {
  it("mounts its application shell without relying on live providers or network services", async () => {
    render(<App />);

    expect(await screen.findByTestId("index-route")).toHaveTextContent("Job Tayari home");
  });
});
