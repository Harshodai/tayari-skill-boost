import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, updateProfile, ApiError } from "@/api";
import { isBackendUnavailable } from "@/api/client";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STEP_LABELS = ["Your track", "Your targets", "Review & finish"] as const;
import {
  Briefcase,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  GitBranch,
  Layers,
  ArrowRightLeft,
  AlertTriangle,
  AlertCircle,
  HardDrive,
  WifiOff,
  Check,
} from "lucide-react";

export type TransitionType = "same_domain" | "cross_domain";

const STORAGE_DRAFT_KEY = "tayari_onboarding_draft";
const STORAGE_COMPLETED_KEY = "tayari_onboarding";

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isGatewayOffline, setIsGatewayOffline] = useState(false);
  const [transitionType, setTransitionType] = useState<TransitionType>("same_domain");
  const [currentTitle, setCurrentTitle] = useState("");
  const [targetLevel, setTargetLevel] = useState("");
  const [currentIndustry, setCurrentIndustry] = useState("");
  const [targetIndustry, setTargetIndustry] = useState("");
  const [transferableSkills, setTransferableSkills] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [hydration, setHydration] = useState<
    "pending" | "empty" | "loaded" | "error" | "unavailable"
  >("pending");
  const [retryHydration, setRetryHydration] = useState(0);

  // Restore draft from localStorage immediately on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(STORAGE_DRAFT_KEY) || localStorage.getItem(STORAGE_COMPLETED_KEY);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        if (draft.transitionType) setTransitionType(draft.transitionType);
        if (draft.currentTitle) setCurrentTitle(draft.currentTitle);
        if (draft.targetLevel) setTargetLevel(draft.targetLevel);
        if (draft.currentIndustry) setCurrentIndustry(draft.currentIndustry);
        if (draft.targetIndustry) setTargetIndustry(draft.targetIndustry);
        if (Array.isArray(draft.transferableSkills) && draft.transferableSkills.length > 0) {
          setTransferableSkills(draft.transferableSkills);
        }
      }
    } catch {
      // Local storage unavailable or unparseable
    }
  }, []);

  // Hydrate from canonical backend profile if reachable
  useEffect(() => {
    setHydration("pending");
    getProfile()
      .then((profile) => {
        const hasCareerFields =
          profile.transition_type ||
          profile.current_title ||
          profile.target_level ||
          profile.current_industry ||
          profile.target_industry ||
          (profile.transferable_skills?.length ?? 0) > 0;
        if (!hasCareerFields) {
          setHydration("empty");
          return;
        }
        setTransitionType((profile.transition_type as TransitionType) ?? "same_domain");
        if (profile.current_title) setCurrentTitle(profile.current_title);
        if (profile.target_level) setTargetLevel(profile.target_level);
        if (profile.current_industry) setCurrentIndustry(profile.current_industry);
        if (profile.target_industry) setTargetIndustry(profile.target_industry);
        if (profile.transferable_skills?.length) setTransferableSkills(profile.transferable_skills);
        setHydration("loaded");
        setIsGatewayOffline(false);
      })
      .catch((err) => {
        const isOffline = isBackendUnavailable(err) || err?.status === 502 || err?.status === 503;
        if (isOffline) {
          setIsGatewayOffline(true);
          setHydration("unavailable");
        } else {
          setHydration("error");
        }
      });
  }, [retryHydration]);

  // Auto-save draft changes to localStorage for offline drafting
  useEffect(() => {
    const draftPayload = {
      transitionType,
      currentTitle,
      targetLevel,
      currentIndustry,
      targetIndustry,
      transferableSkills,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(draftPayload));
    } catch {
      // Storage unavailable
    }
  }, [transitionType, currentTitle, targetLevel, currentIndustry, targetIndustry, transferableSkills]);

  const savedFieldsList = useMemo(() => {
    const list: string[] = [];
    if (transitionType) {
      list.push(transitionType === "same_domain" ? "✓ Career Track (Same Domain)" : "✓ Career Track (Cross-Domain)");
    }
    if (currentTitle.trim()) {
      list.push(`✓ Baseline Title: ${currentTitle.trim()}`);
    }
    if (targetLevel.trim()) {
      list.push(`✓ Target Level: ${targetLevel.trim()}`);
    }
    if (currentIndustry.trim()) {
      list.push(`✓ Current Industry: ${currentIndustry.trim()}`);
    }
    if (targetIndustry.trim()) {
      list.push(`✓ Target Industry: ${targetIndustry.trim()}`);
    }
    if (transferableSkills.length > 0) {
      list.push(`✓ Skills (${transferableSkills.length} saved)`);
    }
    list.push("✓ Career Goal Strategy");
    return list;
  }, [transitionType, currentTitle, targetLevel, currentIndustry, targetIndustry, transferableSkills]);

  const handleAddSkill = () => {
    if (!newSkillInput.trim()) return;
    if (!transferableSkills.includes(newSkillInput.trim())) {
      setTransferableSkills([...transferableSkills, newSkillInput.trim()]);
    }
    setNewSkillInput("");
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setTransferableSkills(transferableSkills.filter((s) => s !== skillToRemove));
  };

  const finish = async () => {
    setValidationError(null);

    const payload = {
      transitionType,
      currentTitle,
      targetLevel,
      currentIndustry,
      targetIndustry,
      transferableSkills,
      completedAt: new Date().toISOString(),
    };

    // Store in localStorage immediately
    try {
      localStorage.setItem(STORAGE_COMPLETED_KEY, JSON.stringify(payload));
      localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // storage unavailable
    }

    try {
      await updateProfile({
        transition_type: transitionType,
        current_title: currentTitle,
        target_level: targetLevel,
        current_industry: currentIndustry,
        target_industry: targetIndustry,
        transferable_skills: transferableSkills,
      });
      setIsGatewayOffline(false);
    } catch (err: any) {
      const isOutage =
        isBackendUnavailable(err) ||
        err?.status === 502 ||
        err?.status === 503 ||
        err?.status === 504 ||
        err?.message?.includes("network") ||
        err?.message?.includes("fetch");

      if (isOutage) {
        // Recoverable gateway outage: active local mode with localStorage progress
        setIsGatewayOffline(true);
        setValidationError(null);
      } else if (err instanceof ApiError && (err.status === 400 || err.status === 422)) {
        // Profile validation error
        setIsGatewayOffline(false);
        setValidationError(err.message || "Profile validation error. Please check your inputs.");
        return;
      } else {
        // Other unexpected error
        setValidationError(err.message || "Could not save profile. Please verify your details.");
        return;
      }
    }

    // Best-effort Supabase sync
    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (userId) {
        const { data: prefs } = await supabase
          .from("pet_preferences")
          .select("state")
          .eq("user_id", userId)
          .maybeSingle();
        const state = (prefs?.state as Record<string, unknown>) ?? {};
        await supabase
          .from("pet_preferences")
          .upsert({ user_id: userId, state: { ...state, onboarding: payload } });
      }
    } catch {
      // Best effort
    }

    navigate("/dashboard");
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8 text-foreground font-sans">
        {/* Wizard Progress */}
        <div className="space-y-4 border-b border-border pb-5">
          <div className="flex justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg text-primary-foreground font-bold tabular-nums">{step}</div>
              <div>
                <h1 className="text-xl font-bold">Set up your career plan</h1>
                <p className="text-xs text-muted-foreground">Three quick steps. You can skip anything and change it later.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isGatewayOffline && (
                <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning text-xs">
                  <WifiOff className="w-3 h-3 mr-1" aria-hidden="true" /> Local Mode
                </Badge>
              )}
              <Badge className="bg-primary/10 text-primary border-primary/30">
                Step {step} of 3
              </Badge>
            </div>
          </div>

          {/* Animated step rail */}
          <ol className="flex items-center gap-2" aria-label="Onboarding progress">
            {STEP_LABELS.map((label, i) => {
              const index = i + 1;
              const state = index < step ? "done" : index === step ? "current" : "upcoming";
              return (
                <li key={label} className="flex-1">
                  <div
                    aria-current={state === "current" ? "step" : undefined}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-all duration-300",
                        state === "done" && "border-success bg-success text-success-foreground scale-100",
                        state === "current" && "border-primary bg-primary text-primary-foreground scale-110 shadow-sm",
                        state === "upcoming" && "border-border bg-muted text-muted-foreground"
                      )}
                    >
                      {state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index}
                    </span>
                    <span
                      className={cn(
                        "hidden text-xs font-medium transition-colors sm:inline",
                        state === "current" ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                      style={{ width: index < step ? "100%" : index === step ? "50%" : "0%" }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Gateway Outage Warning Banner (Recoverable 502/503/network) */}
        {isGatewayOffline && (
          <div
            data-testid="gateway-offline-banner"
            className="animate-fade-in p-4 rounded-xl border border-warning/40 bg-warning/10 text-foreground space-y-3"
          >
            <div className="flex items-start gap-3">
              <HardDrive className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <h3 className="font-semibold text-sm">
                  Backend Gateway Offline — Local Mode Active. Your progress is saved locally in your browser storage and will auto-sync when connection restores.
                </h3>
                <p className="text-xs text-muted-foreground">
                  You can safely keep going. Nothing you type will be lost.
                </p>
              </div>
            </div>

            {/* Saved Fields List */}
            <div className="pt-2 border-t border-warning/20">
              <p className="text-xs font-medium mb-1.5">Saved locally:</p>
              <div data-testid="saved-fields-list" className="flex flex-wrap gap-1.5">
                {savedFieldsList.map((field, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center text-[11px] bg-warning/15 border border-warning/30 text-foreground px-2 py-0.5 rounded font-mono"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Profile Validation Error Banner (400/422) */}
        {validationError && (
          <div
            role="alert"
            data-testid="validation-error-banner"
            className="animate-scale-in p-4 rounded-xl border border-destructive/40 bg-destructive/10 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-sm text-foreground">Profile Validation Error</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{validationError}</p>
            </div>
          </div>
        )}


        {/* Step 1: Branch Selector */}
        {step === 1 && (
          <Card key="step-1" className="animate-fade-in bg-card border-border text-foreground p-6 space-y-6">
            <CardHeader className="p-0 space-y-2">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <GitBranch className="w-6 h-6 text-primary" /> Select Your Career Transition Track
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Choose the transition path that matches your current goal to customize agent algorithms.
              </CardDescription>
            </CardHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              {/* Branch 1: Same Domain */}
              <div
                data-testid="track-same-domain"
                onClick={() => setTransitionType("same_domain")}
                className={`p-6 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-4 ${
                  transitionType === "same_domain"
                    ? "bg-primary/10 border-primary shadow-lg shadow-primary/20"
                    : "bg-card border-border hover:border-border"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Briefcase className="w-8 h-8 text-primary" />
                    {transitionType === "same_domain" && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Job Change (Same Domain)</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Optimize for title promotion or senior level advancement in your existing functional domain.
                  </p>
                </div>
                <Badge className="w-max bg-primary/10 text-primary">Level Advancement</Badge>
              </div>

              {/* Branch 2: Cross-Domain */}
              <div
                data-testid="track-cross-domain"
                onClick={() => setTransitionType("cross_domain")}
                className={`p-6 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-4 ${
                  transitionType === "cross_domain"
                    ? "bg-accent/10 border-accent shadow-lg shadow-accent/20"
                    : "bg-card border-border hover:border-border"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <ArrowRightLeft className="w-8 h-8 text-accent" />
                    {transitionType === "cross_domain" && <CheckCircle2 className="w-5 h-5 text-accent" />}
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Domain Change (Cross-Industry)</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Pivot to a new industry or domain using transferable technical competencies and skill-gap translation.
                  </p>
                </div>
                <Badge className="w-max bg-accent/10 text-accent">Skill-Gap Translation</Badge>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={() => setStep(2)} className="bg-primary hover:bg-primary/90 font-semibold px-6">
                Next: Role Configuration <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Track Customization */}
        {step === 2 && (
          <Card key="step-2" className="animate-fade-in bg-card border-border text-foreground p-6 space-y-6">
            <CardHeader className="p-0 space-y-2">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                {transitionType === "same_domain" ? (
                  <>
                    <Briefcase className="w-6 h-6 text-primary" /> Current Title Alignment & Target Level
                  </>
                ) : (
                  <>
                    <Layers className="w-6 h-6 text-accent" /> Skill-Gap Translation & Transferable Competencies
                  </>
                )}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {transitionType === "same_domain"
                  ? "Define your current baseline and target level for maximum ATS match scoring."
                  : "Translate your transferable competencies across industry boundaries."}
              </CardDescription>
            </CardHeader>

            {transitionType === "same_domain" ? (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Current Title Baseline</label>
                    <Input
                      data-testid="input-current-title"
                      placeholder="e.g. Senior Software Engineer"
                      value={currentTitle}
                      onChange={(e) => setCurrentTitle(e.target.value)}
                      className="bg-card border-border text-foreground text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Target Level Advancement</label>
                    <Input
                      data-testid="input-target-level"
                      placeholder="e.g. Staff Engineer / Tech Lead"
                      value={targetLevel}
                      onChange={(e) => setTargetLevel(e.target.value)}
                      className="bg-card border-border text-foreground text-sm"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Current Industry</label>
                    <Input
                      data-testid="input-current-industry"
                      placeholder="e.g. Traditional Banking / Finance"
                      value={currentIndustry}
                      onChange={(e) => setCurrentIndustry(e.target.value)}
                      className="bg-card border-border text-foreground text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Target New Industry</label>
                    <Input
                      data-testid="input-target-industry"
                      placeholder="e.g. AI / Cloud Infrastructure"
                      value={targetIndustry}
                      onChange={(e) => setTargetIndustry(e.target.value)}
                      className="bg-card border-border text-foreground text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Skills management */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Transferable Skills & Competencies</label>
              <div className="flex gap-2">
                <Input
                  data-testid="input-skill"
                  placeholder="Add skill (e.g. TypeScript, Distributed Systems, Go)"
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  className="bg-card border-border text-foreground text-sm"
                />
                <Button type="button" size="sm" onClick={handleAddSkill} variant="secondary">
                  Add
                </Button>
              </div>

              <div className="p-4 bg-card rounded-lg border border-border space-y-2">
                <div className="flex flex-wrap gap-2">
                  {transferableSkills.length > 0 ? (
                    transferableSkills.map((sk, i) => (
                      <Badge
                        key={i}
                        className="bg-primary/10 text-primary border border-primary/30 flex items-center gap-1 cursor-pointer"
                        onClick={() => handleRemoveSkill(sk)}
                      >
                        {sk} <span className="text-xs ml-1 hover:text-red-400">×</span>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No skills added yet</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button onClick={() => setStep(1)} variant="outline" className="border-border text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="bg-primary hover:bg-primary/90 font-semibold px-6">
                Next: Review & Launch <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Complete & Launch */}
        {step === 3 && (
          <Card key="step-3" className="animate-fade-in bg-card border-border text-foreground p-6 space-y-6 text-center">
            <div className="p-4 bg-primary/10 w-max mx-auto rounded-full text-primary">
              <Sparkles className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Onboarding Configuration Complete</h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Your agentic career operations pipeline is configured for{" "}
                <span className="text-primary font-bold">
                  {transitionType === "same_domain" ? "Same Domain Level Advancement" : "Cross-Industry Domain Pivot"}
                </span>.
              </p>
            </div>

            {/* Saved fields preview */}
            <div className="max-w-md mx-auto p-4 rounded-lg bg-card border border-border text-left space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Configured Profile Summary</p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Track: <strong>{transitionType === "same_domain" ? "Same Domain" : "Cross-Industry Pivot"}</strong></li>
                {currentTitle && <li>• Baseline Title: <strong>{currentTitle}</strong></li>}
                {targetLevel && <li>• Target Level: <strong>{targetLevel}</strong></li>}
                {currentIndustry && <li>• Current Industry: <strong>{currentIndustry}</strong></li>}
                {targetIndustry && <li>• Target Industry: <strong>{targetIndustry}</strong></li>}
                {transferableSkills.length > 0 && (
                  <li>• Transferable Skills: <strong>{transferableSkills.join(", ")}</strong></li>
                )}
              </ul>
            </div>

            <div className="flex justify-center gap-4 pt-4">
              {hydration === "error" && (
                <Button
                  onClick={() => setRetryHydration((n) => n + 1)}
                  variant="outline"
                  className="border-border text-muted-foreground"
                >
                  Retry
                </Button>
              )}
              <Button onClick={() => setStep(2)} variant="outline" className="border-border text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                data-testid="launch-dashboard-button"
                onClick={finish}
                disabled={hydration === "pending"}
                className="bg-success hover:bg-success font-bold px-8"
              >
                Launch Career Dashboard <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
