import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        /** Solid primary — high-emphasis label */
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/85",
        /** Muted secondary — low-emphasis label, fixed dark-mode contrast */
        secondary:
          "border-border bg-secondary/60 text-secondary-foreground hover:bg-secondary/80",
        /** Destructive / error */
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/85",
        /** Stroke only */
        outline:
          "border-border text-foreground bg-transparent",
        /** Success / positive */
        success:
          "border-success/20 bg-success/10 text-success hover:bg-success/15",
        /** Warning / caution */
        warning:
          "border-warning/20 bg-warning/10 text-warning hover:bg-warning/15",
        /** Info / neutral-blue */
        info:
          "border-info/20 bg-info/10 text-info hover:bg-info/15",
        /** Ghost / very subtle */
        subtle:
          "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
      },
      shape: {
        pill: "rounded-full",
        tag: "rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "pill",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, shape, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, shape }), className)} {...props} />;
}

export { Badge, badgeVariants };
