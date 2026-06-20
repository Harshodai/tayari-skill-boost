import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  Target,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Download,
  Trash2,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  startAutopilot,
  listAutopilotRuns,
  getAutopilotRun,
  listApplications,
  downloadApplicationResume,
  deleteApplication,
} from "@/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const AutoPilot = () => {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [maxJobs, setMaxJobs] = useState(5);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: runs = [], isLoading: runsLoading, error: runsError } = useQuery({
    queryKey: ["autopilot-runs"],
    queryFn: () => listAutopilotRuns(),
  });

  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ["applications", activeRunId],
    queryFn: () => listApplications(),
    enabled: !!activeRunId,
  });

  const { data: runStatus, error: runStatusError } = useQuery({
    queryKey: ["autopilot-run", activeRunId],
    queryFn: () => getAutopilotRun(activeRunId!),
    enabled: !!activeRunId,
    refetchInterval: (data) => {
      if (data?.status === "completed" || data?.status === "failed") return false;
      return 3000;
    },
  });

  const startMutation = useMutation({
    mutationFn: startAutopilot,
    onSuccess: (data) => {
      toast.success("Auto-Pilot started");
      setRunError(null);
      setActiveRunId(data.run_id);
      queryClient.invalidateQueries({ queryKey: ["autopilot-runs"] });
    },
    onError: (err: any) => {
      const msg = err.message || "Failed to start";
      setRunError(msg);
      toast.error(msg);
    },
  });

  const handleStart = () => {
    setRunError(null);
    startMutation.mutate({
      run_config: {
        query: query || undefined,
        location: location || undefined,
        max_jobs: maxJobs,
        auto_apply: false,
      },
      resume_text: "",
      candidate_name: "Candidate",
    });
  };

  const isRunning = runStatus?.status === "running" || runStatus?.status === "queued";

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            Auto-Pilot Mode
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Let AI Apply for You
          </h1>
          <p className="text-muted-foreground text-lg">
            Configure your preferences and let the agent search, tailor, and apply to jobs automatically.
          </p>
        </div>

        {/* Config Panel */}
        <div className="max-w-3xl mx-auto mb-10">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Run Configuration
              </CardTitle>
              <CardDescription>
                Set search criteria and let the agent handle the rest.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Job Query</label>
                  <Input
                    placeholder="e.g. Software Engineer, React Developer"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Location</label>
                  <Input
                    placeholder="e.g. Remote, Bangalore, US"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Max Jobs: {maxJobs}</label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={maxJobs}
                  onChange={(e) => setMaxJobs(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleStart}
                  disabled={startMutation.isPending || isRunning}
                  className="min-w-[140px]"
                >
                  {startMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Start Run
                </Button>
                {isRunning && (
                  <Badge variant="outline" className="animate-pulse">
                    <Clock className="w-3 h-3 mr-1" />
                    Running…
                  </Badge>
                )}
              </div>
              {runError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{runError}</span>
                  <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => setRunError(null)}>
                    Dismiss
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Active Run Status */}
        {activeRunId && runStatus && (
          <div className="max-w-3xl mx-auto mb-10">
            <Card className="border-primary/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Active Run: {activeRunId.slice(0, 8)}…
                  </CardTitle>
                  <Badge
                    variant={
                      runStatus.status === "completed"
                        ? "default"
                        : runStatus.status === "failed"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {runStatus.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Step: {runStatus.current_step || "—"}</span>
                  <span>Progress: {runStatus.progress || 0}%</span>
                </div>
                <Progress value={runStatus.progress || 0} className="h-2" />
                {runStatus.logs && runStatus.logs.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <ChevronDown className="w-4 h-4 mr-2" />
                        View Logs ({runStatus.logs.length})
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="bg-muted rounded-lg p-3 max-h-48 overflow-y-auto text-xs font-mono space-y-1">
                        {runStatus.logs.map((log, i) => (
                          <div key={i} className="text-muted-foreground">
                            {log}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                {runStatus.error && (
                  <div className="text-sm text-destructive flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {runStatus.error}
                  </div>
                )}
                {runStatusError && (
                  <div className="text-sm text-destructive flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Failed to poll run status: {runStatusError.message}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Applications Generated */}
        {activeRunId && appsLoading && (
          <div className="max-w-4xl mx-auto mb-10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Loading Applications…
            </h2>
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-primary/10 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-1/4 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {applications.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Applications Generated ({applications.length})
            </h2>
            <div className="space-y-4">
              {applications.map((app) => (
                <Card key={app.application_id} className="card-hover">
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {app.job?.title || "Untitled Job"}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {app.job?.company || "Unknown Company"}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                          <span>ATS Before: {app.ats_score_before}</span>
                          <span>→</span>
                          <span className={app.ats_score_after >= 80 ? "text-success" : "text-warning"}>
                            After: {app.ats_score_after}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            downloadApplicationResume(app.application_id).then((blob) => {
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `resume-${app.application_id}.docx`;
                              a.click();
                              window.URL.revokeObjectURL(url);
                            }).catch((err: any) => toast.error(err.message));
                          }}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Resume
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            deleteApplication(app.application_id).then(() => {
                              toast.success("Deleted");
                              queryClient.invalidateQueries({ queryKey: ["applications", activeRunId] });
                            }).catch((err: any) => toast.error(err.message));
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Past Runs */}
        <div className="max-w-3xl mx-auto mt-12">
          <h2 className="text-xl font-semibold mb-4">Past Runs</h2>
          {runsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : runsError ? (
            <Card className="py-12 text-center border-destructive/30">
              <CardContent>
                <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Failed to load past runs</p>
                <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["autopilot-runs"] })}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : runs.length === 0 ? (
            <Card className="py-12 text-center">
              <CardContent>
                <RotateCcw className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No runs yet. Start your first Auto-Pilot above.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <Card key={run.run_id} className="card-hover">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {run.status === "completed" ? (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        ) : run.status === "failed" ? (
                          <XCircle className="w-5 h-5 text-destructive" />
                        ) : (
                          <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{run.run_id.slice(0, 8)}…</p>
                          <p className="text-xs text-muted-foreground">{run.current_step || run.status}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{run.progress || 0}%</p>
                        <p className="text-xs text-muted-foreground">{run.applications_created || 0} apps</p>
                      </div>
                    </div>
                    <Progress value={run.progress || 0} className="h-1 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AutoPilot;
