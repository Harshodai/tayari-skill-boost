import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Linkedin,
  ArrowRight,
  ArrowLeft,
  Target,
  Briefcase,
  TrendingUp,
  Compass,
  Sparkles,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Goal = "find_job" | "get_promoted" | "switch_careers" | "exploring";

const GOALS: { id: Goal; title: string; desc: string; icon: React.ElementType }[] = [
  { id: "find_job", title: "Find a new job", desc: "Search, apply, and interview-prep at scale", icon: Briefcase },
  { id: "get_promoted", title: "Get promoted", desc: "Grow into the next role at your company", icon: TrendingUp },
  { id: "switch_careers", title: "Switch careers", desc: "Bridge your skills into a new field", icon: Target },
  { id: "exploring", title: "Just exploring", desc: "Build a profile and see what's possible", icon: Compass },
];

const ROLE_SUGGESTIONS = [
  "Software Engineer",
  "Senior Software Engineer",
  "Product Manager",
  "Senior Product Manager",
  "Data Scientist",
  "Data Engineer",
  "Designer",
  "UX Designer",
  "Engineering Manager",
  "DevOps Engineer",
  "Marketing Manager",
  "Frontend Engineer",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [linkedin, setLinkedin] = useState("");
  const [goal, setGoal] = useState<Goal | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState("");

  const filteredSuggestions = ROLE_SUGGESTIONS.filter(
    (r) => !roles.includes(r) && r.toLowerCase().includes(roleInput.toLowerCase())
  ).slice(0, 6);

  const addRole = (r: string) => {
    const trimmed = r.trim();
    if (!trimmed || roles.includes(trimmed) || roles.length >= 3) return;
    setRoles([...roles, trimmed]);
    setRoleInput("");
  };

  const finish = () => {
    try {
      localStorage.setItem(
        "tayari_onboarding",
        JSON.stringify({ goal, roles, hasResume: !!file || !!linkedin, completedAt: Date.now() })
      );
    } catch {
      // localStorage may be unavailable (private mode, storage quota); onboarding
      // is best-effort and re-offered next time.
    }
    navigate("/dashboard");
  };

  const canNext =
    (step === 1 && (file || linkedin || true)) || // step 1 always skippable
    (step === 2 && !!goal) ||
    (step === 3 && roles.length > 0);

  return (
    <Layout showFooter={false}>
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border transition-colors",
                  step >= s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border"
                )}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    "h-px flex-1 mx-2 transition-colors",
                    step > s ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <Card className="border-border/60">
          <CardContent className="p-8">
            {step === 1 && (
              <div>
                <h1 className="text-2xl font-bold mb-1">Bring in your resume</h1>
                <p className="text-muted-foreground text-sm mb-6">
                  We'll parse it once and use it everywhere — search, optimizer, interview prep.
                </p>

                <label
                  className={cn(
                    "block rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
                    file ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"
                  )}
                >
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <Upload className="w-7 h-7 mx-auto mb-3 text-primary" />
                  <p className="font-medium">
                    {file ? file.name : "Drop your resume here"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PDF or DOCX, up to 10MB</p>
                </label>

                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="relative">
                  <Linkedin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="linkedin.com/in/yourname"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h1 className="text-2xl font-bold mb-1">What's your goal?</h1>
                <p className="text-muted-foreground text-sm mb-6">
                  We'll tailor your workspace around it.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {GOALS.map((g) => {
                    const Icon = g.icon;
                    const selected = goal === g.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => setGoal(g.id)}
                        className={cn(
                          "text-left p-4 rounded-lg border-2 transition-all",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-5 h-5 mb-3",
                            selected ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                        <p className="font-semibold text-sm">{g.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{g.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h1 className="text-2xl font-bold mb-1">Pick up to 3 target roles</h1>
                <p className="text-muted-foreground text-sm mb-6">
                  Seeds your Smart Search and Roadmap right away.
                </p>

                {roles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {roles.map((r) => (
                      <Badge
                        key={r}
                        variant="secondary"
                        className="pl-3 pr-1.5 py-1.5 gap-1 text-sm"
                      >
                        {r}
                        <button
                          onClick={() => setRoles(roles.filter((x) => x !== r))}
                          className="ml-1 hover:bg-muted rounded p-0.5"
                          aria-label={`Remove ${r}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <Input
                  placeholder={roles.length >= 3 ? "Maximum 3 roles" : "e.g. Senior Product Manager"}
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRole(roleInput)}
                  disabled={roles.length >= 3}
                />

                {roleInput && filteredSuggestions.length > 0 && roles.length < 3 && (
                  <div className="mt-2 rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
                    {filteredSuggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => addRole(s)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {!roleInput && roles.length < 3 && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground mb-2">Popular:</p>
                    <div className="flex flex-wrap gap-2">
                      {ROLE_SUGGESTIONS.slice(0, 6).map((r) => (
                        <button
                          key={r}
                          onClick={() => addRole(r)}
                          className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-accent transition-colors"
                        >
                          + {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/60">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (step === 1 ? finish() : setStep(step - 1))}
              >
                {step === 1 ? (
                  "Skip for now"
                ) : (
                  <>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </>
                )}
              </Button>
              <div className="flex items-center gap-2">
                {step > 1 && (
                  <Button variant="ghost" size="sm" onClick={finish}>
                    Skip
                  </Button>
                )}
                {step < 3 ? (
                  <Button
                    onClick={() => setStep(step + 1)}
                    disabled={!canNext}
                  >
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={finish} variant="glow">
                    <Sparkles className="w-4 h-4 mr-2" /> Enter Tayari
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Step {step} of 3 · You can change everything later in Profile.
        </p>
      </div>
    </Layout>
  );
}
