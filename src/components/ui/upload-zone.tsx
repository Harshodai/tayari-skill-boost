import * as React from "react";
import { cn } from "@/lib/utils";
import { Upload, FileText, X, CheckCircle2, AlertCircle } from "lucide-react";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number;
  file?: File | null;
  onRemove?: () => void;
  className?: string;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const UploadZone = React.forwardRef<HTMLDivElement, UploadZoneProps>(
  (
    {
      onFileSelect,
      accept = ".pdf,.docx",
      maxSize = 5 * 1024 * 1024,
      file,
      onRemove,
      className,
      disabled,
    },
    ref,
  ) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    };

    const validateFile = (f: File): boolean => {
      setError(null);
      if (maxSize && f.size > maxSize) {
        setError(`File too large — max ${Math.round(maxSize / 1024 / 1024)} MB`);
        return false;
      }
      const accepted = accept.split(",").map((t) => t.trim());
      const ext = `.${f.name.split(".").pop()?.toLowerCase()}`;
      const ok = accepted.some(
        (t) => t === ext || f.type.includes(t.replace(".", "")),
      );
      if (!ok) {
        setError(`Unsupported format — use ${accept}`);
        return false;
      }
      return true;
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const dropped = e.dataTransfer.files[0];
      if (dropped && validateFile(dropped)) onFileSelect(dropped);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected && validateFile(selected)) onFileSelect(selected);
    };

    const handleClick = () => {
      if (!disabled) inputRef.current?.click();
    };

    /* ── File selected state ─────────────────────────────── */
    if (file) {
      return (
        <div
          ref={ref}
          className={cn(
            "flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-4",
            "ring-1 ring-success/10",
            className,
          )}
          role="status"
          aria-label={`File selected: ${file.name}`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-success/10">
            <FileText className="h-5 w-5 text-success" aria-hidden="true" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatFileSize(file.size)}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                aria-label="Remove file"
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full",
                  "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      );
    }

    /* ── Drop zone ───────────────────────────────────────── */
    return (
      <div
        ref={ref}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload file — click or drag and drop"
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "group relative flex flex-col items-center justify-center gap-3",
          "rounded-xl border-2 border-dashed p-10 text-center",
          "cursor-pointer select-none transition-all duration-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Idle
          !isDragging && !error && !disabled &&
            "border-border/60 bg-muted/20 hover:border-primary/50 hover:bg-primary/3",
          // Dragging
          isDragging &&
            "border-primary bg-primary/6 scale-[1.01] shadow-glow",
          // Error
          error && "border-destructive/50 bg-destructive/3",
          // Disabled
          disabled && "cursor-not-allowed opacity-50 border-border/30 bg-muted/10",
          className,
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="sr-only"
          disabled={disabled}
          aria-hidden="true"
        />

        {/* Icon container */}
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300",
            isDragging
              ? "bg-primary/15 text-primary scale-110"
              : error
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
          )}
        >
          {error ? (
            <AlertCircle className="h-7 w-7" aria-hidden="true" />
          ) : (
            <Upload className="h-7 w-7" aria-hidden="true" />
          )}
        </div>

        {/* Copy */}
        <div className="space-y-1">
          {error ? (
            <>
              <p className="text-sm font-semibold text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground">Click to try a different file</p>
            </>
          ) : isDragging ? (
            <p className="text-sm font-semibold text-primary">Release to upload</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">
                Drop your resume here
              </p>
              <p className="text-xs text-muted-foreground">
                or{" "}
                <span className="text-primary underline underline-offset-2 hover:no-underline">
                  browse your files
                </span>
              </p>
            </>
          )}
        </div>

        {/* Format hint */}
        <p className="text-[11px] text-muted-foreground/60">
          {accept.replace(/\./g, "").toUpperCase().replace(/,/g, ", ")} ·{" "}
          max {Math.round(maxSize / 1024 / 1024)} MB
        </p>
      </div>
    );
  },
);

UploadZone.displayName = "UploadZone";

export { UploadZone };

