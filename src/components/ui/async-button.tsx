/**
 * AsyncButton — Button with built-in async loading & error state
 *
 * Props/API:
 *  onClick     — Async handler; loading is automatically managed
 *  loadingText — Text to show while loading (default: same as children)
 *  successText — Optional text shown briefly after success
 *  errorText   — Optional text shown briefly after failure
 *  All ButtonProps are forwarded.
 *
 * Usage:
 *  <AsyncButton
 *    onClick={submitResume}
 *    loadingText="Submitting…"
 *    successText="Submitted!"
 *  >
 *    Submit Resume
 *  </AsyncButton>
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonProps } from "./button";
import { LoadingSpinner } from "./loading-spinner";

type AsyncButtonState = "idle" | "loading" | "success" | "error";

export interface AsyncButtonProps extends Omit<ButtonProps, "onClick"> {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  /** Duration (ms) to show success/error feedback before reverting to idle */
  feedbackDuration?: number;
}

const AsyncButton = React.forwardRef<HTMLButtonElement, AsyncButtonProps>(
  (
    {
      children,
      onClick,
      loadingText,
      successText,
      errorText,
      feedbackDuration = 2000,
      className,
      variant,
      size,
      disabled,
      ...props
    },
    ref
  ) => {
    const [state, setState] = React.useState<AsyncButtonState>("idle");
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cleanup timer on unmount
    React.useEffect(() => {
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, []);

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!onClick || state === "loading") return;

      try {
        setState("loading");
        await onClick(e);

        if (successText) {
          setState("success");
          timerRef.current = setTimeout(() => setState("idle"), feedbackDuration);
        } else {
          setState("idle");
        }
      } catch {
        if (errorText) {
          setState("error");
          timerRef.current = setTimeout(() => setState("idle"), feedbackDuration);
        } else {
          setState("idle");
        }
      }
    };

    const isLoading = state === "loading";
    const isSuccess = state === "success";
    const isError = state === "error";

    const displayVariant = isError ? "destructive" : variant;

    const content = () => {
      if (isLoading) {
        return (
          <>
            <LoadingSpinner size="sm" variant="white" />
            {loadingText ?? children}
          </>
        );
      }
      if (isSuccess && successText) {
        return (
          <>
            <CheckIcon />
            {successText}
          </>
        );
      }
      if (isError && errorText) {
        return (
          <>
            <XIcon />
            {errorText}
          </>
        );
      }
      return children;
    };

    return (
      <button
        ref={ref}
        className={cn(
          buttonVariants({ variant: displayVariant, size }),
          "transition-all duration-200",
          className
        )}
        disabled={disabled || isLoading}
        onClick={handleClick}
        aria-disabled={isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {content()}
      </button>
    );
  }
);
AsyncButton.displayName = "AsyncButton";

/* ── Micro-icons ─────────────────────────────────────────────── */
function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

/**
 * CopyButton — Button that copies text to clipboard with feedback
 *
 * Props/API:
 *  text      — String to copy to clipboard
 *  label     — Accessible label (default: "Copy")
 *  className — Extra Tailwind overrides
 *
 * Usage:
 *  <CopyButton text="resume-optimization-tips" />
 *  <CopyButton text={resumeText} label="Copy resume" className="ml-2" />
 */
export interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

function CopyButton({ text, label = "Copy", className }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail for unsupported environments
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied!" : label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
        "border border-border/50 bg-muted/40 text-muted-foreground",
        "hover:bg-muted hover:text-foreground transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {copied ? (
        <>
          <CheckIcon />
          Copied!
        </>
      ) : (
        <>
          <ClipboardIcon />
          {label}
        </>
      )}
    </button>
  );
}

function ClipboardIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
  );
}

export { AsyncButton, CopyButton };
