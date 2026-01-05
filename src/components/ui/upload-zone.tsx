import * as React from "react";
import { cn } from "@/lib/utils";
import { Upload, FileText, X, Check } from "lucide-react";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number;
  file?: File | null;
  onRemove?: () => void;
  className?: string;
  disabled?: boolean;
}

const UploadZone = React.forwardRef<HTMLDivElement, UploadZoneProps>(
  ({ onFileSelect, accept = ".pdf,.docx", maxSize = 5 * 1024 * 1024, file, onRemove, className, disabled }, ref) => {
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

    const validateFile = (file: File): boolean => {
      setError(null);
      
      if (maxSize && file.size > maxSize) {
        setError(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
        return false;
      }

      const acceptedTypes = accept.split(",").map(t => t.trim());
      const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;
      const isAccepted = acceptedTypes.some(type => 
        type === fileExtension || file.type.includes(type.replace(".", ""))
      );

      if (!isAccepted) {
        setError(`Please upload a valid file (${accept})`);
        return false;
      }

      return true;
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      if (disabled) return;

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && validateFile(droppedFile)) {
        onFileSelect(droppedFile);
      }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile && validateFile(selectedFile)) {
        onFileSelect(selectedFile);
      }
    };

    const handleClick = () => {
      if (!disabled) inputRef.current?.click();
    };

    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    if (file) {
      return (
        <div
          ref={ref}
          className={cn(
            "relative flex items-center gap-4 p-4 rounded-lg border border-success/50 bg-success/10",
            className
          )}
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-success/20">
            <FileText className="w-6 h-6 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{file.name}</p>
            <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-success">
              <Check className="w-4 h-4 text-success-foreground" />
            </div>
            {onRemove && (
              <button
                onClick={onRemove}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-destructive/20 transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed transition-all duration-300 cursor-pointer",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-accent/50",
          disabled && "opacity-50 cursor-not-allowed",
          error && "border-destructive",
          className
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />

        <div className={cn(
          "flex items-center justify-center w-16 h-16 rounded-full mb-4 transition-colors",
          isDragging ? "bg-primary/20" : "bg-muted"
        )}>
          <Upload className={cn(
            "w-8 h-8 transition-colors",
            isDragging ? "text-primary" : "text-muted-foreground"
          )} />
        </div>

        <p className="text-foreground font-medium mb-1">
          {isDragging ? "Drop your file here" : "Drop your resume here"}
        </p>
        <p className="text-muted-foreground text-sm mb-2">or click to browse</p>
        <p className="text-muted-foreground text-xs">
          PDF, DOCX (max {Math.round(maxSize / 1024 / 1024)}MB)
        </p>

        {error && (
          <p className="absolute bottom-2 text-destructive text-sm">{error}</p>
        )}
      </div>
    );
  }
);

UploadZone.displayName = "UploadZone";

export { UploadZone };
