import { useState } from "react";
import { Layout } from "@/components/layout";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
  Filter,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { searchJobs, saveJob, listSavedJobs, getProfile, listResumes } from "@/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const JobSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: savedJobs = [], isLoading: savedLoading } = useQuery({
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
      toast.success("Job saved");
      queryClient.invalidateQueries({ queryKey: ["saved-jobs"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to save job"),
  });

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const profilePayload = profile ? {
        desired_roles: profile.desired_roles || [],
        skills: profile.skills || [],
        locations: profile.locations || [],
        experience_years: profile.experience_years || 0,
        open_to_remote: profile.open_to_remote || false,
      } : {};

      const resumeText = resumes && resumes.length > 0
        ? ((resumes[0] as any).optimized_text || resumes[0].original_text || "")
        : "";

      const res = await searchJobs({
        query,
        location,
        profile: profilePayload,
        resume_text: resumeText,
        top_n: 12,
      });
      const jobs = res?.report?.jobs || res?.jobs || [];
      setResults(jobs);
      if (jobs.length === 0) {
        toast.info("No jobs found for your query. Try different keywords.");
      }
    } catch (err: any) {
      const msg = err.message || "Search failed";
      setSearchError(msg);
      toast.error(msg);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = (job: any) => {
    const dedupeKey = job.dedupe_key || `${job.company}-${job.title}-${job.location}`;
    saveMutation.mutate({
      dedupe_key: dedupeKey,
      job: job,
      status: "saved",
    });
  };

  const filteredResults = results.filter((j) => {
    const score = j.score || j.fit_score || 0;
    return score >= minScore;
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Hermes Agent Powered
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Smart Job Search
          </h1>
          <p className="text-muted-foreground text-lg">
            Search across multiple job boards with AI-powered ranking and deduplication.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Job title, keywords, or company..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="relative w-full md:w-64">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Location (optional)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching} className="min-w-[120px]">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Search
            </Button>
          </div>

          {/* Filters */}
          <Collapsible open={showFilters} onOpenChange={setShowFilters} className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 rounded-lg border border-border bg-card mt-2">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground min-w-[80px]">Min Score:</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12">{minScore}%</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Error Banner */}
        {searchError && (
          <div className="max-w-4xl mx-auto mb-6">
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="py-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Search failed</p>
                  <p className="text-sm text-muted-foreground">{searchError}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleSearch}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results */}
        <div className="max-w-4xl mx-auto">
          {isSearching && (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-5">
                  <div className="flex items-start gap-4">
                    <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-1/3" />
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                    <div className="space-y-2 min-w-[80px]">
                      <Skeleton className="h-6 w-12 ml-auto" />
                      <Skeleton className="h-8 w-20 ml-auto" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isSearching && filteredResults.length === 0 && (
            <Card className="py-16 text-center">
              <CardContent>
                <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {results.length === 0 ? (searchError ? "Search error" : "Start your search") : "No jobs match your filters"}
                </h3>
                <p className="text-muted-foreground">
                  {results.length === 0
                    ? "Enter a job title or keyword to find opportunities."
                    : "Try lowering the minimum score filter."}
                </p>
              </CardContent>
            </Card>
          )}

          {!isSearching && (
            <div className="space-y-4">
              {filteredResults.map((job, index) => {
                const dedupeKey = job.dedupe_key || `${job.company}-${job.title}-${job.location}`;
                const isSaved = savedDedupeKeys.has(dedupeKey);
                const score = job.score || job.fit_score || 0;

                return (
                  <Card
                    key={index}
                    className="animate-fade-in-up card-hover"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <CardContent className="py-5">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                              <Building2 className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">{job.title}</h3>
                              <p className="text-muted-foreground text-sm">{job.company}</p>
                              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {job.location || "Remote"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Briefcase className="w-3 h-3" />
                                  {job.job_type || "Full-time"}
                                </span>
                                {job.source && (
                                  <Badge variant="outline" className="text-xs">
                                    {job.source}
                                  </Badge>
                                )}
                              </div>
                              {job.snippet && (
                                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                                  {job.snippet}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-3 min-w-[140px]">
                          <div className="text-right">
                            <div className={`text-lg font-bold ${score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive"}`}>
                              {score}%
                            </div>
                            <div className="text-xs text-muted-foreground">Match</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSave(job)}
                              disabled={isSaved || saveMutation.isPending || savedLoading}
                            >
                              {isSaved ? (
                                <BookmarkCheck className="w-4 h-4 text-primary" />
                              ) : (
                                <Bookmark className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const params = new URLSearchParams({
                                  job_title: job.title || '',
                                  company: job.company || '',
                                  description: (job.snippet || '').slice(0, 500),
                                });
                                navigate(`/cover-letter?${params.toString()}`);
                              }}
                            >
                              <MessageSquare className="w-3 h-3 mr-1" />
                              Cover Letter
                            </Button>
                            {job.url && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={job.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  Apply
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {score > 0 && (
                        <div className="mt-4">
                          <Progress value={score} className="h-1.5" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default JobSearch;
