import { cn } from "@/lib/utils";

interface AnimatedGradientTextProps {
  children: React.ReactNode;
  className?: string;
  animated?: boolean;
}

export function AnimatedGradientText({ 
  children, 
  className,
  animated = true 
}: AnimatedGradientTextProps) {
  return (
    <span
      className={cn(
        "bg-clip-text text-transparent",
        "bg-gradient-to-r from-primary via-secondary to-accent",
        animated && "bg-[length:200%_auto] animate-gradient-shift",
        className
      )}
    >
      {children}
    </span>
  );
}

// Variant with customizable gradient colors
interface CustomGradientTextProps {
  children: React.ReactNode;
  className?: string;
  from?: string;
  via?: string;
  to?: string;
  animated?: boolean;
}

export function CustomGradientText({
  children,
  className,
  from = "hsl(var(--primary))",
  via = "hsl(var(--secondary))",
  to = "hsl(var(--accent))",
  animated = true,
}: CustomGradientTextProps) {
  return (
    <span
      className={cn(
        "bg-clip-text text-transparent",
        animated && "bg-[length:200%_auto] animate-gradient-shift",
        className
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, ${from}, ${via}, ${to})`,
      }}
    >
      {children}
    </span>
  );
}
