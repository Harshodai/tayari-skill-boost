import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const BACKEND_UNAVAILABLE_MESSAGE =
  "Tracking works without the backend. Everything AI — resume optimization, the browser agent, autopilot, and AI analysis — needs the local Tayari engine. Self-host with `docker compose --profile dev up -d --build` or connect to a deployed backend.";

const FEATURE_LABELS: Record<string, string> = {
  autopilot: "AutoPilot",
  "resume optimizer": "Resume Optimizer",
  "knowledge hub": "Omnisave Knowledge Hub",
  "job search": "Smart Job Search",
  dashboard: "Dashboard AI features",
};

export interface BackendUnavailableBannerProps {
  feature?: keyof typeof FEATURE_LABELS | string;
  className?: string;
  variant?: "inline" | "full";
}

export function BackendUnavailableBanner({
  feature,
  className,
  variant = "inline",
}: BackendUnavailableBannerProps) {
  const featureLabel = feature ? FEATURE_LABELS[feature] ?? feature : null;
  return (
    <Card
      className={cn(
        "border-amber-500/40 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100",
        variant === "full" && "w-full",
        className
      )}
      role="alert"
    >
      <CardContent className="p-5 sm:p-6 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5 min-w-0">
            <p className="font-semibold text-sm sm:text-base">
              {featureLabel ? `${featureLabel} needs the local Tayari engine` : "Advanced features need the local Tayari engine"}
            </p>
            <p className="text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/90">
              {BACKEND_UNAVAILABLE_MESSAGE}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default BackendUnavailableBanner;