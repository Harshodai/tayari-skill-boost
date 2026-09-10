import React from "react";
import { Badge } from "@/components/ui/badge";
import { InterviewCard } from "./InterviewCard";
import type { ApplicationItem, Column } from "./types";

export interface InterviewColumnProps {
  column: Column;
  apps: ApplicationItem[];
  optimisticApps: Record<string, string>;
  isFirstColumn: boolean;
  isLastColumn: boolean;
  onSelectApp: (app: ApplicationItem) => void;
  onMoveApp: (app: ApplicationItem, direction: "left" | "right") => void;
  onDeleteApp: (id: string | number) => void;
  isDeleting: boolean;
  onMilestone: (app: ApplicationItem, stage: "interview" | "offer") => void;
  onCelebration: (app: ApplicationItem) => void;
}

export const InterviewColumn: React.FC<InterviewColumnProps> = ({
  column,
  apps,
  optimisticApps,
  isFirstColumn,
  isLastColumn,
  onSelectApp,
  onMoveApp,
  onDeleteApp,
  isDeleting,
  onMilestone,
  onCelebration,
}) => {
  return (
    <div className="flex flex-col min-w-[200px] flex-1">
      {/* Column header */}
      <div
        className={`p-3.5 rounded-t-xl ${column.headerBg} border flex items-center justify-between backdrop-blur-md shadow-xs`}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${column.dotColor} shadow-xs`} />
          <span className="text-xs font-extrabold uppercase tracking-wider text-foreground/90">
            {column.label}
          </span>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] font-black border-0 px-2 py-0.5 rounded-full ${column.badgeBg}`}
        >
          {apps.length}
        </Badge>
      </div>

      {/* Cards feed */}
      <div className="flex-1 bg-card/20 border-x border-b border-border/60 rounded-b-xl p-2.5 space-y-3 min-h-[350px] transition-colors flex flex-col">
        {apps.length === 0 ? (
          <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-border/50 text-center bg-card/10">
            <p className="text-xs font-semibold text-muted-foreground">
              No active interviews in this stage
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-1 max-w-[160px] leading-normal">
              {column.id === "saved"
                ? "Add or import positions to track them here"
                : `Move cards here when reaching ${column.label.toLowerCase()}`}
            </p>
          </div>
        ) : (
          apps.map((app) => (
            <InterviewCard
              key={app.id}
              app={app}
              columnId={column.id}
              isMoving={Boolean(optimisticApps[String(app.id)])}
              isFirstColumn={isFirstColumn}
              isLastColumn={isLastColumn}
              onSelect={onSelectApp}
              onMove={onMoveApp}
              onDelete={onDeleteApp}
              isDeleting={isDeleting}
              onMilestone={onMilestone}
              onCelebration={onCelebration}
            />
          ))
        )}
      </div>
    </div>
  );
};
