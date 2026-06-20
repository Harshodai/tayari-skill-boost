import { Layout } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Upload,
  Briefcase,
  Calendar,
  ArrowRight,
  ExternalLink,
  MapPin,
  Map,
  CheckCircle2,
  Circle,
  Mic,
  Sparkles,
  History,
  MessageSquare,
  Mail,
  Brain,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnalysisHistoryList } from "@/components/resume/AnalysisHistoryList";
import { JobMatchScore } from "@/components/ui/job-match-score";
import type { ResumeAnalysisRecord } from "@/types/resume";
import { USE_SELF_HOSTED, listResumes, listAnalysisHistory } from "@/api";
import { listJDs } from "@/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data for saved resumes
const savedResumes = [
  {
    id: "1",
    name: "Software Engineer Resume",
    lastModified: "2024-01-08",
    score: 85,
    status: "optimized",
    version: 3,
  },
  {
    id: "2",
    name: "Full Stack Developer CV",
    lastModified: "2024-01-05",
    score: 72,
    status: "needs-improvement",
    version: 2,
  },
  {
    id: "3",
    name: "Frontend Developer Resume",
    lastModified: "2024-01-02",
    score: 91,
    status: "optimized",
    version: 1,
  },
];

// Mock data for application history
const applicationHistory = [
  {
    id: "1",
    company: "TechCorp Inc.",
    position: "Senior Software Engineer",
    appliedDate: "2024-01-08",
    status: "interview",
    resumeUsed: "Software Engineer Resume",
  },
  {
    id: "2",
    company: "StartupXYZ",
    position: "Full Stack Developer",
    appliedDate: "2024-01-06",
    status: "applied",
    resumeUsed: "Full Stack Developer CV",
  },
  {
    id: "3",
    company: "Global Tech",
    position: "Frontend Engineer",
    appliedDate: "2024-01-03",
    status: "rejected",
    resumeUsed: "Frontend Developer Resume",
  },
  {
    id: "4",
    company: "Innovation Labs",
    position: "React Developer",
    appliedDate: "2024-01-01",
    status: "offer",
    resumeUsed: "Software Engineer Resume",
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "optimized":
      return <Badge className="bg-success/20 text-success border-success/30">Optimized</Badge>;
    case "needs-improvement":
      return <Badge className="bg-warning/20 text-warning border-warning/30">Needs Work</Badge>;
    default:
      return <Badge variant="secondary">Draft</Badge>;
  }
};

const getApplicationStatusBadge = (status: string) => {
  switch (status) {
    case "interview":
      return <Badge className="bg-primary/20 text-primary border-primary/30">Interview</Badge>;
    case "applied":
      return <Badge className="bg-muted text-muted-foreground border-border">Applied</Badge>;
    case "rejected":
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Rejected</Badge>;
    case "offer":
      return <Badge className="bg-success/20 text-success border-success/30">Offer!</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
};
import { formatDistanceToNow } from "date-fns";

const Dashboard = () => {
  const { user } = useAuth();
  
  const userId = user?.id;

  const { data: analyses = [] } = useQuery({
    queryKey: ["resume-analyses", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (USE_SELF_HOSTED) {
        const res = await listAnalysisHistory();
        // Normalize Go format → UI format
        return res.map((item: any) => ({
          id: String(item.id),
          user_id: item.user_id ?? "",
          resume_filename: `Resume #${item.resume_id}`,
          overall_score: item.score ?? 0,
          created_at: item.created_at,
          analysis_data: {
            overallScore: item.score ?? 0,
            sections: [],
            matchedKeywords: [],
            missingKeywords: [],
            summaryRecommendation: "View the detailed analysis for this result.",
          },
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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Hero */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-muted-foreground mt-2">
              Your jobs, roadmap, and interviews all in one place.
            </p>
          </div>
          <Button asChild size="lg" variant="glow">
            <Link to="/resume">
              <Sparkles className="w-4 h-4 mr-2" />
              Analyze a new resume
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <Card className="card-hover">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analyses.length}</p>
                <p className="text-xs text-muted-foreground">Resume analyses</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{savedJobs.length}</p>
                <p className="text-xs text-muted-foreground">Saved jobs</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                <Map className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{roadmapPct}%</p>
                <p className="text-xs text-muted-foreground">Roadmap progress</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{interviews.length}</p>
                <p className="text-xs text-muted-foreground">Interview sessions</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {/* Latest match score */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Latest job match</CardTitle>
              <CardDescription>From your most recent analysis</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center pb-8">
              {latestScore !== null ? (
                <JobMatchScore
                  score={latestScore}
                  size="lg"
                  label={analyses[0]?.job_title || "Latest role"}
                />
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground text-sm mb-4">No analyses yet</p>
                  <Button asChild size="sm">
                    <Link to="/resume">
                      <Upload className="w-4 h-4 mr-2" /> Upload resume
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Roadmap progress */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Roadmap progress</CardTitle>
                  <CardDescription>
                    {completedRoadmap} of {roadmap.length || 0} steps completed
                  </CardDescription>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/roadmap">
                    Open roadmap <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={roadmapPct} className="h-2 mb-4" />
              {roadmap.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Start a roadmap to track your career progress here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {roadmap.slice(0, 5).map((step) => (
                    <li
                      key={step.id}
                      className="flex items-center justify-between p-3 rounded-md border border-border/60 bg-card/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {step.status === "completed" ? (
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{step.step_key}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {step.roadmap_slug}
                          </p>
                        </div>
                      </div>
                      <Badge variant={step.status === "completed" ? "default" : "secondary"}>
                        {step.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions — New Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <Card className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Cover Letter Generator</p>
                  <p className="text-xs text-muted-foreground">AI-tailored, resume-aware</p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link to="/cover-letter">Generate Cover Letter</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Communication Hub</p>
                  <p className="text-xs text-muted-foreground">Follow-ups, thank-yous, negotiation</p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link to="/communication">Open Communication Hub</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Interview Prep</p>
                  <p className="text-xs text-muted-foreground">STAR coaching + company-specific Qs</p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link to="/interview/prep">Start Interview Prep</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList>
            <TabsTrigger value="jobs">
              <Briefcase className="w-4 h-4 mr-2" /> Saved jobs
            </TabsTrigger>
            <TabsTrigger value="interviews">
              <Calendar className="w-4 h-4 mr-2" /> Interviews
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" /> Resume history
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Saved jobs</CardTitle>
                <CardDescription>Jobs you've bookmarked for later</CardDescription>
              </CardHeader>
              <CardContent>
                {savedJobs.length === 0 ? (
                  <div className="text-center py-10">
                    <Briefcase className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      You haven't saved any jobs yet.
                    </p>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {savedJobs.map((job) => (
                      <li
                        key={job.id}
                        className="p-4 rounded-lg border border-border bg-card/50 card-hover"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{job.title}</p>
                            <p className="text-sm text-muted-foreground truncate">{job.company}</p>
                            {job.location && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {job.location}
                              </p>
                            )}
                          </div>
                          {job.url && (
                            <Button asChild size="icon" variant="ghost" className="shrink-0">
                              <a href={job.url} target="_blank" rel="noreferrer noopener">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                        {job.notes && (
                          <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                            {job.notes}
                          </p>
                        )}
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-3">
                          Saved {formatDistanceToNow(new Date(job.saved_at), { addSuffix: true })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>          <TabsContent value="interviews">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Interview sessions</CardTitle>
                <CardDescription>Practice runs and upcoming sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {interviews.length === 0 ? (
                  <div className="text-center py-10">
                    <Mic className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No interview sessions yet.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {interviews.map((s) => (
                      <li
                        key={s.id}
                        className="p-4 rounded-lg border border-border bg-card/50 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.role}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })} ·{" "}
                            {s.difficulty}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {s.score !== null && s.score !== undefined && (
                            <JobMatchScore
                              score={s.score}
                              size="sm"
                              label=""
                              sublabel=""
                              showBar={false}
                              animated={false}
                            />
                          )}
                          <Badge variant="outline">{s.difficulty}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resume analysis history</CardTitle>
                <CardDescription>All your past resume analyses</CardDescription>
              </CardHeader>
              <CardContent>
                <AnalysisHistoryList analyses={analyses} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Dashboard;
