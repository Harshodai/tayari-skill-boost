
import { cn } from "@/lib/utils";

interface GradientOrbProps {
  className?: string;
  variant?: "primary" | "secondary" | "accent";
  size?: "sm" | "md" | "lg" | "xl";
  delay?: "none" | "short" | "long";
}

export function GradientOrb({
  className,
  variant = "primary",
  size = "md",
  delay = "none"
}: GradientOrbProps) {

  const sizeClasses = {
    sm: "w-64 h-64 blur-[80px]",
    md: "w-96 h-96 blur-[100px]",
    lg: "w-[500px] h-[500px] blur-[120px]",
    xl: "w-[800px] h-[800px] blur-[150px]",
  };

  const colorClasses = {
    primary: "bg-primary/20",
    secondary: "bg-secondary/20",
    accent: "bg-accent/20",
  };

  const animClasses = {
    none: "animate-blob",
    short: "animate-blob-delayed",
    long: "animate-blob-delayed-2",
  };

  return (
    <div
      className={cn(
        "absolute rounded-full pointer-events-none mix-blend-screen opacity-70",
        sizeClasses[size],
        colorClasses[variant],
        animClasses[delay],
        className
      )}
    />
  );
}
