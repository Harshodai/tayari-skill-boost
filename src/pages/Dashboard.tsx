import { useState } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Upload,
  Briefcase,
  Calendar,
  ArrowRight,
  ExternalLink,
  MapPin,
  CheckCircle2,
  Circle,
  Mic,
  Sparkles,
  MessageSquare,
  Mail,
  Brain,
  Zap,
  Activity,
  Target,
  AlertCircle,
  RefreshCw,
  DollarSign,
  Radar,
  Globe,
  Send,
  BarChart3,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { JobMatchScore } from "@/components/ui/job-match-score";
import { StatsCard, StatsGrid } from "@/components/ui/stats-card";
import type { ResumeAnalysisRecord } from "@/types/resume";
import { USE_SELF_HOSTED, listAnalysisHistory, getFunnelData } from "@/api";
import { useAutomation } from "@/contexts/AutomationContext";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ApplicationPipeline } from "@/components/pipeline/ApplicationPipeline";
import { ChainStrip } from "@/components/pipeline/ChainStrip";
import { MemoryBadge } from "@/components/pipeline/MemoryBadge";
import { GamificationBadge } from "@/components/GamificationBadge";
import { AchievementsBadge } from "@/components/AchievementsBadge";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { BackendUnavailableBanner } from "@/components/BackendUnavailableBanner";
import { buildApplyChain } from "@/lib/automation/applyChain";
import { toast } from "sonner";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { TASK_RECIPES } from "@/lib/agent/taskRecipes";


const Dashboard = () => {
  const { user } = useAuth();
  const { startRun, runChain, open: openActivity, runs } = useAutomation();
  const userId = user?.id;
  const [activeTab, setActiveTab] = useState<"match" | "outcomes">("match");

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";

  const { analyses = [], savedJobs = [], roadmap = [], interviews = [], funnel = { saved: 0, applied: 0, interview: 0, offer: 0 }, isLoading, isError, refetch } = useDashboardData(userId);
  const { unavailable: backendUnavailable } = useBackendHealth();

  const totalApps = (funnel.applied ?? 0) + (funnel.interview ?? 0) + (funnel.offer ?? 0);
  const responseRate = totalApps > 0 ? Math.round(((funnel.interview + funnel.offer) / totalApps) * 100) : 0;
  const callbackRate = totalApps > 0 ? Math.round((funnel.interview / totalApps) * 100) : 0;

  const latestScore = analyses[0]?.overall_score ?? null;
  const completedRoadmap = roadmap.filter((r) => r.status === "completed").length;
  const roadmapPct = roadmap.length ? Math.round((completedRoadmap / roadmap.length) * 100) : 0;

  // Pipeline counts (use funnel data for status)
  const pipelineCounts: Record<string, number> = {
    saved: funnel.saved || savedJobs.length,
    applied: funnel.applied || 0,
    interview: funnel.interview || interviews.length,
    offer: funnel.offer || 0,
  };

  // Today's focus — pick the highest-leverage next action
  const focus = (() => {
    if (analyses.length === 0) {
      return {
        title: "Upload your resume",
        desc: "Get an AI match score against any job description in under a minute.",
        cta: "Start with Resume",
        to: "/resume",
        icon: Upload,
      };
    }
    if (savedJobs.length === 0) {
      return {
        title: "Find your next role",
        desc: "Use Smart Search to surface jobs ranked by your profile fit.",
        cta: "Open Smart Search",
        to: "/jobs",
        icon: Briefcase,
      };
    }
    return {
      title: "Review your next application",
      desc: `Open the review queue for your ${savedJobs.length} saved job${savedJobs.length === 1 ? "" : "s"}. Inspect the generated materials before any external action.`,
      cta: "Open Review Queue",
      to: "/review-queue",
      icon: CheckCircle2,
    };
  })();

  const triggerApplyChain = async () => {
    const saved = savedJobs[0];
    if (!saved) {
      toast.info("Save a job first — AutoPilot runs on a real job.");
      return;
    }
    const job = (saved as any).job || saved;
    const { ok } = await runChain({
      title: "AutoPilot",
      context: `${job.title ?? saved.title} @ ${job.company ?? saved.company}`,
      steps: buildApplyChain(job),
    });
    if (ok) toast.success("AutoPilot finished — see Activity");
    else toast.error("AutoPilot stopped — open Activity for the reason");
  };


  const FocusIcon = focus.icon;

  return (
    <AppShell>
      <WelcomeTour />
      <div className="container mx-auto px-4 py-10 max-w-7xl">
        {backendUnavailable && (
          <div className="mb-6">
            <BackendUnavailableBanner feature="dashboard" />
          </div>
        )}
        {/* ponytail: minimal loading skeleton + error retry — single guard for all dashboard queries */}
        {isLoading && (
          <div className="space-y-4 mb-8" aria-busy="true" aria-live="polite">
            <div className="h-24 bg-muted rounded-lg animate-pulse" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
            <div className="h-48 bg-muted rounded-lg animate-pulse" />
          </div>
        )}
        {isError && !isLoading && (
          <Card className="mb-8 border-destructive/50 bg-destructive/5">
            <CardContent className="py-6 flex flex-col items-center text-center gap-3">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm font-medium text-destructive">Couldn't load your dashboard data.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" /> Retry
              </Button>
            </CardContent>
          </Card>
        )}
        {!isLoading && !isError && (
        <>
        {/* Header */}
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Welcome back{firstName ? `, ${firstName}` : ""}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openActivity}>
              <Activity className="w-4 h-4 mr-2" /> Activity
              {runs.length > 0 && (
                <Badge variant="secondary" className="ml-2 tabular-nums">{runs.length}</Badge>
              )}
            </Button>
            <Button asChild size="sm" variant="glow">
              <Link to="/resume">
                <Sparkles className="w-4 h-4 mr-2" /> New analysis
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <GamificationBadge />
          <AchievementsBadge />
        </div>
        {/* K5 — observable 7-stage chain strip (server-aggregated, polls every 30s) */}
        <div className="mb-6 space-y-3">
          <ChainStrip />
          <MemoryBadge />
        </div>

        {/* ⚡ One-Shot Autopilot Console Hero Banner */}
        <Card className="mb-6 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-background backdrop-blur-md shadow-sm relative overflow-hidden group">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/15 transition-colors" />
          <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shadow-xs">
                <Zap className="w-3.5 h-3.5 fill-current animate-pulse" />
                Featured: One-Shot Jobseeker Engine
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                One-Shot Autopilot Console
              </h2>
              <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
                Execute Fit Audit → Typst Resume → Cover Letter → Stealth Auto-Apply → Recruiter Outreach → STAR Interview Kit in a single click.
              </p>
            </div>
            <Button asChild size="lg" variant="glow" className="font-bold whitespace-nowrap">
              <Link to="/one-shot">
                Launch One-Shot Console <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Ruthless Automation Center */}
        <Card className="mb-6 border-primary/25 bg-gradient-to-r from-primary/8 via-card to-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Ruthless Automation Center</CardTitle>
              <CardDescription>Choose a bounded lane. Tay prepares the work, records the evidence, and stops before an external write.</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline"><Link to="/tay">Open Desktop Assist</Link></Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {TASK_RECIPES.map((recipe) => {
                const Icon = recipe.id === "application_packet" ? FileText : recipe.id === "opportunity_sweep" ? Briefcase : recipe.id === "interview_sprint" ? Mic : Mail;
                return <Link key={recipe.id} to={`/tay?lane=${recipe.id}`} className="group rounded-xl border border-border/60 bg-background/45 p-3 transition-colors hover:border-primary/40 hover:bg-accent/30"><div className="flex items-center gap-2 text-xs font-semibold text-foreground group-hover:text-primary"><Icon className="w-4 h-4 text-primary" />{recipe.title}</div><p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{recipe.promise}</p></Link>;
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Banner */}
        <StatsGrid columns={4} className="mb-6 animate-fade-in-up">
          <StatsCard
            label="Resume Score"
            value={latestScore !== null ? `${latestScore}%` : "—"}
            icon={<FileText className="w-4 h-4" />}
            description={analyses.length > 1 ? `${Math.abs(analyses[0].overall_score - analyses[1].overall_score)} pts vs previous scan` : analyses.length === 1 ? "Latest recorded scan" : "No recorded scan"}
            sparklineData={analyses.length > 1 ? [...analyses.map(a => a.overall_score).reverse()] : undefined}
            colorScheme={latestScore !== null && latestScore >= 80 ? "success" : latestScore !== null && latestScore >= 60 ? "warning" : "default"}
          />
          <StatsCard
            label="Saved Jobs"
            value={savedJobs.length}
            icon={<Briefcase className="w-4 h-4" />}
            description={savedJobs.length > 0 ? "Saved in your workspace" : "No saved jobs yet"}
            colorScheme="primary"
          />
          <StatsCard
            label="Practice Sessions"
            value={interviews.length}
            icon={<Mic className="w-4 h-4" />}
            description={interviews.length > 0 ? "Recorded practice sessions" : "No sessions yet"}
            colorScheme="default"
          />
          <StatsCard
            label="AutoPilot Runs"
            value={runs.length}
            icon={<Zap className="w-4 h-4" />}
            description={runs.length > 0 ? "Recorded workspace runs" : "No recorded runs"}
            colorScheme={runs.length > 0 ? "success" : "default"}
          />
        </StatsGrid>

        {/* Today's focus + pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden relative">
            <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
            <CardContent className="p-6 relative">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold mb-3">
                <Target className="w-3.5 h-3.5" /> Today's focus
              </div>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold mb-2">{focus.title}</h2>
                  <p className="text-muted-foreground text-sm max-w-lg">{focus.desc}</p>
                </div>
                <div className="flex flex-col sm:items-end gap-2">
                  <Button asChild size="lg" variant="glow">
                    <Link to={focus.to}>
                      <FocusIcon className="w-4 h-4 mr-2" />
                      {focus.cta}
                    </Link>
                  </Button>
                  {savedJobs.length > 0 && (
                    <button
                      onClick={triggerApplyChain}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      or try the Apply chain →
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Job Intel
                </CardTitle>
                <div className="flex bg-muted p-0.5 rounded-lg border border-border/50">
                  <button
                    onClick={() => setActiveTab("match")}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md transition-all font-medium",
                      activeTab === "match" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Match Score
                  </button>
                  <button
                    onClick={() => setActiveTab("outcomes")}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md transition-all font-medium",
                      activeTab === "outcomes" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Funnel
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center pb-6 min-h-[220px]">
              {activeTab === "match" ? (
                latestScore !== null ? (
                  <div className="flex justify-center w-full">
                    <JobMatchScore
                      score={latestScore}
                      size="md"
                      label={analyses[0]?.job_title || "Latest role"}
                    />
                  </div>
                ) : (
                  <div className="text-center py-2 w-full">
                    <p className="text-sm text-muted-foreground mb-3">No analyses yet</p>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/resume">
                        <Upload className="w-4 h-4 mr-2" /> Analyze resume
                      </Link>
                    </Button>
                  </div>
                )
              ) : (
                <div className="space-y-4 w-full">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50">
                      <div className="text-xs text-muted-foreground font-medium mb-0.5">Response Rate</div>
                      <div className="text-xl font-bold font-mono tabular-nums text-primary">
                        {totalApps > 0 ? `${responseRate}%` : "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {totalApps > 0 ? `${funnel.interview + funnel.offer} of ${totalApps} roles` : "No applications"}
                      </div>
                    </div>
                    <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50">
                      <div className="text-xs text-muted-foreground font-medium mb-0.5">Callback Rate</div>
                      <div className="text-xl font-bold font-mono tabular-nums text-success">
                        {totalApps > 0 ? `${callbackRate}%` : "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {totalApps > 0 ? `${funnel.interview} interviews` : "Practice mock first"}
                      </div>
                    </div>
                  </div>

                  {/* Visual Funnel Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                      <span>Funnel Stages</span>
                      <span className="tabular-nums">{totalApps} Total Applications</span>
                    </div>
                    <div className="flex h-3.5 w-full rounded-full overflow-hidden bg-muted/65 border border-border/50">
                      <div
                        className="bg-primary/85 transition-all"
                        style={{ width: `${totalApps > 0 ? Math.max(12, (funnel.applied / totalApps) * 100) : 25}%` }}
                        title={`Applied: ${funnel.applied}`}
                      />
                      <div
                        className="bg-warning/85 transition-all border-l border-background"
                        style={{ width: `${totalApps > 0 ? Math.max(12, (funnel.interview / totalApps) * 100) : 25}%` }}
                        title={`Interviews: ${funnel.interview}`}
                      />
                      <div
                        className="bg-success/85 transition-all border-l border-background"
                        style={{ width: `${totalApps > 0 ? Math.max(12, (funnel.offer / totalApps) * 100) : 25}%` }}
                        title={`Offers: ${funnel.offer}`}
                      />
                      <div
                        className="bg-muted-foreground/30 transition-all border-l border-background"
                        style={{ width: `${totalApps > 0 ? Math.max(0, (funnel.saved / totalApps) * 100) : 25}%` }}
                        title={`Saved: ${funnel.saved}`}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span>Applied (<span className="tabular-nums">{funnel.applied}</span>)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                        <span>Interview (<span className="tabular-nums">{funnel.interview}</span>)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                        <span>Offers (<span className="tabular-nums">{funnel.offer}</span>)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* One-Stop Jobseeker AI Command Center */}
        <Card className="mb-6 border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2 text-foreground font-semibold">
                <Sparkles className="w-4 h-4 text-primary" />
                Jobseeker AI Command Center
              </CardTitle>
              <CardDescription>
                Unified career acceleration suite: Search, Tailor, Practice, Apply & Negotiate
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs">
              Workspace tools
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { title: "Company Radar", desc: "Review company signals", icon: Radar, to: "/radar" },
                { title: "Voice Coach", desc: "WPM, filler & STAR feedback", icon: Mic, to: "/interview/voice-coach" },
                { title: "Salary Negotiation", desc: "H1B benchmarks & scripts", icon: DollarSign, to: "/negotiation" },
                { title: "Skill Gap Radar", desc: "Free resource mapping", icon: Target, to: "/skill-gap-radar" },
                { title: "Portfolio Builder", desc: "Interactive HTML export", icon: Globe, to: "/portfolio" },
                { title: "Recruiter Outreach", desc: "Cold email & LinkedIn notes", icon: Send, to: "/outreach" },
                { title: "Funnel Analytics", desc: "Conversion diagnostics", icon: BarChart3, to: "/analytics-funnel" },
                { title: "Cover Letter AI", desc: "3-paragraph custom letters", icon: FileText, to: "/cover-letter" },
              ].map(({ title, desc, icon: Icon, to }) => (
                <Link
                  key={to}
                  to={to}
                  className="p-3 rounded-lg bg-muted/30 hover:bg-accent/40 border border-border/50 hover:border-primary/40 transition-all block group"
                >
                  <div className="flex items-center gap-2 mb-1 text-foreground group-hover:text-primary font-semibold text-xs transition-colors">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span>{title}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground line-clamp-1">{desc}</div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pipeline */}
        <Card className="mb-6">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Application pipeline</CardTitle>
              <CardDescription>Drag jobs across stages as they progress</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/jobs">View all <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {savedJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Save jobs from Smart Search to populate your pipeline.
              </p>
            ) : (
              <ApplicationPipeline
                variant="compact"
                jobs={savedJobs.map((j) => ({
                  id: String(j.id),
                  title: j.title,
                  company: j.company,
                  location: j.location ?? null,
                  url: j.url ?? null,
                  stage: "saved" as const,
                  savedAt: j.saved_at,
                }))}
              />
            )}
          </CardContent>
        </Card>

        {/* Roadmap + Interviews row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Roadmap progress</CardTitle>
                <CardDescription>
                  <span className="tabular-nums">{completedRoadmap}</span> of <span className="tabular-nums">{roadmap.length || 0}</span> steps completed
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link to="/roadmap">Open <ArrowRight className="w-4 h-4 ml-1" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Progress value={roadmapPct} className="h-2 mb-4" />
              {roadmap.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">
                  Start a roadmap to grow into your target role.
                </p>
              ) : (
                <ul className="space-y-2">
                  {roadmap.slice(0, 3).map((step) => (
                    <li key={step.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
                      {step.status === "completed" ? (
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm truncate flex-1">{step.step_key}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Upcoming interviews</CardTitle>
                <CardDescription>Practice and live sessions</CardDescription>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link to="/interview/prep">Prep <ArrowRight className="w-4 h-4 ml-1" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {interviews.length === 0 ? (
                <div className="text-center py-4">
                  <Mic className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">No sessions yet</p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/interview/prep">Start practice</Link>
                  </Button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {interviews.slice(0, 3).map((s) => (
                    <li key={s.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.role}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">{s.difficulty}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cross-product shortcuts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: MessageSquare, title: "Cover Letter", desc: "Resume-aware, JD-tailored", to: "/cover-letter", tint: "primary" },
            { icon: Mail, title: "Communication Hub", desc: "Follow-ups & negotiation", to: "/communication", tint: "accent" },
            { icon: Brain, title: "Interview AI", desc: "STAR coaching & mock Qs", to: "/interview/prep", tint: "secondary" },
          ].map(({ icon: Icon, title, desc, to, tint }) => (
            <Link key={to} to={to} className="group">
              <Card className="card-hover h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    tint === "primary" && "bg-primary/10 text-primary",
                    tint === "accent" && "bg-accent/10 text-accent",
                    tint === "secondary" && "bg-secondary/20 text-foreground",
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground truncate">{desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        </>
        )}
      </div>
    </AppShell>
  );
};

export default Dashboard;
