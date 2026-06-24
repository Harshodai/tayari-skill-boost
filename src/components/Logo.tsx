import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Rocket } from "lucide-react";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <Link 
      to="/" 
      className={cn("flex items-center gap-2.5 group select-none outline-none", className)}
    >
      <div
        className={cn(
          "relative flex items-center justify-center w-9.5 h-9.5 rounded-xl",
          "border border-primary/20 bg-primary/5 text-primary",
          "shadow-sm transition-all duration-300",
          "group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:scale-105"
        )}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-xl bg-primary/10 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-300" />
        <Rocket className="relative w-4.5 h-4.5 text-primary transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2.5} />
      </div>
      {showText && (
        <span className="font-display text-xl font-bold text-foreground tracking-tight flex items-center">
          <span>Job</span>
          <span className="text-gradient">Tayari</span>
          <span className="w-1.5 h-1.5 rounded-full bg-primary ml-1 animate-pulse-slow shrink-0" />
        </span>
      )}
    </Link>
  );
}

