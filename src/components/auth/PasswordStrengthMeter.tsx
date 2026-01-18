import { useMemo } from "react";
import { Check, X, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { validatePassword, getPasswordFeedback } from "@/lib/password-validator";
import { Progress } from "@/components/ui/progress";

interface PasswordStrengthMeterProps {
  password: string;
  showRequirements?: boolean;
  className?: string;
}

export function PasswordStrengthMeter({ 
  password, 
  showRequirements = true,
  className 
}: PasswordStrengthMeterProps) {
  const result = useMemo(() => validatePassword(password), [password]);
  const feedback = useMemo(() => getPasswordFeedback(result), [result]);

  const levelColors = {
    weak: "bg-destructive",
    fair: "bg-warning",
    good: "bg-secondary",
    strong: "bg-success",
  };

  const levelIcons = {
    weak: ShieldAlert,
    fair: Shield,
    good: ShieldCheck,
    strong: ShieldCheck,
  };

  const LevelIcon = levelIcons[result.level];

  if (!password) return null;

  return (
    <div className={cn("space-y-3 animate-fade-in", className)}>
      {/* Strength Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LevelIcon className={cn(
              "w-4 h-4",
              result.level === 'weak' && "text-destructive",
              result.level === 'fair' && "text-warning",
              result.level === 'good' && "text-secondary",
              result.level === 'strong' && "text-success"
            )} />
            <span className="text-sm font-medium text-foreground capitalize">
              {result.level}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {result.score}%
          </span>
        </div>
        
        <div className="relative">
          <Progress 
            value={result.score} 
            className="h-2 bg-muted"
          />
          <div 
            className={cn(
              "absolute inset-0 h-2 rounded-full transition-all duration-500",
              levelColors[result.level]
            )}
            style={{ width: `${result.score}%` }}
          />
        </div>
        
        <p className="text-xs text-muted-foreground">
          {feedback}
        </p>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-1.5">
          {result.requirements.map((req) => (
            <div
              key={req.id}
              className={cn(
                "flex items-center gap-2 text-xs transition-all duration-200",
                req.met ? "text-success" : "text-muted-foreground"
              )}
            >
              {req.met ? (
                <Check className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <X className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
              )}
              <span className={cn(req.met && "line-through opacity-75")}>
                {req.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
