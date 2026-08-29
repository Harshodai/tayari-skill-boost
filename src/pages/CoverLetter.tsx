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
import { apiFetchResponse, listSavedJobs, getProfile, listResumes } from "@/api";
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
  UserCheck,
  BookOpen,
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

async function generateCoverLetter(payload: any) {
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

export const CoverLetter = () => {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [tone, setTone] = useState("formal");
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [generated, setGenerated] = useState("");
  const [personalNotes, setPersonalNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

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
    retry: false,
  });
  const { data: resumes } = useQuery({
    queryKey: ["resumes"],
    queryFn: () => listResumes(),
    retry: false,
  });

  const resumeText = resumes && resumes.length > 0
    ? ((resumes[0] as any).optimized_text || resumes[0].original_text || "")
    : "";

  const handleSelectJob = (id: string) => {
    setSelectedJobId(id);
    const job = savedJobs.find((j: any) => String(j.id) === id);
    if (job) {
      const jobData = job.job || {};
      setJobTitle(jobData.title || "");
      setCompanyName(jobData.company || "");
      setJobDescription(jobData.description || "");
    }
  };

  const loadSampleRole = (preset: typeof SAMPLE_COVER_ROLES[0]) => {
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
    const candidateText = resumeText || "Staff Software Engineer with 8+ years experience building distributed systems and high-scale web platforms.";
    setIsGenerating(true);
    try {
      const result = await generateCoverLetter({
        resume_text: candidateText,
        job_title: jobTitle,
        company: companyName,
        job_description: jobDescription,
        tone,
        personal_notes: personalNotes,
      });
      setGenerated(result.cover_letter || "");
      toast.success("Cover letter generated!");
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setIsGenerating(false);
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
    a.download = `cover-letter-${companyName.toLowerCase().replace(/\s+/g, "-")}.txt`;
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
                    <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Select Saved Job</label>
                    <Select value={selectedJobId} onValueChange={handleSelectJob}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a saved job..." />
                      </SelectTrigger>
                      <SelectContent>
                        {savedJobs.map((job: any) => {
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
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Company Name *</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                      placeholder="e.g., Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Job Title *</label>
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
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Job Description *</label>
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
                    Personal notes <span className="text-muted-foreground font-normal">(optional hooks for authenticity)</span>
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
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Tone</label>
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

          {/* Output Preview */}
          <div>
            <Card className="h-full flex flex-col shadow-sm">
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
              <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
                {generated ? (
                  <>
                    <div className="p-4 rounded-xl bg-muted/30 border text-xs leading-relaxed whitespace-pre-wrap font-sans text-foreground/90 flex-1 max-h-[500px] overflow-y-auto">
                      {generated}
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={handleCopy} className="text-xs active:scale-[0.98]">
                        {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                        {copied ? "Copied" : "Copy to Clipboard"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleDownload} className="text-xs active:scale-[0.98]">
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Download TXT
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="py-24 text-center text-muted-foreground space-y-2">
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-medium text-foreground text-sm">No Cover Letter Generated Yet</p>
                    <p className="text-xs max-w-xs mx-auto">
                      Fill in the job details on the left or select a sample preset to generate a targeted letter.
                    </p>
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
