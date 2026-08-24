import { Badge } from "@/components/ui/badge";
import type { ProvenanceClassification } from "@/api";

const LABELS: Record<ProvenanceClassification, string> = {
  human_only: "Created by a human",
  ai_assisted: "Created with AI assistance",
  ai_generated: "Created entirely by AI",
  ai_transformed: "Transformed by AI",
  machine_imported: "Imported from an external system",
  unknown: "Origin not recorded",
  disputed: "Origin under review",
};

const COLORS: Record<ProvenanceClassification, string> = {
  human_only: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  ai_assisted: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  ai_generated: "bg-accent/10 text-accent border-accent/20",
  ai_transformed: "bg-primary/10 text-primary border-primary/20",
  machine_imported: "bg-slate-500/10 text-slate-700 border-slate-500/20",
  unknown: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  disputed: "bg-red-500/10 text-red-700 border-red-500/20",
};

export function ProvenanceBadge({
  classification = "unknown",
  className = "",
}: {
  classification?: ProvenanceClassification;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={`${COLORS[classification]} ${className}`}
      title="This label reflects recorded provenance only; it does not certify factual accuracy or external submission."
    >
      {LABELS[classification]}
    </Badge>
  );
}
