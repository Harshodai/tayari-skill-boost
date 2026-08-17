import { apiFetch } from "./client";

export type ProvenanceClassification =
  | "human_only"
  | "ai_assisted"
  | "ai_generated"
  | "ai_transformed"
  | "machine_imported"
  | "unknown"
  | "disputed";

export interface ProvenanceArtifactSummary {
  id: string;
  user_id: string;
  artifact_type: string;
  current_version_id: string | null;
  origin_classification: ProvenanceClassification;
  disclosure_status: string;
  sensitivity: string;
  retention_class: string;
  created_at: string;
  updated_at: string;
}

export interface ProvenanceCollectionResponse {
  schema: "tayari.ai-provenance.collection.v1";
  policy_version: string;
  artifacts: ProvenanceArtifactSummary[];
}

export interface ProvenanceDisclosure {
  disclosure_id: string;
  artifact_id: string;
  classification: ProvenanceClassification;
  user_label: string;
  reason_codes: string[];
  confidence: "high" | "medium" | "low" | "unknown";
  human_review_status: string;
  policy_version: string;
  evaluator_version: string;
}

export interface ProvenanceArtifactDetail {
  schema: "tayari.ai-provenance.artifact.v1";
  policy_version: string;
  artifact: ProvenanceArtifactSummary;
  versions: Array<Record<string, unknown>>;
  origin_events: Array<Record<string, unknown>>;
  disclosures: Array<Record<string, unknown>>;
}

export interface ProvenanceExport {
  schema: "tayari.ai-provenance.export.v1";
  policy_version: string;
  evaluator_version: string;
  owner_id: string;
  generated_at: string;
  count: number;
  completeness: {
    unknown_artifacts: number;
    provenance_complete: number;
  };
  artifacts: ProvenanceArtifactDetail[];
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

export function listProvenanceArtifacts(options: {
  origin?: ProvenanceClassification;
  disclosureStatus?: string;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<ProvenanceCollectionResponse> {
  return apiFetch<ProvenanceCollectionResponse>(
    `/v1/provenance/artifacts${query({
      origin: options.origin,
      disclosure_status: options.disclosureStatus,
      created_after: options.createdAfter,
      created_before: options.createdBefore,
      limit: options.limit,
      offset: options.offset,
    })}`,
  );
}

export function getProvenanceArtifact(artifactId: string): Promise<ProvenanceArtifactDetail> {
  return apiFetch<ProvenanceArtifactDetail>(`/v1/provenance/artifacts/${encodeURIComponent(artifactId)}`);
}

export function computeProvenanceDisclosure(
  artifactId: string,
  channel = "internal",
): Promise<ProvenanceDisclosure> {
  return apiFetch<ProvenanceDisclosure>(`/v1/provenance/artifacts/${encodeURIComponent(artifactId)}/disclosure`, {
    method: "POST",
    body: JSON.stringify({ channel }),
  });
}

export function exportProvenance(options: {
  origin?: ProvenanceClassification;
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
} = {}): Promise<ProvenanceExport> {
  return apiFetch<ProvenanceExport>(
    `/v1/provenance/export${query({
      origin: options.origin,
      created_after: options.createdAfter,
      created_before: options.createdBefore,
      limit: options.limit,
    })}`,
  );
}
