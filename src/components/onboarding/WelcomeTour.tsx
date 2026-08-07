import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Upload, Zap, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutomation } from "@/contexts/AutomationContext";

const TOUR_KEY = "tayari_tour_v1";

const STEPS = [
  {
    icon: Search,
    title: "Find roles that actually fit",
    body: "Smart Search ranks every result against your profile, so you see a match score before you spend a minute reading a JD.",
    action: "Show me Smart Search",
    href: "/jobs",
  },
  {
    icon: Upload,
    title: "Bring in your resume once",
    body: "Upload a PDF or DOCX. We parse it once and reuse it for tailoring, ATS scoring, cover letters and interview prep.",
    action: "Upload my resume",
    href: "/resume",
  },
  {
    icon: Zap,
    title: "Run your first AutoPilot",
    body: "One click saves the job, tailors your resume to the JD, drafts a cover letter, and tracks it in your pipeline — you approve every step.",
    action: "Start my first apply",
    href: "/jobs",
  },
] as const;

export function WelcomeTour({ forceOpen = false }: { forceOpen?: boolean }) {
  const navigate = useNavigate();
  const { startRun, open: openActivity } = useAutomation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      return;
    }
    try {
      if (!localStorage.getItem(TOUR_KEY)) setOpen(true);
    } catch {
      /* storage blocked — skip the tour */
    }
  }, [forceOpen]);

  const dismiss = () => {
    try {
      localStorage.setItem(TOUR_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const go = () => {
    dismiss();
    if (isLast) {
      // Kick off a walkthrough run so the user can see what an assisted
      // apply looks like in the Activity drawer before committing to one.
      startRun({
        title: "AutoPilot walkthrough",
        context: "Guided tour",
        steps: [
          "Save the job to your pipeline",
          "Tailor your resume to the JD",
          "Draft a matching cover letter",
          "Track it in Pipeline → Applied",
        ],
      });
      openActivity();
    }
    navigate(current.href);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <DialogTitle className="text-xl">{current.title}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">
          {current.body}
        </DialogDescription>

        <div className="flex items-center gap-1.5 mt-4">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-border"
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 mt-4">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Skip tour
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={go}>
              {current.action}
            </Button>
            {!isLast ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={dismiss}>
                <Check className="w-4 h-4 mr-1" /> Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WelcomeTour;
