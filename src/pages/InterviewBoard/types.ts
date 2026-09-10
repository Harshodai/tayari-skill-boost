import type { CopilotStreamEvent } from "@/api/ai";
import type { GmailSyncOptions, Application } from "@/api";

export type StageId = "saved" | "applied" | "phone_screen" | "interview" | "offer" | "rejected";

export interface Column {
  id: string;
  label: string;
  dotColor: string;
  headerBg: string;
  badgeBg: string;
}

export const COLUMNS: Column[] = [
  { id: "saved", label: "Saved", dotColor: "bg-slate-400 shadow-slate-400/50", headerBg: "bg-slate-500/10 border-slate-500/20", badgeBg: "bg-slate-500/15 text-muted-foreground" },
  { id: "applied", label: "Applied", dotColor: "bg-blue-400 shadow-blue-400/50", headerBg: "bg-blue-500/10 border-blue-500/20", badgeBg: "bg-blue-500/15 text-blue-300" },
  { id: "phone_screen", label: "Phone Screen", dotColor: "bg-amber-400 shadow-amber-400/50", headerBg: "bg-amber-500/10 border-amber-500/20", badgeBg: "bg-amber-500/15 text-amber-300" },
  { id: "interview", label: "Interview", dotColor: "bg-primary shadow-primary/50", headerBg: "bg-primary/10 border-primary/20", badgeBg: "bg-primary/15 text-primary" },
  { id: "offer", label: "Offer", dotColor: "bg-success shadow-emerald-400/50", headerBg: "bg-success/10 border-success/20", badgeBg: "bg-success/15 text-success" },
  { id: "rejected", label: "Rejected", dotColor: "bg-destructive shadow-rose-400/50", headerBg: "bg-destructive/10 border-destructive/20", badgeBg: "bg-destructive/15 text-destructive" },
];

export interface InterviewNote {
  id?: string;
  text: string;
  at?: string;
}

export interface VoiceNote {
  id?: string;
  transcript?: string;
  url?: string;
  at?: string;
}

export interface CommonlyAskedQuestion {
  question: string;
  category?: string;
  why_asked?: string;
  how_to_answer?: string;
}

export interface InterviewResearch {
  commonly_asked?: CommonlyAskedQuestion[];
  preparation_focus?: string[];
  recent_topics?: string[];
  red_flags_to_avoid?: string[];
}

export type ApplicationItem = Partial<Application> & {
  id?: number | string;
  job_description?: string;
  resume_id?: string;
};

export interface FilterState {
  search: string;
  stage?: string;
}

export interface PracticeDelta {
  headline: string;
  subtext: string;
  badge: string;
  improved: boolean;
}

export interface ParsedEmailData {
  title?: string;
  company?: string;
  location?: string;
  stage?: string;
  summary?: string;
  is_job_related?: boolean;
}

export interface StarBreakdownDetail {
  strength?: "strong" | "adequate" | "needs_improvement" | "missing" | string;
  feedback?: string;
}

export interface StarResult {
  completeness_score: number;
  star_score?: number;
  missing_elements?: string[];
  breakdown?: {
    situation?: StarBreakdownDetail;
    task?: StarBreakdownDetail;
    action?: StarBreakdownDetail;
    result?: StarBreakdownDetail;
  };
  follow_up_question?: string;
  follow_up_target?: string;
  coaching_tips?: string[];
}

export type { CopilotStreamEvent, GmailSyncOptions };
