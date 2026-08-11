export type PipelineStage = "saved" | "applied" | "interview" | "offer" | "rejected";

export interface PipelineJob {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  url?: string | null;
  stage: PipelineStage;
  savedAt?: string;
  /**
   * Submission proof, when a receipt exists for this job.
   * `undefined` = never submitted through the agent.
   * `verified: true` = the ATS printed a confirmation phrase (and optional
   *   reference number) — the submission is provable.
   * `verified: false, failed: false` = the agent finished but the site showed
   *   no confirmation. Deliberately shown rather than rounded up to "Applied".
   * `failed: true` = the run died before reaching submit (network error,
   *   agent blocked, site rejected). Distinct from "no confirmation" so a
   *   missing receipt never looks like a pending one (audit Q8.2 / WS-02).
   */
  receipt?: {
    verified: boolean;
    failed?: boolean;
    confirmationNumber?: string | null;
    submittedAt?: string | null;
  };
}


export const PIPELINE_STAGES: { key: PipelineStage; label: string; tint: string }[] = [
  { key: "saved", label: "Saved", tint: "text-muted-foreground" },
  { key: "applied", label: "Applied", tint: "text-primary" },
  { key: "interview", label: "Interview", tint: "text-accent" },
  { key: "offer", label: "Offer", tint: "text-success" },
  { key: "rejected", label: "Rejected", tint: "text-destructive" },
];

const KEY = "tayari.pipeline.stages.v1";

export function loadStageMap(): Record<string, PipelineStage> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveStageMap(map: Record<string, PipelineStage>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
