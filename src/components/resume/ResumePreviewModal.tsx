import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Eye, 
  FileCode, 
  Download, 
  Loader2,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ResumePreviewContent } from "./ResumePreviewContent";
import { LaTeXSourceView } from "./LaTeXSourceView";
import type { 
  ParsedResume, 
  ResumeAnalysisResult, 
  GenerateResumeResponse 
} from "@/types/resume";

interface ResumePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedResume: ParsedResume | null;
  analysisResults: ResumeAnalysisResult;
  resumeText: string;
  jobDescription?: string;
  appliedSuggestions: string[];
  template: string;
  templateName: string;
  resumeFileName?: string;
}

export const ResumePreviewModal = ({
  open,
  onOpenChange,
  parsedResume,
  analysisResults,
  resumeText,
  jobDescription,
  appliedSuggestions,
  template,
  templateName,
  resumeFileName,
}: ResumePreviewModalProps) => {
  const [activeTab, setActiveTab] = useState<"preview" | "latex">("preview");
  const [latexSource, setLatexSource] = useState<string>("");
  const [isLoadingLatex, setIsLoadingLatex] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab("preview");
    }
  }, [open]);

  const handleGenerateLatex = async () => {
    setIsLoadingLatex(true);
    try {
      const response = await supabase.functions.invoke<GenerateResumeResponse>(
        "generate-resume-pdf",
        {
          body: {
            resumeText,
            analysisResults,
            appliedSuggestions,
            template,
            jobDescription,
            parsedResume,
            previewOnly: true, // Only generate LaTeX, don't compile PDF
          },
        }
      );

      if (response.error) {
        throw new Error(response.error.message || "Failed to generate LaTeX");
      }

      if (response.data?.latexSource) {
        setLatexSource(response.data.latexSource);
      } else {
        throw new Error("No LaTeX source in response");
      }
    } catch (error) {
      console.error("Error generating LaTeX:", error);
      toast.error("Failed to generate LaTeX preview");
    } finally {
      setIsLoadingLatex(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await supabase.functions.invoke<GenerateResumeResponse>(
        "generate-resume-pdf",
        {
          body: {
            resumeText,
            analysisResults,
            appliedSuggestions,
            template,
            jobDescription,
            parsedResume,
          },
        }
      );

      if (response.error) {
        throw new Error(response.error.message || "Failed to generate PDF");
      }

      const data = response.data;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to generate PDF");
      }

      if (data.pdfGenerated && data.pdfBase64) {
        const binaryString = atob(data.pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${resumeFileName?.replace(/\.[^/.]+$/, "") || "resume"}_optimized.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Resume PDF downloaded!");
      } else if (data.latexSource) {
        const blob = new Blob([data.latexSource], { type: "text/x-latex" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${resumeFileName?.replace(/\.[^/.]+$/, "") || "resume"}_optimized.tex`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.info("PDF compilation failed. LaTeX source downloaded instead.");
      }
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadLatex = () => {
    if (!latexSource) {
      toast.error("No LaTeX source available. Generate preview first.");
      return;
    }

    const blob = new Blob([latexSource], { type: "text/x-latex" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${resumeFileName?.replace(/\.[^/.]+$/, "") || "resume"}_${template}.tex`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("LaTeX source downloaded!");
  };

  // Create a fallback parsed resume if none is provided
  const displayResume: ParsedResume = parsedResume || {
    name: "Your Name",
    email: "email@example.com",
    phone: "(555) 123-4567",
    summary: "Professional summary will appear here based on your resume content.",
    experience: [
      {
        title: "Job Title",
        company: "Company Name",
        startDate: "Start",
        endDate: "Present",
        description: "Your experience details will appear here.",
        achievements: ["Achievement 1", "Achievement 2"],
      },
    ],
    education: [
      {
        degree: "Your Degree",
        institution: "Your Institution",
        year: "Year",
      },
    ],
    skills: ["Skill 1", "Skill 2", "Skill 3"],
    projects: [],
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Resume Preview - {templateName} Template
          </DialogTitle>
        </DialogHeader>

        <Tabs 
          value={activeTab} 
          onValueChange={(v) => setActiveTab(v as "preview" | "latex")}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger 
              value="latex" 
              className="flex items-center gap-2"
              onClick={() => {
                if (!latexSource && !isLoadingLatex) {
                  handleGenerateLatex();
                }
              }}
            >
              <FileCode className="w-4 h-4" />
              LaTeX Source
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="flex-1 overflow-hidden">
            <ResumePreviewContent 
              parsedResume={displayResume} 
              template={template} 
            />
          </TabsContent>

          <TabsContent value="latex" className="flex-1 overflow-hidden">
            <LaTeXSourceView 
              latexSource={latexSource}
              isLoading={isLoadingLatex}
              filename={resumeFileName?.replace(/\.[^/.]+$/, "") || "resume"}
            />
          </TabsContent>
        </Tabs>

        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
          <div className="flex items-center gap-2">
            {activeTab === "latex" && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGenerateLatex}
                disabled={isLoadingLatex}
              >
                {isLoadingLatex ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Regenerate
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handleDownloadLatex}
              disabled={!latexSource || isLoadingLatex}
            >
              <FileCode className="w-4 h-4 mr-2" />
              Download LaTeX
            </Button>
            <Button 
              variant="glow" 
              onClick={handleDownloadPDF}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResumePreviewModal;