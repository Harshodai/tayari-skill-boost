import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Sparkles, Minimize2, Maximize2, X, Brain, CheckCircle, Flame } from "lucide-react";

interface STARHint {
  question_keyword: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}

interface InterviewHUDOverlayProps {
  active?: boolean;
  onClose?: () => void;
}

export function InterviewHUDOverlay({ active = true, onClose }: InterviewHUDOverlayProps) {
  const [isListening, setIsListening] = useState(true);
  const [minimized, setMinimized] = useState(false);

  // Live transcript & STAR hints mock / WebSockets payload
  const [transcript, setTranscript] = useState("Tell me about a time you resolved a major system latency bottleneck under pressure.");
  const [activeHint, setActiveHint] = useState<STARHint>({
    question_keyword: "System Latency Bottleneck",
    situation: "Go microservices API proxy was hitting 450ms latency during high concurrency spikes.",
    task: "Identify Redis cache misses and worker thread contention in Celery task queue.",
    action: "Refactored worker async queues, added connection pooling, and optimized SQL index lookups.",
    result: "P99 latency dropped from 450ms to 14ms; system throughput increased by 3.5X with zero downtime."
  });

  if (!active) return null;

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-bounce">
        <Button 
          onClick={() => setMinimized(false)}
          className="rounded-full shadow-2xl bg-gradient-to-r from-primary to-primary/70 text-white font-bold px-5 py-6 border border-white/20 flex items-center gap-2"
        >
          <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
          <span>Interview Co-Pilot Active</span>
          <Maximize2 className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-lg shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Card className="border-primary/40 bg-slate-950/90 backdrop-blur-xl text-slate-100 shadow-2xl overflow-hidden">
        {/* HUD Top Bar */}
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-primary" /> Live Interview Co-Pilot
            </span>
            <Badge variant="outline" className="text-[10px] px-2 py-0 border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
              HUD-v2 Active
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setIsListening(!isListening)}>
              {isListening ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-rose-400" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setMinimized(true)}>
              <Minimize2 className="w-4 h-4" />
            </Button>
            {onClose && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-4 space-y-4 text-xs">
          {/* Real-Time Transcript Line */}
          <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Live Question Speech Recognition:</span>
            <p className="italic text-slate-200 font-medium">"{transcript}"</p>
          </div>

          {/* Contextual STAR Flashcard Response */}
          {activeHint && (
            <div className="space-y-2 border border-primary/30 rounded-xl p-3 bg-gradient-to-br from-primary/10 via-slate-900/40 to-slate-950">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400 text-xs flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 fill-current" /> Matched STAR Talking Points: {activeHint.question_keyword}
                </span>
                <Badge variant="secondary" className="text-[10px]">Verified Proof Card</Badge>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-1">
                <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                  <span className="font-bold text-primary block mb-0.5">S — Situation:</span>
                  <span className="text-slate-300">{activeHint.situation}</span>
                </div>
                <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                  <span className="font-bold text-sky-400 block mb-0.5">T — Task:</span>
                  <span className="text-slate-300">{activeHint.task}</span>
                </div>
                <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                  <span className="font-bold text-emerald-400 block mb-0.5">A — Action:</span>
                  <span className="text-slate-300">{activeHint.action}</span>
                </div>
                <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                  <span className="font-bold text-amber-400 block mb-0.5">R — Result (Metrics):</span>
                  <span className="text-slate-300">{activeHint.result}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
