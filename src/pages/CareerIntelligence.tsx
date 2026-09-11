import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Compass,
  DollarSign,
  ExternalLink,
  GraduationCap,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";
import { apiFetch } from "@/api";
import {
  getSkillsGap,
  getSalaryBenchmark,
  getLearningPath,
  type SkillsGapResponse,
  type SalaryBenchmarkResponse,
  type LearningPathResponse,
} from "@/api/jobs";
import { ScenarioPlanner } from "@/components/career/ScenarioPlanner";

const PRESET_ROLES = [
  "Senior Full-Stack Engineer",
  "Frontend Architect",
  "AI / Machine Learning Engineer",
  "DevOps / Cloud Platform Lead",
  "Product Engineering Lead",
];

export function CareerIntelligence() {
  const routerLocation = useLocation();
  const [targetRole, setTargetRole] = useState("Senior Full-Stack Engineer");
  const [location, setLocation] = useState("San Francisco, CA (Remote)");
  const [activeTab, setActiveTab] = useState("all");

  // ponytail: JobSearch.tsx's "Boost" button on a missing-skill chip
  // navigates here with { state: { targetSkill } } and tells the user via
  // toast it's "pre-filling learning roadmap details" — but nothing ever
  // read this state, so that promise was false. This page has no per-skill
  // field (only a role/location form), so the closest honest destination is
  // the Learning Timeline tab, which is literally organized by skill.
  const targetSkillFromNav = routerLocation.state?.targetSkill as string | undefined;
  useEffect(() => {
    if (targetSkillFromNav) setActiveTab("learning");
  }, [targetSkillFromNav]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [skillsData, setSkillsData] = useState<SkillsGapResponse | null>(null);
  const [salaryData, setSalaryData] = useState<SalaryBenchmarkResponse | null>(null);
  const [learningData, setLearningData] = useState<LearningPathResponse | null>(null);

  const latestRequestId = useRef(0);

  const fetchData = useCallback(
    async (role: string, loc: string) => {
      const requestId = ++latestRequestId.current;
      setLoading(true);
      setError(null);

      const payload = {
        target_role: role,
        location: loc,
      };

      try {
        const [skillsRes, salaryRes, learningRes] = await Promise.allSettled([
          getSkillsGap(payload),
          getSalaryBenchmark(payload),
          getLearningPath(payload),
        ]);

        if (requestId !== latestRequestId.current) return;

        let hasSuccess = false;
        const errors: string[] = [];

        if (skillsRes.status === "fulfilled" && skillsRes.value) {
          setSkillsData(skillsRes.value);
          hasSuccess = true;
        } else if (skillsRes.status === "rejected") {
          errors.push("Skills gap analysis unavailable");
        }

        if (salaryRes.status === "fulfilled" && salaryRes.value) {
          setSalaryData(salaryRes.value);
          hasSuccess = true;
        } else if (salaryRes.status === "rejected") {
          errors.push("Salary benchmark data unavailable");
        }

        if (learningRes.status === "fulfilled" && learningRes.value) {
          setLearningData(learningRes.value);
          hasSuccess = true;
        } else if (learningRes.status === "rejected") {
          errors.push("Learning path recommendations unavailable");
        }

        if (!hasSuccess && errors.length > 0) {
          setError(
            "The Career Intelligence engine is currently offline or unreachable. Please verify your connection or try again shortly."
          );
        } else if (errors.length > 0) {
          setError(`Partial data loaded: ${errors.join(", ")}.`);
        }
      } catch (err: unknown) {
        if (requestId !== latestRequestId.current) return;
        setError(
          err instanceof Error ? err.message : "Failed to load career intelligence insights. Please try again."
        );
      } finally {
        if (requestId === latestRequestId.current) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData(targetRole, location);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRole.trim()) return;
    fetchData(targetRole, location);
  };

  // 1. Radar Chart Data Preparation
  const radarChartData = React.useMemo(() => {
    if (!skillsData) return [];

    const matched = new Set(skillsData.matched_skills || []);
    const adjacent = new Set(skillsData.adjacent_skills || []);
    const allSkills = Array.from(
      new Set([
        ...(skillsData.required_skills || []),
        ...(skillsData.matched_skills || []),
        ...(skillsData.missing_skills || []),
      ])
    ).slice(0, 7);

    if (allSkills.length === 0) {
      return [
        { skill: "System Design", current: 80, required: 90 },
        { skill: "Distributed Systems", current: 65, required: 85 },
        { skill: "TypeScript / Node", current: 95, required: 90 },
        { skill: "Cloud / Kubernetes", current: 50, required: 80 },
        { skill: "Data Pipelines", current: 40, required: 75 },
        { skill: "API Architecture", current: 85, required: 90 },
      ];
    }

    return allSkills.map((skill) => {
      let currentScore = 30;
      if (matched.has(skill)) currentScore = 95;
      else if (adjacent.has(skill)) currentScore = 65;

      return {
        skill,
        current: currentScore,
        required: 90,
      };
    });
  }, [skillsData]);

  // 2. Salary Bar Chart Data Preparation
  const salaryChartData = React.useMemo(() => {
    if (!salaryData) {
      return [
        { tier: "25th Percentile (Min)", amount: 135000, fill: "#38bdf8" },
        { tier: "50th Percentile (Median)", amount: 172000, fill: "#0ea5e9" },
        { tier: "90th Percentile (Max)", amount: 225000, fill: "#0284c7" },
      ];
    }

    return [
      {
        tier: "25th Percentile (Min)",
        amount: salaryData.salary_min || 120000,
        fill: "#38bdf8",
      },
      {
        tier: "50th Percentile (Median)",
        amount: salaryData.salary_median || 165000,
        fill: "#0ea5e9",
      },
      {
        tier: "90th Percentile (Max)",
        amount: salaryData.salary_max || 215000,
        fill: "#0284c7",
      },
    ];
  }, [salaryData]);

  const currencySymbol = salaryData?.currency === "EUR" ? "€" : salaryData?.currency === "GBP" ? "£" : "$";

  return (
    <AppShell>
      <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8 md:py-12">
        {/* Header Title Section */}
        <div className="flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
                <Compass className="mr-1.5 h-3.5 w-3.5" /> Market Telemetry & Roadmap
              </Badge>
              {salaryData?.confidence && (
                <Badge variant="secondary" className="capitalize text-xs">
                  {salaryData.confidence} Confidence
                </Badge>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Career Intelligence & Roadmap</h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
              Synthesize competency gaps, market compensation percentiles, and sequenced learning milestones tailored to your target engineering trajectory.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(targetRole, location)}
            disabled={loading}
            className="gap-2 shrink-0 self-start md:self-auto"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Analytics
          </Button>
        </div>

        {/* Search & Presets Bar */}
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4 sm:p-5 space-y-4">
            <form onSubmit={handleSearch} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Target Role
                </label>
                <Input
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Full-Stack Engineer"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Location / Market
                </label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. San Francisco, CA or Remote"
                  className="bg-background"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={loading} className="w-full md:w-auto px-6 font-medium">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Analyze Trajectory
                </Button>
              </div>
            </form>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-muted-foreground mr-1">Popular Roles:</span>
              {PRESET_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setTargetRole(role);
                    fetchData(role, location);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    targetRole === role
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Graceful Error Banner per lessons.md standard */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-3 animate-in fade-in-50"
          >
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold">Backend Telemetry Notice</p>
              <p className="text-xs leading-relaxed text-destructive/90">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(targetRole, location)}
              className="border-destructive/30 hover:bg-destructive/20 text-xs shrink-0"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Visualization Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 max-w-2xl h-10">
            <TabsTrigger value="all" className="text-xs">
              Overview
            </TabsTrigger>
            <TabsTrigger value="skills" className="text-xs">
              Skill Gap Radar
            </TabsTrigger>
            <TabsTrigger value="salary" className="text-xs">
              Salary Benchmark
            </TabsTrigger>
            <TabsTrigger value="learning" className="text-xs">
              Learning Timeline
            </TabsTrigger>
            {/* ponytail: merged in from the standalone /roadmap page
                (CareerRoadmap.tsx) — this was the one genuinely unique
                capability there (a "what if I pivot to scenario X" planner)
                that this page's skills/salary/learning trio didn't have.
                Everything else CareerRoadmap.tsx did duplicated this page. */}
            <TabsTrigger value="scenarios" className="text-xs">
              Scenario Planning
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: All / Overview */}
          <TabsContent value="all" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Visualization 1: Skill Gap Radar */}
              <Card className="border-border/70 shadow-sm flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5 text-teal-500" />
                      1. Competency Overlap & Radar
                    </CardTitle>
                    {skillsData?.match_score !== undefined && (
                      <Badge variant="outline" className="border-teal-500/30 text-teal-600 dark:text-teal-400 font-mono text-xs">
                        {skillsData.match_score}% Match Ratio
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    Visual mapping of your verified profile competencies against role benchmarks.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between pt-4">
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarChartData}>
                        <PolarGrid stroke="currentColor" className="text-muted/30" />
                        <PolarAngleAxis dataKey="skill" tick={{ fill: "currentColor", fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Radar
                          name="Current Competency"
                          dataKey="current"
                          stroke="#0ea5e9"
                          fill="#0ea5e9"
                          fillOpacity={0.4}
                        />
                        <Radar
                          name="Target Requirement"
                          dataKey="required"
                          stroke="#94a3b8"
                          strokeDasharray="3 3"
                          fill="transparent"
                        />
                        <RechartsTooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {skillsData && (
                    <div className="mt-4 space-y-3 pt-3 border-t border-border/40 text-xs">
                      <div>
                        <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                          Matched Competencies
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {(skillsData.matched_skills || []).slice(0, 5).map((s) => (
                            <Badge key={s} variant="secondary" className="gap-1 py-0.5 text-xs font-normal">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {s}
                            </Badge>
                          ))}
                          {(!skillsData.matched_skills || skillsData.matched_skills.length === 0) && (
                            <span className="text-muted-foreground italic text-xs">No direct matches identified.</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                          Recommended Priority Gaps
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {(skillsData.missing_skills || []).slice(0, 4).map((s) => (
                            <Badge key={s} variant="outline" className="gap-1 py-0.5 text-xs text-amber-500 border-amber-500/30">
                              <XCircle className="h-3 w-3 text-amber-500" /> {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Visualization 2: Salary Benchmark Bar Chart */}
              <Card className="border-border/70 shadow-sm flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-emerald-500" />
                      2. Compensation Benchmark Spectrum
                    </CardTitle>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {salaryData?.currency || "USD"}
                    </Badge>
                  </div>
                  <CardDescription>
                    Market salary bands for {salaryData?.role || targetRole} in {salaryData?.location || location}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between pt-4">
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salaryChartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/30" />
                        <XAxis dataKey="tier" tick={{ fontSize: 11 }} />
                        <YAxis
                          tickFormatter={(val) => `${currencySymbol}${val / 1000}k`}
                          tick={{ fontSize: 11 }}
                        />
                        <RechartsTooltip
                          formatter={(value: unknown) => [`${currencySymbol}${Number(value).toLocaleString()}`, "Estimated Total Base"]}
                        />
                        <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                          {salaryChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border/40 text-center">
                    <div className="p-2 rounded-lg bg-muted/40">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground">Min (25th)</p>
                      <p className="text-sm font-bold mt-0.5 text-foreground">
                        {currencySymbol}{(salaryData?.salary_min || 135000).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-[10px] uppercase font-semibold text-primary">Median (50th)</p>
                      <p className="text-sm font-bold mt-0.5 text-primary">
                        {currencySymbol}{(salaryData?.salary_median || 172000).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground">Max (90th)</p>
                      <p className="text-sm font-bold mt-0.5 text-foreground">
                        {currencySymbol}{(salaryData?.salary_max || 225000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Visualization 3: Learning Path Milestones */}
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-indigo-500" />
                    3. Sequenced Learning Path Timeline
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {(learningData?.recommendations || []).length} Curated Modules
                  </Badge>
                </div>
                <CardDescription>
                  Step-by-step milestones to close your target role's missing skills with certified learning materials.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {(learningData?.recommendations || []).length === 0 ? (
                  <div className="space-y-4">
                    {/* Default Recommended Milestone Path when recommendations are synthesizing */}
                    <div className="relative border-l-2 border-primary/30 ml-4 space-y-6 pl-6 pb-2">
                      {[
                        {
                          step: 1,
                          skill: "System Design & Distributed Scalability",
                          title: "Designing Data-Intensive Applications",
                          provider: "O'Reilly / High Scalability",
                          difficulty: "advanced",
                          cost: "free",
                          url: "https://dataintensive.net/",
                        },
                        {
                          step: 2,
                          skill: "Kubernetes & Cloud Native Deployment",
                          title: "Production Kubernetes & Service Mesh Patterns",
                          provider: "Cloud Native Computing Foundation",
                          difficulty: "intermediate",
                          cost: "free",
                          url: "https://kubernetes.io/docs/tutorials/",
                        },
                        {
                          step: 3,
                          skill: "Event-Driven & Microservices Architecture",
                          title: "Kafka & Redis Stream Pipelines",
                          provider: "Confluent Developer",
                          difficulty: "intermediate",
                          cost: "free",
                          url: "https://developer.confluent.io/",
                        },
                      ].map((m) => (
                        <div key={m.step} className="relative group">
                          <div className="absolute -left-[33px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow">
                            {m.step}
                          </div>
                          <div className="p-4 rounded-xl border border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{m.title}</span>
                                <Badge variant="secondary" className="text-[10px] capitalize">
                                  {m.difficulty}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 capitalize">
                                  {m.cost}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Addresses core requirement: <span className="font-medium text-foreground">{m.skill}</span> · Provider: {m.provider}
                              </p>
                            </div>
                            <a href={m.url} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="text-xs shrink-0 gap-1.5 active:scale-95">
                                Explore Syllabus <ExternalLink className="h-3 w-3" />
                              </Button>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-primary/30 ml-4 space-y-6 pl-6 pb-2">
                    {learningData?.recommendations.map((item, idx) => (
                      <div key={idx} className="relative group">
                        <div className="absolute -left-[33px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow">
                          {idx + 1}
                        </div>
                        <div className="p-4 rounded-xl border border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{item.title}</span>
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {item.difficulty}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] capitalize",
                                  item.cost_type === "free"
                                    ? "text-emerald-500 border-emerald-500/30"
                                    : "text-blue-500 border-blue-500/30"
                                )}
                              >
                                {item.cost_type}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Target Competency: <span className="font-medium text-foreground">{item.skill}</span> · Provider: {item.provider}
                            </p>
                          </div>
                          {item.url && (
                            <a href={item.url} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="text-xs shrink-0 gap-1.5 active:scale-95">
                                Access Module <ExternalLink className="h-3 w-3" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Standalone Skills View */}
          <TabsContent value="skills" className="space-y-6">
            <Card className="border-border/70 p-6">
              <h3 className="text-lg font-bold mb-2">Detailed Competency Matrix</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Detailed radar scan of technical and architectural requirements for {targetRole}.
              </p>
              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarChartData}>
                    <PolarGrid stroke="currentColor" className="text-muted/30" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: "currentColor", fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar
                      name="Your Competency"
                      dataKey="current"
                      stroke="#0ea5e9"
                      fill="#0ea5e9"
                      fillOpacity={0.4}
                    />
                    <Radar
                      name="Industry Benchmark"
                      dataKey="required"
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      fill="transparent"
                    />
                    <RechartsTooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>

          {/* Tab 3: Standalone Salary View */}
          <TabsContent value="salary" className="space-y-6">
            <Card className="border-border/70 p-6">
              <h3 className="text-lg font-bold mb-2">Market Compensation Analytics</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Comparative compensation percentiles in {location}.
              </p>
              <div className="h-[420px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salaryChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/30" />
                    <XAxis dataKey="tier" />
                    <YAxis tickFormatter={(val) => `${currencySymbol}${val / 1000}k`} />
                    <RechartsTooltip
                      formatter={(value: unknown) => [`${currencySymbol}${Number(value).toLocaleString()}`, "Base Salary"]}
                    />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={90}>
                      {salaryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>

          {/* Tab 4: Standalone Learning View */}
          <TabsContent value="learning" className="space-y-6">
            <Card className="border-border/70 p-6">
              <h3 className="text-lg font-bold mb-2">Milestone Learning Roadmap</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Curated courses and open-source documentation to bridge every identified skill gap.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {(learningData?.recommendations || []).map((item, idx) => {
                  const isTargeted = !!targetSkillFromNav && item.skill?.toLowerCase() === targetSkillFromNav.toLowerCase();
                  return (
                  <div key={idx} className={cn("p-4 rounded-xl border bg-muted/20 space-y-2", isTargeted ? "border-primary ring-1 ring-primary/40" : "border-border/60")}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{item.skill}</span>
                      <div className="flex items-center gap-1.5">
                        {isTargeted && <Badge className="text-[10px]">From Job Search</Badge>}
                        <Badge variant="outline" className="text-xs capitalize">{item.difficulty}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.title}</p>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] text-muted-foreground">Source: {item.provider}</span>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                          View Resource <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </div>
                  </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          {/* Tab 5: Scenario Planning (merged in from CareerRoadmap.tsx) */}
          <TabsContent value="scenarios" className="space-y-6">
            <ScenarioPlanner />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

export default CareerIntelligence;
