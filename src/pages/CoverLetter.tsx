import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { listSavedJobs, getProfile, listResumes } from "@/api";
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
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

function getToken() {
  return localStorage.getItem("auth_token");
}

async function generateCoverLetter(payload: any) {
  const res = await fetch(`${API_URL}/v1/cover-letter/generate`, {
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

const CoverLetter = () => {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [tone, setTone] = useState("formal");
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [generated, setGenerated] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [searchParams] = useSearchParams();

  // Pre-fill from URL query params (e.g., from JobSearch or InterviewBoard)
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

  const selectedJob = savedJobs.find((j: any) => String(j.id) === selectedJobId);

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

  const handleGenerate = async () => {
    if (!jobTitle || !companyName || !jobDescription) {
      toast.error("Please select a job and provide a job description");
      return;
    }
    if (!resumeText) {
      toast.error("Please upload a resume first");
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generateCoverLetter({
        resume_text: resumeText,
        job_title: jobTitle,
        company: companyName,
        job_description: jobDescription,
        tone,
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
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Cover Letter Generator
          </h1>
          <p className="text-muted-foreground text-lg">
            Generate tailored, resume-aware cover letters in seconds. Short, specific, and ATS-friendly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Inputs */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Job Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Saved Job</label>
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

                <div>
                  <label className="text-sm font-medium mb-2 block">Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                    placeholder="e.g., Acme Corp"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Job Title</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                    placeholder="e.g., Senior Software Engineer"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Job Description</label>
                  <Textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the job description here..."
                    rows={6}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Tone</label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="conversational">Conversational</SelectItem>
                      <SelectItem value="confident">Confident</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={isGenerating || !jobTitle || !companyName || !jobDescription}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
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

          {/* Output */}
          <div>
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Generated Cover Letter
                </CardTitle>
                {generated && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {generated ? (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
                      {generated}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{tone}</Badge>
                      <span>•</span>
                      <span>{generated.split(/\s+/).length} words</span>
                      <span>•</span>
                      <span>Under 300 words</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Your tailored cover letter will appear here.</p>
                    <p className="text-sm mt-2">Select a job and click Generate to begin.</p>
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
