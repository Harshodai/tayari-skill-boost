import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Target } from "lucide-react";
import type { ApplicationItem } from "./types";

export interface ResumeOption {
  id: string | number;
  name?: string;
  title?: string;
}

export interface PracticeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applications: ApplicationItem[];
  resumes: ResumeOption[];
  onOpenPractice: (params: {
    app?: ApplicationItem;
    customContext?: {
      title: string;
      company: string;
      job_description: string;
      resume_id: string;
    };
  }) => void;
}

export const PracticeModal: React.FC<PracticeModalProps> = ({
  open,
  onOpenChange,
  applications,
  resumes,
  onOpenPractice,
}) => {
  const [practiceContextType, setPracticeContextType] = useState<"app" | "custom">("app");
  const [practiceAppId, setPracticeAppId] = useState("");
  const [practiceJd, setPracticeJd] = useState("");
  const [practiceResumeId, setPracticeResumeId] = useState("");

  useEffect(() => {
    if (open && applications.length > 0 && !practiceAppId) {
      setPracticeAppId(String(applications[0].id));
    }
  }, [open, applications, practiceAppId]);

  const handleLaunch = () => {
    if (practiceContextType === "app") {
      const target = applications.find((a) => String(a.id) === practiceAppId);
      if (target) {
        onOpenPractice({ app: target });
      }
    } else {
      onOpenPractice({
        customContext: {
          title: "Target Role",
          company: "Custom Opportunity",
          job_description: practiceJd,
          resume_id: practiceResumeId,
        },
      });
    }
    onOpenChange(false);
  };

  const isLaunchDisabled =
    practiceContextType === "app"
      ? !practiceAppId
      : !practiceJd.trim() || !practiceResumeId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
            <Target className="w-5 h-5 text-primary" />
            Start STAR Practice Session
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Real application context is required to ground AI evaluation and follow-up generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs">
          <div className="flex gap-2 border-b border-border/60 pb-3">
            <Button
              type="button"
              variant={practiceContextType === "app" ? "default" : "outline"}
              size="sm"
              onClick={() => setPracticeContextType("app")}
              className="text-xs h-8"
            >
              Active Application
            </Button>
            <Button
              type="button"
              variant={practiceContextType === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setPracticeContextType("custom")}
              className="text-xs h-8"
            >
              Pasted JD + Resume
            </Button>
          </div>

          {practiceContextType === "app" ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground block">
                Select Target Application ({applications.length} available)
              </label>
              {applications.length === 0 ? (
                <p className="text-xs text-amber-500 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                  No active applications found. Switch to "Pasted JD + Resume" or add an application card first.
                </p>
              ) : (
                <select
                  value={practiceAppId}
                  onChange={(e) => setPracticeAppId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-border bg-background text-foreground"
                >
                  <option value="">-- Choose an application --</option>
                  {applications.map((app) => (
                    <option key={String(app.id)} value={String(app.id)}>
                      {app.title} at {app.company} ({app.status || app.stage})
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Pasted Job Description
                </label>
                <Textarea
                  value={practiceJd}
                  onChange={(e) => setPracticeJd(e.target.value)}
                  placeholder="Paste requirements, tech stack, and responsibilities..."
                  className="h-24 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Select Candidate Resume ({resumes.length} available)
                </label>
                {resumes.length === 0 ? (
                  <p className="text-xs text-amber-500 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                    No resumes found in your profile. Upload a resume first to provide candidate context.
                  </p>
                ) : (
                  <select
                    value={practiceResumeId}
                    onChange={(e) => setPracticeResumeId(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-border bg-background text-foreground"
                  >
                    <option value="">-- Choose a resume --</option>
                    {resumes.map((res) => (
                      <option key={res.id} value={res.id}>
                        {res.name || res.title || `Resume (${String(res.id).slice(0, 8)})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={isLaunchDisabled}
            onClick={handleLaunch}
            className="bg-primary text-primary-foreground font-semibold"
          >
            Open STAR Practice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
