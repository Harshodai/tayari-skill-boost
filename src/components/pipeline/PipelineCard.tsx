import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, GripVertical, MapPin, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { PipelineJob, PipelineStage } from "./types";

interface Props {
  job: PipelineJob;
  isOverlay?: boolean;
}

// ponytail: stage → suggested comms template. Dragging a card to a stage is
// the trigger (audit action #6); the deep-link pre-selects the matching
// template in CommunicationHub. saved = nothing to message yet → null.
const STAGE_COMM_TYPE: Record<PipelineStage, string | null> = {
  saved: null,
  applied: "follow-up",
  interview: "thank-you",
  offer: "negotiation",
  rejected: "status-check",
};

export function PipelineCard({ job, isOverlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
    data: { stage: job.stage },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const commType = STAGE_COMM_TYPE[job.stage];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group rounded-md border bg-card p-3 text-left shadow-sm cursor-grab active:cursor-grabbing",
        "hover:border-primary/40 hover:shadow transition-all",
        isDragging && "opacity-40",
        isOverlay && "shadow-lg ring-1 ring-primary/40 rotate-1"
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight truncate">{job.title}</p>
          <p className="text-xs text-muted-foreground truncate">{job.company}</p>
          {job.location && (
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" /> {job.location}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {commType && (
            <Link
              to={`/communication?type=${commType}`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
              aria-label={`Draft ${commType.replace("-", " ")} message`}
              title={`Draft ${commType.replace("-", " ")} message`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </Link>
          )}
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              aria-label="Open job posting"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
