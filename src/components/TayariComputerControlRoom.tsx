import React, { useState, useEffect, useCallback } from 'react';
import { Monitor, Play, Pause, AlertTriangle, ShieldCheck, RefreshCw, Terminal, CheckCircle2, Lock, Eye } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/api';

interface AutopilotStep {
  step: number;
  action: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp: string;
}

interface AutopilotStreamEvent {
  runId: string;
  stage: string;
  status: 'connected' | 'in_progress' | 'finished' | 'error';
  timestamp: string;
}

export const TayariComputerControlRoom: React.FC = () => {
  const [manualTakeover, setManualTakeover] = useState(false);
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const [takeoverError, setTakeoverError] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState("https://boards.greenhouse.io/techcorp/jobs/4010293");
  const [agentSteps, setAgentSteps] = useState<AutopilotStep[]>([
    { step: 1, action: "Navigate to Target Application URL", status: "completed", timestamp: "16:40:01" },
    { step: 2, action: "Inspect Accessibility Snapshot Tree", status: "completed", timestamp: "16:40:03" },
    { step: 3, action: "Fill Semantic Field 'Full Name' -> Alex Mercer", status: "completed", timestamp: "16:40:05" },
    { step: 4, action: "Fill Semantic Field 'Email' -> alex@example.com", status: "completed", timestamp: "16:40:06" },
    { step: 5, action: "Upload Tailored Resume PDF", status: "in_progress", timestamp: "16:40:08" }
  ]);
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const handleManualTakeover = useCallback(async () => {
    setTakeoverLoading(true);
    setTakeoverError(null);
    const newTakeoverState = !manualTakeover;

    try {
      // Call backend to pause/resume autopilot
      // POST /api/v1/autopilot/pause with { runId, pause: boolean }
      await apiFetch('/v1/autopilot/pause', {
        method: 'POST',
        body: JSON.stringify({ pause: newTakeoverState }),
      });

      // Only update state after successful backend request
      setManualTakeover(newTakeoverState);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle manual control';
      setTakeoverError(message);
      // Preserve existing takeover state on failure
    } finally {
      setTakeoverLoading(false);
    }
  }, [manualTakeover]);

  // Subscribe to autopilot SSE stream for live updates
  useEffect(() => {
    // In a real implementation, this would connect to an active run's SSE stream
    // For now, we label the UI as a preview since no active run is connected
    setIsPreviewMode(true);

    // Example of how to connect to SSE when a runId is available:
    // if (activeRunId) {
    //   const eventSource = new EventSource(`/api/v1/autopilot/stream/${activeRunId}`);
    //   eventSource.addEventListener('autopilot_update', (event) => {
    //     const data: AutopilotStreamEvent = JSON.parse(event.data);
    //     // Update liveUrl and agentSteps based on stage
    //     setLiveUrl(data.stage.includes('NAVIGATE') ? data.stage : liveUrl);
    //     // Convert stage to agent steps
    //   });
    //   return () => eventSource.close();
    // }
  }, [activeRunId]);

  const formatStepStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 text-slate-100 font-sans">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
            <Monitor className="w-7 h-7 text-indigo-400" /> Tayari Computer Control Room
          </h1>
          <p className="text-xs text-slate-400">Accessibility-Snapshot Browser Sandbox Execution & Real-Time Telemetry</p>
        </div>
        <div className="flex items-center gap-3">
          {isPreviewMode && (
            <Badge className="bg-amber-950 text-amber-300 border border-amber-800" variant="secondary">
              <AlertTriangle className="w-3 h-3 mr-1" /> Preview Mode — No Live Autopilot Stream
            </Badge>
          )}
          <Button
            onClick={handleManualTakeover}
            disabled={takeoverLoading}
            className={`font-bold transition ${
              manualTakeover ? "bg-amber-600 hover:bg-amber-500 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"
            } ${takeoverLoading ? 'opacity-50 cursor-wait' : ''}`}
            aria-pressed={manualTakeover}
            aria-busy={takeoverLoading}
          >
            {takeoverLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Toggling…
              </>
            ) : manualTakeover ? (
              <>
                <Pause className="w-4 h-4 mr-2" /> Manual Control Active
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" /> Take Manual Control
              </>
            )}
          </Button>
          {takeoverError && (
            <span className="text-xs text-amber-300 bg-amber-950/90 px-2 py-1 rounded border border-amber-800" role="alert">
              {takeoverError}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Simulated WebRTC Canvas (2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-slate-900 border-slate-800 text-slate-100 overflow-hidden">
            <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
              <label htmlFor="live-url-input" className="sr-only">
                Current Page URL
              </label>
              <Input
                id="live-url-input"
                value={liveUrl}
                readOnly
                className="bg-slate-900 border-slate-800 text-xs font-mono text-slate-300 h-7 flex-1 cursor-not-allowed"
                aria-label="Current page URL (read-only — navigation not yet wired)"
                title="Current page URL — navigation not yet wired"
              />
              <Badge className={manualTakeover ? "bg-amber-950 text-amber-300" : "bg-emerald-950 text-emerald-300"}>
                {manualTakeover ? "MANUAL" : "AUTOPILOT"}
              </Badge>
            </div>

            {/* Simulated WebRTC Video Canvas */}
            <div className="relative aspect-video bg-slate-950 flex flex-col justify-center items-center p-8 text-center space-y-4 border-b border-slate-800">
              <div className="p-4 bg-indigo-950/60 rounded-full text-indigo-400 animate-pulse">
                <Monitor className="w-12 h-12" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-200">Simulated WebRTC Browser Stream</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Rendering accessibility node tree: <code>role='textbox' name='First Name'</code>
                </p>
              </div>

              {manualTakeover && (
                <div className="absolute top-4 left-4 bg-amber-950/90 text-amber-200 px-3 py-1 rounded text-xs border border-amber-800 font-mono">
                  ⚠️ Manual Takeover Engaged — Agent Paused
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Agent Step Timeline (1 Column) */}
        <div className="space-y-4">
          <Card className="bg-slate-900 border-slate-800 text-slate-100 p-4 space-y-4">
            <CardHeader className="p-0 border-b border-slate-800 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" /> Agent Execution Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-3 font-mono text-xs">
              {agentSteps.map((st) => (
                <div key={st.step} className="p-3 bg-slate-950 rounded border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Step {st.step}</span>
                    <span>{st.timestamp}</span>
                  </div>
                  <div className="text-slate-200 font-semibold">{st.action}</div>
                  <div className="flex justify-end">
                    <Badge
                      className={
                        st.status === "completed" ? "bg-emerald-950 text-emerald-300 text-[10px]" :
                        st.status === "in_progress" ? "bg-amber-950 text-amber-300 text-[10px]" :
                        st.status === "failed" ? "bg-red-950 text-red-300 text-[10px]" :
                        "bg-slate-800 text-slate-400 text-[10px]"
                      }
                    >
                      {formatStepStatus(st.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TayariComputerControlRoom;