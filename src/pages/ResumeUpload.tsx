import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UploadZone } from "@/components/ui/upload-zone";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowRight,
  FileText,
  Clipboard,
  Sparkles,
  Settings2,
  Loader2,
  Wand2,
  Target,
  Zap,
  ChevronDown,
  ChevronUp,
  LogIn,
  AlertCircle
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { extractTextFromFile } from "@/lib/resume-parser";
import { toast } from "sonner";
import { resumeUploadSchema } from "@/lib/schemas";
import { createResume, createJD, analyzeResume, importJobDescription, uploadResumeMultipart } from "@/api";
import { buildAnalyzePayload, normalizeGoAnalysis } from "@/lib/resumeAnalysis";
import { Input } from "@/components/ui/input";
import { ResumeFilePreview } from "@/components/resume/ResumeFilePreview";

const ResumeUpload = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState<string>("");
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [jobPostUrl, setJobPostUrl] = useState("");
  const [isImportingJobDescription, setIsImportingJobDescription] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Workflow Options
  const [aiOptions, setAiOptions] = useState({
    emphasizeKeywords: true,
    quantifyAchievements: true,
    optimizeFormat: false,
    tailorSummary: true,
  });

  // Extract text when file is selected
  useEffect(() => {
    if (!resumeFile) {
      setResumeText("");
      setParsingError(null);
      return;
    }

    const extractText = async () => {
      try {
        setParsingError(null);

        // Zod Validation
        const validationResult = resumeUploadSchema.safeParse({ file: resumeFile });
        if (!validationResult.success) {
          const errorMsg = validationResult.error.issues[0].message;
          setParsingError(errorMsg);
          setResumeText("");
          return;
        }

        const text = await extractTextFromFile(resumeFile);
        setResumeText(text);
        console.log("Extracted resume text:", text.substring(0, 200) + "...");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to parse file";
        setParsingError(message);
        setResumeText("");
        console.error("Resume parsing error:", err);
      }
    };

    extractText();
  }, [resumeFile]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisStep(0);

    try {
      // Phase 1: create/upload resume record
      setAnalysisStep(1);
      let newResume: any;
      if (resumeFile) {
        newResume = await uploadResumeMultipart(resumeFile);
      } else {
        const fileType = "txt";
        newResume = await createResume({
          title: "Pasted Resume",
          original_text: resumeText,
          file_type: fileType,
        });
      }
      const resumeId = newResume.id || newResume.resume_id;

      // Phase 2: create job description record
      setAnalysisStep(2);
      const newJD = await createJD({
        title: jobDescription.slice(0, 60) || "Untitled JD",
        company: "",
        text: jobDescription,
      });

      // Phase 3: call analysis endpoint
      setAnalysisStep(3);
      const result = await analyzeResume(
        buildAnalyzePayload(resumeId, newJD.id, customInstructions, aiOptions)
      );

      setAnalysisStep(4);
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Normalize Go-backend response to UI shape
      const normalized = normalizeGoAnalysis(result);

      navigate("/resume/results", {
        state: {
          resumeId: resumeId,
          analysisResults: normalized,
          parsedResume: newResume.parsed_json,
          resumeFileName: resumeFile?.name || "Resume",
          resumeText: newResume.original_text || resumeText,
          jobDescription,
        },
      });
    } catch (err) {
      console.error("Analysis error:", err);
      const message = err instanceof Error ? err.message : "Failed to analyze resume";
      setError(message);
      toast.error(message);
      setIsAnalyzing(false);
    }
  };

  const canAnalyze = (resumeText || resumeFile) && jobDescription.trim().length > 50 && !parsingError;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJobDescription(text);
    } catch (err) {
      console.error("Failed to paste from clipboard");
    }
  };

  const handleImportJobDescription = async () => {
    const url = jobPostUrl.trim();
    if (!url) {
      const message = "Enter a public job-post URL to import its description.";
      setError(message);
      toast.error(message);
      return;
    }

    setIsImportingJobDescription(true);
    setError(null);
    try {
      const imported = await importJobDescription(url);
      setJobDescription(imported.job_description);
      toast.success("Job description imported.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import the job description.";
      setError(message);
      toast.error(message);
    } finally {
      setIsImportingJobDescription(false);
    }
  };

  const analysisSteps = [
    { label: "Preparing analysis", done: analysisStep >= 1 },
    { label: "Parsing resume content", done: analysisStep >= 2 },
    { label: "Analyzing with AI", done: analysisStep >= 3 },
    { label: "Generating recommendations", done: analysisStep >= 4 },
  ];

  // Loading/Analyzing State
  if (isAnalyzing) {
    return (
      <AppShell>
        <div className="container mx-auto px-4 py-24">
          <div className="max-w-lg mx-auto text-center">
            <div className="relative mb-8">
              {/* Animated loader */}
              <div className="w-32 h-32 mx-auto relative">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
                <div className="absolute inset-4 rounded-full border-4 border-transparent border-t-secondary animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-4">
              Analyzing Your Resume
            </h2>
            <p className="text-muted-foreground mb-8">
              Our AI is comparing your resume against the job requirements...
            </p>

            {/* Progress steps */}
            <div className="space-y-4 text-left max-w-sm mx-auto">
              {analysisSteps.map((step, index) => (
                <div
                  key={step.label}
                  className="flex items-center gap-3 animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  {step.done ? (
                    <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                      <span className="text-success-foreground text-xs">✓</span>
                    </div>
                  ) : (
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  )}
                  <span className={step.done ? "text-muted-foreground" : "text-foreground"}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-12">
        {/* Sign-in prompt for guests */}
        {!user && (
          <Alert className="max-w-5xl mx-auto mb-8 border-primary/30 bg-primary/5">
            <LogIn className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between flex-wrap gap-4">
              <span>Sign in to save your results and access your history.</span>
              <Button variant="outline" size="sm" asChild>
                <Link to="/auth">
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="max-w-5xl mx-auto mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            AI-Powered Analysis
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Resume Optimizer
          </h1>
          <p className="text-muted-foreground text-lg">
            Upload your resume and paste the job description to get AI-powered suggestions for improvement.
          </p>
        </div>

        {/* Main Content - 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Left Column - Resume Upload */}
          <Card className="animate-fade-in-up">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Your Resume</CardTitle>
                  <CardDescription>Upload your current resume</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <UploadZone
                file={resumeFile}
                onFileSelect={setResumeFile}
                onRemove={() => setResumeFile(null)}
                accept=".pdf,.docx"
                maxSize={5 * 1024 * 1024}
              />
              {parsingError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {parsingError}
                  </AlertDescription>
                </Alert>
              )}
              {resumeText && !parsingError && (
                <p className="text-success text-sm mt-2 flex items-center gap-2">
                  <span>✓</span> Resume parsed successfully ({resumeText.length} characters)
                </p>
              )}
              <ResumeFilePreview file={resumeFile} extractedText={resumeText} />
            </CardContent>
          </Card>

          {/* Right Column - Job Description */}
          <Card className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                    <Clipboard className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Job Description</CardTitle>
                    <CardDescription>Paste the target job posting</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handlePaste}>
                  <Clipboard className="w-4 h-4 mr-2" />
                  Paste
                </Button>
              </div>
            </CardHeader>
<CardContent>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Label htmlFor="job-post-url" className="sr-only">
                    Job Post URL (optional)
                  </Label>
                  <Input
                    id="job-post-url"
                    type="url"
                    placeholder="Optional public job-post URL"
                    value={jobPostUrl}
                    onChange={(e) => setJobPostUrl(e.target.value)}
                    disabled={isImportingJobDescription}
                  />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleImportJobDescription}
                  disabled={isImportingJobDescription}
                  className="sm:shrink-0"
                >
                  {isImportingJobDescription ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clipboard className="w-4 h-4 mr-2" />}
                  Import URL
                </Button>
              </div>
              <p className="text-muted-foreground text-xs mt-2 mb-4">
                Imports readable text from a public page. Login, CAPTCHA, robots, and job-board access controls cannot be bypassed.
              </p>
              <Textarea
                placeholder="Paste the job description here...

Include:
• Job title and company
• Required skills and qualifications
• Responsibilities
• Nice-to-have requirements"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="min-h-[200px] resize-none"
              />
              <p className="text-muted-foreground text-sm mt-2">
                {jobDescription.length} characters
                {jobDescription.length < 50 && " (minimum 50 required)"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Custom AI Instructions Section */}
        <div className="max-w-5xl mx-auto mt-8">
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <Card className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary/10">
                        <Settings2 className="w-5 h-5 text-secondary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Custom AI Instructions</CardTitle>
                        <CardDescription>Fine-tune how the AI analyzes your resume</CardDescription>
                      </div>
                    </div>
                    {showAdvanced ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="space-y-6 pt-0">
                  {/* AI Workflow Options */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">AI Workflow Options</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        {
                          key: "emphasizeKeywords",
                          label: "Emphasize Keywords",
                          description: "Highlight matching skills and keywords",
                          icon: Target,
                        },
                        {
                          key: "quantifyAchievements",
                          label: "Quantify Achievements",
                          description: "Suggest adding metrics and numbers",
                          icon: Zap,
                        },
                        {
                          key: "optimizeFormat",
                          label: "Optimize Format",
                          description: "Suggest formatting improvements",
                          icon: FileText,
                        },
                        {
                          key: "tailorSummary",
                          label: "Tailor Summary",
                          description: "Customize summary for this job",
                          icon: Wand2,
                        },
                      ].map((option) => (
                        <div
                          key={option.key}
                          className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <option.icon className="w-5 h-5 text-primary mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={option.key} className="font-medium cursor-pointer">
                                {option.label}
                              </Label>
                              <Switch
                                id={option.key}
                                checked={aiOptions[option.key as keyof typeof aiOptions]}
                                onCheckedChange={(checked) =>
                                  setAiOptions({ ...aiOptions, [option.key]: checked })
                                }
                              />
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {option.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom Instructions Text */}
                  <div className="space-y-2">
                    <Label htmlFor="custom-instructions" className="text-base font-medium">
                      Additional Instructions
                    </Label>
                    <Textarea
                      id="custom-instructions"
                      placeholder="Add any specific instructions for the AI...

Examples:
• Focus on highlighting my Python experience
• I'm transitioning from marketing to product management
• Emphasize my leadership experience
• Downplay my gap year"
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      className="min-h-[120px] resize-none"
                    />
                    <p className="text-muted-foreground text-xs">
                      Optional: Provide context or specific focus areas for better results
                    </p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        {/* Analyze Button */}
        <div className="flex justify-center mt-8 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <Button
            size="xl"
            variant="glow"
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className="min-w-[250px]"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Analyze Resume
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-16">
          {[
            {
              title: "AI-Powered Analysis",
              description: "Our AI compares your resume against the job requirements",
            },
            {
              title: "Section Scoring",
              description: "Get detailed scores for skills, experience, and formatting",
            },
            {
              title: "Actionable Tips",
              description: "Receive specific suggestions to improve your match rate",
            },
          ].map((item, index) => (
            <div
              key={item.title}
              className="text-center p-6 rounded-xl bg-card/50 border border-border/50 animate-fade-in-up"
              style={{ animationDelay: `${0.4 + index * 0.1}s` }}
            >
              <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-muted-foreground text-sm">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export default ResumeUpload;
