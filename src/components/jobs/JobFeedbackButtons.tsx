import { useState } from "react";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postJobFeedback, type FeedbackType } from "@/api";
import { cn } from "@/lib/utils";

// -------------------------------------------------------------------
// M4 — like / applied feedback signals on a job card.
//
// Sends a single feedback event to POST /api/v1/preferences/feedback so the
// preference-learning job can weight future recommendations. Fire-and-forget
// with optimistic local state; failures stay silent (preference signals are
// best-effort, never block the job UI).
//
// SRP: owns only signal capture. Props are the job identity it needs.
// -------------------------------------------------------------------

interface JobFeedbackButtonsProps {
  jobId: string;
  jobTitle?: string;
  companyName?: string;
  metadata?: Record<string, unknown>;
  className?: string;
}

export function JobFeedbackButtons({
  jobId,
  jobTitle,
  companyName,
  metadata,
  className,
}: JobFeedbackButtonsProps) {
  const [selected, setSelected] = useState<FeedbackType | null>(null);

  const send = async (type: FeedbackType) => {
    setSelected(type);
    try {
      await postJobFeedback({
        job_id: jobId,
        feedback_type: type,
        job_title: jobTitle,
        company_name: companyName,
        metadata,
      });
    } catch {
      // ponytail: still best-effort — no toast, don't spam the user for a
      // low-stakes preference signal. But the button previously stayed
      // visually "selected" even when the write never landed, silently
      // claiming a click succeeded when it didn't; revert so the UI is
      // honest about what actually got recorded.
      setSelected(null);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        size="sm"
        variant={selected === "liked" ? "default" : "outline"}
        onClick={() => send("liked")}
        aria-pressed={selected === "liked"}
        aria-label="I like this job"
      >
        <ThumbsUp className="w-4 h-4 mr-1.5" />
        Like
      </Button>
      <Button
        size="sm"
        variant={selected === "applied" ? "default" : "outline"}
        onClick={() => send("applied")}
        aria-pressed={selected === "applied"}
        aria-label="Mark as applied"
      >
        <Check className="w-4 h-4 mr-1.5" />
        Applied
      </Button>
      <Button
        size="sm"
        variant={selected === "disliked" ? "destructive" : "outline"}
        onClick={() => send("disliked")}
        aria-pressed={selected === "disliked"}
        aria-label="Not interested"
      >
        <ThumbsDown className="w-4 h-4 mr-1.5" />
        Skip
      </Button>
    </div>
  );
}