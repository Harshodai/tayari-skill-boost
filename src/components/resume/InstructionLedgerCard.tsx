import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InstructionLedgerEntry {
  instruction: string;
  status: "applied" | "ignored" | "rejected";
  reason: string;
}

interface InstructionLedgerCardProps {
  entries: InstructionLedgerEntry[];
  className?: string;
}

export const InstructionLedgerCard: React.FC<InstructionLedgerCardProps> = ({
  entries,
  className,
}) => {
  if (!entries || entries.length === 0) return null;

  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Custom Instructions Ledger</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">{entries.length} directive(s) audited</span>
        </div>
        <CardDescription className="text-xs">
          Transparent audit of candidate custom instructions evaluated against truthfulness guardrails and relevance bounds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {entries.map((entry, idx) => {
          const isApplied = entry.status === "applied";
          const isRejected = entry.status === "rejected";
          return (
            <div
              key={idx}
              className={cn(
                "p-3 rounded-lg border text-xs flex flex-col md:flex-row md:items-center justify-between gap-2",
                isApplied && "border-emerald-500/25 bg-emerald-500/5",
                isRejected && "border-destructive/30 bg-destructive/5",
                !isApplied && !isRejected && "border-border bg-muted/20"
              )}
            >
              <div className="flex items-start gap-2 flex-1">
                {isApplied && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />}
                {isRejected && <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                {!isApplied && !isRejected && <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                <div>
                  <p className="font-medium text-foreground">{entry.instruction}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{entry.reason}</p>
                </div>
              </div>
              <Badge
                variant={isApplied ? "default" : isRejected ? "destructive" : "secondary"}
                className={cn(
                  "text-[10px] uppercase tracking-wider self-start md:self-auto",
                  isApplied && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                )}
              >
                {entry.status}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
