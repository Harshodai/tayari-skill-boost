import { useState, useEffect } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download, Check, Eye, Loader2, AlertTriangle, FileCode, CheckCircle2, CircleDot, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ResumePreviewModal } from "@/components/resume/ResumePreviewModal";
import type { ResumeAnalysisResult, ParsedResume } from "@/types/resume";

const templates = [
  {
    id: "modern",
    name: "Modern",
    description: "Clean and contemporary design with a focus on readability",
    preview: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-dark)) 100%)",
    features: ["ATS-friendly", "Two-column layout", "Skills section"],
  },
  {
    id: "professional",
    name: "Professional",
    description: "Classic layout perfect for traditional industries",
    preview: "linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--success)) 100%)",
    features: ["ATS-friendly", "Single column", "Formal styling"],
  },
  {
    id: "creative",
    name: "Creative",
    description: "Stand out with a unique and eye-catching design",
    preview: "linear-gradient(135deg, hsl(var(--warning)) 0%, hsl(var(--destructive)) 100%)",
    features: ["Visual accents", "Infographic elements", "Bold typography"],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Simple and elegant with plenty of white space",
    preview: "linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--accent)) 100%)",
    features: ["ATS-friendly", "Clean layout", "Typography focused"],
  },
  {
    id: "tech",
    name: "Tech",
    description: "Designed specifically for software engineering roles",
    preview: "linear-gradient(135deg, hsl(var(--primary-dark)) 0%, hsl(var(--secondary)) 100%)",
    features: ["Skills emphasis", "Project showcase", "GitHub integration"],
  },
  {
    id: "executive",
    name: "Executive",
    description: "Sophisticated design for senior-level positions",
    preview: "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--card)) 100%)",
    features: ["Leadership focus", "Achievement highlights", "Premium styling"],
  },
];

type StepStatus = 'pending' | 'active' | 'complete' | 'error';

interface CompilationStep {
  id: string;
  label: string;
  status: StepStatus;
}

const ResumeTemplates = () => {
  const location = useLocation();
  const analysisResults = location.state?.analysisResults as ResumeAnalysisResult | undefined;
  const resumeText = location.state?.resumeText as string | undefined;
  const resumeFileName = location.state?.resumeFileName as string | undefined;
  const jobDescription = location.state?.jobDescription as string | undefined;
  const appliedSuggestions = location.state?.appliedSuggestions as string[] || [];
  const parsedResume = location.state?.parsedResume as ParsedResume | undefined;

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [compilationSteps, setCompilationSteps] = useState<CompilationStep[]>([
    { id: 'optimizing', label: 'Optimizing content', status: 'pending' },
    { id: 'converting', label: 'Converting to LaTeX', status: 'pending' },
    { id: 'compiling', label: 'Compiling PDF', status: 'pending' },
    { id: 'downloading', label: 'Preparing download', status: 'pending' },
  ]);

  // Redirect if no data passed
  if (!analysisResults || !resumeText) {
    return <Navigate to="/resume/results" replace />;
  }

  const updateStepStatus = (stepId: string, status: StepStatus) => {
    setCompilationSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const resetSteps = () => {
    setCompilationSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
  };

  const handleDownload = async () => {
    if (!selectedTemplate) return;

    setIsGenerating(true);
    resetSteps();
    updateStepStatus('optimizing', 'active');

    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

      const response = await fetch(`${apiUrl}/v1/export/pdf`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          resume_text: resumeText,
          template: selectedTemplate,
          job_description: jobDescription,
          applied_suggestions: appliedSuggestions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate PDF");
      }

      const blob = await response.blob();
      updateStepStatus('optimizing', 'complete');
      updateStepStatus('converting', 'complete');
      updateStepStatus('compiling', 'complete');
      updateStepStatus('downloading', 'active');

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resumeFileName?.replace(/\.[^/.]+$/, "") || "resume"}_optimized.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      updateStepStatus('downloading', 'complete');
      toast.success("Resume PDF downloaded successfully!", {
        description: `Template: ${selectedTemplate}`,
      });
    } catch (error) {
      console.error("Error generating resume:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate resume";

      const activeStep = compilationSteps.find(s => s.status === 'active');
      if (activeStep) {
        updateStepStatus(activeStep.id, 'error');
      }

      toast.error("Failed to generate resume", {
        description: errorMessage,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getStepIcon = (status: StepStatus) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      case 'active':
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Button variant="ghost" asChild className="mb-2">
              <Link to="/resume/results">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Results
              </Link>
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Choose a Template
            </h1>
            <p className="text-muted-foreground mt-1">
              Select a professional template for your optimized resume
            </p>
          </div>
          <Button 
            size="lg" 
            variant="glow"
            onClick={handleDownload}
            disabled={!selectedTemplate || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Download Resume
              </>
            )}
          </Button>
        </div>

        {/* Progress Indicator */}
        {isGenerating && (
          <div className="max-w-lg mx-auto mb-8 animate-fade-in">
            <Card className="overflow-hidden border-primary/30">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4 text-center">Generating Your Resume</h3>
                <div className="space-y-3">
                  {compilationSteps.map((step, index) => (
                    <div 
                      key={step.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg transition-all",
                        step.status === 'active' && "bg-primary/10 border border-primary/30",
                        step.status === 'complete' && "bg-success/10",
                        step.status === 'error' && "bg-destructive/10"
                      )}
                    >
                      {getStepIcon(step.status)}
                      <span className={cn(
                        "text-sm",
                        step.status === 'active' && "font-medium text-foreground",
                        step.status === 'complete' && "text-success",
                        step.status === 'error' && "text-destructive",
                        step.status === 'pending' && "text-muted-foreground"
                      )}>
                        {step.label}
                      </span>
                      {step.status === 'complete' && (
                        <span className="ml-auto text-xs text-success">Complete</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Template Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template, index) => {
            const isSelected = selectedTemplate === template.id;
            const isHovered = hoveredTemplate === template.id;

            return (
              <Card
                key={template.id}
                className={cn(
                  "relative overflow-hidden cursor-pointer transition-all duration-300 animate-fade-in-up",
                  isSelected 
                    ? "ring-2 ring-primary border-primary" 
                    : "hover:border-primary/50"
                )}
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => setSelectedTemplate(template.id)}
                onMouseEnter={() => setHoveredTemplate(template.id)}
                onMouseLeave={() => setHoveredTemplate(null)}
              >
                {/* Template Preview */}
                <div 
                  className="h-48 relative"
                  style={{ background: template.preview }}
                >
                  {/* Preview placeholder - would be actual resume preview */}
                  <div className="absolute inset-4 bg-background/90 rounded-lg p-4 flex flex-col gap-2">
                    <div className="h-3 w-1/2 bg-foreground/20 rounded" />
                    <div className="h-2 w-3/4 bg-foreground/10 rounded" />
                    <div className="h-2 w-2/3 bg-foreground/10 rounded" />
                    <div className="flex-1" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-2 bg-foreground/10 rounded" />
                      <div className="h-2 bg-foreground/10 rounded" />
                    </div>
                  </div>

                  {/* Hover Overlay */}
                  {(isHovered || isSelected) && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center gap-2 animate-fade-in">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTemplate(template.id);
                          setPreviewOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </Button>
                    </div>
                  )}

                  {/* Selected Indicator */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">
                      <Check className="w-5 h-5" />
                    </div>
                  )}
                </div>

                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground mb-1">
                    {template.name}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-3">
                    {template.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {template.features.map((feature) => (
                      <span 
                        key={feature}
                        className="text-xs px-2 py-1 rounded-full bg-accent text-muted-foreground"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Download Section */}
        {selectedTemplate && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-sm border-t border-border animate-slide-in-right">
            <div className="container mx-auto flex items-center justify-between">
              <div>
                <p className="text-foreground font-medium">
                  Selected: {templates.find(t => t.id === selectedTemplate)?.name}
                </p>
                <p className="text-muted-foreground text-sm">
                  Ready to download your optimized resume
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => setSelectedTemplate(null)} disabled={isGenerating}>
                  Change Template
                </Button>
                <Button variant="glow" onClick={handleDownload} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {selectedTemplate && (
          <ResumePreviewModal
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            parsedResume={parsedResume || null}
            analysisResults={analysisResults}
            resumeText={resumeText}
            jobDescription={jobDescription}
            appliedSuggestions={appliedSuggestions}
            template={selectedTemplate}
            templateName={templates.find(t => t.id === selectedTemplate)?.name || ""}
            resumeFileName={resumeFileName}
          />
        )}
      </div>
    </Layout>
  );
};

export default ResumeTemplates;
