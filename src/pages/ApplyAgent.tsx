import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, ShieldCheck, Eye, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AgentLiveView } from "@/components/agent/AgentLiveView";
import { listAgentRuns, startApplyAgent } from "@/lib/agent/applyAgent";

/** Glass-Box Apply Agent console: watch every step, submit yourself. */
export function ApplyAgent() {
  const queryClient = useQueryClient();
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: runs = [] } = useQuery({ queryKey: ["agent-runs"], queryFn: listAgentRuns });

  const isLinkedInUrl = (url: string): { isLinkedIn: boolean; normalizedUrl: string } => {
    const trimmed = url.trim();
    if (!trimmed) return { isLinkedIn: false, normalizedUrl: "" };
    try {
      const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
      const parsed = new URL(candidate);
      const host = parsed.hostname.toLowerCase();
      const isLinkedIn =
        host === "linkedin.com" ||
        host === "www.linkedin.com" ||
        host.endsWith(".linkedin.com");
      return { isLinkedIn, normalizedUrl: isLinkedIn ? parsed.toString() : "" };
    } catch {
      return { isLinkedIn: false, normalizedUrl: "" };
    }
  };
  const linkedinUrlInfo = isLinkedInUrl(jobUrl);

  // Only offer the live browser feed when there is a real posting URL to open.
  const browserInstruction = jobUrl.trim()
    ? [
        `Open ${jobUrl.trim()} and walk through the application form for the role`,
        `"${jobTitle.trim() || "this position"}"${company.trim() ? ` at ${company.trim()}` : ""}.`,
        `Read each field and report what it asks for. Do not submit the form.`,
        resumeText.trim() ? `Candidate background: ${resumeText.trim().slice(0, 800)}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    : undefined;

  const start = async () => {
    setError(null);
    if (!jobTitle.trim() || !jobDescription.trim() || !resumeText.trim()) {
      setError("Role, job description and resume text are all required.");
      return;
    }
    setRunning(true);
    try {
      const { runId } = await startApplyAgent({
        jobTitle: jobTitle.trim(),
        company: company.trim(),
        jobUrl: jobUrl.trim(),
        jobDescription: jobDescription.trim(),
        resumeText: resumeText.trim(),
      });
      setActiveRunId(runId);
      queryClient.invalidateQueries({ queryKey: ["agent-runs"] });
      toast.success("Packet ready for your review");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Run failed";
      setError(message);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="space-y-2 border-b pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Apply Agent</h1>
            <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600">
              <Eye className="mr-1 h-3.5 w-3.5" /> Glass box
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            The agent reads the posting, matches your resume, drafts the form answers and shows
            every step it took. You review and submit — it never clicks submit for you.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prepare an application</CardTitle>
              <CardDescription>Paste the posting and your resume. Nothing is sent anywhere else.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Senior Backend Engineer" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Stripe" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="url">Application URL</Label>
                <Input id="url" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="https://…" />
                {linkedinUrlInfo.isLinkedIn && (
                  <div className="mt-1.5 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium">
                          LinkedIn submissions are not automated. LinkedIn's User Agreement §8.2 prohibits bots and enforcement is account termination. We'll save the job and prep your resume, but you submit manually.
                        </p>
                        <a
                          href={linkedinUrlInfo.normalizedUrl}
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
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jd">Job description</Label>
                <Textarea id="jd" rows={6} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="resume">Your resume text</Label>
                <Textarea id="resume" rows={6} value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
              </div>

              {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <Button onClick={start} disabled={running} className="w-full">
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                {running ? "Working — watch the log" : "Prepare application"}
              </Button>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                Facts are only reused from your resume. Anything the resume doesn't cover is
                reported as a gap instead of invented.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {activeRunId ? (
              <AgentLiveView runId={activeRunId} browserInstruction={browserInstruction} />
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Start a run to watch the agent work, step by step.
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent runs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No runs yet.</p>
                ) : (
                  runs.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setActiveRunId(r.id)}
                      className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                    >
                      <span className="truncate">
                        {r.job_title || "Application"}
                        {r.company ? ` · ${r.company}` : ""}
                      </span>
                      <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                        {r.status.replace("_", " ")}
                      </Badge>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default ApplyAgent;
