import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { searchJobs, saveJob, listSavedJobs, getProfile, listResumes } from "@/api";
import { useAutomation } from "@/contexts/AutomationContext";
import { cn } from "@/lib/utils";

interface Job {
  title: string;
  company: string;
  location?: string;
  url?: string;
  source?: string;
  snippet?: string;
  description?: string;
  job_type?: string;
  posted_at?: string;
  salary?: string;
  score?: number;
  fit_score?: number;
  match_reasons?: string[];
  missing_skills?: string[];
  dedupe_key?: string;
}

const scoreColor = (s: number) =>
  s >= 80 ? "text-emerald-400" : s >= 60 ? "text-amber-400" : "text-rose-400";

const scoreRing = (s: number) =>
  s >= 80 ? "ring-emerald-500/40" : s >= 60 ? "ring-amber-500/40" : "ring-rose-500/40";

const JobSearch = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startRun } = useAutomation();

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [results, setResults] = useState<Job[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [alertOn, setAlertOn] = useState(false);

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
    setIsSearching(true);
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
      setResults(jobs);
      setSelectedIdx(0);
      if (jobs.length === 0) toast.info("No jobs matched. Try broader keywords.");
    } catch (err: any) {
      const msg = err.message || "Search failed";
      setSearchError(msg);
      toast.error(msg);
    } finally {
      setIsSearching(false);
    }
  };

  const filtered = useMemo(
    () =>
      results.filter((j) => {
        const s = j.score || j.fit_score || 0;
        if (s < minScore) return false;
        if (remoteOnly && j.location && !/remote/i.test(j.location)) return false;
        return true;
      }),
    [results, minScore, remoteOnly]
  );

  const selected = filtered[selectedIdx] || filtered[0];

  const handleSave = (job: Job) => {
    const dedupeKey = job.dedupe_key || `${job.company}-${job.title}-${job.location}`;
    saveMutation.mutate({ dedupe_key: dedupeKey, job, status: "saved" } as any);
  };

  const handleApplyChain = (job: Job) => {
    startRun({
      title: `Apply to ${job.title}`,
      context: `${job.company}${job.location ? " · " + job.location : ""}`,
      steps: [
        "Tailoring resume to JD",
        "Generating cover letter",
        "Drafting recruiter outreach",
        "Queueing application via AutoPilot",
      ],
    });
    toast.success("Apply chain started — see Activity");
  };

  const handleQueueAutoPilot = (job: Job) => {
    startRun({
      title: `AutoPilot: ${job.title}`,
      context: job.company,
      steps: ["Verifying eligibility", "Filling application", "Submitting", "Logging to pipeline"],
    });
    toast.success("Queued for AutoPilot");
  };

  return (
    <AppShell title="Smart Job Search" subtitle="Search • Match • Apply — in one flow">
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
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
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
            <Button onClick={handleSearch} disabled={isSearching} className="h-11 min-w-[120px]">
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" /> Search
                </>
              )}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              <Sparkles className="w-3 h-3" /> Hermes Agent
            </span>
            <span>Aggregating Greenhouse · Lever · Ashby · Workday · Remotive</span>
          </div>
        </div>
      </div>

      {searchError && (
        <Card className="mb-4 border-destructive/40 bg-destructive/5 p-3 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm flex-1">{searchError}</span>
          <Button size="sm" variant="outline" onClick={handleSearch}>
            <RotateCcw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </Card>
      )}

      {/* 3-pane workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1.1fr)] gap-4 min-h-[70vh]">
        {/* Filters & saved searches */}
        <aside className="space-y-4">
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Bell className="w-4 h-4 text-muted-foreground" /> Daily alert
                  </div>
                  <Switch
                    checked={alertOn}
                    onCheckedChange={(v) => {
                      setAlertOn(v);
                      if (v) toast.success("Daily alert enabled for this search");
                    }}
                  />
                </div>
              </div>
            </div>
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
        <section>
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
                    const score = job.score || job.fit_score || 0;
                    const active = i === selectedIdx;
                    const dedupeKey =
                      job.dedupe_key || `${job.company}-${job.title}-${job.location}`;
                    const isSaved = savedDedupeKeys.has(dedupeKey);
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedIdx(i)}
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
                                  "text-xs font-bold tabular-nums shrink-0",
                                  scoreColor(score)
                                )}
                              >
                                {score}%
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
        <section>
          <Card className="h-full p-0 overflow-hidden">
            {!selected ? (
              <div className="h-full flex items-center justify-center p-8 text-center">
                <div>
                  <Star className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Pick a role to see the breakdown</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Match analysis, JD, and one-click apply chain.
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="p-5 space-y-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center ring-4",
                        scoreRing(selected.score || selected.fit_score || 0)
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
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          "text-2xl font-bold tabular-nums",
                          scoreColor(selected.score || selected.fit_score || 0)
                        )}
                      >
                        {selected.score || selected.fit_score || 0}%
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        AI match
                      </div>
                    </div>
                  </div>

                  <Progress
                    value={selected.score || selected.fit_score || 0}
                    className="h-1.5"
                  />

                  {/* Action bar */}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => handleApplyChain(selected)} className="flex-1 min-w-[160px]">
                      <Wand2 className="w-4 h-4 mr-2" /> Apply with AI chain
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleQueueAutoPilot(selected)}
                    >
                      <Zap className="w-4 h-4 mr-2" /> Queue AutoPilot
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

                  {/* Why this job */}
                  {(selected.match_reasons?.length || selected.missing_skills?.length) ? (
                    <div className="grid md:grid-cols-2 gap-3">
                      {selected.match_reasons && selected.match_reasons.length > 0 && (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                          <div className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider">
                            Why this job
                          </div>
                          <ul className="space-y-1 text-sm">
                            {selected.match_reasons.slice(0, 4).map((r, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="text-emerald-400">✓</span>
                                <span className="text-foreground/85">{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selected.missing_skills && selected.missing_skills.length > 0 && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
                          <div className="text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">
                            Gaps to close
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {selected.missing_skills.slice(0, 8).map((s, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {s}
                              </Badge>
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
