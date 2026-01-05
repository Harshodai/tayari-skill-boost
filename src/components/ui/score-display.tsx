import * as React from "react";
import { cn } from "@/lib/utils";

interface ScoreDisplayProps {
  score: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  showBar?: boolean;
  animated?: boolean;
  className?: string;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
};

const getScoreBarColor = (score: number) => {
  if (score >= 80) return "bg-success";
  if (score >= 50) return "bg-warning";
  return "bg-destructive";
};

const getScoreRingColor = (score: number) => {
  if (score >= 80) return "stroke-success";
  if (score >= 50) return "stroke-warning";
  return "stroke-destructive";
};

const ScoreDisplay = React.forwardRef<HTMLDivElement, ScoreDisplayProps>(
  ({ score, size = "md", label, showBar = false, animated = true, className }, ref) => {
    const [displayScore, setDisplayScore] = React.useState(animated ? 0 : score);

    React.useEffect(() => {
      if (!animated) {
        setDisplayScore(score);
        return;
      }

      const duration = 1000;
      const steps = 60;
      const increment = score / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= score) {
          setDisplayScore(score);
          clearInterval(timer);
        } else {
          setDisplayScore(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }, [score, animated]);

    const sizeClasses = {
      sm: { container: "w-16 h-16", text: "text-lg", label: "text-xs" },
      md: { container: "w-24 h-24", text: "text-2xl", label: "text-sm" },
      lg: { container: "w-32 h-32", text: "text-4xl", label: "text-base" },
    };

    const radius = size === "sm" ? 24 : size === "md" ? 36 : 48;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (displayScore / 100) * circumference;

    return (
      <div ref={ref} className={cn("flex flex-col items-center gap-2", className)}>
        <div className={cn("relative", sizeClasses[size].container)}>
          <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${radius * 2 + 8} ${radius * 2 + 8}`}>
            {/* Background circle */}
            <circle
              cx={radius + 4}
              cy={radius + 4}
              r={radius}
              fill="none"
              className="stroke-muted"
              strokeWidth="4"
            />
            {/* Progress circle */}
            <circle
              cx={radius + 4}
              cy={radius + 4}
              r={radius}
              fill="none"
              className={cn(getScoreRingColor(displayScore), "transition-all duration-300")}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: animated ? "stroke-dashoffset 0.3s ease-out" : "none" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn(sizeClasses[size].text, "font-bold", getScoreColor(displayScore))}>
              {displayScore}%
            </span>
          </div>
        </div>

        {label && (
          <span className={cn(sizeClasses[size].label, "text-muted-foreground font-medium")}>
            {label}
          </span>
        )}

        {showBar && (
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", getScoreBarColor(displayScore))}
              style={{ width: `${displayScore}%` }}
            />
          </div>
        )}
      </div>
    );
  }
);

ScoreDisplay.displayName = "ScoreDisplay";

export { ScoreDisplay };
