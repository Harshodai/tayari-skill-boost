import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  apiFetchResponse,
  listSavedJobs,
  getProfile,
  listResumes,
  listCoverLetters,
  createCoverLetter,
  deleteCoverLetter,
  type CoverLetter as SavedCoverLetter,
} from "@/api";
import {
  FileText,
  Copy,
  Download,
  Loader2,
  Sparkles,
  Check,
  Building2,
  Briefcase,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Trash2,
  History,
  FolderOpen,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

const SAMPLE_COVER_ROLES = [
  {
    company: "Stripe",
    title: "Staff Frontend Engineer",
    jd: `Requirements:
- 6+ years building performant web applications in React 19 and TypeScript.
- Deep focus on developer ergonomics, micro-frontends, and sub-50ms user interactions.
- Experience collaborating across engineering, design systems, and product teams.`,
    notes: "Followed Stripe's annual letter on developer platform reliability. Impressed by their focus on API idempotency.",
  },
  {
    company: "Cloudflare",
    title: "Lead Systems Engineer",
    jd: `Requirements:
- High-throughput distributed systems development in Go and Rust.
- Low-latency edge caching, Kafka streaming, and PostgreSQL database reliability.
- Experience with zero-downtime deployments and distributed consensus.`,
    notes: "Read Cloudflare's deep-dive blog post on eBPF traffic filtering. Strong alignment with their edge-first mission.",
  },
];

function getToken() {
  return localStorage.getItem("auth_token");
}

async function generateCoverLetter(payload: Record<string, unknown>) {
  const res = await apiFetchResponse(`/v1/cover-letter/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getToken() ? `Bearer ${getToken()}` : "",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to generate cover letter");
  return res.json();
}

interface SavedJobRecord {
  id: string | number;
  job?: {
    title?: string;
    company?: string;
    description?: string;
  };
}

export const CoverLetter = () => {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [tone, setTone] = useState("formal");
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [generated, setGenerated] = useState("");
  const [personalNotes, setPersonalNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);

  const [searchParams] = useSearchParams();

  // Pre-fill from URL query params
  useEffect(() => {
    const qJobTitle = searchParams.get("job_title");
    const qCompany = searchParams.get("company");
    const qDescription = searchParams.get("description");
    if (qJobTitle) setJobTitle(qJobTitle);
    if (qCompany) setCompanyName(qCompany);
    if (qDescription) setJobDescription(qDescription);
  }, [searchParams]);

  const { data: savedJobs = [] } = useQuery({
    queryKey: ["saved-jobs"],
    queryFn: () => listSavedJobs(),
  });
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
    retry: 2,
  });
  const { data: resumes } = useQuery({
    queryKey: ["resumes"],
    queryFn: () => listResumes(),
    retry: 2,
  });

  const {
    data: savedLetters = [],
    isLoading: isLoadingSaved,
    refetch: refetchSavedLetters,
  } = useQuery<SavedCoverLetter[]>({
    queryKey: ["cover-letters"],
    queryFn: () => listCoverLetters(),
    retry: 1,
  });

  const resumeText =
    resumes && resumes.length > 0
      ? ((resumes[0] as { optimized_text?: string; original_text?: string }).optimized_text || resumes[0].original_text || "")
      : "";

  const handleSelectJob = (id: string) => {
    setSelectedJobId(id);
    const job = (savedJobs as SavedJobRecord[]).find((j: SavedJobRecord) => String(j.id) === id);
    if (job) {
      const jobData = job.job || {};
      setJobTitle(jobData.title || "");
      setCompanyName(jobData.company || "");
      setJobDescription(jobData.description || "");
    }
  };

  const loadSampleRole = (preset: (typeof SAMPLE_COVER_ROLES)[0]) => {
    setCompanyName(preset.company);
    setJobTitle(preset.title);
    setJobDescription(preset.jd);
    setPersonalNotes(preset.notes);
    toast.success(`Loaded ${preset.title} @ ${preset.company}`);
  };

  const handleGenerate = async () => {
    if (!jobTitle || !companyName || !jobDescription) {
      toast.error("Please provide company name, job title, and description.");
      return;
    }
    const candidateText =
      resumeText ||
      "Staff Software Engineer with 8+ years experience building distributed systems and high-scale web platforms.";
    setIsGenerating(true);
    try {
      const result = await generateCoverLetter({
        resume_text: candidateText,
        job_title: jobTitle,
        company: companyName,
        job_description: jobDescription,
        tone,
        personal_notes: personalNotes,
        resume_id: resumes && resumes.length > 0 ? resumes[0].id : undefined,
      });
      setGenerated(result.cover_letter || "");
      setActiveSavedId(result.id || null);
      toast.success("Cover letter generated!");
      // If it was saved during generation, refresh list
      if (result.saved) {
        refetchSavedLetters();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generated.trim()) {
      toast.error("Generate a cover letter first before saving.");
      return;
    }
    setIsSaving(true);
    try {
      const saved = await createCoverLetter({
        job_title: jobTitle.trim() || "Cover Letter",
        company_name: companyName.trim() || "Company",
        content: generated,
        job_url: "",
        resume_id: resumes && resumes.length > 0 ? String(resumes[0].id) : null,
      });
      setActiveSavedId(saved.id);
      await refetchSavedLetters();
      toast.success("Cover letter saved to your library!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save cover letter");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadLetter = (letter: SavedCoverLetter) => {
    setActiveSavedId(letter.id);
    if (letter.job_title) setJobTitle(letter.job_title);
    if (letter.company_name) setCompanyName(letter.company_name);
    setGenerated(letter.content);
    toast.success(`Loaded cover letter for ${letter.job_title || "job"} @ ${letter.company_name || "company"}`);
  };

  const handleDeleteLetter = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteCoverLetter(id);
      if (activeSavedId === id) {
        setActiveSavedId(null);
      }
      await refetchSavedLetters();
      toast.success("Cover letter deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete cover letter");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const handleDownload = () => {
    const blob = new Blob([generated], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cover-letter-${(companyName || "company").toLowerCase().replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  const wordCount = generated.trim() ? generated.trim().split(/\s+/).length : 0;
  const readingTimeMin = (wordCount / 200).toFixed(1);

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            AI-Powered
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 font-display">
            Cover Letter Generator
          </h1>
          <p className="text-muted-foreground text-base">
            Generate tailored, resume-aware cover letters in seconds. Short, specific, and ATS-friendly.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {SAMPLE_COVER_ROLES.map((preset) => (
              <Button
                key={preset.company}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadSampleRole(preset)}
                className="text-xs font-medium active:scale-[0.98]"
              >
                Sample: {preset.title} ({preset.company})
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Inputs */}
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Job Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {savedJobs.length > 0 && (
                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                      Select Saved Job
                    </label>
                    <Select value={selectedJobId} onValueChange={handleSelectJob}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a saved job..." />
                      </SelectTrigger>
                      <SelectContent>
                        {savedJobs.map((job: SavedJobRecord) => {
                          const j = job.job || {};
                          return (
                            <SelectItem key={job.id} value={String(job.id)}>
                              {j.title || "Untitled"} @ {j.company || "Unknown"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                      placeholder="e.g., Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">
                      Job Title *
                    </label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                      placeholder="e.g., Senior Software Engineer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">
                    Job Description *
                  </label>
                  <Textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the job description here..."
                    rows={5}
                    className="text-xs font-mono leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">
                    Personal notes{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional hooks for authenticity)
                    </span>
                  </label>
                  <Textarea
                    value={personalNotes}
                    onChange={(e) => setPersonalNotes(e.target.value)}
                    placeholder="e.g. 'Met hiring manager at React Summit', 'Impressed by recent blog post on latency'..."
                    rows={3}
                    className="text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Tone
                  </label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Executive & Formal</SelectItem>
                      <SelectItem value="casual">Conversational & Modern</SelectItem>
                      <SelectItem value="confident">High-Conviction & Direct</SelectItem>
                      <SelectItem value="technical">Engineering & Systems Focused</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full font-semibold shadow-md active:scale-[0.98]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Crafting Tailored Cover Letter...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Cover Letter
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Output Preview & Saved Letters */}
          <div className="space-y-6">
            <Card className="flex flex-col shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Generated Output
                </CardTitle>
                {generated && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {wordCount} words (~{readingTimeMin} min read)
                    </Badge>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4 flex flex-col justify-between space-y-4 min-h-[300px]">
                {generated ? (
                  <>
                    <div className="p-4 rounded-xl bg-muted/30 border text-xs leading-relaxed whitespace-pre-wrap font-sans text-foreground/90 max-h-[400px] overflow-y-auto">
                      {generated}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="text-xs active:scale-[0.98] gap-1.5"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3.5 h-3.5" /> Save Cover Letter
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopy}
                        className="text-xs active:scale-[0.98]"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {copied ? "Copied" : "Copy to Clipboard"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownload}
                        className="text-xs active:scale-[0.98]"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Download TXT
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="py-16 text-center text-muted-foreground space-y-2">
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-medium text-foreground text-sm">
                      No Cover Letter Generated Yet
                    </p>
                    <p className="text-xs max-w-xs mx-auto">
                      Fill in the job details on the left or select a sample preset to generate a
                      targeted letter.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Saved Cover Letters Section */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" /> Saved Cover Letters
                </CardTitle>
                <Badge variant="secondary" className="font-mono text-xs">
                  {savedLetters.length}
                </Badge>
              </CardHeader>
              <CardContent className="p-4">
                {isLoadingSaved ? (
                  <div className="py-6 flex justify-center items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Loading saved letters...
                  </div>
                ) : savedLetters.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground space-y-1">
                    <FolderOpen className="w-8 h-8 mx-auto text-muted-foreground/40 mb-1" />
                    <p className="text-xs font-medium text-foreground">No saved cover letters</p>
                    <p className="text-[11px]">
                      Saved cover letters will appear here so you can load or copy them anytime.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {savedLetters.map((letter) => {
                      const isActive = activeSavedId === letter.id;
                      const dateStr = letter.created_at
                        ? new Date(letter.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "";
                      return (
                        <div
                          key={letter.id}
                          onClick={() => handleLoadLetter(letter)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 text-left ${
                            isActive
                              ? "border-primary/60 bg-primary/[0.06] shadow-xs"
                              : "border-border/50 hover:border-border bg-card/60 hover:bg-card"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs text-foreground truncate">
                                {letter.job_title || "Untitled Position"}
                              </span>
                              {letter.company_name && (
                                <Badge variant="outline" className="text-[10px] py-0 shrink-0">
                                  {letter.company_name}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5 font-sans line-clamp-1">
                              {letter.content.slice(0, 100)}...
                            </p>
                            {dateStr && (
                              <span className="text-[10px] text-muted-foreground/70 block mt-1">
                                {dateStr}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoadLetter(letter);
                              }}
                            >
                              Load
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => handleDeleteLetter(e, letter.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default CoverLetter;
