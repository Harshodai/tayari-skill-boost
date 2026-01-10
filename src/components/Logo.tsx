import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Rocket } from "lucide-react";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary">
        <Rocket className="w-5 h-5 text-primary-foreground" />
      </div>
      {showText && (
        <span className="text-xl font-bold text-foreground">
          Job<span className="text-gradient">Tayari</span>
        </span>
      )}
    </Link>
  );
}