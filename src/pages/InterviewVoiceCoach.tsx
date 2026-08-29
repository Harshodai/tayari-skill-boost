import React, { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Volume2, Play, RefreshCw, Award, Zap, AlertTriangle, CheckCircle, Radio, Sparkles, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetchResponse, apiFetch } from "@/api";

interface VoiceAnalysis {
  transcript: string;
  word_count: number;
  duration_seconds: number;
  wpm: number;
  wpm_status: string;
  filler_word_count: number;
  filler_words_found: Record<string, number>;
  star_breakdown: {
    situation: number;
    task: number;
    action: number;
    result: number;
  };
  overall_score: number;
  interviewer_followup: string;
  coaching_tips: string[];
}

const PRESET_INTERVIEW_PROMPTS = [
  "Tell me about a high-severity production outage you diagnosed and mitigated.",
  "Describe how you designed a low-latency distributed caching layer.",
  "How did you resolve a major technical disagreement with a staff architect?",
];

const SAMPLE_STAR_TRANSCRIPT = `During peak Black Friday traffic, our primary database cluster suffered sudden read-lock contention, spiking API latency to 4.2 seconds. As the lead on-call, I immediately isolated the root cause to an un-indexed analytics query, diverted read traffic to our secondary replica mesh, and enabled Redis caching for hot product catalogs. Within 8 minutes, p99 latency dropped back down to 38ms with zero lost orders. Afterwards, I authored a post-mortem and instituted query timeout circuit-breakers.`;

export function InterviewVoiceCoach() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<VoiceAnalysis | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState(PRESET_INTERVIEW_PROMPTS[0]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch { /* recognition may already be stopped */ }
      }
    };
  }, []);

  const transcriptRef = useRef<string>("");

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech Recognition Not Supported", {
        description: "Your browser does not support SpeechRecognition. Please use Chrome or Edge.",
      });
      return;
    }

    setIsRecording(true);
    setTimerSeconds(0);
    setTranscript("");
    transcriptRef.current = "";
    setAnalysis(null);

    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let current = "";
        for (let i = 0; i < event.results.length; ++i) {
          current += event.results[i][0].transcript;
        }
        if (current) {
          setTranscript(current);
          transcriptRef.current = current;
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      toast.error("Failed to start microphone", {
        description: "Please check microphone permissions.",
      });
    }

    toast.info("Voice Recording Active", {
      description: "Speak clearly into your microphone to record your response.",
    });
  };

  const loadSampleAnswer = () => {
    setTranscript(SAMPLE_STAR_TRANSCRIPT);
    transcriptRef.current = SAMPLE_STAR_TRANSCRIPT;
    setTimerSeconds(45);
    toast.success("Sample STAR response loaded. Click Analyze to evaluate speech cadence.");
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch { /* recognition may already be stopped */ }
    }

    const currentText = transcriptRef.current || transcript;
    const sampleTranscript = currentText.trim();

    if (!sampleTranscript) {
      setAnalysis(null);
      toast.error("No Speech Captured", {
        description: "We didn't hear your answer. Please check your microphone and try again.",
        action: { label: "Retry", onClick: () => startRecording() },
      });
      return;
    }

    setTranscript(sampleTranscript);
    setIsAnalyzing(true);

    try {
      const health = await apiFetch<{
        model_status?: string;
        active_engine?: string;
      }>("/v1/health").catch(() => null);

      const modelUnconfigured =
        !health ||
        typeof health !== "object" ||
        health?.model_status === "llm_not_configured" ||
        health?.active_engine === "mock" ||
        health?.active_engine === "mock-fallback";

      if (modelUnconfigured) {
        setAnalysis(null);
        toast.error("AI Coach Not Configured", {
          description: "A live LLM must be configured before voice analysis can run.",
          action: { label: "Configure", onClick: () => window.open("/settings", "_blank") },
        });
        return;
      }

      const resp = await apiFetchResponse("/v1/interview/voice-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: sampleTranscript,
          duration_seconds: Math.max(timerSeconds, 15),
          target_role: "Senior Software Engineer",
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setAnalysis(data);
        toast.success("Voice Analysis Complete");
      } else {
        setAnalysis(null);
        toast.error("Voice Analysis Failed", {
          description: "Unable to analyze your response. Please check your connection and try again.",
          action: { label: "Retry", onClick: () => stopRecording() },
        });
      }
    } catch {
      setAnalysis(null);
      toast.error("Voice Analysis Failed", {
        description: "Unable to reach the coaching service. Please check your connection and try again.",
        action: { label: "Retry", onClick: () => stopRecording() },
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight font-display">AI Voice Interview Coach</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Radio className="w-3.5 h-3.5 mr-1 animate-pulse text-red-500" /> Real-Time Audio STT
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Practice interview responses orally. AI analyzes speech cadence (WPM), filler word frequency, and STAR structure completeness.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSampleAnswer} className="text-xs">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Sample STAR Answer
          </Button>
        </div>

        {/* Prompt Selector */}
        <Card className="border-border/60 bg-card/60 p-4 backdrop-blur-md">
          <span className="text-xs font-mono font-semibold text-muted-foreground block mb-2">Target Interview Question:</span>
          <div className="flex flex-wrap gap-2">
            {PRESET_INTERVIEW_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPrompt(p)}
                className={`text-xs p-2 rounded-lg border text-left transition-all ${
                  selectedPrompt === p
                    ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                    : "border-border/50 bg-background/50 text-foreground/80 hover:bg-muted"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Audio Recording Console */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="text-center p-6 flex flex-col items-center justify-center space-y-4 border-2 border-dashed shadow-sm">
              <div className="relative">
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isRecording
                      ? "bg-red-500/20 text-red-500 animate-ping"
                      : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {isRecording ? <Mic className="w-10 h-10 animate-bounce" /> : <Mic className="w-10 h-10" />}
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-semibold text-base">
                  {isRecording ? "Recording Answer..." : "Ready to Practice"}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  {isRecording ? `Timer: ${timerSeconds}s` : "Click below to begin speech recording"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {!isRecording ? (
                  <Button onClick={startRecording} className="gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold active:scale-[0.98]">
                    <Mic className="w-4 h-4" /> Start Voice Recording
                  </Button>
                ) : (
                  <Button onClick={stopRecording} variant="destructive" className="gap-2 active:scale-[0.98]">
                    <MicOff className="w-4 h-4" /> Stop & Analyze Response
                  </Button>
                )}
                {transcript && !isRecording && (
                  <Button onClick={stopRecording} disabled={isAnalyzing} variant="outline" className="gap-2">
                    <RefreshCw className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`} /> Analyze Transcript
                  </Button>
                )}
              </div>
            </Card>

            {transcript && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2 border-b border-border/40">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span>Captured Transcript</span>
                    <span className="font-mono text-xs text-muted-foreground">{transcript.split(/\s+/).length} words</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <p className="text-xs text-foreground/90 font-mono leading-relaxed whitespace-pre-wrap bg-muted/40 p-3 rounded-lg border">
                    {transcript}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Analysis Results Pane */}
          <div className="lg:col-span-7 space-y-4">
            {isAnalyzing && (
              <Card className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm font-semibold">Analyzing Speech Patterns & STAR Structure...</p>
              </Card>
            )}

            {!isAnalyzing && !analysis && (
              <Card className="p-12 text-center text-muted-foreground space-y-2">
                <Volume2 className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                <h3 className="font-semibold text-foreground">No Voice Feedback Yet</h3>
                <p className="text-xs max-w-sm mx-auto">
                  Record your oral answer or load a sample STAR response to receive real-time cadence scoring, filler word counts, and quadrant analysis.
                </p>
              </Card>
            )}

            {!isAnalyzing && analysis && (
              <div className="space-y-4">
                {/* Scorecards */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-4 text-center">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground">Cadence</span>
                    <p className="text-2xl font-bold font-mono mt-1 text-primary">{analysis.wpm} WPM</p>
                    <Badge variant="outline" className="text-[9px] mt-1">{analysis.wpm_status}</Badge>
                  </Card>
                  <Card className="p-4 text-center">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground">Filler Words</span>
                    <p className="text-2xl font-bold font-mono mt-1 text-amber-500">{analysis.filler_word_count}</p>
                    <span className="text-[10px] text-muted-foreground mt-1 block">Detected</span>
                  </Card>
                  <Card className="p-4 text-center">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground">Overall STAR</span>
                    <p className="text-2xl font-bold font-mono mt-1 text-emerald-500">{analysis.overall_score}%</p>
                    <span className="text-[10px] text-muted-foreground mt-1 block">Structure</span>
                  </Card>
                </div>

                {/* STAR Breakdown */}
                <Card className="p-4 space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">STAR Quadrant Breakdown</h4>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded bg-muted/40 border">
                      <span className="text-[10px] text-muted-foreground font-mono">Situation</span>
                      <p className="text-base font-bold font-mono text-foreground">{analysis.star_breakdown.situation}%</p>
                    </div>
                    <div className="p-2 rounded bg-muted/40 border">
                      <span className="text-[10px] text-muted-foreground font-mono">Task</span>
                      <p className="text-base font-bold font-mono text-foreground">{analysis.star_breakdown.task}%</p>
                    </div>
                    <div className="p-2 rounded bg-muted/40 border">
                      <span className="text-[10px] text-muted-foreground font-mono">Action</span>
                      <p className="text-base font-bold font-mono text-primary">{analysis.star_breakdown.action}%</p>
                    </div>
                    <div className="p-2 rounded bg-muted/40 border">
                      <span className="text-[10px] text-muted-foreground font-mono">Result</span>
                      <p className="text-base font-bold font-mono text-emerald-500">{analysis.star_breakdown.result}%</p>
                    </div>
                  </div>
                </Card>

                {/* Coaching Tips */}
                {analysis.coaching_tips.length > 0 && (
                  <Card className="p-4 space-y-2 border-primary/20 bg-primary/5">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" /> AI Interviewer Coaching Notes
                    </h4>
                    <ul className="space-y-1.5 text-xs text-foreground/90">
                      {analysis.coaching_tips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default InterviewVoiceCoach;
