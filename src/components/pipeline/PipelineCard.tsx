import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, GripVertical, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineJob } from "./types";

interface Props {
  job: PipelineJob;
  isOverlay?: boolean;
}

export function PipelineCard({ job, isOverlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
    data: { stage: job.stage },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

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
  );
}
