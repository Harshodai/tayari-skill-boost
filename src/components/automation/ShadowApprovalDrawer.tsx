import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, Lock, Sparkles, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface ShadowApprovalItem {
  id: string;
  job_title: string;
  company_name: string;
  target_url: string;
  reason: "2fa_required" | "custom_essay" | "salary_range" | "guardrail_review";
  prompt_question?: string;
  suggested_answer?: string;
  pii_detected?: boolean;
}

interface ShadowApprovalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ShadowApprovalItem | null;
  onApprove: (id: string, responseAnswer: string) => void;
  onReject: (id: string) => void;
}

export function ShadowApprovalDrawer({ open, onOpenChange, item, onApprove, onReject }: ShadowApprovalDrawerProps) {
  const { toast } = useToast();
  const [userAnswer, setUserAnswer] = useState(item?.suggested_answer || "");

  useEffect(() => {
    setUserAnswer(item?.suggested_answer || "");
  }, [item]);

  if (!item) return null;

  const handleConfirm = () => {
    onApprove(item.id, userAnswer);
    toast({
      title: "✅ Application Approved & Submitted",
      description: `Auto-Apply proceeding for ${item.job_title} at ${item.company_name}.`
    });
    onOpenChange(false);
  };

  const handleDecline = () => {
    onReject(item.id);
    toast({
      title: "Submission Cancelled",
      description: `Skipped auto-apply for ${item.company_name}.`,
      variant: "destructive"
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg space-y-6 overflow-y-auto">
        <SheetHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Shadow Approval Required
            </Badge>
            <Badge variant="secondary" className="text-xs">Stealth Mode</Badge>
          </div>
          <SheetTitle className="text-xl font-bold">
            Review Submission: {item.company_name}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Role: <span className="font-semibold text-foreground">{item.job_title}</span>
          </SheetDescription>
        </SheetHeader>

        {/* Portal Info Card */}
        <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted-foreground">Target Portal:</span>
            <a 
              href={item.target_url} 
              target="_blank" 
              rel="noreferrer" 
              className="text-primary hover:underline flex items-center gap-1 font-medium"
            >
              Open Direct Job Link <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {item.pii_detected && (
            <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 dark:text-emerald-400 text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>PII Guardrail: Sensitive personal identification tokens redacted.</span>
            </div>
          )}
        </div>

        {/* Reason Specific Question / Input */}
        <div className="space-y-4">
          {item.reason === "2fa_required" && (
            <div className="space-y-2">
              <label className="text-xs font-bold flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-500" /> Enter 2FA / Verification Code
              </label>
              <Input 
                placeholder="e.g. 6-digit code sent to your phone/email"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Workday/Enterprise login requested single-use authentication verification code.
              </p>
            </div>
          )}

          {item.reason === "custom_essay" && (
            <div className="space-y-2">
              <label className="text-xs font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" /> Custom Application Prompt:
              </label>
              <div className="p-3 bg-muted/60 rounded-lg text-xs font-medium text-foreground">
                "{item.prompt_question || "Why do you want to join our engineering team?"}"
              </div>
              <label className="text-xs font-semibold text-muted-foreground block pt-2">AI-Generated Draft Response (Editable):</label>
              <Textarea 
                rows={5}
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Review and edit candidate essay draft..."
              />
            </div>
          )}

          {item.reason === "salary_range" && (
            <div className="space-y-2">
              <label className="text-xs font-bold">Salary Expectation Preference</label>
              <Input 
                placeholder="e.g. $140,000 - $165,000 USD / Competitive"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Portal requires mandatory numerical salary range.
              </p>
            </div>
          )}

          {item.reason === "guardrail_review" && (
            <div className="space-y-2">
              <label className="text-xs font-bold flex items-center gap-1 text-destructive">
                <ShieldAlert className="w-4 h-4" /> Quality Gate Audit Warning
              </label>
              <p className="text-xs text-muted-foreground">
                Resume tailoring triggered a strict verification warning. Review tailored claims below before confirming submission.
              </p>
              <Textarea 
                rows={5}
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
              />
            </div>
          )}
        </div>

        <SheetFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleDecline} className="w-full">
            Skip Application
          </Button>
          <Button onClick={handleConfirm} className="w-full font-bold bg-primary hover:bg-primary/90">
            <CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Submit
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
