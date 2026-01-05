import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UploadZone } from "@/components/ui/upload-zone";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowRight, FileText, Clipboard, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ResumeUpload = () => {
  const navigate = useNavigate();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");

  const handleAnalyze = () => {
    // In production, this would upload and analyze
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

        {/* Analyze Button */}
        <div className="flex justify-center mt-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
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
              style={{ animationDelay: `${0.3 + index * 0.1}s` }}
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
