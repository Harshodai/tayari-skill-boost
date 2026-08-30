import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  Search,
  MapPin,
  Briefcase,
  Building2,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Loader2,
  Sparkles,
  AlertCircle,
  RotateCcw,
  MessageSquare,
  Zap,
  Wand2,
  Bell,
  Star,
  Globe,
  Target,
  ArrowUpRight,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { searchJobs, agentSearch, saveJob, listSavedJobs, getProfile, listResumes, isBackendUnavailable } from "@/api";
import type { JobSearchResponse, JobSearchResult, RoleIntelligence, PreparationMaterial } from "@/api/jobs";
import { BackendUnavailableBanner } from "@/components/BackendUnavailableBanner";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { useAutomation } from "@/contexts/AutomationContext";
import { SkillGapWidget } from "@/components/jobs/SkillGapWidget";
import { CalibratedFitCard, getFitBand } from "@/components/jobs/CalibratedFitCard";
import { JobFeedbackButtons } from "@/components/jobs/JobFeedbackButtons";
import { SavedSearches } from "@/components/jobs/SavedSearches";
import { buildApplyChain } from "@/lib/automation/applyChain";
import { cn } from "@/lib/utils";


const ATS_LOGOS: Record<string, string> = {
  greenhouse: "🌱", lever: "⚙️", ashby: "📋", workday: "📅",
  bamboohr: "🎋", taleo: "🔮", icims: "🔗", smartrecruiters: "🎯",
  successfactors: "📊", oracle: "🟢", brassring: "⭕", jobvite: "📨",
  kenexa: "🔷", ukg: "🟣", paylocity: "💳", ceipal: "👥", fountain: "⛲",
};

const ATS_NAMES: Record<string, string> = {
  greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby",
  workday: "Workday", bamboohr: "BambooHR", taleo: "Taleo",
  icims: "iCIMS", smartrecruiters: "SmartRecruiters",
  successfactors: "SuccessFactors", oracle: "Oracle Cloud",
  brassring: "BrassRing", jobvite: "Jobvite", kenexa: "Kenexa",
  ukg: "UKG", paylocity: "Paylocity", ceipal: "CEIPAL",
  fountain: "Fountain",
};

type Job = JobSearchResult & {
  role_intelligence?: RoleIntelligence;
  preparation_material?: PreparationMaterial;
  dedupe_key?: string;
  ats_provider?: string;
};

const scoreColor = (s: number) =>
  s >= 80 ? "text-success" : s >= 60 ? "text-warning" : "text-destructive";

const scoreRing = (s: number) =>
  s >= 80 ? "ring-success/40" : s >= 60 ? "ring-warning/40" : "ring-destructive/40";

const JobSearch = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startRun, runChain } = useAutomation();
  const { unavailable: backendUnavailable, refetch: refetchHealth } = useBackendHealth();

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [results, setResults] = useState<Job[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  // K3 hero callout: top missing skills for the selected job, surfaced above
  // the 3-pane grid so users see the conversion lever without opening detail.
  const [heroGap, setHeroGap] = useState<{ gaps: { skill: string }[]; overlap_score: number } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAgentSearching, setIsAgentSearching] = useState(false);
  const [hideGhostJobs, setHideGhostJobs] = useState(false);
  const [visibleAgentEvents, setVisibleAgentEvents] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [roleIntelligence, setRoleIntelligence] = useState<RoleIntelligence | null>(null);
  const [memoryInfo, setMemoryInfo] = useState<{ used: boolean; tiers: string[]; truncated: boolean }>({
    used: false,
    tiers: [],
    truncated: false,
  });
  // Mobile master-detail: below lg the list and detail share the viewport.
  const [mobileDetail, setMobileDetail] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: savedJobs = [] } = useQuery({
    queryKey: ["saved-jobs"],
    queryFn: () => listSavedJobs(),
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
    retry: false,
  });

  const { data: resumes } = useQuery({
    queryKey: ["resumes"],
    queryFn: () => listResumes(),
    retry: false,
  });

  const savedDedupeKeys = new Set(savedJobs.map((j) => j.dedupe_key));

  const saveMutation = useMutation({
    mutationFn: saveJob,
    onSuccess: () => {
      toast.success("Saved to your list");
      queryClient.invalidateQueries({ queryKey: ["saved-jobs"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (backendUnavailable) {
      setSearchError("Search is unavailable while the backend is down.");
      return;
    }
    setIsSearching(true);
    setIsAgentSearching(false);
    setVisibleAgentEvents([]);
    setSearchError(null);
    try {
      const profilePayload = profile
        ? {
            desired_roles: profile.desired_roles || [],
            skills: profile.skills || [],
            locations: profile.locations || [],
            experience_years: profile.experience_years || 0,
            open_to_remote: profile.open_to_remote || remoteOnly,
          }
        : { open_to_remote: remoteOnly };
      const resumeText =
        resumes && resumes.length > 0
          ? ((resumes[0] as any).optimized_text || resumes[0].original_text || "")
          : "";
      const res = await searchJobs({
        query,
        location,
        profile: profilePayload,
        resume_text: resumeText,
        top_n: 20,
      });
      const jobs: Job[] = res?.report?.jobs || res?.jobs || [];
      setRoleIntelligence(res?.role_intelligence || null);
      setMemoryInfo({
        used: res?.memory_used === true,
        tiers: res?.memory_tiers_used || [],
        truncated: res?.memory_truncated === true,
      });
      setResults(jobs);
      setSelectedIdx(0);
      if (jobs.length === 0) toast.info("No jobs matched. Try broader keywords.");
    } catch (err: any) {
      // ponytail: re-probe the gateway before reporting the failure — the
      // banner and disabled states key off `backendUnavailable`, which only
      // refreshes on the poll interval otherwise.
      await refetchHealth().catch(() => null);
      const msg = isBackendUnavailable(err)
        ? "Search is unavailable while the backend is down."
        : err.message || "Search failed";
      setSearchError(msg);
      toast.error(msg);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAgentSearch = async () => {
    if (!query.trim()) return;
    if (backendUnavailable) {
      setSearchError("Search is unavailable while the backend is down.");
      return;
    }
    setIsSearching(true);
    setIsAgentSearching(true);
    setSearchError(null);
    setVisibleAgentEvents([]);
    setResults([]);

    try {
      const profilePayload = profile
        ? {
            desired_roles: profile.desired_roles || [],
            skills: profile.skills || [],
            locations: profile.locations || [],
            experience_years: profile.experience_years || 0,
            open_to_remote: profile.open_to_remote || remoteOnly,
          }
        : { open_to_remote: remoteOnly };
      const resumeText =
        resumes && resumes.length > 0
          ? ((resumes[0] as any).optimized_text || resumes[0].original_text || "")
          : "";

      const res = await agentSearch({
        query,
        location,
        profile: profilePayload,
        resume_text: resumeText,
        top_n: 20,
      });

      const events = (res?.events as unknown[]) || [];
      const agentResult = res?.result as JobSearchResponse | undefined;
      const finalJobs: Job[] = agentResult?.report?.jobs || agentResult?.jobs || res?.report?.jobs || res?.jobs || [];
      setRoleIntelligence(agentResult?.role_intelligence || res?.role_intelligence || null);
      setMemoryInfo({
        used: agentResult?.memory_used === true,
        tiers: agentResult?.memory_tiers_used || [],
        truncated: agentResult?.memory_truncated === true,
      });

      // Stream events one by one for visual effect
      for (let i = 0; i < events.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        setVisibleAgentEvents((prev) => [...prev, events[i]]);
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
      setResults(finalJobs);
      setSelectedIdx(0);
      if (finalJobs.length === 0) toast.info("No jobs matched. Try broader keywords.");
    } catch (err: any) {
      // ponytail: re-probe the gateway before reporting the failure — same
      // rationale as handleSearch; the agent-search path must not leave the
      // backend state stale either.
      await refetchHealth().catch(() => null);
      const msg = isBackendUnavailable(err)
        ? "Agent search is unavailable while the backend is down."
        : err.message || "Agent search failed";
      setSearchError(msg);
      toast.error(msg);
    } finally {
      setIsSearching(false);
      setIsAgentSearching(false);
    }
  };

  const filtered = useMemo(
    () =>
      results.filter((j: any) => {
        const s = j.score ?? j.fit_score ?? j.match_score ?? 0;
        if (s < minScore) return false;
        if (remoteOnly && j.location && !/remote/i.test(j.location)) return false;
        if (hideGhostJobs) {
          const badge = j.posting_health?.badge || j.health_badge || (j.posted_at && (Date.now() - new Date(j.posted_at).getTime() > 45 * 86400000) ? "Likely ghost" : "Fresh");
          if (badge === "Likely ghost") return false;
        }
        return true;
      }),
    [results, minScore, remoteOnly, hideGhostJobs]
  );

  const selected = filtered[selectedIdx] || filtered[0];

  // Clear the hero callout when the selected job changes — the SkillGapWidget
  // remounts (key=dedupe_key) and re-emits via onResult once its fetch lands.
  useEffect(() => {
    setHeroGap(null);
  }, [selected?.dedupe_key, selected?.title]);

  const handleSave = (job: Job) => {
    const dedupeKey = job.dedupe_key || `${job.company}-${job.title}-${job.location}`;
    saveMutation.mutate({ dedupe_key: dedupeKey, job, status: "saved" } as any);
  };

  const handleApplyChain = async (job: Job) => {
    const { ok } = await runChain({
      title: `AutoPilot — ${job.title}`,
      context: `${job.company}${job.location ? " · " + job.location : ""}`,
      steps: buildApplyChain(job as any),
    });
    if (ok) toast.success("AutoPilot finished — see Activity");
    else toast.error("AutoPilot stopped — open Activity for the reason");
  };

  const handleQueueForReview = (job: Job) => {
    const dedupeKey = job.dedupe_key || `${job.company}-${job.title}-${job.location}`;
    saveMutation.mutate(
      { dedupe_key: dedupeKey, job: { ...job, auto_apply: false }, status: "saved" } as any,
      {
        onSuccess: () => {
          toast.success("Queued for review in your Application Pipeline (human submission required)");
        },
      }
    );
  };


  return (
    <AppShell title="Smart Job Search" subtitle="Search • Match • Apply — in one flow">
      {/* Backend unavailable — search, saved jobs, and profile all need Go+Python */}
      {backendUnavailable && (
        <div className="mb-6">
          <BackendUnavailableBanner feature="job search" />
        </div>
      )}
      {/* Top NL search bar */}
      <div className="mb-5">
        <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-3 md:p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-2">
            <div className="flex-1 relative">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
              <Input
                placeholder='Try "Remote senior PM in fintech, $180k+, posted this week"'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 h-11 bg-background/60 border-border/70 text-sm"
                onKeyDown={(e) => e.key === "Enter" && !backendUnavailable && handleSearch()}
              />
            </div>
            <div className="relative w-full lg:w-60">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="pl-10 h-11 bg-background/60 border-border/70 text-sm"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching || backendUnavailable} variant="outline" className="h-11 min-w-[100px] border-border/60">
              {isSearching && !isAgentSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" /> Search
                </>
              )}
            </Button>
            <Button 
              onClick={handleAgentSearch} 
              disabled={isSearching || backendUnavailable}
              className="h-11 min-w-[140px] bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 text-primary-foreground shadow-sm"
            >
              {isSearching && isAgentSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2 text-primary-foreground animate-pulse" /> Agent Search
                </>
              )}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                <Sparkles className="w-3 h-3" /> Live job feeds
              </span>
              <span>Aggregating Greenhouse · Lever · Ashby · Workday · Remotive</span>
            </div>
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground/80 hover:text-foreground">
              <input
                type="checkbox"
                checked={hideGhostJobs}
                onChange={(e) => {
                  setHideGhostJobs(e.target.checked);
                  setSelectedIdx(0);
                }}
                className="rounded border-border text-primary focus:ring-primary/20 h-3.5 w-3.5"
              />
              <span>Hide likely-ghost jobs</span>
            </label>
          </div>
        </div>
      </div>

      {visibleAgentEvents.length > 0 && (
        <Card className="mb-6 border-primary/20 bg-primary/5 backdrop-blur p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <h4 className="text-sm font-bold text-primary font-sans">Search log</h4>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto font-sans text-xs">
            {visibleAgentEvents.map((evt, idx) => (
              <div key={idx} className="flex items-center gap-2 text-foreground/90 animate-fade-in">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>{evt.message}</span>
              </div>
            ))}
            {isAgentSearching && (
              <div className="flex items-center gap-2 text-muted-foreground italic animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>Agent is thinking...</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {(roleIntelligence || memoryInfo.used) && (
        <Card className="mb-4 border-primary/20 bg-primary/[0.03] p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Search intelligence</span>
            {roleIntelligence?.confidence && (
              <Badge variant="outline" className="text-[10px]">Role confidence: {roleIntelligence.confidence}</Badge>
            )}
            {roleIntelligence?.family && (
              <Badge variant="secondary" className="text-[10px]">Family: {roleIntelligence.family}</Badge>
            )}
            {memoryInfo.used && (
              <Badge variant="outline" className="text-[10px]">
                Memory used{memoryInfo.truncated ? " · budgeted" : ""}
              </Badge>
            )}
          </div>
          {roleIntelligence?.clarification_question && (
            <p className="mt-2 text-xs text-foreground/80">{roleIntelligence.clarification_question}</p>
          )}
          {memoryInfo.used && memoryInfo.tiers.length > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Personalization layers: {memoryInfo.tiers.join(" · ")}. Private memory is used only to improve ranking context.
            </p>
          )}
        </Card>
      )}

      {searchError && (
        <Card className="mb-4 border-destructive/40 bg-destructive/5 p-3 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm flex-1">{searchError}</span>
          <Button size="sm" variant="outline" onClick={handleSearch}>
            <RotateCcw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </Card>
      )}

      {/* K3 hero callout — top missing skills for the selected job, surfaced
          above the 3-pane grid so the conversion lever is visible without
          opening the detail pane (audit action #7). */}
      {selected && heroGap && heroGap.gaps.length > 0 && (
        <Card className="mb-4 border-primary/30 bg-primary/5 p-3 md:p-4 animate-fade-in-up">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Skills you're missing for {selected.title}
              </span>
            </div>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {heroGap.gaps.slice(0, 3).map((g) => (
                <Badge key={g.skill} variant="secondary" className="bg-background/70 text-foreground border-border/60 font-mono text-xs">
                  {g.skill}
                </Badge>
              ))}
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 text-xs gap-1">
              <Link to="/roadmap">
                Close these gaps
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </Card>
      )}

      {/* Mobile-only filter toggle — the sidebar is a drawer under lg */}
      <div className="lg:hidden mb-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between"
          onClick={() => setFiltersOpen((o) => !o)}
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Filters &amp; saved searches
          </span>
          <ChevronDown className={cn("w-4 h-4 transition-transform", filtersOpen && "rotate-180")} />
        </Button>
      </div>

      {/* 3-pane workspace (stacks to a master-detail flow under lg) */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1.1fr)] gap-4 lg:min-h-[70vh]">
        {/* Filters & saved searches */}
        <aside className={cn("space-y-4 lg:block", filtersOpen ? "block" : "hidden")}>
          <Card className="p-4 space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Filters
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Min match</span>
                    <span className="font-medium">{minScore}%</span>
                  </div>
                  <Slider
                    value={[minScore]}
                    onValueChange={(v) => setMinScore(v[0])}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground" /> Remote only
                  </div>
                  <Switch checked={remoteOnly} onCheckedChange={setRemoteOnly} />
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <Bell className="mt-0.5 w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Daily alerts</div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">Save this search first, then use the bell beside it to enable or disable durable alerts.</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <SavedSearches
              current={{ query, location, remoteOnly, minScore }}
              onApply={(s) => {
                setQuery(s.query);
                setLocation(s.location || "");
                setRemoteOnly(s.remote_only);
                setMinScore(s.min_score);
                toast.info(`Loaded "${s.name}"`);
              }}
            />
          </Card>

          <Card className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Saved jobs
            </h3>
            {savedJobs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Bookmark roles to compare and queue them later.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {savedJobs.slice(0, 6).map((j: any) => (
                  <li key={j.dedupe_key} className="truncate">
                    <span className="font-medium">{j.job?.title}</span>
                    <span className="text-muted-foreground"> · {j.job?.company}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>


        {/* Results list */}
        <section className={cn("lg:block", mobileDetail && "hidden")}>
          <Card className="h-full p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {isSearching
                  ? "Searching…"
                  : filtered.length > 0
                  ? `${filtered.length} matches`
                  : "Results"}
              </h3>
              {filtered.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  Ranked by AI match
                </Badge>
              )}
            </div>
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="p-2 space-y-2">
                {isSearching &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/50">
                      <Skeleton className="h-4 w-2/3 mb-2" />
                      <Skeleton className="h-3 w-1/2 mb-1" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  ))}

                {!isSearching && filtered.length === 0 && (
                  <div className="px-4 py-16 text-center">
                    <Briefcase className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                    <p className="text-sm font-medium">
                      {results.length === 0 ? "Start your search" : "No matches at this filter"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {results.length === 0
                        ? "Try keywords, a role, or paste a natural-language query."
                        : "Lower the min match or turn off Remote only."}
                    </p>
                  </div>
                )}

                {!isSearching &&
                  filtered.map((job, i) => {
                    const score = job.match_score ?? job.score ?? job.fit_score ?? null;
                    const band = getFitBand(score);
                    const active = i === selectedIdx;
                    const dedupeKey =
                      job.dedupe_key || `${job.company}-${job.title}-${job.location}`;
                    const isSaved = savedDedupeKeys.has(dedupeKey);
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedIdx(i);
                          setMobileDetail(true);
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-all",
                          active
                            ? "border-primary/60 bg-primary/[0.06] shadow-sm"
                            : "border-border/50 hover:border-border bg-card/50 hover:bg-card"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-semibold truncate">{job.title}</h4>
                              <span
                                className={cn(
                                  "text-[11px] font-semibold tabular-nums shrink-0 px-2 py-0.5 rounded border",
                                  band.className
                                )}
                              >
                                {score !== null ? `${score}%` : "Unranked"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {job.company}
                              {job.location ? ` · ${job.location}` : ""}
                            </p>
                            {job.match_reasons && job.match_reasons.length > 0 && (
                              <p className="mt-1.5 text-[11px] text-foreground/70 line-clamp-1">
                                <Sparkles className="w-3 h-3 inline mr-1 text-primary" />
                                {job.match_reasons[0]}
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              {job.source && (
                                <Badge variant="outline" className="text-[10px] py-0">
                                  {job.source}
                                </Badge>
                              )}
                              {job.ats_provider && (
                                <Badge variant="secondary" className="text-[10px] py-0 border-primary/20 gap-1">
                                  <span>{ATS_LOGOS[job.ats_provider] || "🖥️"}</span>
                                  {ATS_NAMES[job.ats_provider] || job.ats_provider}
                                </Badge>
                              )}
                              {isSaved && (
                                <Badge variant="outline" className="text-[10px] py-0 text-primary border-primary/40">
                                  Saved
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </ScrollArea>
          </Card>
        </section>

        {/* Detail pane */}
        <section className={cn("lg:block", mobileDetail ? "block" : "hidden")}>
          <Card className="h-full p-0 overflow-hidden">
            {!selected ? (
              <div className="h-full flex items-center justify-center p-8 text-center min-h-[240px]">
                <div>
                  <Star className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Pick a role to see the breakdown</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Match analysis, JD, and one-click apply chain.
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[70vh] lg:h-[calc(100vh-280px)]">
                <div className="p-4 md:p-5 space-y-5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden -ml-2 h-8 px-2 text-muted-foreground"
                    onClick={() => setMobileDetail(false)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back to results
                  </Button>
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center ring-2",
                        (selected.match_score ?? selected.score ?? selected.fit_score) !== null && (selected.match_score ?? selected.score ?? selected.fit_score) !== undefined
                          ? scoreRing(selected.match_score ?? selected.score ?? selected.fit_score ?? 0)
                          : "ring-muted"
                      )}
                    >
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold leading-tight">{selected.title}</h2>
                      <p className="text-sm text-muted-foreground">{selected.company}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {selected.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {selected.location}
                          </span>
                        )}
                        {selected.job_type && (
                          <span className="inline-flex items-center gap-1">
                            <Briefcase className="w-3 h-3" /> {selected.job_type}
                          </span>
                        )}
                        {selected.salary && <Badge variant="outline">{selected.salary}</Badge>}
                        {selected.source && (
                          <Badge variant="outline" className="text-[10px]">
                            via {selected.source}
                          </Badge>
                        )}
                        {selected.ats_provider && (
                          <Badge variant="secondary" className="text-[10px] gap-1 border-primary/20">
                            <span>{ATS_LOGOS[selected.ats_provider] || "🖥️"}</span>
                            {ATS_NAMES[selected.ats_provider] || selected.ats_provider}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          "text-2xl font-bold tabular-nums",
                          (selected.match_score ?? selected.score ?? selected.fit_score) !== null && (selected.match_score ?? selected.score ?? selected.fit_score) !== undefined
                            ? scoreColor(selected.match_score ?? selected.score ?? selected.fit_score ?? 0)
                            : "text-muted-foreground"
                        )}
                      >
                        {(selected.match_score ?? selected.score ?? selected.fit_score) !== null && (selected.match_score ?? selected.score ?? selected.fit_score) !== undefined
                          ? `${selected.match_score ?? selected.score ?? selected.fit_score}%`
                          : "—"}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {(selected.match_score ?? selected.score ?? selected.fit_score) !== null && (selected.match_score ?? selected.score ?? selected.fit_score) !== undefined
                          ? "Calibrated Fit"
                          : "Unranked"}
                      </div>
                    </div>
                  </div>

                  {/* Calibrated Fit Card with Evidence Chips */}
                  <CalibratedFitCard
                    score={selected.match_score ?? selected.score ?? selected.fit_score ?? null}
                    matchedSkills={selected.matched_skills || []}
                    missingSkills={selected.missing_skills || []}
                    matchReason={selected.match_reasons?.[0] || selected.match_reason}
                    atsProvider={selected.ats_provider}
                    isLiveAtSource={true}
                    transitionType={(profile as any)?.transition_type}
                  />

                  {selected.role_intelligence && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2"><Sparkles className="w-4 h-4 text-primary" /></div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Semantic role family</div>
                          <p className="mt-1 text-sm text-foreground">
                            {selected.role_intelligence.family
                              ? `Searching across ${selected.role_intelligence.family} titles, not just this exact wording.`
                              : "This role was searched using the exact title and your profile context."}
                          </p>
                        </div>
                      </div>
                      {selected.role_intelligence.expanded_queries && selected.role_intelligence.expanded_queries.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selected.role_intelligence.expanded_queries.slice(0, 6).map((variant) => (
                            <Badge key={variant} variant="secondary" className="text-[10px]">{variant}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selected.preparation_material && (
                    <div className="rounded-xl border border-border/70 bg-card/70 p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-accent/10 p-2"><BookOpen className="w-4 h-4 text-accent" /></div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preparation material</div>
                          <p className="mt-1 text-sm font-medium text-foreground">Build evidence for this role before you apply.</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(selected.preparation_material.focus_areas || []).slice(0, 6).map((focus) => (
                          <Badge key={focus} variant="outline" className="text-[10px]">{focus}</Badge>
                        ))}
                      </div>
                      {(selected.preparation_material.practice_prompts || []).length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Practice prompts</div>
                          <ul className="space-y-1 text-xs text-foreground/80">
                            {selected.preparation_material.practice_prompts?.slice(0, 3).map((prompt) => <li key={prompt} className="flex gap-2"><span className="text-primary">•</span><span>{prompt}</span></li>)}
                          </ul>
                        </div>
                      )}
                      {(selected.preparation_material.evidence_to_prepare || []).length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Evidence to prepare</div>
                          <ul className="space-y-1 text-xs text-foreground/80">
                            {selected.preparation_material.evidence_to_prepare?.slice(0, 3).map((item) => <li key={item} className="flex gap-2"><span className="text-primary">•</span><span>{item}</span></li>)}
                          </ul>
                        </div>
                      )}
                      {(selected.preparation_material.counterfactuals || []).length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">How the match could improve</div>
                          <ul className="space-y-1 text-xs text-foreground/80">
                            {selected.preparation_material.counterfactuals?.slice(0, 3).map((item) => <li key={item} className="flex gap-2"><span className="text-accent">↗</span><span>{item}</span></li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => handleApplyChain(selected)} className="flex-1 min-w-[160px]">
                      <Wand2 className="w-4 h-4 mr-2" /> Apply with AI chain
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleQueueForReview(selected)}
                    >
                      <Zap className="w-4 h-4 mr-2" /> Queue for Review
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSave(selected)}
                      disabled={savedDedupeKeys.has(
                        selected.dedupe_key ||
                          `${selected.company}-${selected.title}-${selected.location}`
                      )}
                    >
                      {savedDedupeKeys.has(
                        selected.dedupe_key ||
                          `${selected.company}-${selected.title}-${selected.location}`
                      ) ? (
                        <BookmarkCheck className="w-4 h-4" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams({
                          job_title: selected.title || "",
                          company: selected.company || "",
                          description: (selected.snippet || selected.description || "").slice(0, 500),
                        });
                        navigate(`/cover-letter?${params.toString()}`);
                      }}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" /> Cover letter
                    </Button>
                    {selected.url && (
                      <Button variant="ghost" asChild>
                        <a href={selected.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" /> Open
                        </a>
                      </Button>
                    )}
                  </div>

                  {/* K3 — skills you're missing (taxonomy gaps → roadmap) */}
                  {(selected.description || selected.snippet) && (
                    <SkillGapWidget
                      key={selected.dedupe_key || selected.title}
                      jobDescription={selected.description || selected.snippet || ""}
                      onResult={(r) => setHeroGap({ gaps: r.gaps, overlap_score: r.overlap_score })}
                    />
                  )}

                  {/* M4 — preference feedback signals (like / applied / skip) */}
                  {selected.dedupe_key && (
                    <JobFeedbackButtons
                      jobId={selected.dedupe_key}
                      jobTitle={selected.title}
                      companyName={selected.company}
                      metadata={{ location: selected.location, source: selected.source }}
                    />
                  )}

                  {/* Why this job */}
                  {(selected.match_reasons?.length || selected.missing_skills?.length) ? (
                    <div className="grid md:grid-cols-2 gap-3">
                      {selected.match_reasons && selected.match_reasons.length > 0 && (
                        <div className="rounded-lg border border-success/20 bg-success/5 p-3">
                          <div className="text-xs font-semibold text-success mb-2 uppercase tracking-wider">
                            Why this job
                          </div>
                          <ul className="space-y-1 text-sm">
                            {selected.match_reasons.slice(0, 4).map((r, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="text-success">✓</span>
                                <span className="text-foreground/85">{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selected.missing_skills && selected.missing_skills.length > 0 && (
                        <div className="rounded-lg border border-border bg-card p-4 col-span-2">
                          <div className="flex items-center justify-between gap-4 mb-3 pb-2 border-b border-border/50">
                            <div>
                              <h4 className="font-semibold text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                Skill Gaps to Close ({selected.missing_skills.length})
                              </h4>
                              <p className="text-[10px] text-muted-foreground leading-normal">
                                Missing requirements detected from target job description
                              </p>
                            </div>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" asChild>
                              <Link to="/roadmap">
                                View Learning Roadmap
                              </Link>
                            </Button>
                          </div>
                          
                          <div className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                            Gaps to Close ({selected.missing_skills.length})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {selected.missing_skills.slice(0, 8).map((s, i) => (
                              <div key={i} className="flex items-center gap-1.5 bg-warning/5 text-warning border border-warning/20 px-2.5 py-0.5 rounded-full text-xs font-medium hover:bg-warning/10 transition-colors">
                                <span>{s}</span>
                                <button
                                  onClick={() => {
                                    toast.info(`Pre-filling learning roadmap details for "${s}"...`);
                                    navigate("/roadmap", { state: { targetSkill: s } });
                                  }}
                                  className="hover:bg-warning/20 rounded px-1.5 py-0.5 ml-1 transition-colors text-[9px] font-bold uppercase tracking-wider border border-warning/25 bg-warning/10"
                                  title={`Boost ${s}`}
                                >
                                  Boost
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {(selected.snippet || selected.description) && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Job description
                      </h4>
                      <p className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">
                        {(selected.description || selected.snippet || "").slice(0, 2000)}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </Card>
        </section>
      </div>
    </AppShell>
  );
};

export default JobSearch;
