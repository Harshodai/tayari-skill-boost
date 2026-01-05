import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
        <span className="text-xl font-bold text-primary-foreground">JT</span>
      </div>
      {showText && (
        <span className="text-xl font-bold text-foreground">
          Job<span className="text-primary">Tayari</span>
        </span>
      )}
    </Link>
  );
}
