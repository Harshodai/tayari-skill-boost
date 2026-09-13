import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, GripVertical, MapPin, MessageSquare, CheckCheck, XCircle, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { PipelineJob, PipelineStage, ReceiptStatus } from "./types";

interface Props {
  job: PipelineJob;
  isOverlay?: boolean;
  selected?: boolean;
  onSelect?: (job: PipelineJob) => void;
}

const STAGE_COMM_TYPE: Record<PipelineStage, string | null> = {
  saved: null,
  applied: "follow-up",
  interview: "thank-you",
  offer: "negotiation",
  rejected: "status-check",
};

export function PipelineCard({ job, isOverlay, selected, onSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
    data: { stage: job.stage },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const commType = STAGE_COMM_TYPE[job.stage];

  // Determine receipt status accurately
  let receiptStatus: ReceiptStatus | null = null;
  if (job.receipt) {
    if (job.receipt.status) {
      receiptStatus = job.receipt.status;
    } else if (job.receipt.failed) {
      receiptStatus = "failed";
    } else if (job.receipt.verified) {
      receiptStatus = "verified";
    } else {
      receiptStatus = "unverifiable";
    }
  }

  const confirmationCode = job.receipt?.confirmationCode || job.receipt?.confirmationNumber;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={`pipeline-card-${job.id}`}
      data-press
      role="button"
      tabIndex={0}
      aria-pressed={selected ? true : undefined}
      aria-label={`${job.title} at ${job.company} — ${job.stage} stage`}
      onClick={() => onSelect?.(job)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(job);
        }
      }}
      className={cn(
        "group rounded-md border bg-card p-3 text-left shadow-sm cursor-grab active:cursor-grabbing",
        "transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:translate-y-0 active:scale-[0.99]",
        selected && "border-primary bg-primary/[0.06] shadow-md ring-1 ring-primary/30",
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

          {/* Submission Receipts with Visually Distinct Verified, Failed, and Unverifiable states */}
          {receiptStatus === "verified" && (
            <div
              data-testid="receipt-verified"
              className="mt-2 p-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-600 dark:text-emerald-400 space-y-0.5"
            >
              <div className="flex items-center gap-1 font-semibold">
                <CheckCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>VERIFIED RECEIPT</span>
                {confirmationCode && (
                  <span className="font-mono text-[10px] opacity-90 truncate">#{confirmationCode}</span>
                )}
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">
                1 Credit Debited
              </div>
            </div>
          )}

          {receiptStatus === "failed" && (
            <div
              data-testid="receipt-failed"
              className="mt-2 p-1.5 rounded bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-600 dark:text-rose-400 space-y-0.5"
            >
              <div className="flex items-center gap-1 font-semibold">
                <XCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>SUBMISSION FAILED</span>
              </div>
              <p className="text-[10px] text-rose-700 dark:text-rose-300 truncate">
                {job.receipt?.failureReason || "Portal error · 0 Credits Charged (Free)"}
              </p>
            </div>
          )}

          {receiptStatus === "unverifiable" && (
            <div
              data-testid="receipt-unverifiable"
              className="mt-2 p-1.5 rounded bg-slate-500/10 border border-slate-500/30 text-[11px] text-slate-700 dark:text-slate-300 space-y-0.5"
            >
              <div className="flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span className="truncate">UNVERIFIABLE / CANDIDATE CONFIRMED</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Missing External ATS Confirmation. 0 Credits Charged.
              </p>
            </div>
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
