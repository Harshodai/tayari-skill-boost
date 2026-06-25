import { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { listApplications, listSavedJobs } from "@/api";
import {
  Brain,
  Loader2,
  Sparkles,
  ArrowLeft,
  Timer,
  Eye,
  EyeOff,
  Star,
  CheckCircle2,
  Building2,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RefreshCw,
  Trophy,
  AlertCircle,
  HelpCircle
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

function getToken() {
  return localStorage.getItem("auth_token");
}

async function fetchInterviewPrep(payload: any) {
  const res = await fetch(`${API_URL}/v1/interview/prep`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getToken() ? `Bearer ${getToken()}` : "",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to generate interview prep");
  return res.json();
}

const InterviewPrep = () => {
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [interviewType, setInterviewType] = useState("behavioral");
  const [prepData, setPrepData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [selfScores, setSelfScores] = useState<Record<number, number>>({});
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  const [searchParams] = useSearchParams();

  // Voice AI Live States
  const [isVoiceSession, setIsVoiceSession] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"disconnected" | "connecting" | "ready" | "listening" | "processing" | "speaking">("disconnected");
  const [voiceLog, setVoiceLog] = useState<{ sender: "interviewer" | "candidate"; text: string }[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState("");
  const [telemetry, setTelemetry] = useState<{
    wpm: number;
    fillers: string[];
    star_compliance: { situation: boolean; task: boolean; action: boolean; result: boolean; score: number };
  } | null>(null);
  const [activeSpeechDuration, setActiveSpeechDuration] = useState(0);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-fill application from URL query param (e.g., from InterviewBoard)
  useEffect(() => {
    const qAppId = searchParams.get("app");
    if (qAppId) setSelectedAppId(qAppId);
  }, [searchParams]);

  const { data: applications = [] } = useQuery({
    queryKey: ["applications"],
    queryFn: () => listApplications(),
  });
  const { data: savedJobs = [] } = useQuery({
    queryKey: ["saved-jobs"],
    queryFn: () => listSavedJobs(),
  });

  const interviewApps = applications.filter((a: any) =>
    ["phone_screen", "interview"].includes(a.status)
  );

  const selectedApp = interviewApps.find(
    (a: any) => (a.application_id || a.id) === selectedAppId
  );
  const selectedJob = selectedApp
    ? savedJobs.find((j: any) => j.id === (selectedApp as any).saved_job_id)
    : null;

  const handleGenerate = async () => {
    if (!selectedAppId) {
      toast.error("Select an application first");
      return;
    }
    setIsGenerating(true);
    try {
      const payload: any = {
        application_id: selectedAppId,
        interview_type: interviewType,
      };
      if (selectedJob) {
        const job = selectedJob.job || {};
        payload.job_title = job.title || "";
        payload.company_name = job.company || "";
        payload.job_description = job.description || "";
      }
      const result = await fetchInterviewPrep(payload);
      setPrepData(result);
      setExpandedQuestion(null);
      setPracticeMode(false);
      toast.success("Interview prep generated!");
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleTimer = () => {
    if (timerActive) {
      setTimerActive(false);
    } else {
      setTimerActive(true);
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev >= 120) {
            clearInterval(interval);
            setTimerActive(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleStarClick = (qIdx: number, star: number) => {
    setSelfScores((prev) => ({ ...prev, [qIdx]: star }));
  };

  // ===========================================================================
  // VOICE INTERVIEW AI STREAMING HANDLERS
  // ===========================================================================
  const startVoiceInterview = async () => {
    setVoiceStatus("connecting");
    setVoiceLog([]);
    setTelemetry(null);
    setCurrentTranscription("");

    // 1. Establish WebSocket
    const wsBaseUrl = API_URL.replace("http://", "ws://").replace("https://", "wss://");
    const wsUrl = `${wsBaseUrl}/v1/interview/stream`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setVoiceStatus("ready");
        // Send initial metadata
        const job = selectedJob?.job || {};
        ws.send(JSON.stringify({
          type: "start",
          target_role: job.title || "Software Engineer",
          company_name: job.company || "Target Company",
          interview_type: interviewType
        }));

        // 2. Request user microphone
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          
          const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
          mediaRecorderRef.current = mediaRecorder;

          mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              ws.send(event.data);
            }
          };

          // Start recorder (collect 250ms chunks)
          mediaRecorder.start(250);
          setVoiceStatus("listening");
        } catch (micErr) {
          console.error("Microphone access failed:", micErr);
          toast.error("Microphone access is required for live voice mock interviews.");
          stopVoiceInterview();
        }
      };

      ws.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          // Play synthesized interviewer audio response
          setVoiceStatus("speaking");
          const audioUrl = URL.createObjectURL(event.data);
          const audio = new Audio(audioUrl);
          audio.onended = () => {
            setVoiceStatus("listening");
            // Start speaking timer for telemetry tracking
            setActiveSpeechDuration(0);
            if (audioTimerRef.current) clearInterval(audioTimerRef.current);
            audioTimerRef.current = setInterval(() => {
              setActiveSpeechDuration(prev => prev + 1);
            }, 1000);
          };
          audio.play();
        } else {
          // Parse JSON frames
          const msg = JSON.parse(event.data);
          if (msg.type === "llm_text") {
            setVoiceLog(prev => [...prev, { sender: "interviewer", text: msg.text }]);
            setVoiceStatus("processing");
          } else if (msg.type === "transcription") {
            setCurrentTranscription(msg.text);
            if (msg.is_final) {
              setVoiceLog(prev => [...prev, { sender: "candidate", text: msg.text }]);
              setCurrentTranscription("");
            }
          } else if (msg.type === "telemetry") {
            setTelemetry({
              wpm: msg.wpm,
              fillers: msg.fillers,
              star_compliance: msg.star_compliance
            });
            // Stop speech duration timer
            if (audioTimerRef.current) {
              clearInterval(audioTimerRef.current);
              audioTimerRef.current = null;
            }
          }
        }
      };

      ws.onclose = () => {
        setVoiceStatus("disconnected");
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        toast.error("Voice stream connection error.");
        stopVoiceInterview();
      };

      setIsVoiceSession(true);
    } catch (wsErr) {
      console.error("WS error:", wsErr);
      setVoiceStatus("disconnected");
    }
  };

  const stopVoiceInterview = () => {
    // Stop recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    // Close websocket
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current);
      audioTimerRef.current = null;
    }
    setIsVoiceSession(false);
    setVoiceStatus("disconnected");
  };

  const getCategoryVariant = (category: string): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "subtle" => {
    switch (category?.toLowerCase()) {
      case "behavioral":
        return "info";
      case "technical":
        return "default";
      case "system-design":
        return "warning";
      default:
        return "secondary";
    }
  };

  const questions = prepData?.questions || [];
  const companySpecific = prepData?.company_specific;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Link>
          </Button>
        </div>

        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
            <Brain className="w-4 h-4" />
            AI Interview Coach
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight font-display mb-3">
            Mock Interview Practice
          </h1>
          <p className="text-muted-foreground text-sm">
            Practice questions custom-tailored to your resume and experience, or launch the interactive real-time Voice AI Interview simulator.
          </p>
        </div>

        {/* View Mode Switcher */}
        {!isVoiceSession ? (
          <div className="space-y-8">
            {/* Setup Form Controls */}
            <Card className="glass border-border/40 shadow-lg">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                  <div className="md:col-span-4">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Select Application</label>
                    <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an interview..." />
                      </SelectTrigger>
                      <SelectContent>
                        {interviewApps.map((app: any) => {
                          const job = savedJobs.find((j: any) => j.id === app.saved_job_id);
                          const jobData = job?.job || {};
                          return (
                            <SelectItem key={app.id || app.application_id} value={app.application_id || app.id}>
                              {jobData.title || "Untitled"} @ {jobData.company || "Unknown"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Interview Type</label>
                    <Select value={interviewType} onValueChange={setInterviewType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="behavioral">Behavioral (STAR)</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="system-design">System Design</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-5 flex gap-3">
                    <Button className="flex-1 font-semibold" onClick={handleGenerate} disabled={isGenerating || !selectedAppId}>
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4.5 h-4.5 animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4.5 h-4.5 mr-2" />
                          Generate Questions
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      onClick={startVoiceInterview} 
                      disabled={!selectedAppId}
                      className="bg-success hover:bg-success/90 text-white font-semibold flex-1 gap-2"
                    >
                      <Mic className="w-4.5 h-4.5" />
                      Live Voice Mock
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Company Banner */}
            {companySpecific && (
              <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-bold text-sm">{companySpecific.company} Focus Areas</p>
                      <p className="text-xs text-muted-foreground">
                        Preparation points: {companySpecific.principles?.slice(0, 4).join(", ")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Static Question List */}
            {questions.length > 0 && (
              <div className="space-y-4">
                {questions.map((q: any, idx: number) => (
                  <Card key={idx} className="overflow-hidden border border-border/30 hover:border-border/60 transition-all shadow-sm">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={getCategoryVariant(q.category)}>{q.category}</Badge>
                          <span className="text-xs text-muted-foreground font-mono">Q{idx + 1}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedQuestion(expandedQuestion === idx ? null : idx)}
                          >
                            {expandedQuestion === idx ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="font-bold text-base mb-2 text-foreground">{q.question}</p>
                      {q.source_bullet && (
                        <p className="text-xs text-muted-foreground italic mb-3">
                          Based on resume: "{q.source_bullet}"
                        </p>
                      )}

                      {expandedQuestion === idx && (
                        <div className="mt-4 space-y-4 bg-muted/40 rounded-lg p-4 border border-border/20">
                          {q.star_suggested && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Suggested STAR Framework Outline</p>
                              <div className="grid gap-2 text-xs md:text-sm">
                                <div><strong className="text-foreground font-semibold">Situation:</strong> {q.star_suggested.situation}</div>
                                <div><strong className="text-foreground font-semibold">Task:</strong> {q.star_suggested.task}</div>
                                <div><strong className="text-foreground font-semibold">Action:</strong> {q.star_suggested.action}</div>
                                <div><strong className="text-foreground font-semibold">Result:</strong> {q.star_suggested.result}</div>
                              </div>
                            </div>
                          )}
                          {q.suggested_answer && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Recommended Response Outline</p>
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{q.suggested_answer}</p>
                            </div>
                          )}
                          {q.suggested_approach && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Technical/Communication Strategy</p>
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{q.suggested_approach}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!prepData && !isGenerating && (
              <div className="text-center py-16 border border-dashed rounded-xl bg-card/40">
                <Brain className="w-12 h-12 mx-auto mb-4 opacity-30 animate-pulse text-muted-foreground" />
                <h3 className="font-bold text-foreground mb-1">No Practice Questions Loaded</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Select an interview from your applications drop-down above and generate structured coaching sheets.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ===================================================================
             LIVE VOICE INTERVIEW SCREEN
             =================================================================== */
          <div className="space-y-8 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3.5 h-3.5 rounded-full ${
                  voiceStatus === "listening" ? "bg-success animate-pulse" :
                  voiceStatus === "processing" ? "bg-warning animate-pulse" :
                  voiceStatus === "speaking" ? "bg-primary animate-pulse" : "bg-muted"
                }`}></div>
                <span className="text-sm font-bold text-foreground capitalize">
                  {voiceStatus === "listening" ? "Interviewer Listening..." :
                   voiceStatus === "processing" ? "Interviewer Thinking..." :
                   voiceStatus === "speaking" ? "Interviewer Speaking..." : "Connecting..."}
                </span>
              </div>
              <Button variant="destructive" onClick={stopVoiceInterview} className="font-semibold">
                Exit Practice
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Interview conversation log */}
              <div className="lg:col-span-8 space-y-4">
                <Card className="glass border-border/40 shadow-xl min-h-[400px] flex flex-col justify-between">
                  <CardHeader className="border-b border-border/40 pb-3">
                    <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-primary" /> Live Transcript Feed
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 flex-1 flex flex-col justify-end space-y-4 overflow-y-auto max-h-[450px]">
                    {voiceLog.length === 0 && voiceStatus === "connecting" && (
                      <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                        Initializing WebSocket channel and loading voice engines...
                      </div>
                    )}
                    {voiceLog.map((logItem, idx) => (
                      <div
                        key={idx}
                        className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                          logItem.sender === "interviewer"
                            ? "bg-muted border self-start rounded-tl-none text-foreground font-medium"
                            : "bg-primary text-primary-foreground self-end rounded-tr-none"
                        }`}
                      >
                        {logItem.text}
                      </div>
                    ))}
                    {currentTranscription && (
                      <div className="max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed bg-primary/20 text-foreground border border-primary/20 self-end rounded-tr-none italic animate-pulse">
                        {currentTranscription}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Speech Telemetry Checklist */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                {/* Speech Metrics */}
                <Card className="border border-border/40 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Timer className="w-4 h-4 text-primary" /> Voice Telemetry
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {telemetry ? (
                      <>
                        {/* WPM score */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Speech Velocity:</span>
                          <span className={`text-base font-bold ${
                            telemetry.wpm >= 110 && telemetry.wpm <= 150 ? "text-success" :
                            telemetry.wpm > 150 ? "text-warning" : "text-destructive"
                          }`}>
                            {telemetry.wpm} WPM {
                              telemetry.wpm >= 110 && telemetry.wpm <= 150 ? "(Optimal)" :
                              telemetry.wpm > 150 ? "(Too Fast)" : "(Too Slow)"
                            }
                          </span>
                        </div>

                        {/* Fillers */}
                        <div className="space-y-2">
                          <span className="text-sm text-muted-foreground block">Filler Words Flagged:</span>
                          {telemetry.fillers.length === 0 ? (
                            <Badge variant="outline" className="bg-success/5 text-success border-success/20">
                              Excellent, no fillers!
                            </Badge>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {telemetry.fillers.map((fill, i) => (
                                <Badge key={i} variant="secondary" className="bg-destructive/10 text-destructive border border-destructive/20 text-[11px]">
                                  {fill}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* STAR compliance checklist */}
                        <div className="space-y-3 pt-2 border-t">
                          <span className="text-sm font-bold text-foreground block">STAR Structure Compliance</span>
                          <div className="space-y-2.5">
                            {[
                              { label: "Situation Context", val: telemetry.star_compliance.situation },
                              { label: "Task Definition", val: telemetry.star_compliance.task },
                              { label: "Action Explanation", val: telemetry.star_compliance.action },
                              { label: "Result Metric", val: telemetry.star_compliance.result },
                            ].map((step, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-foreground/90">
                                <CheckCircle2 className={`w-4.5 h-4.5 ${step.val ? "text-success fill-success/10" : "text-muted"}`} />
                                <span className={step.val ? "font-medium text-foreground" : "text-muted-foreground"}>
                                  {step.label}
                                </span>
                              </div>
                            ))}
                          </div>
                          
                          {/* Progress bar */}
                          <div className="space-y-1.5 pt-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>STAR Score</span>
                              <span className="font-bold text-foreground">{telemetry.star_compliance.score}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-success transition-all duration-500" style={{ width: `${telemetry.star_compliance.score}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-sm text-muted-foreground italic">
                        {voiceStatus === "listening" ? (
                          <div className="flex flex-col items-center gap-2">
                            <Mic className="w-8 h-8 text-primary animate-pulse" />
                            <span>Candidate is speaking... ({formatTime(activeSpeechDuration)})</span>
                          </div>
                        ) : (
                          <span>Response analytics will show here after you finish your turn.</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* STAR Tip */}
                <Card className="border border-border/30 bg-muted/20">
                  <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Trophy className="w-4 h-4 text-warning" />
                      STAR Interview Method
                    </div>
                    <p className="leading-relaxed">
                      Structured responses are critical. Describe the **Situation**, explain the **Task** you had to perform, detailing the **Actions** you took, and close with the final **Result** (include quantitative metrics where possible).
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default InterviewPrep;
