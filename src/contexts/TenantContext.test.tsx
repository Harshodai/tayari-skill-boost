import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { apiFetchResponse } = vi.hoisted(() => ({
  apiFetchResponse: vi.fn(),
}));

vi.mock("@/api", () => ({
  apiFetchResponse,
}));

import { TenantProvider, useTenant } from "./TenantContext";

function TenantProbe({ children }: { children?: ReactNode }) {
  const { isLoading, tenant } = useTenant();
  return (
    <div>
      <span>{isLoading ? "loading" : "ready"}</span>
      <span>{tenant?.name ?? "default-brand"}</span>
      {children}
    </div>
  );
}

afterEach(() => {
  apiFetchResponse.mockReset();
  vi.unstubAllEnvs();
});

describe("TenantProvider", () => {
  it("keeps the default brand without a network request outside self-hosted mode", async () => {
    vi.stubEnv("VITE_USE_SELF_HOSTED", "false");
    vi.stubEnv("VITE_API_URL", "/api");

    render(
      <TenantProvider>
        <TenantProbe />
      </TenantProvider>
    );

    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
    expect(screen.getByText("default-brand")).toBeInTheDocument();
    expect(apiFetchResponse).not.toHaveBeenCalled();
  });
});
