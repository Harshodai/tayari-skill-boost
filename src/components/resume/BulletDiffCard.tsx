import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, GitCompare, Plus, Minus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BulletDiffEntry {
  original: string;
  optimized: string;
  status: "modified" | "added" | "removed" | "unchanged";
}

interface BulletDiffCardProps {
  diffs: BulletDiffEntry[];
  className?: string;
}

export const BulletDiffCard: React.FC<BulletDiffCardProps> = ({
  diffs,
  className,
}) => {
  if (!diffs || diffs.length === 0) return null;

  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Resume Bullet Changes (Before & After)</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">{diffs.length} section(s) tracked</span>
        </div>
        <CardDescription className="text-xs">
          Line-by-line provenance showing exactly how your achievements were re-expressed for ATS relevance and impact.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {diffs.map((entry, idx) => {
          if (entry.status === "unchanged") return null;
          return (
            <div key={idx} className="p-3 rounded-lg border border-border bg-muted/10 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Item #{idx + 1}
                </span>
                <Badge
                  variant={entry.status === "added" ? "default" : entry.status === "modified" ? "secondary" : "outline"}
                  className="text-[10px] uppercase tracking-wider"
                >
                  {entry.status}
                </Badge>
              </div>
              {entry.original && (
                <div className="rounded bg-destructive/5 border border-destructive/15 p-2 text-muted-foreground">
                  <span className="font-mono text-[10px] text-destructive mr-1 font-bold">ORIGINAL:</span>
                  <span>{entry.original}</span>
                </div>
              )}
              {entry.optimized && (
                <div className="rounded bg-emerald-500/5 border border-emerald-500/15 p-2 text-foreground font-medium">
                  <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 mr-1 font-bold">TAILORED:</span>
                  <span>{entry.optimized}</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
