import React from "react";
import { CheckCheck, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReceiptStatus = "verified" | "failed" | "unverifiable";

export interface ReceiptBadgeProps {
  status: ReceiptStatus;
  confirmationCode?: string | null;
  className?: string;
  showCreditInfo?: boolean;
}

export function ReceiptBadge({
  status,
  confirmationCode,
  className,
  showCreditInfo = true,
}: ReceiptBadgeProps) {
  if (status === "verified") {
    return (
      <span
        data-testid="receipt-badge-verified"
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
          "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 dark:bg-emerald-950/60",
          className
        )}
      >
        <CheckCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>VERIFIED RECEIPT</span>
        {confirmationCode && (
          <span className="font-mono text-[11px] opacity-90">({confirmationCode})</span>
        )}
        {showCreditInfo && (
          <span className="ml-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            1 Credit Debited
          </span>
        )}
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        data-testid="receipt-badge-failed"
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
          "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 dark:bg-rose-950/60",
          className
        )}
      >
        <XCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
        <span>SUBMISSION FAILED</span>
        {showCreditInfo && (
          <span className="ml-1 text-[10px] font-medium text-rose-700 dark:text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded">
            0 Credits Charged (Free)
          </span>
        )}
      </span>
    );
  }

  // Unverifiable
  return (
    <span
      data-testid="receipt-badge-unverifiable"
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
        "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30 dark:bg-slate-800",
        className
      )}
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
      <span>UNVERIFIABLE / CANDIDATE CONFIRMED</span>
      {showCreditInfo && (
        <span className="ml-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-500/10 px-1.5 py-0.5 rounded">
          0 Credits Charged
        </span>
      )}
    </span>
  );
}
