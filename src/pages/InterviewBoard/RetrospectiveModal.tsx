import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Trophy,
  HeartCrack,
  FileText,
  Mic,
  MicOff,
  Brain,
  MessageSquare,
  Target,
  BookOpen,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { ApplicationItem } from "./types";

export interface RetrospectiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: ApplicationItem | null;
  targetStage: string;
  isSaving: boolean;
  onSubmit: (params: { text: string; audioBlob: Blob | null; skip: boolean }) => Promise<void>;
}

export const RetrospectiveModal: React.FC<RetrospectiveModalProps> = ({
  open,
  onOpenChange,
  app,
  targetStage,
  isSaving,
  onSubmit,
}) => {
  const [retroText, setRetroText] = useState("");
  const [retroTab, setRetroTab] = useState<"text" | "voice">("text");
  const [retroRecording, setRetroRecording] = useState(false);
  const [retroAudioUrl, setRetroAudioUrl] = useState<string | null>(null);
  const [retroAudioBlob, setRetroAudioBlob] = useState<Blob | null>(null);
  const retroMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const retroAudioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!open) {
      setRetroText("");
      setRetroTab("text");
      if (retroAudioUrl) {
        try {
          URL.revokeObjectURL(retroAudioUrl);
        } catch {
          /* best effort */
        }
      }
      setRetroAudioUrl(null);
      setRetroAudioBlob(null);
      setRetroRecording(false);
    }
  }, [open, retroAudioUrl]);

  const cleanupRecording = () => {
    if (retroMediaRecorderRef.current && retroRecording) {
      try {
        retroMediaRecorderRef.current.onstop = null;
        retroMediaRecorderRef.current.stop();
        retroMediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* best effort */
      }
    }
    setRetroRecording(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && !isSaving) {
      cleanupRecording();
      onOpenChange(false);
    }
  };

  const startRetroRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      retroMediaRecorderRef.current = recorder;
      retroAudioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) retroAudioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(retroAudioChunksRef.current, { type: "audio/webm" });
        setRetroAudioBlob(blob);
        setRetroAudioUrl(URL.createObjectURL(blob));
      };
      recorder.start();
      setRetroRecording(true);
      setRetroAudioUrl(null);
      setRetroAudioBlob(null);
    } catch {
      toast.error("Microphone access denied.");
    }
  };

  const stopRetroRecording = () => {
    if (retroMediaRecorderRef.current && retroRecording) {
      retroMediaRecorderRef.current.stop();
      retroMediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
      setRetroRecording(false);
    }
  };

  const handleSubmit = async (skip = false) => {
    cleanupRecording();
    await onSubmit({
      text: retroText,
      audioBlob: retroAudioBlob,
      skip,
    });
  };

  if (!app) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border border-border shadow-xl bg-card">
        {/* Standardized header */}
        <div
          className={`p-6 pb-5 border-b ${
            targetStage === "offer" ? "bg-success/10 border-success/20" : "bg-muted/40 border-border"
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                targetStage === "offer"
                  ? "bg-success/20 text-success border border-success/30"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {targetStage === "offer" ? (
                <Trophy className="w-6 h-6 text-success" />
              ) : (
                <HeartCrack className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                  targetStage === "offer" ? "text-success" : "text-muted-foreground"
                }`}
              >
                {targetStage === "offer" ? "Congratulations 🎉" : "Stage Retrospective 💪"}
              </div>
              <h2 className="text-lg font-bold text-foreground leading-tight">
                {targetStage === "offer"
                  ? "Offer Received Retrospective"
                  : "Application Debrief & Learnings"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {app.title || app.job?.title || "Untitled Role"} ·{" "}
                {app.company || app.job?.company || "Unknown Company"}
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            {targetStage === "offer"
              ? "Capture what worked — your winning responses, the questions they loved, and what set you apart."
              : "Every interview provides insights. Capture what happened, where you felt unprepared, and what to focus on next."}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 bg-card">
          {/* Prompt chips */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reflection prompts
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(targetStage === "offer"
                ? [
                    "What set me apart?",
                    "Which round went best?",
                    "What prep helped most?",
                    "Key skills they valued",
                  ]
                : [
                    "Where did I stumble?",
                    "Questions I wasn't ready for",
                    "What I'd prepare differently",
                    "Fit issues?",
                    "Technical gaps to close",
                  ]
              ).map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setRetroText((t) => (t ? `${t}\n• ${chip}: ` : `• ${chip}: `))}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-medium"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Input tabs */}
          <Tabs value={retroTab} onValueChange={(v) => setRetroTab(v as "text" | "voice")}>
            <TabsList className="w-full h-9 bg-muted/40">
              <TabsTrigger value="text" className="flex-1 text-xs">
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Write
              </TabsTrigger>
              <TabsTrigger value="voice" className="flex-1 text-xs">
                <Mic className="w-3.5 h-3.5 mr-1.5" /> Record
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-3">
              <Textarea
                placeholder={
                  targetStage === "offer"
                    ? "What went well? What was your winning strategy? Any standout moments in the interview?"
                    : "What happened? Where did it fall short? What would you prep differently next time?"
                }
                rows={5}
                value={retroText}
                onChange={(e) => setRetroText(e.target.value)}
                className="resize-none bg-background focus-visible:ring-primary/20 text-xs leading-relaxed"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5 tabular-nums">
                {retroText.length > 0
                  ? `${retroText.length} characters written`
                  : "Start typing your reflection..."}
              </p>
            </TabsContent>

            <TabsContent value="voice" className="mt-3">
              <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-muted/20 border-dashed gap-4">
                {retroRecording && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-destructive rounded-full animate-ping" />
                      <span className="text-xs font-semibold text-destructive animate-pulse">
                        Recording voice reflection...
                      </span>
                    </div>
                    {/* Animated Audio Equalizer Bars */}
                    <div className="flex items-end gap-1 h-8 px-4">
                      <div className="w-1.5 bg-destructive rounded-full h-4 animate-bounce [animation-delay:0.1s]" />
                      <div className="w-1.5 bg-destructive rounded-full h-7 animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 bg-destructive rounded-full h-5 animate-bounce [animation-delay:0.3s]" />
                      <div className="w-1.5 bg-destructive rounded-full h-8 animate-bounce [animation-delay:0.15s]" />
                      <div className="w-1.5 bg-destructive rounded-full h-3 animate-bounce [animation-delay:0.25s]" />
                      <div className="w-1.5 bg-destructive rounded-full h-6 animate-bounce [animation-delay:0.35s]" />
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  {!retroRecording ? (
                    <Button onClick={startRetroRecording} size="sm" variant="default">
                      <Mic className="w-4 h-4 mr-2" /> Start Recording
                    </Button>
                  ) : (
                    <Button onClick={stopRetroRecording} size="sm" variant="destructive">
                      <MicOff className="w-4 h-4 mr-2" /> Stop
                    </Button>
                  )}
                </div>
                {retroAudioUrl && !retroRecording && (
                  <>
                    <audio src={retroAudioUrl} controls className="w-full h-8 mt-1" />
                    <p className="text-[10px] text-muted-foreground">
                      Voice note recorded. It will be transcribed and saved.
                    </p>
                  </>
                )}
                {!retroAudioUrl && !retroRecording && (
                  <p className="text-xs text-muted-foreground">
                    Speak your reflection aloud — it will be AI-transcribed and attached to this application.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Self-assessment quick rating */}
          <div className="border border-border/60 rounded-xl p-4 bg-muted/20 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Quick self-assessment areas
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Brain, label: "Technical preparation" },
                { icon: MessageSquare, label: "Communication style" },
                { icon: Target, label: "Role/company fit" },
                { icon: BookOpen, label: "Research depth" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setRetroText((t) => (t ? `${t}\n• ${label}: ` : `• ${label}: `))}
                  className="flex items-center gap-2 text-left text-xs px-3 py-2 rounded-lg border border-border/40 bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground text-xs"
              onClick={() => handleSubmit(true)}
              disabled={isSaving}
            >
              Skip for now
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => handleSubmit(false)}
              disabled={isSaving || (retroText.trim() === "" && !retroAudioBlob)}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4 mr-1" /> Save Reflection & Move Card
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
