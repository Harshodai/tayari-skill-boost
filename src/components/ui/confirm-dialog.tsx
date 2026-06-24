/**
 * ConfirmDialog — Production-grade accessible confirmation dialog
 *
 * Props/API:
 *  open           — Controlled open state
 *  onOpenChange   — (open: boolean) => void
 *  title          — Dialog heading
 *  description    — Dialog body text
 *  variant        — "default" | "destructive" (default: "default")
 *  confirmLabel   — Confirm button text (default: "Confirm")
 *  cancelLabel    — Cancel button text (default: "Cancel")
 *  onConfirm      — Async or sync confirm callback
 *  isLoading      — Disable + show spinner while submitting
 *  icon           — Optional icon shown above title
 *
 * Usage:
 *  <ConfirmDialog
 *    open={showDelete}
 *    onOpenChange={setShowDelete}
 *    title="Delete application?"
 *    description="This action cannot be undone."
 *    variant="destructive"
 *    confirmLabel="Delete"
 *    onConfirm={handleDelete}
 *    isLoading={isDeleting}
 *  />
 */

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { LoadingSpinner } from "./loading-spinner";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = "default",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  isLoading = false,
  icon,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = React.useState(false);
  const isSubmitting = isLoading || internalLoading;

  const handleConfirm = async () => {
    try {
      setInternalLoading(true);
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />

        {/* Panel */}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "focus:outline-none"
          )}
          aria-describedby={description ? "confirm-dialog-description" : undefined}
        >
          {/* Icon */}
          {icon && (
            <div
              className={cn(
                "mb-4 flex h-12 w-12 items-center justify-center rounded-xl",
                variant === "destructive"
                  ? "bg-red-500/10 text-red-500"
                  : "bg-primary/10 text-primary"
              )}
              aria-hidden="true"
            >
              {icon}
            </div>
          )}

          {/* Title */}
          <DialogPrimitive.Title className="text-lg font-semibold text-foreground leading-tight">
            {title}
          </DialogPrimitive.Title>

          {/* Description */}
          {description && (
            <DialogPrimitive.Description
              id="confirm-dialog-description"
              className="mt-2 text-sm text-muted-foreground leading-relaxed"
            >
              {description}
            </DialogPrimitive.Description>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogPrimitive.Close asChild>
              <Button variant="outline" disabled={isSubmitting} className="w-full sm:w-auto">
                {cancelLabel}
              </Button>
            </DialogPrimitive.Close>

            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              disabled={isSubmitting}
              onClick={handleConfirm}
              className="w-full sm:w-auto"
              aria-label={isSubmitting ? "Processing…" : confirmLabel}
            >
              {isSubmitting && <LoadingSpinner size="sm" variant="white" />}
              {isSubmitting ? "Processing…" : confirmLabel}
            </Button>
          </div>

          {/* Close button */}
          {!isSubmitting && (
            <DialogPrimitive.Close
              className={cn(
                "absolute right-4 top-4 rounded-md opacity-60 ring-offset-background transition-opacity",
                "hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              )}
              aria-label="Close dialog"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export { ConfirmDialog };
