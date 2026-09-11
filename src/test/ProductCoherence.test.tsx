import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CapabilityStatusBadge, CAPABILITY_STATUS_CONFIG } from "@/components/common/CapabilityStatusBadge";
import { ActionReceiptBanner, type ActionReceiptItem } from "@/components/common/ActionReceiptBanner";

describe("CapabilityStatusBadge Component", () => {
  it("renders ready, beta, review_required, manual_handoff correctly", () => {
    const { unmount } = render(<CapabilityStatusBadge status="ready" />);
    expect(screen.getByText("Ready")).toBeDefined();
    unmount();

    render(<CapabilityStatusBadge status="review_required" />);
    expect(screen.getByText("Always reviewed")).toBeDefined();
  });

  it("exposes all status labels and configurations", () => {
    expect(CAPABILITY_STATUS_CONFIG.ready.label).toBe("Ready");
    expect(CAPABILITY_STATUS_CONFIG.manual_handoff.label).toBe("Manual handoff");
    expect(CAPABILITY_STATUS_CONFIG.provider_required.label).toBe("Provider required");
    expect(CAPABILITY_STATUS_CONFIG.review_required.label).toBe("Always reviewed");
  });
});

describe("ActionReceiptBanner Component", () => {
  it("renders truthful did vs did not do disclosure lists", () => {
    const receipt: ActionReceiptItem = {
      id: "rcpt-1",
      actionTitle: "Resume Tailoring & Field Pre-Fill",
      category: "prepared",
      timestamp: "2026-09-08 01:45:00 UTC",
      didList: [
        "Tailored 4 bullet points to match target skills",
        "Pre-filled candidate contact details in browser DOM"
      ],
      didNotList: [
        "Did NOT submit the application externally",
        "Did NOT enter passwords or CAPTCHA answers"
      ],
      proofHash: "sha256-abc123durableproof"
    };

    render(<ActionReceiptBanner receipt={receipt} />);
    expect(screen.getByText("Action Receipt: Resume Tailoring & Field Pre-Fill")).toBeDefined();
    expect(screen.getByText("What Job Tayari Did")).toBeDefined();
    expect(screen.getByText("What Job Tayari Did NOT Do (By Policy)")).toBeDefined();
    expect(screen.getByText("Tailored 4 bullet points to match target skills")).toBeDefined();
    expect(screen.getByText("Did NOT submit the application externally")).toBeDefined();
    expect(screen.getByText("sha256-abc123durableproof")).toBeDefined();
  });
});
