import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UploadZone } from "@/components/ui/upload-zone";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  ChevronUp
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const ResumeUpload = () => {
  const navigate = useNavigate();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // AI Workflow Options
  const [aiOptions, setAiOptions] = useState({
    emphasizeKeywords: true,
    quantifyAchievements: true,
    optimizeFormat: false,
    tailorSummary: true,
  });

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 3000));
    setIsAnalyzing(false);
    navigate("/resume/results");
  };

  const canAnalyze = resumeFile && jobDescription.trim().length > 50;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJobDescription(text);
    } catch (err) {
      console.error("Failed to paste from clipboard");
    }
  };

  // Loading/Analyzing State
  if (isAnalyzing) {
    return (
      <Layout>
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
              {[
                { label: "Parsing resume content", done: true },
                { label: "Extracting job requirements", done: true },
                { label: "Matching skills and experience", done: false },
                { label: "Generating recommendations", done: false },
              ].map((step, index) => (
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
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
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
    </Layout>
  );
};

export default ResumeUpload;