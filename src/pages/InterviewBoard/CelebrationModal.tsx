import React from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Confetti } from "@/components/ui/confetti";
import { Trophy, PartyPopper, Gift, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { getMilestonePostText } from "./MilestoneModal";
import type { ApplicationItem } from "./types";

export interface CelebrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: ApplicationItem | null;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
  open,
  onOpenChange,
  app,
}) => {
  if (!app) return null;

  const writeToClipboard = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const getReferralUrl = (item: ApplicationItem) => {
    const code = item.id ? String(item.id).slice(0, 8).toUpperCase() : "PRO3M";
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}/auth?mode=signup&ref=ALUMNI-${code}&gift=3m`;
    }
    return `https://tayari.app/auth?mode=signup&ref=ALUMNI-${code}&gift=3m`;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border border-emerald-500/30 shadow-2xl bg-card">
        {open && <Confetti count={75} />}

        {/* Header banner */}
        <div className="relative p-6 pb-5 border-b bg-gradient-to-br from-emerald-500/20 via-amber-500/10 to-primary/10 border-emerald-500/20 overflow-hidden">
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
              <Trophy className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400 border border-emerald-500/30 mb-1.5">
                <PartyPopper className="w-3.5 h-3.5" />
                Offer Accepted / Hired
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground">
                Welcome to Job Tayari Alumni!
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Huge congratulations on landing{" "}
                <span className="font-semibold text-foreground">
                  {app.title || app.job?.title || "Software Engineer"}
                </span>{" "}
                at{" "}
                <span className="font-semibold text-foreground">
                  {app.company || app.job?.company || "Target Company"}
                </span>
                !
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 bg-card relative z-10">
          {/* Referral Gift Card */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Gift 3 Free Months of Job Tayari Pro to a Friend
                </h3>
                <p className="text-xs text-muted-foreground">
                  As an alumni, sponsor a fellow job seeker with 3 months of unlimited ATS calibrations and tailoring.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={getReferralUrl(app)}
                className="font-mono text-xs bg-background/80 select-all"
              />
              <Button
                size="sm"
                variant="default"
                onClick={async () => {
                  const copied = await writeToClipboard(getReferralUrl(app));
                  if (copied) {
                    toast.success("Referral link copied! Share it with a friend.");
                  } else {
                    toast.error("Could not copy to clipboard.");
                  }
                }}
                className="shrink-0 text-xs gap-1.5 px-4 font-semibold"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Link
              </Button>
            </div>
          </div>

          {/* LinkedIn Announcement */}
          <div className="space-y-2.5 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Share the Good News on LinkedIn
                </h4>
              </div>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Viral Alumni Post
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">
              Inspire fellow job seekers and share your success with our pre-populated post tagging Job Tayari.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const text = getMilestonePostText(app, "offer");
                  const copied = await writeToClipboard(text);
                  if (copied) {
                    toast.success("Offer announcement post copied!");
                  } else {
                    toast.error("Could not copy to clipboard.");
                  }
                }}
                className="text-xs gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Post
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const text = getMilestonePostText(app, "offer");
                  handleShareToLinkedIn(text);
                }}
                className="bg-[#0a66c2] hover:bg-[#084e96] text-white text-xs gap-1.5 font-semibold shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share on LinkedIn
              </Button>
            </div>
          </div>

          {/* Close button */}
          <div className="flex justify-end pt-2 border-t border-border/40">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs px-6"
            >
              Done & Back to Board
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
