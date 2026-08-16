import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ReceiptBadge } from "@/components/receipts/ReceiptBadge";
import { ReceiptCard, SubmissionReceiptItem } from "@/components/receipts/ReceiptCard";
import { PipelineCard } from "@/components/pipeline/PipelineCard";
import type { PipelineJob } from "@/components/pipeline/types";

// Mock @dnd-kit/sortable for PipelineCard
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

describe("Submission Receipts UI - Verified, Failed & Unverifiable States", () => {
  describe("Verified State", () => {
    it("renders Verified Receipt badge with checkmark, confirmation code, and 1 Credit Debited", () => {
      render(
        <ReceiptBadge
          status="verified"
          confirmationCode="ATS-CONF-98765"
          showCreditInfo={true}
        />
      );

      const badge = screen.getByTestId("receipt-badge-verified");
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toContain("VERIFIED RECEIPT");
      expect(badge.textContent).toContain("ATS-CONF-98765");
      expect(badge.textContent).toContain("1 Credit Debited");
      expect(badge.className).toContain("text-emerald");
    });

    it("renders full ReceiptCard for verified submission", () => {
      const receipt: SubmissionReceiptItem = {
        id: "rec-1",
        company: "Acme Corp",
        title: "Senior Software Engineer",
        url: "https://jobs.acme.com/123",
        status: "verified",
        confirmationCode: "CONF-456",
        submittedAt: "2026-08-16T10:00:00Z",
        atsVendor: "Greenhouse",
      };

      render(<ReceiptCard receipt={receipt} />);

      const card = screen.getByTestId("receipt-card-verified");
      expect(card).toBeInTheDocument();
      expect(screen.getByText("Senior Software Engineer")).toBeInTheDocument();
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("ATS: Greenhouse")).toBeInTheDocument();
      expect(card.textContent).toContain("1 Credit Debited");
      expect(card.textContent).toContain("CONF-456");

      // Verify it does NOT contain pending/in-progress indicators
      expect(card.textContent).not.toContain("Pending");
      expect(card.textContent).not.toContain("In Progress");
    });
  });

  describe("Failed State", () => {
    it("renders Submission Failed badge with X icon and 0 Credits Charged (Free)", () => {
      render(<ReceiptBadge status="failed" showCreditInfo={true} />);

      const badge = screen.getByTestId("receipt-badge-failed");
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toContain("SUBMISSION FAILED");
      expect(badge.textContent).toContain("0 Credits Charged (Free)");
      expect(badge.className).toContain("text-rose");
    });

    it("renders full ReceiptCard for failed submission with failure reason and retry action", () => {
      const onRetry = vi.fn();
      const receipt: SubmissionReceiptItem = {
        id: "rec-2",
        company: "Beta Health",
        title: "Staff Platform Engineer",
        status: "failed",
        failureReason: "CAPTCHA challenge timed out",
        submittedAt: "2026-08-16T10:30:00Z",
      };

      render(<ReceiptCard receipt={receipt} onRetry={onRetry} />);

      const card = screen.getByTestId("receipt-card-failed");
      expect(card).toBeInTheDocument();
      expect(card.textContent).toContain("SUBMISSION FAILED");
      expect(card.textContent).toContain("Failure Reason: CAPTCHA challenge timed out");
      expect(card.textContent).toContain("0 Credits Charged (Free)");

      const retryBtn = screen.getByRole("button", { name: /Retry Application/i });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledWith(receipt);

      // Verify it does NOT contain pending/in-progress indicators
      expect(card.textContent).not.toContain("Pending");
      expect(card.textContent).not.toContain("In Progress");
    });
  });

  describe("Unverifiable State", () => {
    it("renders Unverifiable / Candidate Confirmed badge with AlertTriangle and 0 Credits Charged", () => {
      render(<ReceiptBadge status="unverifiable" showCreditInfo={true} />);

      const badge = screen.getByTestId("receipt-badge-unverifiable");
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toContain("UNVERIFIABLE / CANDIDATE CONFIRMED");
      expect(badge.textContent).toContain("0 Credits Charged");
      expect(badge.className).toContain("text-slate");
    });

    it("renders full ReceiptCard for unverifiable submission with missing external confirmation notice", () => {
      const receipt: SubmissionReceiptItem = {
        id: "rec-3",
        company: "Gamma Logistics",
        title: "DevOps Engineer",
        status: "unverifiable",
        submittedAt: "2026-08-16T11:00:00Z",
      };

      render(<ReceiptCard receipt={receipt} />);

      const card = screen.getByTestId("receipt-card-unverifiable");
      expect(card).toBeInTheDocument();
      expect(card.textContent).toContain("UNVERIFIABLE / CANDIDATE CONFIRMED");
      expect(card.textContent).toContain("Missing External ATS Confirmation. 0 Credits Charged.");
      expect(card.textContent).toContain("0 Credits Charged");

      // Verify it does NOT contain pending/in-progress indicators
      expect(card.textContent).not.toContain("Pending");
      expect(card.textContent).not.toContain("In Progress");
    });
  });

  describe("PipelineCard Receipt Visual States", () => {
    it("renders verified receipt status on pipeline job card", () => {
      const job: PipelineJob = {
        id: "job-1",
        title: "Frontend Lead",
        company: "Stripe",
        stage: "applied",
        receipt: {
          verified: true,
          status: "verified",
          confirmationCode: "STRIPE-999",
        },
      };

      render(
        <MemoryRouter>
          <PipelineCard job={job} />
        </MemoryRouter>
      );

      const receiptBox = screen.getByTestId("receipt-verified");
      expect(receiptBox).toBeInTheDocument();
      expect(receiptBox.textContent).toContain("VERIFIED RECEIPT");
      expect(receiptBox.textContent).toContain("#STRIPE-999");
      expect(receiptBox.textContent).toContain("1 Credit Debited");
    });

    it("renders failed receipt status on pipeline job card", () => {
      const job: PipelineJob = {
        id: "job-2",
        title: "Backend Architect",
        company: "Netflix",
        stage: "saved",
        receipt: {
          verified: false,
          failed: true,
          status: "failed",
          failureReason: "Portal session error · 0 Credits Charged (Free)",
        },
      };

      render(
        <MemoryRouter>
          <PipelineCard job={job} />
        </MemoryRouter>
      );

      const receiptBox = screen.getByTestId("receipt-failed");
      expect(receiptBox).toBeInTheDocument();
      expect(receiptBox.textContent).toContain("SUBMISSION FAILED");
      expect(receiptBox.textContent).toContain("0 Credits Charged (Free)");
    });

    it("renders unverifiable receipt status on pipeline job card", () => {
      const job: PipelineJob = {
        id: "job-3",
        title: "Fullstack Engineer",
        company: "Airbnb",
        stage: "applied",
        receipt: {
          verified: false,
          failed: false,
          status: "unverifiable",
        },
      };

      render(
        <MemoryRouter>
          <PipelineCard job={job} />
        </MemoryRouter>
      );

      const receiptBox = screen.getByTestId("receipt-unverifiable");
      expect(receiptBox).toBeInTheDocument();
      expect(receiptBox.textContent).toContain("UNVERIFIABLE / CANDIDATE CONFIRMED");
      expect(receiptBox.textContent).toContain("Missing External ATS Confirmation. 0 Credits Charged.");
    });
  });
});
