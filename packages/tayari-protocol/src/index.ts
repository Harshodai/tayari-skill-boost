/**
 * Tayari Protocol is a portable contract package. It intentionally contains no
 * connector credentials, browser automation, candidate storage, or final-submit
 * implementation. Those stay in the managed Tayari Cloud product.
 */

export const APPLICATION_STAGES = [
  "DISCOVERED",
  "QUALIFIED",
  "PREPARED",
  "REVIEW_REQUIRED",
  "APPROVED_FOR_DRAFT",
  "DRAFT_FILLED",
  "CANDIDATE_CONFIRMED",
  "EXTERNALLY_VERIFIED",
  "AMBIGUOUS",
  "CANCELLED",
] as const;

export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

/**
 * Run state is distinct from application stage. A run describes an auditable
 * unit of work; it may pause for consent or credential handoff, while the
 * candidate application remains in a safe reviewable stage.
 */
export const CAREER_RUN_STATES = [
  "PLANNED",
  "RUNNING",
  "AWAITING_APPROVAL",
  "AWAITING_CREDENTIAL_HANDOFF",
  "PAUSED",
  "CANCEL_REQUESTED",
  "CANCELLED",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
] as const;
export type CareerRunState = (typeof CAREER_RUN_STATES)[number];

export interface CareerRun {
  runRef: string;
  candidateRef: string;
  state: CareerRunState;
  idempotencyKey: string;
  policyVersion: string;
  createdAt: string;
  updatedAt: string;
}

/** A lease prevents one worker from continuing another worker's candidate run. */
export interface WorkerLease {
  leaseRef: string;
  runRef: string;
  candidateRef: string;
  workerRef: string;
  acquiredAt: string;
  expiresAt: string;
}

export const APPROVAL_DECISIONS = ["REQUESTED", "APPROVED", "DENIED", "EXPIRED", "REVOKED"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export interface CandidateReference {
  /** An opaque tenant-scoped value. Never put a name, email, or platform ID here. */
  candidateRef: string;
  profileVersion: string;
  careerGoalVersion: string;
}

export interface CareerGoal {
  title: string;
  targetDomains: string[];
  targetLocations: string[];
  workModes: Array<"remote" | "hybrid" | "onsite">;
  compensationCurrency?: string;
  compensationMin?: number;
  constraints?: string[];
}

export interface JobPosting {
  jobRef: string;
  sourceUrl: string;
  employerName: string;
  title: string;
  location?: string;
  descriptionHash: string;
  retrievedAt: string;
}

export interface ArtifactReference {
  artifactRef: string;
  kind: "resume" | "cover_letter" | "portfolio" | "application_answer" | "other";
  sha256: string;
  createdAt: string;
}

export interface Approval {
  approvalRef: string;
  candidate: CandidateReference;
  decision: ApprovalDecision;
  action: "PREPARE_ARTIFACT" | "FILL_DRAFT" | "FINAL_SUBMISSION" | "CONNECTOR_SYNC";
  portal?: string;
  jobRef?: string;
  artifactHashes: string[];
  policyVersion: string;
  requestedAt: string;
  expiresAt: string;
  decidedAt?: string;
}

export interface ApplicationReceipt {
  receiptRef: string;
  candidateRef: string;
  jobRef: string;
  portal: string;
  outcome: "EXTERNALLY_VERIFIED" | "AMBIGUOUS" | "NOT_VERIFIED";
  observedAt: string;
  evidenceHash: string;
  workerRunRef?: string;
  externalReference?: string;
}

/**
 * The minimum context that an implementation must bind to a final external
 * action. Managed products can add stronger signatures and policy checks, but
 * must not omit these dimensions.
 */
export interface FinalSubmissionRequest {
  candidateRef: string;
  jobRef: string;
  portal: string;
  artifactHashes: string[];
}

export interface CareerEvent<T = Record<string, unknown>> {
  eventRef: string;
  runRef: string;
  candidateRef: string;
  type:
    | "RUN_PLANNED"
    | "RUN_STARTED"
    | "ARTIFACT_PREPARED"
    | "APPROVAL_REQUESTED"
    | "APPROVAL_DECIDED"
    | "DRAFT_FILLED"
    | "RECEIPT_OBSERVED"
    | "RUN_COMPLETED"
    | "RUN_FAILED";
  occurredAt: string;
  payload: T;
}

const RUN_TRANSITIONS: Record<CareerRunState, readonly CareerRunState[]> = {
  PLANNED: ["RUNNING", "CANCELLED", "EXPIRED"],
  RUNNING: ["AWAITING_APPROVAL", "AWAITING_CREDENTIAL_HANDOFF", "PAUSED", "CANCEL_REQUESTED", "COMPLETED", "FAILED", "EXPIRED"],
  AWAITING_APPROVAL: ["RUNNING", "CANCEL_REQUESTED", "CANCELLED", "EXPIRED"],
  AWAITING_CREDENTIAL_HANDOFF: ["RUNNING", "CANCEL_REQUESTED", "CANCELLED", "EXPIRED"],
  PAUSED: ["RUNNING", "CANCEL_REQUESTED", "CANCELLED", "EXPIRED"],
  CANCEL_REQUESTED: ["CANCELLED", "FAILED"],
  CANCELLED: [],
  COMPLETED: [],
  FAILED: [],
  EXPIRED: [],
};

const TRANSITIONS: Record<ApplicationStage, readonly ApplicationStage[]> = {
  DISCOVERED: ["QUALIFIED", "CANCELLED"],
  QUALIFIED: ["PREPARED", "CANCELLED"],
  PREPARED: ["REVIEW_REQUIRED", "CANCELLED"],
  REVIEW_REQUIRED: ["APPROVED_FOR_DRAFT", "CANCELLED"],
  APPROVED_FOR_DRAFT: ["DRAFT_FILLED", "CANCELLED"],
  DRAFT_FILLED: ["CANDIDATE_CONFIRMED", "CANCELLED"],
  CANDIDATE_CONFIRMED: ["EXTERNALLY_VERIFIED", "AMBIGUOUS", "CANCELLED"],
  EXTERNALLY_VERIFIED: [],
  AMBIGUOUS: ["EXTERNALLY_VERIFIED", "CANCELLED"],
  CANCELLED: [],
};

/** Returns whether a candidate-application state transition is structurally allowed. */
export function canTransitionApplication(from: ApplicationStage, to: ApplicationStage): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Cancel requests are terminally safe: they can resolve only to cancelled or
 * failed, never to a completed external action.
 */
export function canTransitionRun(from: CareerRunState, to: CareerRunState): boolean {
  return RUN_TRANSITIONS[from].includes(to);
}

/** A worker may act only while it holds a current lease for this exact run and candidate. */
export function isWorkerLeaseActive(
  lease: WorkerLease | undefined,
  run: Pick<CareerRun, "runRef" | "candidateRef">,
  now = new Date(),
): boolean {
  if (!lease || lease.runRef !== run.runRef || lease.candidateRef !== run.candidateRef) return false;
  const expiry = new Date(lease.expiresAt).getTime();
  return Number.isFinite(expiry) && expiry > now.getTime();
}

/** A verified application outcome always requires a receipt observed by an external system. */
export function canMarkExternallyVerified(receipt: ApplicationReceipt | undefined): boolean {
  return receipt?.outcome === "EXTERNALLY_VERIFIED" && Boolean(receipt.evidenceHash);
}

/**
 * A receipt may only verify the exact candidate/job/portal application that
 * produced it. This prevents evidence from one run being replayed elsewhere.
 */
export function canVerifyApplication(
  receipt: ApplicationReceipt | undefined,
  request: Pick<FinalSubmissionRequest, "candidateRef" | "jobRef" | "portal">,
): boolean {
  return Boolean(
    canMarkExternallyVerified(receipt)
      && receipt?.candidateRef === request.candidateRef
      && receipt.jobRef === request.jobRef
      && receipt.portal === request.portal,
  );
}

export function isApprovalActive(approval: Approval, now = new Date()): boolean {
  return approval.decision === "APPROVED" && new Date(approval.expiresAt).getTime() > now.getTime();
}

/**
 * Final submission requires an active, purpose-specific approval that binds
 * the same candidate, job, portal, and every submitted artefact hash. An
 * approval for draft filling, a different employer, or a stale resume cannot
 * be escalated into an irreversible action.
 */
export function canAuthorizeFinalSubmission(
  approval: Approval | undefined,
  request: FinalSubmissionRequest,
  now = new Date(),
): boolean {
  if (!approval || !isApprovalActive(approval, now)) return false;
  if (approval.action !== "FINAL_SUBMISSION") return false;
  if (approval.candidate.candidateRef !== request.candidateRef) return false;
  if (approval.jobRef !== request.jobRef || approval.portal !== request.portal) return false;
  if (request.artifactHashes.length === 0) return false;
  return request.artifactHashes.every((hash) => approval.artifactHashes.includes(hash));
}
