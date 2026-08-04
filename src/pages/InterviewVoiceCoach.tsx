import React, { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Volume2, Play, RefreshCw, Award, Zap, AlertTriangle, CheckCircle, Radio } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/api";

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

export function InterviewVoiceCoach() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<VoiceAnalysis | null>(null);
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
        } catch {}
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

  const stopRecording = async () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    const currentText = transcriptRef.current || transcript;
    const sampleTranscript = currentText.trim();

    if (!sampleTranscript) {
      // ponytail: no fabricated fallback transcript — keep analysis empty and
      // surface an actionable retry path when no speech was captured.
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
        health?.model_status === "llm_not_configured" ||
        health?.active_engine === "mock" ||
        health?.active_engine === "mock-fallback";

      if (modelUnconfigured) {
        // ponytail: never show synthetic STAR/score output when no real LLM is
        // configured — surface the missing-config error path instead.
        setAnalysis(null);
        toast.error("AI Coach Not Configured", {
          description: "A live LLM must be configured before voice analysis can run.",
          action: { label: "Configure", onClick: () => window.open("/settings", "_blank") },
        });
        return;
      }

      const resp = await fetch("/api/v1/interview/voice-feedback", {
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
        // ponytail: never populate synthetic scores or coaching text when the
        // API fails; keep the transcript and show a retryable error instead.
        setAnalysis(null);
        toast.error("Voice Analysis Failed", {
          description: "Unable to analyze your response. Please check your connection and try again.",
          action: { label: "Retry", onClick: () => stopRecording() },
        });
      }
    } catch {
      // ponytail: thrown/network failures also clear stale analysis and surface
      // a retryable error rather than fabricated feedback.
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
              <h1 className="text-3xl font-bold tracking-tight">AI Voice Interview Coach</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Radio className="w-3.5 h-3.5 mr-1 animate-pulse text-red-500" /> Real-Time Audio STT
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Practice interview responses orally. AI analyzes speech cadence (WPM), filler word frequency, and STAR structure completeness.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Audio Recording Console */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="text-center p-6 flex flex-col items-center justify-center space-y-4 border-2 border-dashed">
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
                  <Button onClick={startRecording} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                    <Mic className="w-4 h-4" /> Start Voice Recording
                  </Button>
                ) : (
                  <Button onClick={stopRecording} variant="destructive" className="gap-2">
                    <MicOff className="w-4 h-4" /> Stop & Analyze Response
                  </Button>
                )}
              </div>
            </Card>

            {transcript && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
                    Speech Transcript
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-foreground italic bg-muted/30 p-3 rounded border leading-relaxed">
                    "{transcript}"
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Real-time Feedback Scorecard */}
          <div className="lg:col-span-7 space-y-4">
            {isAnalyzing ? (
              <Card className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm font-medium text-muted-foreground">
                  Analyzing vocal pace, filler frequency, and STAR structure...
                </p>
              </Card>
            ) : analysis ? (
              <div className="space-y-4">
                {/* Top Metrics Row */}
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-4 text-center">
                    <div className="text-xs font-medium text-muted-foreground">Overall Score</div>
                    <div className="text-3xl font-extrabold text-primary mt-1">{analysis.overall_score}/100</div>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {analysis.overall_score >= 80 ? "Exceeds Bar" : "Meets Bar"}
                    </Badge>
                  </Card>

                  <Card className="p-4 text-center">
                    <div className="text-xs font-medium text-muted-foreground">Speaking Pace</div>
                    <div className="text-2xl font-bold text-foreground mt-1">{analysis.wpm} WPM</div>
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {analysis.wpm_status}
                    </Badge>
                  </Card>

                  <Card className="p-4 text-center">
                    <div className="text-xs font-medium text-muted-foreground">Filler Words</div>
                    <div className="text-2xl font-bold text-amber-500 mt-1">{analysis.filler_word_count}</div>
                    <span className="text-[10px] text-muted-foreground block mt-1">
                      {Object.keys(analysis.filler_words_found).join(", ") || "None"}
                    </span>
                  </Card>
                </div>

                {/* STAR Alignment Breakdown */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" /> STAR Framework Coverage
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span>Situation / Context</span>
                      <span className="font-semibold text-primary">{analysis.star_breakdown.situation}%</span>
                    </div>
                    <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${analysis.star_breakdown.situation}%` }} />
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Technical Action</span>
                      <span className="font-semibold text-emerald-500">{analysis.star_breakdown.action}%</span>
                    </div>
                    <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: `${analysis.star_breakdown.action}%` }} />
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Quantified Result</span>
                      <span className="font-semibold text-blue-500">{analysis.star_breakdown.result}%</span>
                    </div>
                    <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full" style={{ width: `${analysis.star_breakdown.result}%` }} />
                    </div>
                  </CardContent>
                </Card>

                {/* AI Coaching Tips */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-500" /> AI Coach Feedback
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {analysis.coaching_tips.map((tip, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </div>
                    ))}
                    <div className="mt-3 p-3 bg-primary/5 rounded border border-primary/20">
                      <div className="font-semibold text-xs text-primary mb-1">Recommended Follow-up Question:</div>
                      <div className="text-xs text-foreground font-medium">"{analysis.interviewer_followup}"</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="p-12 text-center text-muted-foreground text-sm">
                Record a 30-60 second oral answer to receive instant vocal analytics and STAR feedback.
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default InterviewVoiceCoach;
