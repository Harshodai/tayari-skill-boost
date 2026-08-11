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

/** A verified application outcome always requires a receipt observed by an external system. */
export function canMarkExternallyVerified(receipt: ApplicationReceipt | undefined): boolean {
  return receipt?.outcome === "EXTERNALLY_VERIFIED" && Boolean(receipt.evidenceHash);
}

export function isApprovalActive(approval: Approval, now = new Date()): boolean {
  return approval.decision === "APPROVED" && new Date(approval.expiresAt).getTime() > now.getTime();
}
