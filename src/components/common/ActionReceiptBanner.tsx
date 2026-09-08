import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldAlert, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionReceiptItem {
  id: string;
  actionTitle: string;
  category: "prepared" | "reviewed" | "approved" | "handed_off" | "synced" | "receipted";
  timestamp: string;
  didList: string[];
  didNotList: string[];
  proofHash?: string;
}

interface ActionReceiptBannerProps {
  receipt: ActionReceiptItem;
  className?: string;
}

export const ActionReceiptBanner: React.FC<ActionReceiptBannerProps> = ({
  receipt,
  className,
}) => {
  return (
    <Card className={cn("border-border bg-card/60 backdrop-blur-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">
              Action Receipt: {receipt.actionTitle}
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs uppercase tracking-wider">
            {receipt.category}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">Recorded at {receipt.timestamp}</p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400 mb-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>What Job Tayari Did</span>
            </div>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              {receipt.didList.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-muted bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 font-medium text-foreground mb-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <span>What Job Tayari Did NOT Do (By Policy)</span>
            </div>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              {receipt.didNotList.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        {receipt.proofHash && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
            <span>Durable Proof Hash:</span>
            <code className="font-mono bg-muted/60 px-1.5 py-0.5 rounded">{receipt.proofHash}</code>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
