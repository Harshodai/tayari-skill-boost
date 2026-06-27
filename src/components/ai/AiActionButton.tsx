import { forwardRef } from "react";
import { Sparkles } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AiActionButtonProps extends ButtonProps {
  label?: string;
  loading?: boolean;
}

/**
 * Standardized inline AI action trigger.
 * Use anywhere we offer an AI-powered enhancement (tailor resume,
 * rewrite bullet, generate cover letter, etc.).
 */
export const AiActionButton = forwardRef<HTMLButtonElement, AiActionButtonProps>(
  ({ label = "AI tailor", loading, className, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size="sm"
        variant="outline"
        className={cn(
          "gap-1.5 h-8 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary",
          className
        )}
        disabled={loading || props.disabled}
        {...props}
      >
        <Sparkles className={cn("h-3.5 w-3.5", loading && "animate-pulse")} />
        {children ?? label}
      </Button>
    );
  }
);
AiActionButton.displayName = "AiActionButton";
