import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ResumePreviewContent } from "./ResumePreviewContent";
import { generateResumePdf } from "@/api";
import type { ParsedResume, ResumeAnalysisResult } from "@/types/resume";

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
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const data = await generateResumePdf({
        resume_text: resumeText,
        profile_data: parsedResume,
        analysis: analysisResults,
        applied_suggestions: appliedSuggestions,
        job_description: jobDescription,
        template,
      });

      const binaryString = atob(data.pdf_base64);
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
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download PDF");
    } finally {
      setIsDownloading(false);
    }
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

        <div className="flex-1 overflow-hidden">
          <ResumePreviewContent
            parsedResume={displayResume}
            template={template}
          />
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-border mt-4">
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
      </DialogContent>
    </Dialog>
  );
};

export default ResumePreviewModal;
