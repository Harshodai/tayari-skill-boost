import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, updateProfile } from "@/api";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  ArrowRight,
  ArrowLeft,
  Target,
  Sparkles,
  CheckCircle2,
  GitBranch,
  Layers,
  ArrowRightLeft
} from "lucide-react";

type TransitionType = "same_domain" | "cross_domain";

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [transitionType, setTransitionType] = useState<TransitionType>("same_domain");
  const [currentTitle, setCurrentTitle] = useState("");
  const [targetLevel, setTargetLevel] = useState("");
  const [currentIndustry, setCurrentIndustry] = useState("");
  const [targetIndustry, setTargetIndustry] = useState("");
  const [transferableSkills, setTransferableSkills] = useState<string[]>([]);
  const [hydration, setHydration] = useState<
    "pending" | "empty" | "loaded" | "error" | "unavailable"
  >("pending");
  const [retryHydration, setRetryHydration] = useState(0);

  // ponytail: hydrate from the canonical profile so re-running onboarding
  // doesn't clobber saved values with defaults.
  // ponytail: GET /v1/profile returns 200 with the fallback empty profile on
  // BOTH a missing row and a DB error (backend/go/internal/api/routes_mvp.go
  // handleGetProfile) — so "no profile exists" is only distinguishable by the
  // empty career fields, never by HTTP status. A fetch/network failure must
  // not be treated as "new user", or the empty defaults would overwrite a
  // real saved profile.
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
      })
      .catch(() => {
        setHydration("error");
      });
  }, [retryHydration]);

  const finish = async () => {
    // ponytail: never submit before hydration settles, and never treat a
    // fetch failure as "no profile exists" — the fallback empty profile (200
    // on no-row) is the only signal that a fresh write is safe.
    if (hydration === "pending") {
      setSaveError("Loading your profile — try again in a moment.");
      return;
    }
    if (hydration === "error") {
      setSaveError("Couldn't load your profile — retry.");
      return;
    }
    const payload = {
      transitionType,
      currentTitle,
      targetLevel,
      currentIndustry,
      targetIndustry,
      transferableSkills,
      completedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("tayari_onboarding", JSON.stringify(payload));
    } catch {
      /* storage unavailable — continue */
    }
    // ponytail: persist the career goal in the canonical public.profiles table
    // (P0 audit fix Q3); pet_preferences mirror below stays as secondary storage.
    // ponytail: a silent profile-write failure would drop the career goal the
    // user just set — surface it and let them retry.
    try {
      await updateProfile({
        transition_type: transitionType,
        current_title: currentTitle,
        target_level: targetLevel,
        current_industry: currentIndustry,
        target_industry: targetIndustry,
        transferable_skills: transferableSkills,
      });
    } catch {
      setSaveError("Failed to save your career goal. Please try again.");
      return;
    }
    setSaveError(null);
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
      /* best effort — never block the user */
    }
    navigate("/dashboard");
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8 text-slate-100 font-sans">
        {/* Wizard Progress */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white font-bold">1</div>
            <div>
              <h1 className="text-xl font-bold">Branching Onboarding Wizard</h1>
              <p className="text-xs text-slate-400">Configure your personal agentic career operations strategy</p>
            </div>
          </div>
          <Badge className="bg-indigo-950 text-indigo-300 border-indigo-800">
            Step {step} of 3
          </Badge>
        </div>

        {/* Step 1: Branch Selector */}
        {step === 1 && (
          <Card className="bg-slate-900 border-slate-800 text-slate-100 p-6 space-y-6">
            <CardHeader className="p-0 space-y-2">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <GitBranch className="w-6 h-6 text-indigo-400" /> Select Your Career Transition Track
              </CardTitle>
              <CardDescription className="text-slate-400">
                Choose the transition path that matches your current goal to customize agent algorithms.
              </CardDescription>
            </CardHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              {/* Branch 1: Same Domain */}
              <div
                onClick={() => setTransitionType("same_domain")}
                className={`p-6 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-4 ${
                  transitionType === "same_domain"
                    ? "bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-950/50"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Briefcase className="w-8 h-8 text-indigo-400" />
                    {transitionType === "same_domain" && <CheckCircle2 className="w-5 h-5 text-indigo-400" />}
                  </div>
                  <h3 className="text-lg font-bold text-slate-100">Job Change (Same Domain)</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Optimize for title promotion or senior level advancement in your existing functional domain.
                  </p>
                </div>
                <Badge className="w-max bg-indigo-950 text-indigo-300">Level Advancement</Badge>
              </div>

              {/* Branch 2: Cross-Domain */}
              <div
                onClick={() => setTransitionType("cross_domain")}
                className={`p-6 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-4 ${
                  transitionType === "cross_domain"
                    ? "bg-purple-950/40 border-purple-500 shadow-lg shadow-purple-950/50"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <ArrowRightLeft className="w-8 h-8 text-purple-400" />
                    {transitionType === "cross_domain" && <CheckCircle2 className="w-5 h-5 text-purple-400" />}
                  </div>
                  <h3 className="text-lg font-bold text-slate-100">Domain Change (Cross-Industry)</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Pivot to a new industry or domain using transferable technical competencies and skill-gap translation.
                  </p>
                </div>
                <Badge className="w-max bg-purple-950 text-purple-300">Skill-Gap Translation</Badge>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={() => setStep(2)} className="bg-indigo-600 hover:bg-indigo-500 font-semibold px-6">
                Next: Role Configuration <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Track Customization */}
        {step === 2 && (
          <Card className="bg-slate-900 border-slate-800 text-slate-100 p-6 space-y-6">
            <CardHeader className="p-0 space-y-2">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                {transitionType === "same_domain" ? (
                  <>
                    <Briefcase className="w-6 h-6 text-indigo-400" /> Current Title Alignment & Target Level
                  </>
                ) : (
                  <>
                    <Layers className="w-6 h-6 text-purple-400" /> Skill-Gap Translation & Transferable Competencies
                  </>
                )}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {transitionType === "same_domain"
                  ? "Define your current baseline and target level for maximum ATS match scoring."
                  : "Translate your transferable competencies across industry boundaries."}
              </CardDescription>
            </CardHeader>

            {transitionType === "same_domain" ? (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Current Title Baseline</label>
                    <Input
                      value={currentTitle}
                      onChange={(e) => setCurrentTitle(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-100 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Target Level Advancement</label>
                    <Input
                      value={targetLevel}
                      onChange={(e) => setTargetLevel(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-100 text-sm"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Current Industry</label>
                    <Input
                      value={currentIndustry}
                      onChange={(e) => setCurrentIndustry(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-100 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Target New Industry</label>
                    <Input
                      value={targetIndustry}
                      onChange={(e) => setTargetIndustry(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-100 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Transferable Technical Competencies Preview</label>
                  <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {transferableSkills.length > 0 ? (
                        transferableSkills.map((sk, i) => (
                          <Badge key={i} className="bg-purple-950 text-purple-300 border border-purple-800">
                            {sk}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">No skills added yet</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button onClick={() => setStep(1)} variant="outline" className="border-slate-800 text-slate-300">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="bg-indigo-600 hover:bg-indigo-500 font-semibold px-6">
                Next: Review & Launch <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Complete & Launch */}
        {step === 3 && (
          <Card className="bg-slate-900 border-slate-800 text-slate-100 p-6 space-y-6 text-center">
            <div className="p-4 bg-indigo-950/50 w-max mx-auto rounded-full text-indigo-400">
              <Sparkles className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Onboarding Configuration Complete</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Your agentic career operations pipeline is configured for{" "}
                <span className="text-indigo-400 font-bold">
                  {transitionType === "same_domain" ? "Same Domain Level Advancement" : "Cross-Industry Domain Pivot"}
                </span>.
              </p>
            </div>

            {saveError && (
              <p className="text-red-400 text-sm bg-red-950/40 border border-red-500/30 rounded-lg px-4 py-3">
                {saveError}
              </p>
            )}

            <div className="flex justify-center gap-4 pt-4">
              {hydration === "error" && (
                <Button
                  onClick={() => setRetryHydration((n) => n + 1)}
                  variant="outline"
                  className="border-slate-800 text-slate-300"
                >
                  Retry
                </Button>
              )}
              <Button onClick={() => setStep(2)} variant="outline" className="border-slate-800 text-slate-300">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                onClick={finish}
                disabled={hydration === "pending"}
                className="bg-emerald-600 hover:bg-emerald-500 font-bold px-8"
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
