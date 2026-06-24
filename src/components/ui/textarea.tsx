import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  success?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, success, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // Base — mirrors Input
          "flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm",
          "ring-offset-background transition-colors duration-150",
          "placeholder:text-muted-foreground/70",
          // Resize — y-only for better UX
          "resize-y",
          // Focus
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/30",
          // Semantic states
          error && "border-destructive text-destructive placeholder:text-destructive/50 focus-visible:ring-destructive/30",
          success && "border-success focus-visible:ring-success/30",
          !error && !success && "border-border hover:border-border/80",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };

