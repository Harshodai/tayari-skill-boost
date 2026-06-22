import { Layout } from "@/components/layout";
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
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { JobMatchScore } from "@/components/ui/job-match-score";
import type { ResumeAnalysisRecord } from "@/types/resume";
import { USE_SELF_HOSTED, listAnalysisHistory } from "@/api";
import { useAutomation } from "@/contexts/AutomationContext";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const PIPELINE_STAGES = [
  { key: "saved", label: "Saved", color: "text-muted-foreground" },
  { key: "applied", label: "Applied", color: "text-primary" },
  { key: "interview", label: "Interviewing", color: "text-accent" },
  { key: "offer", label: "Offer", color: "text-success" },
] as const;

const Dashboard = () => {
  const { user } = useAuth();
  const { startRun, open: openActivity, runs } = useAutomation();
  const userId = user?.id;

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";

  const { data: analyses = [] } = useQuery({
    queryKey: ["resume-analyses", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (USE_SELF_HOSTED) {
        const res = await listAnalysisHistory();
        return res.map((item: any) => ({
          id: String(item.id),
          user_id: item.user_id ?? "",
          resume_filename: `Resume #${item.resume_id}`,
          overall_score: item.score ?? 0,
          created_at: item.created_at,
          analysis_data: { overallScore: item.score ?? 0, sections: [], matchedKeywords: [], missingKeywords: [], summaryRecommendation: "" },
          job_title: undefined,
          company_name: undefined,
        })) as ResumeAnalysisRecord[];
      }
      const { data, error } = await supabase
        .from("resume_analyses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ResumeAnalysisRecord[];
    },
  });

  const { data: savedJobs = [] } = useQuery({
    queryKey: ["saved-jobs", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (USE_SELF_HOSTED) return [];
      const { data, error } = await supabase
        .from("saved_jobs")
        .select("*")
        .order("saved_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: roadmap = [] } = useQuery({
    queryKey: ["roadmap-progress", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (USE_SELF_HOSTED) return [];
      const { data, error } = await supabase
        .from("roadmap_progress")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: interviews = [] } = useQuery({
    queryKey: ["interview-sessions", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (USE_SELF_HOSTED) return [];
      const { data, error } = await supabase
        .from("interview_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const latestScore = analyses[0]?.overall_score ?? null;
  const completedRoadmap = roadmap.filter((r) => r.status === "completed").length;
  const roadmapPct = roadmap.length ? Math.round((completedRoadmap / roadmap.length) * 100) : 0;

  // Pipeline counts (saved_jobs has no status today — bucket everything under "saved" for now)
  const pipelineCounts: Record<string, number> = {
    saved: savedJobs.length,
    applied: 0,
    interview: interviews.length,
    offer: 0,
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
      title: "Apply with one click",
      desc: `Let AutoPilot run Optimizer → Cover Letter → Apply for your ${savedJobs.length} saved job${savedJobs.length === 1 ? "" : "s"}.`,
      cta: "Run AutoPilot",
      to: "/jobs/autopilot",
      icon: Zap,
    };
  })();

  const triggerApplyChain = () => {
    const job = savedJobs[0];
    startRun({
      title: "Apply workflow",
      context: job ? `${job.title} @ ${job.company}` : "Demo job",
      steps: [
        "Optimizing resume against JD",
        "Generating tailored cover letter",
        "Drafting recruiter outreach",
        "Queued for AutoPilot submission",
      ],
    });
  };

  const FocusIcon = focus.icon;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-7xl">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
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
                <Badge variant="secondary" className="ml-2">{runs.length}</Badge>
              )}
            </Button>
            <Button asChild size="sm" variant="glow">
              <Link to="/resume">
                <Sparkles className="w-4 h-4 mr-2" /> New analysis
              </Link>
            </Button>
          </div>
        </div>

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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Latest match</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center pb-6">
              {latestScore !== null ? (
                <JobMatchScore
                  score={latestScore}
                  size="md"
                  label={analyses[0]?.job_title || "Latest role"}
                />
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground mb-3">No analyses yet</p>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/resume">
                      <Upload className="w-4 h-4 mr-2" /> Analyze resume
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {PIPELINE_STAGES.map((stage) => (
                <div
                  key={stage.key}
                  className="rounded-lg border border-border/60 bg-muted/20 p-4 min-h-[140px]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn("text-xs font-semibold uppercase tracking-wider", stage.color)}>
                      {stage.label}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {pipelineCounts[stage.key] ?? 0}
                    </Badge>
                  </div>
                  {stage.key === "saved" && savedJobs.slice(0, 2).map((j) => (
                    <div key={j.id} className="text-xs bg-card border border-border/60 rounded p-2 mb-2 truncate">
                      <p className="font-medium truncate">{j.title}</p>
                      <p className="text-muted-foreground truncate">{j.company}</p>
                    </div>
                  ))}
                  {pipelineCounts[stage.key] === 0 && (
                    <p className="text-xs text-muted-foreground italic">Empty</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Roadmap + Interviews row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Roadmap progress</CardTitle>
                <CardDescription>
                  {completedRoadmap} of {roadmap.length || 0} steps completed
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
      </div>
    </Layout>
  );
};

export default Dashboard;
