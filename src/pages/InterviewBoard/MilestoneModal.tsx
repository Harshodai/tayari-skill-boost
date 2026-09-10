import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Share2, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";
import type { ApplicationItem } from "./types";

export interface MilestoneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: ApplicationItem | null;
  stage: "interview" | "offer";
}

export const getMilestonePostText = (app: ApplicationItem | null, stage: "interview" | "offer"): string => {
  const role = app?.title || app?.job?.title || "Software Engineer";
  const company = app?.company || app?.job?.company || "Company";
  if (stage === "offer") {
    return `Thrilled to share that I've received an offer for ${role} at ${company}! 🎉\n\nGrateful for the focused preparation and steady progress tracking along the way.\n\nProud to officially join the Job Tayari Alumni community! Keep your job search deliberate. #JobOffer #Hired #Alumni #CareerGrowth #JobTayari`;
  }
  return `Excited to advance to the interview stage for ${role} at ${company}! 🚀\n\nTaking a deliberate, prepared approach to applications made all the difference—organized tracking, structured interview preparation, and steady follow-through.\n\nLooking forward to the conversations ahead! #JobSearch #CareerMilestone #InterviewPrep #JobTayari`;
};

export const MilestoneModal: React.FC<MilestoneModalProps> = ({
  open,
  onOpenChange,
  app,
  stage,
}) => {
  const [customText, setCustomText] = useState("");

  useEffect(() => {
    if (app) {
      setCustomText(getMilestonePostText(app, stage));
    }
  }, [app, stage]);

  const writeToClipboard = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleShareToLinkedIn = async (text: string) => {
    const copied = await writeToClipboard(text);
    const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    if (copied) {
      toast.success("Post copied to clipboard! Opening LinkedIn feed...");
    } else {
      toast.error("Could not copy to clipboard. Please copy the text manually.");
    }
  };

  if (!app) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border border-border shadow-2xl bg-card">
        <div className="p-6 border-b bg-gradient-to-r from-blue-600/10 via-primary/10 to-transparent border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/15 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                Share Milestone on LinkedIn
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stage === "offer" ? "Celebrate your offer" : "Share your interview progress"} for{" "}
                <span className="font-semibold text-foreground">
                  {app.title || app.job?.title || "Software Engineer"}
                </span>{" "}
                at{" "}
                <span className="font-semibold text-foreground">
                  {app.company || app.job?.company || "Company"}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Post Preview (Editable)</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                Pre-populated with honest, tasteful messaging
              </span>
            </label>
            <Textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="min-h-[140px] text-xs font-sans leading-relaxed bg-muted/20 border-border/70"
            />
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
            <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>
              Clicking <strong>Share to LinkedIn</strong> copies this draft to your clipboard and opens the LinkedIn post editor with 1 click.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground text-xs w-full sm:w-auto"
            >
              Dismiss
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const copied = await writeToClipboard(customText);
                  if (copied) {
                    toast.success("Copied post text to clipboard!");
                  } else {
                    toast.error("Could not copy to clipboard.");
                  }
                }}
                className="text-xs gap-1.5 flex-1 sm:flex-initial"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Text
              </Button>
              <Button
                size="sm"
                onClick={() => handleShareToLinkedIn(customText)}
                className="bg-[#0a66c2] hover:bg-[#084e96] text-white text-xs gap-1.5 flex-1 sm:flex-initial"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share to LinkedIn
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
