import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Briefcase,
  Building2,
  MapPin,
  Share2,
  Trophy,
  MessageSquare,
  Mic,
  MicOff,
  Brain,
  Sparkles,
  Target,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { isBackendUnavailable } from "@/api/client";
import { streamInterviewCopilotHints, type CopilotStreamEvent } from "@/api/ai";
import {
  addApplicationNote,
  deleteApplicationNote,
  uploadApplicationVoice,
  getApplicationInterviewQuestions,
  recordPracticeOutcome,
  listApplications,
  apiFetch,
} from "@/api";
import type { ApplicationItem, StarResult, CommonlyAskedQuestion } from "./types";

export interface DetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedApp: ApplicationItem | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onMilestone: (app: ApplicationItem, stage: "interview" | "offer") => void;
  onCelebration: (app: ApplicationItem) => void;
  onUpdateSelectedApp: (app: ApplicationItem) => void;
  onApplicationsInvalidate: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  open,
  onOpenChange,
  selectedApp,
  activeTab,
  onTabChange,
  onMilestone,
  onCelebration,
  onUpdateSelectedApp,
  onApplicationsInvalidate,
}) => {
  // Notes state
  const [newNoteText, setNewNoteText] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Voice note state
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // AI Questions state
  const [isGeneratingIQ, setIsGeneratingIQ] = useState(false);

  // Live Copilot state
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotEvents, setCopilotEvents] = useState<CopilotStreamEvent[]>([]);
  const [isCopilotStreaming, setIsCopilotStreaming] = useState(false);
  const copilotAbortRef = useRef<AbortController | null>(null);

  // STAR Practice state
  const [practiceQuestion, setPracticeQuestion] = useState(
    "Tell me about a time you resolved a critical technical roadblock."
  );
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [isEvaluatingSTAR, setIsEvaluatingSTAR] = useState(false);
  const [starResult, setStarResult] = useState<StarResult | null>(null);
  const [adaptiveFollowUpResponse, setAdaptiveFollowUpResponse] = useState("");
  const [savePracticeConsent, setSavePracticeConsent] = useState(true);

  // Cleanup copilot and audio on close or app switch
  useEffect(() => {
    return () => {
      copilotAbortRef.current?.abort();
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      if (audioUrl) {
        try {
          URL.revokeObjectURL(audioUrl);
        } catch {
          /* best effort */
        }
      }
    };
  }, [audioUrl, isRecording]);

  useEffect(() => {
    setCopilotQuestion("");
    setCopilotEvents([]);
  }, [selectedApp]);

  if (!selectedApp) return null;

  const effectiveStatus = selectedApp.status || selectedApp.stage;

  // Notes handlers
  const handleAddNoteClick = async () => {
    if (!newNoteText.trim()) return;
    setIsAddingNote(true);
    try {
      await addApplicationNote(String(selectedApp.id), newNoteText);
      toast.success("Note added");
      setNewNoteText("");
      onApplicationsInvalidate();
      const updatedList = await listApplications();
      const updatedApp = updatedList.find((a) => String(a.id) === String(selectedApp.id));
      if (updatedApp) onUpdateSelectedApp(updatedApp as ApplicationItem);
    } catch {
      toast.error("Failed to add note");
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDeleteNoteClick = async (noteId: string) => {
    try {
      await deleteApplicationNote(String(selectedApp.id), noteId);
      toast.success("Note removed");
      onApplicationsInvalidate();
      const updatedList = await listApplications();
      const updatedApp = updatedList.find((a) => String(a.id) === String(selectedApp.id));
      if (updatedApp) onUpdateSelectedApp(updatedApp as ApplicationItem);
    } catch {
      toast.error("Failed to delete note");
    }
  };

  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioBlob(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAudioUrl(null);
      setAudioBlob(null);
    } catch (err) {
      console.error("Error accessing microphone", err);
      toast.error("Microphone access denied. Please check your settings.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  const handleUploadVoiceNote = async () => {
    if (!audioBlob || !selectedApp) return;
    setIsUploadingVoice(true);
    try {
      await uploadApplicationVoice(String(selectedApp.id), audioBlob);
      toast.success("Voice note uploaded and transcribed!");
      setAudioUrl(null);
      setAudioBlob(null);
      onApplicationsInvalidate();
      const updatedList = await listApplications();
      const updatedApp = updatedList.find((a) => String(a.id) === String(selectedApp.id));
      if (updatedApp) onUpdateSelectedApp(updatedApp as ApplicationItem);
    } catch {
      toast.error("Voice transcription failed or unavailable.");
    } finally {
      setIsUploadingVoice(false);
    }
  };

  // Interview questions generator
  const handleGenerateInterviewQuestions = async () => {
    if (!selectedApp) return;
    setIsGeneratingIQ(true);
    try {
      await getApplicationInterviewQuestions(String(selectedApp.id));
      toast.success("AI interview questions generated successfully!");
      onApplicationsInvalidate();
      const updatedList = await listApplications();
      const updatedApp = updatedList.find((a) => String(a.id) === String(selectedApp.id));
      if (updatedApp) onUpdateSelectedApp(updatedApp as ApplicationItem);
    } catch (e: unknown) {
      toast.error(
        isBackendUnavailable(e)
          ? "Interview question generation is unavailable right now. Nothing was saved — please try again later."
          : e instanceof Error
          ? e.message
          : "Couldn't generate questions. Nothing was saved."
      );
    } finally {
      setIsGeneratingIQ(false);
    }
  };

  // Live Copilot handler
  const handleCopilotStream = async () => {
    if (!copilotQuestion.trim() || isCopilotStreaming) return;
    setIsCopilotStreaming(true);
    setCopilotEvents([]);
    const controller = new AbortController();
    copilotAbortRef.current = controller;
    try {
      await streamInterviewCopilotHints(
        {
          interviewer_transcript: copilotQuestion.trim(),
          job_title: selectedApp?.title || "Software Engineer",
          company_name: selectedApp?.company || null,
        },
        (event) => setCopilotEvents((prev) => [...prev, event]),
        controller.signal
      );
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Stream failed";
      setCopilotEvents((prev) => [
        ...prev,
        { type: "error", error: "copilot_failed", message },
      ]);
    } finally {
      setIsCopilotStreaming(false);
      copilotAbortRef.current = null;
    }
  };

  // STAR Practice handler
  const handleEvaluateSTAR = async () => {
    const targetAppId = selectedApp?.id;
    const hasAppContext = Boolean(
      targetAppId || (selectedApp?.job_description && selectedApp?.resume_id)
    );
    if (!hasAppContext) {
      toast.error("Real Application Context Required", {
        description:
          "Please link an active application or provide a job description and resume to evaluate practice delivery.",
      });
      return;
    }

    const answerToEval = practiceAnswer.trim();
    if (!answerToEval) {
      toast.error("Answer Required", {
        description: "Please enter or record your response before running STAR analysis.",
      });
      return;
    }

    setIsEvaluatingSTAR(true);
    try {
      const fullAnswer = adaptiveFollowUpResponse.trim()
        ? `${answerToEval}\n\nFollow-up clarification: ${adaptiveFollowUpResponse.trim()}`
        : answerToEval;

      const evalData = await apiFetch<StarResult>("/v1/interview/evaluate-star", {
        method: "POST",
        body: JSON.stringify({
          answer: fullAnswer,
          question: practiceQuestion,
          job_title: selectedApp?.title || "Software Engineer",
        }),
      });

      setStarResult(evalData);

      if (savePracticeConsent) {
        try {
          const outcomeScore = evalData.completeness_score ?? evalData.star_score ?? 0;
          await recordPracticeOutcome({
            practice_session_id: crypto.randomUUID(),
            application_id: targetAppId ? String(targetAppId) : undefined,
            completion_status: "completed",
            confidence: outcomeScore,
            interview_outcome: "unknown",
            correction_note: evalData.follow_up_question || undefined,
            consent_acknowledged: true,
          });
          onApplicationsInvalidate();
        } catch (outcomeErr: unknown) {
          console.warn("Telemetry outcome save failed (non-blocking):", outcomeErr);
        }
      }

      toast.success(`STAR Analysis Complete (${evalData.completeness_score}%)`, {
        description: evalData.missing_elements?.length
          ? `Deficiencies detected in: ${evalData.missing_elements.join(", ")}. See adaptive follow-up below.`
          : "Exceptional STAR delivery with strong metrics!",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to analyze STAR answer.";
      toast.error("Evaluation Failed", {
        description: msg,
      });
    } finally {
      setIsEvaluatingSTAR(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/60">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Briefcase className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <DialogTitle className="text-xl font-bold truncate">
                {selectedApp.title || "Target Role"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-4 h-4 shrink-0" />
                {selectedApp.company || "Target Company"}
                {selectedApp.location && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {selectedApp.location}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 self-center">
              {effectiveStatus === "interview" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 gap-1.5 border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                  onClick={() => onMilestone(selectedApp, "interview")}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share on LinkedIn
                </Button>
              )}
              {effectiveStatus === "offer" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 gap-1.5 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 font-semibold"
                  onClick={() => onCelebration(selectedApp)}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  Alumni Celebration
                </Button>
              )}
              <Badge
                variant="outline"
                className="capitalize text-xs font-bold border-primary/20 bg-primary/5 text-primary py-1 px-3"
              >
                {selectedApp.stage || selectedApp.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={onTabChange}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-6 border-b">
            <TabsList className="w-full justify-start bg-transparent h-12 p-0 gap-6 border-b-0">
              <TabsTrigger
                value="notes"
                disabled={!selectedApp.id}
                className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 h-full bg-transparent shadow-none font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <MessageSquare className="w-4 h-4 mr-2" /> Notes Log
              </TabsTrigger>
              <TabsTrigger
                value="voice"
                disabled={!selectedApp.id}
                className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 h-full bg-transparent shadow-none font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Mic className="w-4 h-4 mr-2" /> Voice Notes
              </TabsTrigger>
              <TabsTrigger
                value="intel"
                className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 h-full bg-transparent shadow-none font-semibold"
              >
                <Brain className="w-4 h-4 mr-2" /> AI Interview Prep
              </TabsTrigger>
              <TabsTrigger
                value="copilot"
                className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 h-full bg-transparent shadow-none font-semibold"
              >
                <Sparkles className="w-4 h-4 mr-2" /> Live Copilot
              </TabsTrigger>
              <TabsTrigger
                value="practice"
                className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 h-full bg-transparent shadow-none font-semibold"
              >
                <Target className="w-4 h-4 mr-2" /> STAR Practice
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {/* Notes Tab */}
            <TabsContent value="notes" className="m-0 space-y-6">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a new custom note about this interview..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddNoteClick()}
                    className="bg-background/80"
                  />
                  <Button
                    onClick={handleAddNoteClick}
                    disabled={isAddingNote || !newNoteText.trim()}
                  >
                    {isAddingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                  </Button>
                </div>

                <div className="space-y-3">
                  {!selectedApp.notes_log || selectedApp.notes_log.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No notes yet. Add your thoughts, follow-up items, or interviewer details.
                    </div>
                  ) : (
                    selectedApp.notes_log.map((note, idx) => (
                      <Card key={note.id || idx} className="border-border/60 bg-muted/10">
                        <CardContent className="p-3.5 flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-sm font-sans text-foreground/95 leading-relaxed">
                              {note.text}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {note.at
                                ? formatDistanceToNow(new Date(note.at)) + " ago"
                                : "just now"}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteNoteClick(note.id || "")}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Voice Notes Tab */}
            <TabsContent value="voice" className="m-0 space-y-6">
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-muted/20 border-dashed gap-4">
                  <div className="flex items-center gap-3">
                    {isRecording ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 bg-destructive rounded-full animate-ping" />
                        <span className="text-xs font-semibold text-destructive animate-pulse">
                          Recording Audio...
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground font-semibold">
                        Record a voice note or verbal mock answer
                      </span>
                    )}
                  </div>

                  <div className="flex gap-3">
                    {!isRecording ? (
                      <Button
                        onClick={startRecording}
                        className="bg-primary/95 text-primary-foreground hover:bg-primary shadow-sm"
                      >
                        <Mic className="w-4 h-4 mr-2" /> Record Voice
                      </Button>
                    ) : (
                      <Button onClick={stopRecording} variant="destructive">
                        <MicOff className="w-4 h-4 mr-2" /> Stop Recording
                      </Button>
                    )}

                    {audioUrl && !isRecording && (
                      <Button
                        onClick={handleUploadVoiceNote}
                        disabled={isUploadingVoice}
                        className="bg-success-600 hover:bg-success-700 text-primary-foreground"
                      >
                        {isUploadingVoice ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            AI Transcribing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Transcribe note
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {audioUrl && !isRecording && (
                    <div className="w-full max-w-sm mt-1">
                      <audio src={audioUrl} controls className="w-full h-8" />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-foreground">Saved Voice Logs</h4>
                  {!selectedApp.voice_notes || selectedApp.voice_notes.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No voice notes recorded yet.
                    </div>
                  ) : (
                    selectedApp.voice_notes.map((vn, idx) => (
                      <Card key={vn.id || idx} className="border-border/60 bg-muted/10">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex justify-between items-center text-xs text-muted-foreground pb-2 border-b border-border/30">
                            <span className="font-semibold flex items-center gap-1.5">
                              <Mic className="w-3.5 h-3.5 text-primary" /> Audio Log
                            </span>
                            <span>
                              {vn.at ? formatDistanceToNow(new Date(vn.at)) + " ago" : "recently"}
                            </span>
                          </div>
                          {vn.transcript ? (
                            <p className="text-sm text-foreground/95 bg-card/60 p-3 rounded-lg border border-border/40 leading-relaxed font-sans mt-2">
                              <span className="font-bold text-[10px] text-primary uppercase tracking-wider block mb-1">
                                AI Transcript
                              </span>
                              "{vn.transcript}"
                            </p>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 italic">
                              <Loader2 className="w-3 h-3 animate-spin text-primary" /> Waiting for
                              transcription callback...
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            {/* AI Intel Tab */}
            <TabsContent value="intel" className="m-0 space-y-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      Interview Questions Intel
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Retrieve commonly asked questions, preparation foci, and potential warning flags.
                    </p>
                  </div>
                  <Button
                    onClick={handleGenerateInterviewQuestions}
                    disabled={isGeneratingIQ}
                    size="sm"
                    className="bg-gradient-to-r from-accent to-primary text-primary-foreground"
                  >
                    {isGeneratingIQ ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        {selectedApp.interview_research?.commonly_asked
                          ? "Regenerate Intel"
                          : "Generate Questions"}
                      </>
                    )}
                  </Button>
                </div>

                {!selectedApp.interview_research ||
                !selectedApp.interview_research.commonly_asked ? (
                  <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
                    <Brain className="w-10 h-10 mx-auto text-muted-foreground/50" />
                    <p>No interview intelligence research generated yet for this role.</p>
                    <p className="text-xs">
                      Click the generate button above to extract commonly asked questions from company history.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {selectedApp.interview_research.preparation_focus && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-primary">
                          Target Study Focus
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {selectedApp.interview_research.preparation_focus.map((item: string, idx: number) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="bg-primary/5 text-primary border-primary/10 py-1 px-2.5 text-xs font-medium"
                            >
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3.5">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Frequently Asked Questions
                      </h5>
                      {selectedApp.interview_research.commonly_asked.map(
                        (item: CommonlyAskedQuestion, idx: number) => (
                          <Card
                            key={idx}
                            className="border-border/60 bg-muted/5 hover:bg-muted/10 transition-colors"
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex justify-between items-start gap-3">
                                <p className="font-bold text-sm text-foreground/90 font-sans">
                                  Q{idx + 1}: {item.question}
                                </p>
                                <Badge
                                  variant="outline"
                                  className="capitalize text-[10px] shrink-0 font-bold"
                                >
                                  {item.category}
                                </Badge>
                              </div>
                              {item.why_asked && (
                                <p className="text-xs text-muted-foreground">
                                  <strong className="text-foreground/80 font-medium">
                                    Why it's asked:
                                  </strong>{" "}
                                  {item.why_asked}
                                </p>
                              )}
                              {item.how_to_answer && (
                                <p className="text-xs text-foreground/80 leading-relaxed bg-background/50 p-2.5 rounded border">
                                  <strong className="text-primary/90 font-medium block mb-1">
                                    Answer Strategy
                                  </strong>
                                  {item.how_to_answer}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        )
                      )}
                    </div>

                    {selectedApp.interview_research.recent_topics && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Core Competency Themes
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {selectedApp.interview_research.recent_topics.map((item: string, idx: number) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs font-medium py-1 px-2.5 bg-muted/40"
                            >
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedApp.interview_research.red_flags_to_avoid &&
                      selectedApp.interview_research.red_flags_to_avoid.length > 0 && (
                        <div className="space-y-2 p-3.5 border border-destructive/20 bg-destructive/5 rounded-xl">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            Important: Avoid These Red Flags
                          </h5>
                          <ul className="list-disc pl-5 text-xs text-destructive-600 dark:text-destructive-400 space-y-1 mt-1.5">
                            {selectedApp.interview_research.red_flags_to_avoid.map((item: string, idx: number) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Live Copilot Tab */}
            <TabsContent value="copilot" className="m-0 space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Live Copilot</h4>
                  <p className="text-xs text-muted-foreground">
                    Paste the interviewer's question for instant STAR hints, framework, and metric callouts — streamed as they generate.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Textarea
                    rows={3}
                    placeholder="Paste the interviewer's question here…"
                    value={copilotQuestion}
                    onChange={(e) => setCopilotQuestion(e.target.value)}
                    className="bg-background/80"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCopilotStream}
                    disabled={isCopilotStreaming || !copilotQuestion.trim()}
                    size="sm"
                  >
                    {isCopilotStreaming ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Streaming…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" /> Get live hints
                      </>
                    )}
                  </Button>
                  {isCopilotStreaming && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copilotAbortRef.current?.abort()}
                    >
                      Stop
                    </Button>
                  )}
                </div>

                {copilotEvents.length > 0 && (
                  <div className="space-y-3">
                    {copilotEvents.map((event, i) => {
                      if (event.type === "error") {
                        return (
                          <div
                            key={i}
                            className="text-xs text-destructive bg-destructive/5 border border-destructive/30 rounded-lg p-3"
                          >
                            {event.error === "ai_service_unavailable"
                              ? "AI service unavailable — configure an LLM provider first."
                              : event.message || "Copilot failed"}
                          </div>
                        );
                      }
                      if (event.type === "question_type") {
                        return (
                          <div key={i} className="text-xs">
                            <span className="font-semibold text-primary">Question type:</span>{" "}
                            <Badge variant="outline">{String(event.value)}</Badge>
                          </div>
                        );
                      }
                      if (event.type === "hints" && Array.isArray(event.value)) {
                        return (
                          <div key={i} className="space-y-1.5">
                            <p className="text-xs font-bold uppercase tracking-wider text-primary">
                              Instant hints
                            </p>
                            {(event.value as string[]).map((h, j) => (
                              <p key={j} className="text-sm text-foreground/90 flex gap-2">
                                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                                {h}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      if (event.type === "star" && event.value && typeof event.value === "object") {
                        const star = event.value as Record<string, string>;
                        return (
                          <div key={i} className="space-y-1.5">
                            <p className="text-xs font-bold uppercase tracking-wider text-primary">
                              STAR framework
                            </p>
                            {Object.entries(star).map(([k, v]) => (
                              <p key={k} className="text-sm text-foreground/90">
                                <span className="font-semibold uppercase text-xs mr-1">{k}:</span>
                                {v}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      if (event.type === "metrics" && Array.isArray(event.value)) {
                        return (
                          <div key={i} className="space-y-1.5">
                            <p className="text-xs font-bold uppercase tracking-wider text-primary">
                              Metric callouts
                            </p>
                            {(event.value as string[]).map((m, j) => (
                              <p key={j} className="text-sm text-foreground/90 flex gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-success" />
                                {m}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* STAR Practice Tab */}
            <TabsContent value="practice" className="m-0 space-y-5">
              <div className="p-4 bg-muted/30 rounded-xl border border-border/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                      Application Context
                    </span>
                    <h4 className="text-sm font-semibold text-foreground">
                      {selectedApp.title || "Target Role"} • {selectedApp.company || "Target Company"}
                    </h4>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-primary/30 text-primary self-start sm:self-auto"
                  >
                    {selectedApp.id ? `App ID: ${String(selectedApp.id).slice(0, 8)}...` : "Context Grounded"}
                  </Badge>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    Interview Question:
                  </label>
                  <Input
                    value={practiceQuestion}
                    onChange={(e) => setPracticeQuestion(e.target.value)}
                    placeholder="Enter behavioral or technical question..."
                    className="text-xs"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      "Tell me about a time you resolved a critical technical roadblock.",
                      "Describe a production outage where you led the investigation.",
                      "Give an example of when you had to optimize a slow system under heavy load.",
                    ].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setPracticeQuestion(q)}
                        className="text-[10px] px-2 py-1 rounded-md border border-border/50 bg-background/60 hover:bg-muted text-muted-foreground text-left"
                      >
                        {q.slice(0, 42)}...
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Your Response (STAR Method):
                    </label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {practiceAnswer.trim().split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                  <Textarea
                    value={practiceAnswer}
                    onChange={(e) => setPracticeAnswer(e.target.value)}
                    placeholder="Set the Situation and Task, detail the Actions you personally executed, and state the quantifiable Result..."
                    rows={6}
                    className="text-xs leading-relaxed"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={savePracticeConsent}
                      onChange={(e) => setSavePracticeConsent(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>Store evaluated outcome in practice history</span>
                  </label>

                  <Button
                    onClick={handleEvaluateSTAR}
                    disabled={isEvaluatingSTAR || !practiceAnswer.trim()}
                    className="bg-primary text-primary-foreground font-semibold text-xs gap-2"
                  >
                    {isEvaluatingSTAR ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Evaluating STAR Delivery...
                      </>
                    ) : (
                      <>
                        <Target className="w-3.5 h-3.5" />
                        Evaluate STAR Delivery
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* STAR Evaluation Results Display */}
              {starResult && (
                <div className="space-y-4 pt-2">
                  {/* Completeness Score Card */}
                  <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                        STAR Completeness Score
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-2xl font-black ${
                            starResult.completeness_score >= 80
                              ? "text-emerald-500"
                              : starResult.completeness_score >= 60
                              ? "text-blue-500"
                              : "text-amber-500"
                          }`}
                        >
                          {starResult.completeness_score}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {starResult.completeness_score >= 80
                            ? "Exemplary"
                            : starResult.completeness_score >= 60
                            ? "Proficient"
                            : "Needs Revision"}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs font-mono font-bold px-2.5 py-1 ${
                        starResult.completeness_score >= 70
                          ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                          : "border-amber-500/30 text-amber-500 bg-amber-500/10"
                      }`}
                    >
                      {(starResult.missing_elements?.length ?? 0) === 0
                        ? "Complete Framework"
                        : `${starResult.missing_elements?.length ?? 0} Missing`}
                    </Badge>
                  </div>

                  {/* STAR Breakdown 4-column Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {(["situation", "task", "action", "result"] as const).map((dim) => {
                      const detail = starResult.breakdown?.[dim] || {};
                      const strength = detail.strength || "missing";
                      const badgeVariant =
                        strength === "strong"
                          ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                          : strength === "adequate"
                          ? "border-blue-500/30 text-blue-500 bg-blue-500/10"
                          : "border-amber-500/30 text-amber-500 bg-amber-500/10";
                      return (
                        <div
                          key={dim}
                          className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                              {dim[0].toUpperCase()}: {dim}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-mono px-1.5 py-0 ${badgeVariant}`}
                            >
                              {strength}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {detail.feedback || "No feedback available."}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Adaptive Follow-up Question Callout */}
                  {starResult.follow_up_question && (
                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                              Adaptive Follow-Up Challenge
                            </h4>
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono border-primary/40 text-primary"
                            >
                              Target: {starResult.follow_up_target}
                            </Badge>
                          </div>
                          <p className="text-xs font-medium text-foreground leading-relaxed">
                            {starResult.follow_up_question}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-1 border-t border-primary/20">
                        <label className="text-[11px] font-semibold text-foreground block">
                          Provide Clarification / Metrics to Boost Score:
                        </label>
                        <Textarea
                          value={adaptiveFollowUpResponse}
                          onChange={(e) => setAdaptiveFollowUpResponse(e.target.value)}
                          placeholder="Provide specific metrics, latency changes, or actions you personally took..."
                          rows={2}
                          className="text-xs font-sans"
                        />
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={handleEvaluateSTAR}
                            disabled={isEvaluatingSTAR || !adaptiveFollowUpResponse.trim()}
                            className="text-xs h-7 bg-primary text-primary-foreground font-semibold"
                          >
                            Submit Clarification & Re-evaluate
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Coaching Tips */}
                  {starResult.coaching_tips && starResult.coaching_tips.length > 0 && (
                    <div className="p-3 bg-muted/20 rounded-lg border border-border/50 space-y-1.5 text-xs">
                      <span className="font-semibold text-foreground block text-[11px] uppercase tracking-wider">
                        Coach Recommendations
                      </span>
                      <ul className="space-y-1 text-muted-foreground text-[11px]">
                        {starResult.coaching_tips.map((tip: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
