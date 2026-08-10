import { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Briefcase,
  Building2,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Loader2,
  Target,
  RotateCcw,
  AlertCircle,
  Brain,
  Mail,
  MessageSquare,
  Mic,
  MicOff,
  Sparkles,
  RefreshCw,
  Link as LinkIcon,
  Calendar,
  FileText,
  User,
  LogOut,
  Info,
  TrendingUp,
  XCircle,
  CheckCircle2,
  BookOpen,
  ChevronRight,
  Trophy,
  HeartCrack
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listApplications,
  createApplication,
  updateApplication,

  deleteApplication,
  addApplicationNote,
  deleteApplicationNote,
  getApplicationInterviewQuestions,
  parseApplicationEmail,
  uploadApplicationVoice,
  getGmailStatus,
  getGmailLogin,
  syncGmail,
  disconnectGmail
} from "@/api";
import { streamInterviewCopilotHints, type CopilotStreamEvent } from "@/api/ai";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const COLUMNS = [
  { id: "saved", label: "Saved", dotColor: "bg-slate-400 shadow-slate-400/50", headerBg: "bg-slate-500/10 border-slate-500/20", badgeBg: "bg-slate-500/15 text-slate-300" },
  { id: "applied", label: "Applied", dotColor: "bg-blue-400 shadow-blue-400/50", headerBg: "bg-blue-500/10 border-blue-500/20", badgeBg: "bg-blue-500/15 text-blue-300" },
  { id: "phone_screen", label: "Phone Screen", dotColor: "bg-amber-400 shadow-amber-400/50", headerBg: "bg-amber-500/10 border-amber-500/20", badgeBg: "bg-amber-500/15 text-amber-300" },
  { id: "interview", label: "Interview", dotColor: "bg-indigo-400 shadow-indigo-400/50", headerBg: "bg-indigo-500/10 border-indigo-500/20", badgeBg: "bg-indigo-500/15 text-indigo-300" },
  { id: "offer", label: "Offer", dotColor: "bg-emerald-400 shadow-emerald-400/50", headerBg: "bg-emerald-500/10 border-emerald-500/20", badgeBg: "bg-emerald-500/15 text-emerald-300" },
  { id: "rejected", label: "Rejected", dotColor: "bg-rose-400 shadow-rose-400/50", headerBg: "bg-rose-500/10 border-rose-500/20", badgeBg: "bg-rose-500/15 text-rose-300" },
];

const InterviewBoard = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Add App state
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [optimisticApps, setOptimisticApps] = useState<Record<string, string>>({});

  // Email Paste Modal state
  const [emailPasteOpen, setEmailPasteOpen] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [isParsingEmail, setIsParsingEmail] = useState(false);
  const [parsedEmailData, setParsedEmailData] = useState<any>(null);

  // Detail Modal state
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isGeneratingIQ, setIsGeneratingIQ] = useState(false);

  // Live Copilot state
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotEvents, setCopilotEvents] = useState<CopilotStreamEvent[]>([]);
  const [isCopilotStreaming, setIsCopilotStreaming] = useState(false);
  const copilotAbortRef = useRef<AbortController | null>(null);

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
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setCopilotEvents((prev) => [
        ...prev,
        { type: "error", error: "copilot_failed", message: err?.message || "Stream failed" },
      ]);
    } finally {
      setIsCopilotStreaming(false);
      copilotAbortRef.current = null;
    }
  };

  // Recording voice note state
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Retrospective modal state (for Offer / Rejected moves)
  const [retroOpen, setRetroOpen] = useState(false);
  const [retroApp, setRetroApp] = useState<any>(null);
  const [retroTargetStage, setRetroTargetStage] = useState<string>("");
  const [retroText, setRetroText] = useState("");
  const [retroTab, setRetroTab] = useState<"text" | "voice">("text");
  const [retroRecording, setRetroRecording] = useState(false);
  const [retroAudioUrl, setRetroAudioUrl] = useState<string | null>(null);
  const [retroAudioBlob, setRetroAudioBlob] = useState<Blob | null>(null);
  const retroMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const retroAudioChunksRef = useRef<Blob[]>([]);
  const retroIdempotencyKeyRef = useRef<string | null>(null);
  const retroVoiceUploadedRef = useRef<boolean>(false);
  const [isSavingRetro, setIsSavingRetro] = useState(false);

  // Gmail status state
  const { data: gmailStatus, refetch: refetchGmailStatus } = useQuery({
    queryKey: ["gmail-status"],
    queryFn: () => getGmailStatus(),
  });

  const [isSyncingGmail, setIsSyncingGmail] = useState(false);

  const { data: applications = [], isLoading, error } = useQuery({
    queryKey: ["applications"],
    queryFn: () => listApplications(),
  });

  const createMutation = useMutation({
    mutationFn: createApplication,
    onSuccess: () => {
      toast.success("Application added");
      setDialogOpen(false);
      setNewJobTitle("");
      setNewCompany("");
      setNewLocation("");
      setNewUrl("");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to add"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateApplication(id, { status }),
    onSuccess: (_, vars) => {
      setOptimisticApps((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: any, vars) => {
      setOptimisticApps((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      toast.error(err.message || "Update failed");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApplication,
    onSuccess: () => {
      toast.success("Deleted");
      if (selectedApp && detailOpen) {
        setDetailOpen(false);
        setSelectedApp(null);
      }
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: any) => toast.error(err.message || "Delete failed"),
  });

  const handleAdd = () => {
    if (!newJobTitle.trim() || !newCompany.trim()) return;
    createMutation.mutate({
      title: newJobTitle,
      company: newCompany,
      location: newLocation,
      url: newUrl,
      stage: "saved",
    });
  };

  const move = (app: any, direction: "left" | "right") => {
    const currentStage = effectiveStatus(app);
    const idx = COLUMNS.findIndex((c) => c.id === currentStage);
    const nextIdx = direction === "left" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= COLUMNS.length) return;
    const nextStatus = COLUMNS[nextIdx].id;
    // Intercept moves to Offer or Rejected — show retrospective first
    if (nextStatus === "offer" || nextStatus === "rejected") {
      setRetroApp(app);
      setRetroTargetStage(nextStatus);
      setRetroText("");
      if (retroAudioUrl) { try { URL.revokeObjectURL(retroAudioUrl); } catch {} }
      setRetroAudioUrl(null);
      setRetroAudioBlob(null);
      setRetroTab("text");
      retroIdempotencyKeyRef.current = crypto.randomUUID();
      retroVoiceUploadedRef.current = false;
      setRetroOpen(true);
      return;
    }
    setOptimisticApps((prev) => ({ ...prev, [app.id]: nextStatus }));
    updateMutation.mutate({ id: app.id, status: nextStatus });
  };

  // Retrospective recording helpers
  const startRetroRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      retroMediaRecorderRef.current = recorder;
      retroAudioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) retroAudioChunksRef.current.push(e.data); };
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
      retroMediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setRetroRecording(false);
    }
  };

  const handleRetroSubmit = async (skip = false) => {
    if (!retroApp) return;
    setIsSavingRetro(true);
    const idempotencyKey = retroIdempotencyKeyRef.current || crypto.randomUUID();
    retroIdempotencyKeyRef.current = idempotencyKey;

    try {
      // Build retrospective content
      const retroTitle = retroApp.title || retroApp.job?.title || "Untitled Role";
      const retroCompany = retroApp.company || retroApp.job?.company || "Unknown Company";
      const outcome = retroTargetStage === "offer" ? "🎉 OFFER RECEIVED" : "❌ REJECTED";
      const noteLines = [
        `=== RETROSPECTIVE — ${outcome} ===`,
        `Role: ${retroTitle} @ ${retroCompany}`,
        `Date: ${new Date().toLocaleDateString()}`,
      ];
      if (!skip) {
        if (retroText.trim()) noteLines.push(`\nReflection:\n${retroText.trim()}`);
        if (retroAudioBlob && !retroVoiceUploadedRef.current) {
          try {
            await uploadApplicationVoice(retroApp.id, retroAudioBlob);
            retroVoiceUploadedRef.current = true;
            noteLines.push("\n[Voice reflection recorded — see Voice Notes tab for transcript]");
          } catch {
            toast.error("Failed to upload voice note.");
            setIsSavingRetro(false);
            return;
          }
        } else if (retroVoiceUploadedRef.current) {
          noteLines.push("\n[Voice reflection recorded — see Voice Notes tab for transcript]");
        }
      } else {
        noteLines.push("\n(Retrospective skipped)");
      }

      // Persist note and stage transition atomically using idempotency key
      setOptimisticApps((prev) => ({ ...prev, [retroApp.id]: retroTargetStage }));
      await Promise.all([
        addApplicationNote(retroApp.id, noteLines.join("\n")),
        updateMutation.mutateAsync({ id: retroApp.id, status: retroTargetStage }),
      ]);
    } catch {
      toast.error("Failed to save retrospective. Please try again.");
      setIsSavingRetro(false);
      return;
    }

    retroIdempotencyKeyRef.current = null;
    retroVoiceUploadedRef.current = false;
    setIsSavingRetro(false);
    setRetroOpen(false);
    setRetroApp(null);
    setRetroText("");
    if (retroAudioUrl) { try { URL.revokeObjectURL(retroAudioUrl); } catch {} }
    setRetroAudioUrl(null);
    setRetroAudioBlob(null);

    const emoji = retroTargetStage === "offer" ? "🎉" : "💪";
    toast.success(`${emoji} Retrospective saved! Your reflection will help you grow.`);
  };

  const effectiveStatus = (app: any) => optimisticApps[app.id] || app.stage || app.status;
  const appsByColumn = (status: string) => applications.filter((a) => effectiveStatus(a) === status);

  // Email Paste handlers
  const handleParseEmailText = async () => {
    if (!emailText.trim() || emailText.length < 10) {
      toast.error("Please paste a longer email message (at least 10 characters).");
      return;
    }
    setIsParsingEmail(true);
    setParsedEmailData(null);
    try {
      const data = await parseApplicationEmail(emailText);
      setParsedEmailData(data);
      if (data && !data.is_job_related) {
        toast.warning("The AI suggests this email might not be related to a job application.");
      } else {
        toast.success("Email parsed successfully!");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to parse email");
    } finally {
      setIsParsingEmail(false);
    }
  };

  const handleSaveParsedEmail = () => {
    if (!parsedEmailData) return;
    createMutation.mutate({
      title: parsedEmailData.title || "Unknown Role",
      company: parsedEmailData.company || "Unknown Company",
      location: parsedEmailData.location || "Remote",
      stage: parsedEmailData.stage || "saved",
      notes: parsedEmailData.summary || "",
    });
    setEmailPasteOpen(false);
    setEmailText("");
    setParsedEmailData(null);
  };

  // Notes handlers
  const handleAddNoteClick = async () => {
    if (!newNoteText.trim()) return;
    setIsAddingNote(true);
    try {
      await addApplicationNote(selectedApp.id, newNoteText);
      toast.success("Note added");
      setNewNoteText("");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      // update state of selectedApp to display the new note instantly
      const updatedList = await listApplications();
      const updatedApp = updatedList.find((a: any) => a.id === selectedApp.id);
      if (updatedApp) setSelectedApp(updatedApp);
    } catch (e: any) {
      toast.error("Failed to add note");
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDeleteNoteClick = async (noteId: string) => {
    try {
      await deleteApplicationNote(selectedApp.id, noteId);
      toast.success("Note removed");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      const updatedList = await listApplications();
      const updatedApp = updatedList.find((a: any) => a.id === selectedApp.id);
      if (updatedApp) setSelectedApp(updatedApp);
    } catch (e: any) {
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
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(audioUrl);
        setAudioBlob(audioBlob);
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
      // stop mic tracks
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  const handleUploadVoiceNote = async () => {
    if (!audioBlob || !selectedApp) return;
    setIsUploadingVoice(true);
    try {
      await uploadApplicationVoice(selectedApp.id, audioBlob);
      toast.success("Voice note uploaded and transcribed!");
      setAudioUrl(null);
      setAudioBlob(null);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      const updatedList = await listApplications();
      const updatedApp = updatedList.find((a: any) => a.id === selectedApp.id);
      if (updatedApp) setSelectedApp(updatedApp);
    } catch (e: any) {
      toast.error("Voice transcription failed or unavailable.");
    } finally {
      setIsUploadingVoice(false);
    }
  };

  // Interview Questions Generator
  const handleGenerateInterviewQuestions = async () => {
    if (!selectedApp) return;
    setIsGeneratingIQ(true);
    try {
      await getApplicationInterviewQuestions(selectedApp.id);
      toast.success("AI interview questions generated successfully!");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      const updatedList = await listApplications();
      const updatedApp = updatedList.find((a: any) => a.id === selectedApp.id);
      if (updatedApp) setSelectedApp(updatedApp);
    } catch (e: any) {
      toast.error("Failed to generate questions. Make sure Python AI engine is running.");
    } finally {
      setIsGeneratingIQ(false);
    }
  };

  // Gmail OAuth handlers
  const handleGmailConnect = async () => {
    try {
      const res = await getGmailLogin();
      if (res && res.auth_url) {
        window.location.href = res.auth_url;
      } else {
        toast.error("Failed to start Google login flow.");
      }
    } catch (e: any) {
      toast.error(e.message || "Error launching OAuth");
    }
  };

  const handleGmailSync = async () => {
    setIsSyncingGmail(true);
    toast.info("Syncing and scanning recently received recruiter emails...");
    try {
      const res = await syncGmail();
      toast.success(res?.message || "Sync complete! New applications added/updated.");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to sync Gmail messages.");
    } finally {
      setIsSyncingGmail(false);
    }
  };

  const handleGmailDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect Gmail?")) return;
    try {
      await disconnectGmail();
      toast.success("Gmail disconnected");
      refetchGmailStatus();
    } catch (e: any) {
      toast.error("Failed to disconnect");
    }
  };

  // Detect callback status in URL query params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      toast.success("Gmail connected successfully!");
      navigate(window.location.pathname, { replace: true });
      refetchGmailStatus();
    } else if (params.get("gmail") === "denied") {
      toast.error("Gmail connection denied by user.");
      navigate(window.location.pathname, { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    return () => copilotAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    setCopilotQuestion("");
    setCopilotEvents([]);
  }, [selectedApp]);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-7xl space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/60">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75">
              Interview Board
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track your job applications, capture notes, record mock notes, and research custom AI interview questions.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Gmail OAuth connection controls */}
            {gmailStatus?.enabled && (
              <div className="flex items-center gap-2 border bg-card/40 backdrop-blur-sm rounded-lg p-1 px-2.5 text-xs font-semibold mr-2 border-border/60">
                <Mail className="w-3.5 h-3.5 text-primary" />
                {gmailStatus.connected ? (
                  <>
                    <span className="text-success-600 dark:text-success-400">Gmail Connected</span>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={handleGmailSync} 
                      disabled={isSyncingGmail}
                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingGmail ? "animate-spin" : ""}`} />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={handleGmailDisconnect}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                      <LogOut className="w-3 h-3" />
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleGmailConnect} 
                    className="h-6 text-[10px] uppercase font-bold p-1 px-2 hover:bg-primary/10 text-primary"
                  >
                    Connect Gmail
                  </Button>
                )}
              </div>
            )}

            {/* AI Email Paste Button */}
            <Dialog open={emailPasteOpen} onOpenChange={setEmailPasteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-primary">
                  <Mail className="w-4 h-4 mr-2" />
                  AI Email-Paste
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                    AI Recruiter Email Parser
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Paste an email from a recruiter. Tayari AI will extract the role, company, stage (e.g. Phone Screen or Interview), and summarize next steps so you can create a card instantly.
                  </p>
                  <Textarea
                    placeholder="Paste email headers and message content here..."
                    rows={8}
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value)}
                    className="font-sans bg-background/50 text-sm focus-visible:ring-primary/20"
                  />

                  {parsedEmailData && (
                    <Card className="bg-primary/5 border-primary/10 mt-3">
                      <CardHeader className="p-3 pb-0">
                        <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-primary">
                          <Info className="w-4 h-4" /> Parsed Results Preview
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 text-xs space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div><span className="font-semibold text-muted-foreground">Role:</span> {parsedEmailData.title || "Unknown"}</div>
                          <div><span className="font-semibold text-muted-foreground">Company:</span> {parsedEmailData.company || "Unknown"}</div>
                          <div><span className="font-semibold text-muted-foreground">Location:</span> {parsedEmailData.location || "Remote"}</div>
                          <div>
                            <span className="font-semibold text-muted-foreground">Detected Stage:</span>{" "}
                            <Badge variant="secondary" className="capitalize text-[10px]">{parsedEmailData.stage}</Badge>
                          </div>
                        </div>
                        {parsedEmailData.summary && (
                          <div className="border-t pt-2 mt-1">
                            <span className="font-semibold text-muted-foreground">AI Handoff Summary:</span>{" "}
                            <span className="italic">{parsedEmailData.summary}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => { setEmailText(""); setParsedEmailData(null); setEmailPasteOpen(false); }}>
                    Cancel
                  </Button>
                  {parsedEmailData ? (
                    <Button onClick={handleSaveParsedEmail}>
                      Save & Import Card
                    </Button>
                  ) : (
                    <Button onClick={handleParseEmailText} disabled={isParsingEmail}>
                      {isParsingEmail ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        "Parse Email"
                      )}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add Application Button */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Application
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Application</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Job Title</label>
                    <Input value={newJobTitle} onChange={(e) => setNewJobTitle(e.target.value)} placeholder="e.g. Software Engineer" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Company</label>
                    <Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="e.g. Google" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Location</label>
                    <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="e.g. Remote" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Apply URL</label>
                    <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAdd} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {error && (
          <div>
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="py-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Failed to load applications</p>
                  <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["applications"] })}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Retry
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {COLUMNS.map((col) => (
              <div key={col.id} className="flex flex-col">
                <div className={`p-3 rounded-t-xl ${col.headerBg} border-x border-t flex items-center justify-between`}>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-6" />
                </div>
                <div className="flex-1 bg-card/20 border-x border-b border-border/60 rounded-b-xl p-2 space-y-3 min-h-[200px]">
                  <Card className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </Card>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((col) => (
              <div key={col.id} className="flex flex-col min-w-[200px] flex-1">
                {/* Column header */}
                <div className={`p-3.5 rounded-t-xl ${col.headerBg} border flex items-center justify-between backdrop-blur-md shadow-xs`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor} shadow-xs`} />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-foreground/90">{col.label}</span>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-black border-0 px-2 py-0.5 rounded-full ${col.badgeBg}`}>
                    {appsByColumn(col.id).length}
                  </Badge>
                </div>

                {/* Cards feed */}
                <div className="flex-1 bg-card/20 border-x border-b border-border/60 rounded-b-xl p-2.5 space-y-3 min-h-[350px] transition-colors">
                  {appsByColumn(col.id).map((app) => {
                    const isMoving = !!optimisticApps[app.id];
                    return (
                      <Card
                        key={app.id}
                        className={`group relative cursor-pointer border-border/60 hover:border-primary/40 bg-card/70 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isMoving ? "opacity-60" : ""
                          }`}
                        onClick={() => {
                          setSelectedApp(app);
                          setDetailOpen(true);
                        }}
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
                              <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-violet-500/5 text-violet-500 border-violet-500/10">
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

                          {/* Controls */}
                          <div className="flex items-center justify-between pt-1 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-muted"
                                disabled={col.id === COLUMNS[0].id || isMoving}
                                onClick={() => move(app, "left")}
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-muted"
                                disabled={col.id === COLUMNS[COLUMNS.length - 1].id || isMoving}
                                onClick={() => move(app, "right")}
                              >
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteMutation.mutate(String(app.id))}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Application details sheet / dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden">
            {selectedApp && (
              <>
                <DialogHeader className="p-6 pb-4 border-b border-border/60">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Briefcase className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <DialogTitle className="text-xl font-bold truncate">{selectedApp.title}</DialogTitle>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 shrink-0" />
                        {selectedApp.company}
                        {selectedApp.location && (
                          <>
                            <span className="text-muted-foreground/50">•</span>
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            {selectedApp.location}
                          </>
                        )}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs font-bold border-primary/20 bg-primary/5 text-primary py-1 px-3 self-center">
                      {selectedApp.stage}
                    </Badge>
                  </div>
                </DialogHeader>

                <Tabs defaultValue="notes" className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-6 border-b">
                    <TabsList className="w-full justify-start bg-transparent h-12 p-0 gap-6 border-b-0">
                      <TabsTrigger value="notes" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 h-full bg-transparent shadow-none font-semibold">
                        <MessageSquare className="w-4 h-4 mr-2" /> Notes Log
                      </TabsTrigger>
                      <TabsTrigger value="voice" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 h-full bg-transparent shadow-none font-semibold">
                        <Mic className="w-4 h-4 mr-2" /> Voice Notes
                      </TabsTrigger>
                      <TabsTrigger value="intel" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 h-full bg-transparent shadow-none font-semibold">
                        <Brain className="w-4 h-4 mr-2" /> AI Interview Prep
                      </TabsTrigger>
                      <TabsTrigger value="copilot" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 h-full bg-transparent shadow-none font-semibold">
                        <Sparkles className="w-4 h-4 mr-2" /> Live Copilot
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 min-h-0">
                    {/* Notes tab */}
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
                          <Button onClick={handleAddNoteClick} disabled={isAddingNote || !newNoteText.trim()}>
                            {isAddingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {!selectedApp.notes_log || selectedApp.notes_log.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              No notes yet. Add your thoughts, follow-up items, or interviewer details.
                            </div>
                          ) : (
                            selectedApp.notes_log.map((note: any) => (
                              <Card key={note.id} className="border-border/60 bg-muted/10">
                                <CardContent className="p-3.5 flex items-start justify-between gap-4">
                                  <div className="space-y-1">
                                    <p className="text-sm font-sans text-foreground/95 leading-relaxed">{note.text}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {note.at ? formatDistanceToNow(new Date(note.at)) + " ago" : "just now"}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteNoteClick(note.id)}
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

                    {/* Voice notes tab */}
                    <TabsContent value="voice" className="m-0 space-y-6">
                      <div className="space-y-6">
                        {/* Audio Recorder Controls */}
                        <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-muted/20 border-dashed gap-4">
                          <div className="flex items-center gap-3">
                            {isRecording ? (
                              <div className="flex items-center gap-2">
                                <div className="w-3.5 h-3.5 bg-destructive rounded-full animate-ping" />
                                <span className="text-xs font-semibold text-destructive animate-pulse">Recording Audio...</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground font-semibold">Record a voice note or verbal mock answer</span>
                            )}
                          </div>

                          <div className="flex gap-3">
                            {!isRecording ? (
                              <Button onClick={startRecording} className="bg-primary/95 text-white hover:bg-primary shadow-sm">
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
                                className="bg-success-600 hover:bg-success-700 text-white"
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

                        {/* Voice Note List */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-bold text-foreground">Saved Voice Logs</h4>
                          {!selectedApp.voice_notes || selectedApp.voice_notes.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground text-sm">
                              No voice notes recorded yet.
                            </div>
                          ) : (
                            selectedApp.voice_notes.map((vn: any) => (
                              <Card key={vn.id} className="border-border/60 bg-muted/10">
                                <CardContent className="p-4 space-y-2">
                                  <div className="flex justify-between items-center text-xs text-muted-foreground pb-2 border-b border-border/30">
                                    <span className="font-semibold flex items-center gap-1.5">
                                      <Mic className="w-3.5 h-3.5 text-primary" /> Audio Log
                                    </span>
                                    <span>{vn.at ? formatDistanceToNow(new Date(vn.at)) + " ago" : "recently"}</span>
                                  </div>
                                  {vn.transcript ? (
                                    <p className="text-sm text-foreground/95 bg-card/60 p-3 rounded-lg border border-border/40 leading-relaxed font-sans mt-2">
                                      <span className="font-bold text-[10px] text-primary uppercase tracking-wider block mb-1">AI Transcript</span>
                                      "{vn.transcript}"
                                    </p>
                                  ) : (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 italic">
                                      <Loader2 className="w-3 h-3 animate-spin text-primary" /> Waiting for transcription callback...
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    {/* AI interview prep intel */}
                    <TabsContent value="intel" className="m-0 space-y-6">
                      <div className="space-y-6">
                        {/* Control to trigger research */}
                        <div className="flex items-center justify-between border-b pb-4">
                          <div>
                            <h4 className="text-sm font-bold text-foreground">Interview Questions Intel</h4>
                            <p className="text-xs text-muted-foreground">Retrieve commonly asked questions, preparation foci, and potential warning flags.</p>
                          </div>
                          <Button
                            onClick={handleGenerateInterviewQuestions}
                            disabled={isGeneratingIQ}
                            size="sm"
                            className="bg-gradient-to-r from-violet-600 to-primary text-white"
                          >
                            {isGeneratingIQ ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                {selectedApp.interview_research?.commonly_asked ? "Regenerate Intel" : "Generate Questions"}
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Display IQ */}
                        {!selectedApp.interview_research || !selectedApp.interview_research.commonly_asked ? (
                          <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
                            <Brain className="w-10 h-10 mx-auto text-muted-foreground/50" />
                            <p>No interview intelligence research generated yet for this role.</p>
                            <p className="text-xs">Click the generate button above to extract commonly asked questions from company history.</p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* Study areas / focus points */}
                            {selectedApp.interview_research.preparation_focus && (
                              <div className="space-y-2">
                                <h5 className="text-xs font-bold uppercase tracking-wider text-primary">Target Study Focus</h5>
                                <div className="flex flex-wrap gap-2">
                                  {selectedApp.interview_research.preparation_focus.map((item: string, idx: number) => (
                                    <Badge key={idx} variant="secondary" className="bg-primary/5 text-primary border-primary/10 py-1 px-2.5 text-xs font-medium">
                                      {item}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* commonly asked list */}
                            <div className="space-y-3.5">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Frequently Asked Questions</h5>
                              {selectedApp.interview_research.commonly_asked.map((item: any, idx: number) => (
                                <Card key={idx} className="border-border/60 bg-muted/5 hover:bg-muted/10 transition-colors">
                                  <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start gap-3">
                                      <p className="font-bold text-sm text-foreground/90 font-sans">
                                        Q{idx + 1}: {item.question}
                                      </p>
                                      <Badge variant="outline" className="capitalize text-[10px] shrink-0 font-bold">
                                        {item.category}
                                      </Badge>
                                    </div>
                                    {item.why_asked && (
                                      <p className="text-xs text-muted-foreground">
                                        <strong className="text-foreground/80 font-medium">Why it's asked:</strong> {item.why_asked}
                                      </p>
                                    )}
                                    {item.how_to_answer && (
                                      <p className="text-xs text-foreground/80 leading-relaxed bg-background/50 p-2.5 rounded border">
                                        <strong className="text-primary/90 font-medium block mb-1">Answer Strategy</strong>
                                        {item.how_to_answer}
                                      </p>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                            </div>

                            {/* recent topics */}
                            {selectedApp.interview_research.recent_topics && (
                              <div className="space-y-2">
                                <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Core Competency Themes</h5>
                                <div className="flex flex-wrap gap-2">
                                  {selectedApp.interview_research.recent_topics.map((item: string, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs font-medium py-1 px-2.5 bg-muted/40">
                                      {item}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* red flags */}
                            {selectedApp.interview_research.red_flags_to_avoid && selectedApp.interview_research.red_flags_to_avoid.length > 0 && (
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
                          <Button onClick={handleCopilotStream} disabled={isCopilotStreaming || !copilotQuestion.trim()} size="sm">
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
                                  <div key={i} className="text-xs text-destructive bg-destructive/5 border border-destructive/30 rounded-lg p-3">
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
                                    <p className="text-xs font-bold uppercase tracking-wider text-primary">Instant hints</p>
                                    {(event.value as string[]).map((h, j) => (
                                      <p key={j} className="text-sm text-foreground/90 flex gap-2">
                                        <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />{h}
                                      </p>
                                    ))}
                                  </div>
                                );
                              }
                              if (event.type === "star" && event.value && typeof event.value === "object") {
                                const star = event.value as Record<string, string>;
                                return (
                                  <div key={i} className="space-y-1.5">
                                    <p className="text-xs font-bold uppercase tracking-wider text-primary">STAR framework</p>
                                    {Object.entries(star).map(([k, v]) => (
                                      <p key={k} className="text-sm text-foreground/90">
                                        <span className="font-semibold uppercase text-xs mr-1">{k}:</span>{v}
                                      </p>
                                    ))}
                                  </div>
                                );
                              }
                              if (event.type === "metrics" && Array.isArray(event.value)) {
                                return (
                                  <div key={i} className="space-y-1.5">
                                    <p className="text-xs font-bold uppercase tracking-wider text-primary">Metric callouts</p>
                                    {(event.value as string[]).map((m, j) => (
                                      <p key={j} className="text-sm text-foreground/90 flex gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />{m}
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
                  </div>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ============================================================
            RETROSPECTIVE MODAL — Offer / Rejected
        ============================================================ */}
        <Dialog open={retroOpen} onOpenChange={(open) => {
          if (!open && !isSavingRetro) {
            if (retroMediaRecorderRef.current && retroRecording) {
              try {
                retroMediaRecorderRef.current.onstop = null;
                retroMediaRecorderRef.current.stop();
                retroMediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
              } catch {}
            }
            if (retroAudioUrl) {
              try { URL.revokeObjectURL(retroAudioUrl); } catch {}
            }
            setRetroRecording(false);
            setRetroAudioUrl(null);
            setRetroAudioBlob(null);
            setRetroOpen(false);
          }
        }}>
          <DialogContent className="max-w-2xl p-0 overflow-hidden border-0 shadow-2xl">
            {retroApp && (
              <>
                {/* Emotional header */}
                <div className={`relative p-8 pb-6 overflow-hidden ${retroTargetStage === "offer"
                  ? "bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900"
                  : "bg-gradient-to-br from-rose-950 via-rose-900 to-red-900"
                  }`}>
                  {/* Decorative circles */}
                  <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-10 ${retroTargetStage === "offer" ? "bg-emerald-400" : "bg-rose-400"
                    }`} />
                  <div className={`absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10 ${retroTargetStage === "offer" ? "bg-teal-400" : "bg-red-400"
                    }`} />

                  <div className="relative z-10 flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${retroTargetStage === "offer"
                      ? "bg-emerald-500/30 border border-emerald-400/30"
                      : "bg-rose-500/30 border border-rose-400/30"
                      }`}>
                      {retroTargetStage === "offer"
                        ? <Trophy className="w-7 h-7 text-emerald-300" />
                        : <HeartCrack className="w-7 h-7 text-rose-300" />}
                    </div>
                    <div className="flex-1">
                      <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${retroTargetStage === "offer" ? "text-emerald-400" : "text-rose-400"
                        }`}>
                        {retroTargetStage === "offer" ? "Congratulations 🎉" : "Stay resilient 💪"}
                      </div>
                      <h2 className="text-xl font-extrabold text-white leading-tight">
                        {retroTargetStage === "offer" ? "You got an offer!" : "Application not selected"}
                      </h2>
                      <p className="text-sm text-white/70 mt-1.5">
                        {retroApp.title || retroApp.job?.title || "Untitled Role"} <span className="text-white/40 mx-1">at</span> {retroApp.company || retroApp.job?.company || "Unknown Company"}
                      </p>
                    </div>
                  </div>

                  <p className={`relative z-10 mt-5 text-sm leading-relaxed ${retroTargetStage === "offer" ? "text-emerald-100/80" : "text-rose-100/80"
                    }`}>
                    {retroTargetStage === "offer"
                      ? "Take a moment to capture what worked — your winning strategies, the questions they loved, and how you stood out. Future-you will thank you."
                      : "Every rejection is a data point. Capture what happened, where you felt unprepared, and what you'd do differently. This is your growth engine."}
                  </p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5 bg-background">
                  {/* Prompt chips */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reflection prompts</p>
                    <div className="flex flex-wrap gap-2">
                      {(retroTargetStage === "offer"
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
                          onClick={() => setRetroText((t) => t ? `${t}\n• ${chip}: ` : `• ${chip}: `)}
                          className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 bg-muted/40 hover:bg-muted/80 text-foreground/70 hover:text-foreground transition-colors cursor-pointer font-medium"
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
                        placeholder={retroTargetStage === "offer"
                          ? "What went well? What was your winning strategy? Any standout moments in the interview?"
                          : "What happened? Where did it fall short? What would you prep differently next time?"
                        }
                        rows={6}
                        value={retroText}
                        onChange={(e) => setRetroText(e.target.value)}
                        className="resize-none bg-muted/20 focus-visible:ring-primary/20 text-sm leading-relaxed"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        {retroText.length > 0 ? `${retroText.length} chars written` : "Start typing your reflection..."}
                      </p>
                    </TabsContent>

                    <TabsContent value="voice" className="mt-3">
                      <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-muted/20 border-dashed gap-4">
                        {retroRecording && (
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-destructive rounded-full animate-ping" />
                              <span className="text-xs font-semibold text-destructive animate-pulse">Recording voice reflection...</span>
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
                            <Button onClick={startRetroRecording} size="sm" className="bg-primary text-white">
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
                            <p className="text-[10px] text-muted-foreground">Voice note recorded. It will be transcribed and saved.</p>
                          </>
                        )}
                        {!retroAudioUrl && !retroRecording && (
                          <p className="text-xs text-muted-foreground">Speak your reflection aloud — it will be AI-transcribed and attached to this application.</p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Self-assessment quick rating */}
                  <div className="border border-border/40 rounded-xl p-4 bg-muted/10 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick self-assessment areas to note</p>
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
                          onClick={() => setRetroText((t) => t ? `${t}\n• ${label}: ` : `• ${label}: `)}
                          className="flex items-center gap-2 text-left text-xs px-3 py-2 rounded-lg border border-border/40 bg-background/50 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
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
                      onClick={() => handleRetroSubmit(true)}
                      disabled={isSavingRetro}
                    >
                      Skip for now
                    </Button>
                    <Button
                      size="sm"
                      className={retroTargetStage === "offer"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-rose-700 hover:bg-rose-800 text-white"
                      }
                      onClick={() => handleRetroSubmit(false)}
                      disabled={isSavingRetro || (retroText.trim() === "" && !retroAudioBlob)}
                    >
                      {isSavingRetro ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                      ) : (
                        <><ChevronRight className="w-4 h-4 mr-1" /> Save Reflection & Move Card</>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
};

export default InterviewBoard;
