import assert from "node:assert/strict";
import test from "node:test";
import {
  canMarkExternallyVerified,
  canTransitionApplication,
  isApprovalActive,
} from "../dist/index.js";

test("application states require candidate confirmation before external verification", () => {
  assert.equal(canTransitionApplication("DRAFT_FILLED", "CANDIDATE_CONFIRMED"), true);
  assert.equal(canTransitionApplication("DRAFT_FILLED", "EXTERNALLY_VERIFIED"), false);
  assert.equal(canTransitionApplication("CANDIDATE_CONFIRMED", "EXTERNALLY_VERIFIED"), true);
});

test("external verification requires an evidence-backed receipt", () => {
  assert.equal(canMarkExternallyVerified(undefined), false);
  assert.equal(
    canMarkExternallyVerified({
      receiptRef: "receipt_123",
      candidateRef: "candidate_opaque",
      jobRef: "job_123",
      portal: "example-ats",
      outcome: "EXTERNALLY_VERIFIED",
      observedAt: "2026-08-12T00:00:00.000Z",
      evidenceHash: "sha256:receipt",
    }),
    true
  );
});

test("only non-expired, explicitly approved actions remain active", () => {
  const base = {
    approvalRef: "approval_123",
    candidate: { candidateRef: "candidate_opaque", profileVersion: "profile_1", careerGoalVersion: "goal_1" },
    action: "FILL_DRAFT",
    artifactHashes: ["sha256:resume"],
    policyVersion: "policy_1",
    requestedAt: "2026-08-12T00:00:00.000Z",
  };

  assert.equal(
    isApprovalActive({ ...base, decision: "APPROVED", expiresAt: "2026-08-12T01:00:00.000Z" }, new Date("2026-08-12T00:30:00.000Z")),
    true
  );
  assert.equal(
    isApprovalActive({ ...base, decision: "APPROVED", expiresAt: "2026-08-12T00:15:00.000Z" }, new Date("2026-08-12T00:30:00.000Z")),
    false
  );
  assert.equal(
    isApprovalActive({ ...base, decision: "REQUESTED", expiresAt: "2026-08-12T01:00:00.000Z" }, new Date("2026-08-12T00:30:00.000Z")),
    false
  );
});
