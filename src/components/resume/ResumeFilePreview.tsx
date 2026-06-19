import { useEffect, useMemo, useState } from "react";
import { FileText, FileType2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ResumeFilePreviewProps {
  file: File | null;
  extractedText: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ResumeFilePreview({ file, extractedText }: ResumeFilePreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [showFullText, setShowFullText] = useState(false);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isPdf = useMemo(
    () => !!file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")),
    [file]
  );
  const isDocx = useMemo(
    () => !!file && file.name.toLowerCase().endsWith(".docx"),
    [file]
  );

  if (!file) return null;

  return (
    <div className="mt-4 rounded-lg border border-border bg-card/50 overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary shrink-0">
            {isPdf ? <FileType2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {isPdf ? "PDF" : isDocx ? "DOCX" : (file.type || "Document")} · {formatSize(file.size)}
            </p>
          </div>
        </div>
      </div>

      {isPdf && objectUrl && (
        <div className="w-full aspect-[4/3] bg-muted/20">
          <iframe
            src={objectUrl}
            title={`Preview of ${file.name}`}
            className="w-full h-full"
          />
        </div>
      )}

      {extractedText && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Extracted text
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFullText((p) => !p)}
              className="h-7 px-2 text-xs"
            >
              {showFullText ? (
                <>
                  <EyeOff className="w-3 h-3 mr-1" /> Collapse
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3 mr-1" /> Expand
                </>
              )}
            </Button>
          </div>
          <pre
            className={cn(
              "text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/20 rounded p-3 overflow-auto",
              showFullText ? "max-h-96" : "max-h-32"
            )}
          >
            {extractedText.slice(0, showFullText ? 20000 : 600)}
            {!showFullText && extractedText.length > 600 ? "…" : ""}
          </pre>
        </div>
      )}
    </div>
  );
}
