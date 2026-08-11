import { useState } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  FileText,
  ExternalLink,
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
  listResumes,
  getResume,
  apiFetch,
  isBackendUnavailable,
} from "@/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BackendUnavailableBanner } from "@/components/BackendUnavailableBanner";
import { useBackendHealth } from "@/hooks/useBackendHealth";

const AutoPilot = () => {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [maxJobs, setMaxJobs] = useState(5);
  const [tailorPerJob, setTailorPerJob] = useState(true);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { unavailable: backendUnavailable } = useBackendHealth();
  // ponytail: autopilot endpoints (start/list/run) are all Go-gated. When the
  // probe says the gateway is down (or a list/starts call throws
  // BackendUnavailableError), we render the honest banner instead of the form.

  const isLinkedInUrl = (url: string | undefined): boolean => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      // ponytail: https-only (an http LinkedIn URL would be a downgrade/mitm
      // risk for an automated-flow page) and any *.linkedin.com subdomain.
      return (
        parsed.protocol === "https:" &&
        (host === "linkedin.com" || host.endsWith(".linkedin.com"))
      );
    } catch {
      return false;
    }
  };

  const { data: resumes = [] } = useQuery({
    queryKey: ["resumes"],
    queryFn: () => listResumes(),
  });

  const { data: firstResume } = useQuery({
    queryKey: ["resume", resumes[0]?.id],
    queryFn: () => getResume(resumes[0].id),
    enabled: resumes.length > 0,
  });
  const resumeText = firstResume?.original_text || "";

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
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 3000;
    },
  });

  const startMutation = useMutation({
    mutationFn: startAutopilot,
    onSuccess: (data) => {
      toast.success("AutoPilot started");
      setRunError(null);
      setActiveRunId(data.run_id);
      queryClient.invalidateQueries({ queryKey: ["autopilot-runs"] });
    },
    onError: (err: Error) => {
      setRunError(err.message);
      toast.error(err.message);
    },
  });

  // ponytail: computed here (after all three queries + startMutation) so both
  // the Start button's disabled prop and handleStart's guard share one source.
  const backendDown =
    backendUnavailable ||
    isBackendUnavailable(runsError) ||
    isBackendUnavailable(runStatusError) ||
    isBackendUnavailable(startMutation.error);

  const handleStart = () => {
    setRunError(null);
    if (backendDown) {
      setRunError("Backend unavailable — start a run once the engine is reachable.");
      return;
    }
    if (!resumeText) {
      setRunError("Upload a resume first — we need your base resume to tailor from.");
      toast.error("No resume found. Upload one from the Resume page first.");
      return;
    }
    startMutation.mutate({
      run_config: {
        query: query || undefined,
        location: location || undefined,
        max_jobs: maxJobs,
        auto_apply: false,
        tailor_per_job: tailorPerJob,
      },
      resume_text: resumeText,
      candidate_name: "Candidate",
    });
  };

  const handleApproveApp = async (appId: string) => {
    try {
      await apiFetch(`/v1/review-queue/${appId}/approve`, {
        method: "PUT",
        body: JSON.stringify({ notes: "Approved from AutoPilot" }),
      });
      toast.success("Application approved and moved to saved jobs!");
      queryClient.invalidateQueries({ queryKey: ["applications", activeRunId] });
      queryClient.invalidateQueries({ queryKey: ["autopilot-runs"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to approve application");
    }
  };

  const handleRejectApp = async (appId: string) => {
    try {
      await apiFetch(`/v1/review-queue/${appId}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason: "Rejected from AutoPilot" }),
      });
      toast.success("Application rejected");
      queryClient.invalidateQueries({ queryKey: ["applications", activeRunId] });
      queryClient.invalidateQueries({ queryKey: ["autopilot-runs"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to reject application");
    }
  };

  const isRunning = runStatus?.status === "running" || runStatus?.status === "queued";

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-12">
        {backendDown && (
          <div className="mb-6">
            <BackendUnavailableBanner feature="autopilot" />
          </div>
        )}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            AutoPilot Mode
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            AutoPilot Agent
          </h1>
          <p className="text-muted-foreground text-lg">
            Configure search criteria to let AI scan roles, optimize your resume, and draft tailored cover letters. **Submissions are gated inside the Review Queue for your safety.**
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
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="tailor-toggle" className="text-sm font-medium">
                      Tailor resume per job
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {tailorPerJob
                        ? "LLM-refines each resume against the job description (slower, higher quality)"
                        : "Sends the same base resume to all jobs (faster, lower response rates)"}
                    </p>
                  </div>
                </div>
                <Switch
                  id="tailor-toggle"
                  checked={tailorPerJob}
                  onCheckedChange={setTailorPerJob}
                />
              </div>
              {!resumeText && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Upload a resume to enable AutoPilot</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleStart}
                  disabled={startMutation.isPending || isRunning || backendDown}
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
              {applications.map((app) => {
                const isLinkedInApp = isLinkedInUrl(app.job?.url || app.apply_url);
                return (
                <Card key={app.application_id} className="card-hover">
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-foreground">
                            {app.job?.title || "Untitled Job"}
                          </h3>
                          <Badge variant={
                            app.status === "review" ? "warning" :
                            app.status === "gate_blocked" ? "destructive" :
                            app.status === "saved" ? "success" :
                            app.status === "rejected" ? "destructive" :
                            "secondary"
                          }>
                            {app.status === "review" ? "Pending Review" :
                             app.status === "gate_blocked" ? "Guardrails Blocked" :
                             app.status}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {app.job?.company || "Unknown Company"}
                        </p>
                        {/* ponytail: the https-validated LinkedIn URL gates the
                            warning block, so the link href is always https here. */}
                        {isLinkedInApp && (
                          <div className="mt-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                              <div className="flex items-start gap-1.5">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <div className="flex-1">
                                  <p className="font-medium">
                                    LinkedIn submissions are not automated. LinkedIn's User Agreement §8.2 prohibits bots and enforcement is account termination. We'll save the job and prep your resume, but you submit manually.
                                  </p>
                                  <a
                                    href={app.job?.url || app.apply_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1.5 inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:no-underline"
                                  >
                                  Open LinkedIn posting <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                          <span>ATS: {app.ats_score_before}</span>
                          <span>→</span>
                          <span className={app.ats_score_after >= 80 ? "text-success" : "text-warning"}>
                            {app.ats_score_after}
                          </span>
                        </div>
                        {(() => {
                          // K4 — render the per-job guardrail gate result so the
                          // user reviews why a package was blocked before approving.
                          const g = (app as any).quality_gate_result as
                            | {
                                all_passed: boolean;
                                results: Record<string, { passed: boolean; violations?: string[]; pii_found?: string[] }>;
                              }
                            | undefined;
                          if (!g) return null;
                          const failed = Object.entries(g.results || {}).filter(([, r]) => !r.passed);
                          return (
                            <div className={`mt-2 rounded-lg p-2 text-xs border ${g.all_passed ? "border-success/20 bg-success/5 text-success" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                              <div className="flex items-center gap-1 font-medium">
                                <AlertTriangle className="w-3 h-3" />
                                {g.all_passed
                                  ? "Guardrails passed"
                                  : `Guardrails blocked: ${failed.map(([k]) => k).join(", ")}`}
                              </div>
                              {!g.all_passed && (
                                <ul className="mt-1 space-y-0.5 opacity-90">
                                  {failed.map(([k, r]) => (
                                    <li key={k}>
                                      • {k}: {(r.violations || r.pii_found || []).slice(0, 2).join("; ") || "failed"}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })()}
                        {app.changes && app.changes.length > 0 && (
                          <Collapsible className="mt-2">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 text-xs">
                                <ChevronDown className="w-3 h-3 mr-1" />
                                {app.changes.length} changes, {app.keywords_added?.length || 0} keywords
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="bg-muted rounded-lg p-3 mt-1 text-xs space-y-1">
                                {app.changes.map((c: string, i: number) => (
                                  <div key={i} className="text-muted-foreground">• {c}</div>
                                ))}
                                {app.keywords_added && app.keywords_added.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border">
                                    {app.keywords_added.map((kw: string, i: number) => (
                                      <Badge key={i} variant="outline" className="text-[10px]">{kw}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {(app.status === "review" || app.status === "gate_blocked") && (
                          <>
                            <Button
                              size="sm"
                              className="bg-success text-success-foreground hover:bg-success/90"
                              onClick={() => handleApproveApp(app.application_id)}
                            >
                              {isLinkedInApp ? "Approve & Save" : "Approve & Submit"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 border-destructive/20"
                              onClick={() => handleRejectApp(app.application_id)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
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
                );
              })}
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
                <p className="text-muted-foreground">No runs yet. Start your first AutoPilot run above.</p>
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
    </AppShell>
  );
};

export default AutoPilot;
