import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base — shared across all variants
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
    "ring-offset-background transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out will-change-transform",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.97]",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /** Primary CTA — solid indigo */
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary-dark",
        /** Danger action */
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive",
        /** Secondary outlined — primary border */
        outline:
          "border border-primary/40 text-primary bg-transparent hover:bg-primary/8 hover:border-primary",
        /** Muted secondary — fills on hover */
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        /** Ghost — text only, background on hover */
        ghost:
          "text-foreground/80 hover:bg-muted hover:text-foreground",
        /** Link — underline on hover */
        link:
          "text-primary underline-offset-4 hover:underline",
        /** Glow — primary with ambient glow */
        glow:
          "bg-primary text-primary-foreground shadow-glow hover:bg-primary-dark hover:shadow-glow focus-visible:ring-primary/50",
        /** Success */
        success:
          "bg-success text-success-foreground shadow-sm hover:bg-success/90",
        /** Info */
        info:
          "bg-info text-info-foreground shadow-sm hover:bg-info/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-8 text-base",
        xl: "h-14 rounded-lg px-10 text-lg font-semibold",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };

