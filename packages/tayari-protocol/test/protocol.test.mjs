import assert from "node:assert/strict";
import test from "node:test";
import {
  canAuthorizeFinalSubmission,
  canMarkExternallyVerified,
  canTransitionApplication,
  canTransitionRun,
  canVerifyApplication,
  isApprovalActive,
  isWorkerLeaseActive,
} from "../dist/index.js";

test("application states require candidate confirmation before external verification", () => {
  assert.equal(canTransitionApplication("DRAFT_FILLED", "CANDIDATE_CONFIRMED"), true);
  assert.equal(canTransitionApplication("DRAFT_FILLED", "EXTERNALLY_VERIFIED"), false);
  assert.equal(canTransitionApplication("CANDIDATE_CONFIRMED", "EXTERNALLY_VERIFIED"), true);
});

test("run cancellation cannot resolve to a completed external action", () => {
  assert.equal(canTransitionRun("RUNNING", "CANCEL_REQUESTED"), true);
  assert.equal(canTransitionRun("CANCEL_REQUESTED", "CANCELLED"), true);
  assert.equal(canTransitionRun("CANCEL_REQUESTED", "COMPLETED"), false);
  assert.equal(canTransitionRun("CANCELLED", "RUNNING"), false);
});

test("worker leases are exact-run, exact-candidate, and time-bound", () => {
  const run = { runRef: "run_123", candidateRef: "candidate_opaque" };
  const lease = {
    leaseRef: "lease_123",
    runRef: "run_123",
    candidateRef: "candidate_opaque",
    workerRef: "worker_123",
    acquiredAt: "2026-08-12T00:00:00.000Z",
    expiresAt: "2026-08-12T01:00:00.000Z",
  };
  const now = new Date("2026-08-12T00:30:00.000Z");

  assert.equal(isWorkerLeaseActive(lease, run, now), true);
  assert.equal(isWorkerLeaseActive({ ...lease, candidateRef: "other_candidate" }, run, now), false);
  assert.equal(isWorkerLeaseActive({ ...lease, expiresAt: "2026-08-12T00:15:00.000Z" }, run, now), false);
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

test("a receipt only verifies the exact candidate, job, and portal it records", () => {
  const receipt = {
    receiptRef: "receipt_123",
    candidateRef: "candidate_opaque",
    jobRef: "job_123",
    portal: "example-ats",
    outcome: "EXTERNALLY_VERIFIED",
    observedAt: "2026-08-12T00:00:00.000Z",
    evidenceHash: "sha256:receipt",
  };

  assert.equal(canVerifyApplication(receipt, {
    candidateRef: "candidate_opaque", jobRef: "job_123", portal: "example-ats",
  }), true);
  assert.equal(canVerifyApplication(receipt, {
    candidateRef: "other_candidate", jobRef: "job_123", portal: "example-ats",
  }), false);
  assert.equal(canVerifyApplication(receipt, {
    candidateRef: "candidate_opaque", jobRef: "other_job", portal: "example-ats",
  }), false);
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

test("final submission approval binds the exact candidate, portal, job, and artefacts", () => {
  const approval = {
    approvalRef: "approval_final_123",
    candidate: { candidateRef: "candidate_opaque", profileVersion: "profile_1", careerGoalVersion: "goal_1" },
    decision: "APPROVED",
    action: "FINAL_SUBMISSION",
    portal: "example-ats",
    jobRef: "job_123",
    artifactHashes: ["sha256:resume", "sha256:letter"],
    policyVersion: "policy_1",
    requestedAt: "2026-08-12T00:00:00.000Z",
    expiresAt: "2026-08-12T01:00:00.000Z",
  };
  const now = new Date("2026-08-12T00:30:00.000Z");
  const request = {
    candidateRef: "candidate_opaque",
    jobRef: "job_123",
    portal: "example-ats",
    artifactHashes: ["sha256:resume", "sha256:letter"],
  };

  assert.equal(canAuthorizeFinalSubmission(approval, request, now), true);
  assert.equal(canAuthorizeFinalSubmission(approval, { ...request, artifactHashes: ["sha256:changed-resume"] }, now), false);
  assert.equal(canAuthorizeFinalSubmission(approval, { ...request, portal: "different-ats" }, now), false);
  assert.equal(canAuthorizeFinalSubmission({ ...approval, action: "FILL_DRAFT" }, request, now), false);
});
