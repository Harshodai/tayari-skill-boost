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
  Info
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
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const COLUMNS = [
  { id: "saved", label: "Saved", color: "bg-muted" },
  { id: "applied", label: "Applied", color: "bg-primary/10" },
  { id: "phone_screen", label: "Phone Screen", color: "bg-secondary/10" },
  { id: "interview", label: "Interview", color: "bg-warning/10" },
  { id: "offer", label: "Offer", color: "bg-success/10" },
  { id: "rejected", label: "Rejected", color: "bg-destructive/10" },
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

  // Recording voice note state
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
    const idx = COLUMNS.findIndex((c) => c.id === app.stage);
    const nextIdx = direction === "left" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= COLUMNS.length) return;
    const nextStatus = COLUMNS[nextIdx].id;
    setOptimisticApps((prev) => ({ ...prev, [app.id]: nextStatus }));
    updateMutation.mutate({ id: app.id, status: nextStatus });
  };

  const effectiveStatus = (app: any) => optimisticApps[app.id] || app.stage;
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
                <div className={`p-3 rounded-t-lg ${col.color} border-x border-t border-border flex items-center justify-between`}>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-6" />
                </div>
                <div className="flex-1 bg-card border-x border-b border-border rounded-b-lg p-2 space-y-3 min-h-[200px]">
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
                <div className={`p-3.5 rounded-t-xl ${col.color} border-x border-t border-border/60 flex items-center justify-between`}>
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">{col.label}</span>
                  <Badge variant="outline" className="text-[10px] bg-background/50 font-bold">
                    {appsByColumn(col.id).length}
                  </Badge>
                </div>

                {/* Cards feed */}
                <div className="flex-1 bg-card/20 border-x border-b border-border/60 rounded-b-xl p-2.5 space-y-3 min-h-[350px]">
                  {appsByColumn(col.id).map((app) => {
                    const isMoving = !!optimisticApps[app.id];
                    return (
                      <Card 
                        key={app.id} 
                        className={`group cursor-pointer border-border/60 hover:border-primary/20 bg-card/60 backdrop-blur-sm transition-all hover:shadow-sm ${
                          isMoving ? "opacity-60" : ""
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
                                {app.title || "Untitled Role"}
                              </h4>
                              <p className="text-xs text-muted-foreground truncate">
                                {app.company || "Unknown"}
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
                              onClick={() => deleteMutation.mutate(app.id)}
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
                  </div>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
};

export default InterviewBoard;
