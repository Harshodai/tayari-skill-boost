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
import { generateResumePdf, buildGenerateResumePdfPayload } from "@/api";
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
      const data = await generateResumePdf(
        buildGenerateResumePdfPayload({
          resumeText,
          profileData: parsedResume,
          analysis: analysisResults,
          appliedSuggestions,
          jobDescription,
          template,
        })
      );

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

  const displayResume = parsedResume;

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
          {displayResume ? (
            <ResumePreviewContent
              parsedResume={displayResume}
              template={template}
            />
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
              <div className="max-w-md space-y-2">
                <p className="font-medium text-foreground">No resume content to preview</p>
                <p className="text-sm text-muted-foreground">Upload or select a resume before opening a template preview. We will not display placeholder candidate data.</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-border mt-4">
          <Button
            variant="glow"
            onClick={handleDownloadPDF}
            disabled={isDownloading || !displayResume}
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
