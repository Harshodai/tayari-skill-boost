import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const progressTrackVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-muted/60",
  {
    variants: {
      size: {
        xs: "h-1",
        sm: "h-1.5",
        md: "h-2",
        lg: "h-3",
      },
    },
    defaultVariants: { size: "sm" },
  },
);

type ColorScheme = "primary" | "success" | "warning" | "destructive" | "auto";

function resolveColor(colorScheme: ColorScheme, value: number): string {
  if (colorScheme === "auto") {
    if (value >= 80) return "from-success to-success/70";
    if (value >= 50) return "from-warning to-warning/70";
    return "from-destructive to-destructive/70";
  }
  const map: Record<Exclude<ColorScheme, "auto">, string> = {
    primary: "from-primary to-primary/70",
    success: "from-success to-success/70",
    warning: "from-warning to-warning/70",
    destructive: "from-destructive to-destructive/70",
  };
  return map[colorScheme as Exclude<ColorScheme, "auto">];
}

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressTrackVariants> {
  colorScheme?: ColorScheme;
  showLabel?: boolean;
  label?: string;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(
  (
    {
      className,
      value = 0,
      size,
      colorScheme = "primary",
      showLabel = false,
      label,
      ...props
    },
    ref,
  ) => {
    const pct = Math.max(0, Math.min(100, value ?? 0));
    const gradientCls = resolveColor(colorScheme, pct);

    return (
      <div className="w-full space-y-1">
        {(showLabel || label) && (
          <div className="flex justify-between">
            {label && (
              <span className="text-xs font-medium text-foreground">{label}</span>
            )}
            {showLabel && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {pct}%
              </span>
            )}
          </div>
        )}
        <ProgressPrimitive.Root
          ref={ref}
          className={cn(progressTrackVariants({ size }), className)}
          value={pct}
          {...props}
        >
          <ProgressPrimitive.Indicator
            className={cn(
              "h-full w-full flex-1 bg-gradient-to-r",
              gradientCls,
              "rounded-full transition-all duration-500 ease-out",
            )}
            style={{ transform: `translateX(-${100 - pct}%)` }}
          />
        </ProgressPrimitive.Root>
      </div>
    );
  },
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };

