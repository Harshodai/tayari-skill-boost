import React from "react";
import { ReceiptBadge, ReceiptStatus } from "./ReceiptBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, ExternalLink, RotateCcw, Clock, ShieldCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SubmissionReceiptItem {
  id: string;
  company?: string | null;
  title?: string | null;
  url?: string | null;
  status: ReceiptStatus;
  confirmationCode?: string | null;
  submittedAt?: string | null;
  failureReason?: string | null;
  atsVendor?: string | null;
}

interface ReceiptCardProps {
  receipt: SubmissionReceiptItem;
  onRetry?: (receipt: SubmissionReceiptItem) => void;
  className?: string;
}

export function ReceiptCard({ receipt, onRetry, className }: ReceiptCardProps) {
  const formattedDate = receipt.submittedAt
    ? new Date(receipt.submittedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recorded";

  return (
    <Card
      data-testid={`receipt-card-${receipt.status}`}
      className={cn(
        "border transition-all hover:shadow-sm",
        receipt.status === "verified" && "border-emerald-500/30 bg-card/90",
        receipt.status === "failed" && "border-rose-500/30 bg-card/90",
        receipt.status === "unverifiable" && "border-slate-500/30 bg-card/90",
        className
      )}
    >
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ReceiptBadge
              status={receipt.status}
              confirmationCode={receipt.confirmationCode}
              showCreditInfo={true}
            />
            {receipt.atsVendor && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                ATS: {receipt.atsVendor}
              </span>
            )}
          </div>

          <div>
            <h4 className="font-semibold text-foreground truncate text-base">
              {receipt.title || "Job Application"}
            </h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{receipt.company || "Unknown Company"}</span>
              <span>•</span>
              <Clock className="w-3 h-3 shrink-0" />
              <span>{formattedDate}</span>
            </div>
          </div>

          {receipt.status === "verified" && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>
                ATS Confirmation Captured: <strong>{receipt.confirmationCode || "Verified Receipt"}</strong>
              </span>
              <span>— 1 Credit Debited</span>
            </div>
          )}

          {receipt.status === "failed" && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Failure Reason: {receipt.failureReason || "Portal rejected submission or session timed out"}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                0 Credits Charged (Free). Your credit was not debited.
              </p>
            </div>
          )}

          {receipt.status === "unverifiable" && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p className="text-slate-600 dark:text-slate-300 font-medium">
                Missing External ATS Confirmation. 0 Credits Charged.
              </p>
              <p className="text-[11px]">
                Submission was recorded by applicant but lacked automated ATS confirmation receipt token.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {receipt.status === "failed" && onRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRetry(receipt)}
              className="border-rose-500/30 text-rose-600 hover:bg-rose-500/10 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Retry Application
            </Button>
          )}

          {receipt.url && (
            <Button size="sm" variant="ghost" asChild className="text-xs">
              <a href={receipt.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> View Posting
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
