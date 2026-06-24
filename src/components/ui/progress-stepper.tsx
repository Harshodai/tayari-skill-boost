/**
 * ProgressStepper — Multi-step progress indicator component
 *
 * Props/API:
 *  steps         — Array of { id, label, description?, status? }
 *  currentStep   — Index (0-based) of the active step
 *  orientation   — "horizontal" | "vertical" (default: "horizontal")
 *  size          — "sm" | "md" | "lg" (default: "md")
 *  onStepClick   — (stepIndex: number) => void (to allow navigating to completed steps)
 *  className     — Extra Tailwind overrides
 *
 * Usage:
 *  <ProgressStepper
 *    steps={[
 *      { id: "upload", label: "Upload Resume" },
 *      { id: "analyze", label: "AI Analysis" },
 *      { id: "optimize", label: "Optimize" },
 *      { id: "export", label: "Export" },
 *    ]}
 *    currentStep={2}
 *    onStepClick={handleStepClick}
 *  />
 */

import * as React from "react";
import { cn } from "@/lib/utils";

type StepStatus = "completed" | "active" | "upcoming" | "error";

export interface Step {
  id: string;
  label: string;
  description?: string;
  status?: StepStatus;
}

export interface ProgressStepperProps {
  steps: Step[];
  currentStep: number;
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
  onStepClick?: (index: number) => void;
  className?: string;
}

const sizeMap = {
  sm: { circle: "h-6 w-6 text-xs", label: "text-xs", desc: "text-[10px]", connector: "h-0.5" },
  md: { circle: "h-8 w-8 text-sm", label: "text-sm", desc: "text-xs", connector: "h-0.5" },
  lg: { circle: "h-10 w-10 text-base", label: "text-base", desc: "text-sm", connector: "h-0.5" },
};

function getEffectiveStatus(index: number, currentStep: number, override?: StepStatus): StepStatus {
  if (override) return override;
  if (index < currentStep) return "completed";
  if (index === currentStep) return "active";
  return "upcoming";
}

function StepCircle({
  status,
  index,
  size,
}: {
  status: StepStatus;
  index: number;
  size: "sm" | "md" | "lg";
}) {
  const cls = sizeMap[size].circle;

  if (status === "completed") {
    return (
      <div className={cn("rounded-full bg-primary flex items-center justify-center shrink-0", cls)}>
        <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={cn("rounded-full bg-destructive flex items-center justify-center shrink-0", cls)}>
        <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className={cn("rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center shrink-0 relative", cls)}>
        <span className="font-semibold text-primary">{index + 1}</span>
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" aria-hidden="true" />
      </div>
    );
  }

  // Upcoming
  return (
    <div className={cn("rounded-full bg-muted border border-border flex items-center justify-center shrink-0", cls)}>
      <span className="font-medium text-muted-foreground">{index + 1}</span>
    </div>
  );
}

function ProgressStepper({
  steps,
  currentStep,
  orientation = "horizontal",
  size = "md",
  onStepClick,
  className,
}: ProgressStepperProps) {
  const sz = sizeMap[size];

  if (orientation === "vertical") {
    return (
      <nav aria-label="Progress" className={cn("flex flex-col gap-0", className)}>
        <ol className="flex flex-col gap-0">
          {steps.map((step, i) => {
            const status = getEffectiveStatus(i, currentStep, step.status);
            const isClickable = onStepClick && (status === "completed" || status === "active");
            const isLast = i === steps.length - 1;

            return (
              <li key={step.id} className="relative flex gap-3">
                {/* Connector line */}
                {!isLast && (
                  <div className="absolute left-4 top-8 bottom-0 -translate-x-1/2 w-0.5">
                    <div
                      className={cn(
                        "h-full w-full transition-colors duration-300",
                        status === "completed" ? "bg-primary" : "bg-border"
                      )}
                    />
                  </div>
                )}

                {/* Circle */}
                <div
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  aria-current={status === "active" ? "step" : undefined}
                  onClick={isClickable ? () => onStepClick(i) : undefined}
                  onKeyDown={
                    isClickable
                      ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStepClick(i); } }
                      : undefined
                  }
                  className={cn(
                    "relative z-10 shrink-0",
                    isClickable && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                  )}
                >
                  <StepCircle status={status} index={i} size={size} />
                </div>

                {/* Labels */}
                <div className={cn("pb-6 min-w-0 flex-1", isLast && "pb-0")}>
                  <p
                    className={cn(
                      "font-medium leading-none mt-1",
                      sz.label,
                      status === "active" ? "text-foreground" : status === "completed" ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className={cn("mt-1 text-muted-foreground", sz.desc)}>{step.description}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  // Horizontal
  return (
    <nav aria-label="Progress" className={cn("w-full overflow-x-auto", className)}>
      <ol className="flex items-center">
        {steps.map((step, i) => {
          const status = getEffectiveStatus(i, currentStep, step.status);
          const isClickable = onStepClick && (status === "completed" || status === "active");
          const isLast = i === steps.length - 1;

          return (
            <li
              key={step.id}
              className={cn("flex items-center", !isLast && "flex-1")}
            >
              {/* Step */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  aria-current={status === "active" ? "step" : undefined}
                  aria-label={`Step ${i + 1}: ${step.label} — ${status}`}
                  onClick={isClickable ? () => onStepClick(i) : undefined}
                  onKeyDown={
                    isClickable
                      ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStepClick(i); } }
                      : undefined
                  }
                  className={cn(
                    "shrink-0",
                    isClickable && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                  )}
                >
                  <StepCircle status={status} index={i} size={size} />
                </div>
                <span
                  className={cn(
                    "whitespace-nowrap font-medium",
                    sz.label,
                    status === "active" ? "text-primary" : status === "completed" ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector */}
              {!isLast && (
                <div className="mx-2 flex-1 relative" aria-hidden="true">
                  <div className="h-0.5 w-full bg-border overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        status === "completed" ? "w-full bg-primary" : "w-0"
                      )}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { ProgressStepper };
