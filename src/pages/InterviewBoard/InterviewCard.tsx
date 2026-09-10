import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  MapPin,
  MessageSquare,
  Mic,
  Brain,
  Share2,
  Trophy,
  ArrowLeft,
  ArrowRight,
  Trash2,
} from "lucide-react";
import type { ApplicationItem } from "./types";

export interface InterviewCardProps {
  app: ApplicationItem;
  columnId: string;
  isMoving: boolean;
  isFirstColumn: boolean;
  isLastColumn: boolean;
  onSelect: (app: ApplicationItem) => void;
  onMove: (app: ApplicationItem, direction: "left" | "right") => void;
  onDelete: (id: string | number) => void;
  isDeleting: boolean;
  onMilestone: (app: ApplicationItem, stage: "interview" | "offer") => void;
  onCelebration: (app: ApplicationItem) => void;
}

export const InterviewCard: React.FC<InterviewCardProps> = ({
  app,
  columnId,
  isMoving,
  isFirstColumn,
  isLastColumn,
  onSelect,
  onMove,
  onDelete,
  isDeleting,
  onMilestone,
  onCelebration,
}) => {
  return (
    <Card
      className={`group relative cursor-pointer border-border/60 hover:border-primary/40 bg-card/70 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        isMoving ? "opacity-60" : ""
      }`}
      onClick={() => onSelect(app)}
    >
      <CardContent className="p-3.5 space-y-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
              {app.title || app.job?.title || "Untitled Role"}
            </h4>
            <p className="text-xs text-muted-foreground truncate">
              {app.company || app.job?.company || "Unknown"}
            </p>
            {app.location && (
              <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {app.location}
              </p>
            )}
          </div>
        </div>

        {/* Quick indicators */}
        <div className="flex flex-wrap gap-1">
          {app.notes_log && app.notes_log.length > 0 && (
            <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-muted/30">
              <MessageSquare className="w-2.5 h-2.5 mr-1" />
              {app.notes_log.length}
            </Badge>
          )}
          {app.voice_notes && app.voice_notes.length > 0 && (
            <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-accent/5 text-accent border-accent/10">
              <Mic className="w-2.5 h-2.5 mr-1" />
              {app.voice_notes.length}
            </Badge>
          )}
          {app.interview_research && app.interview_research.commonly_asked && (
            <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-primary/5 text-primary border-primary/10">
              <Brain className="w-2.5 h-2.5 mr-1" /> AI Intel
            </Badge>
          )}
        </div>

        {/* Milestone & Celebration Action Buttons */}
        {columnId === "interview" && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-[11px] h-7 gap-1.5 border-blue-500/30 text-blue-500 hover:bg-blue-500/10 hover:text-blue-400 font-medium"
            onClick={(e) => {
              e.stopPropagation();
              onMilestone(app, "interview");
            }}
          >
            <Share2 className="w-3 h-3" />
            Share Milestone on LinkedIn
          </Button>
        )}
        {columnId === "offer" && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-[11px] h-7 gap-1.5 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 font-semibold"
            onClick={(e) => {
              e.stopPropagation();
              onCelebration(app);
            }}
          >
            <Trophy className="w-3 h-3 text-emerald-400" />
            Alumni Celebration & Perks
          </Button>
        )}

        {/* Controls */}
        <div
          className="flex items-center justify-between pt-1 border-t border-border/30"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-muted"
              disabled={isFirstColumn || isMoving}
              onClick={() => onMove(app, "left")}
            >
              <ArrowLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-muted"
              disabled={isLastColumn || isMoving}
              onClick={() => onMove(app, "right")}
            >
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              if (app.id !== undefined) onDelete(app.id);
            }}
            disabled={isDeleting || app.id === undefined}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
