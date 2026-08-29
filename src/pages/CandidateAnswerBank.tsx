import React, { useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldCheck, Zap, Database, CheckCircle2, AlertCircle, Search, Download, Upload, RefreshCw, Lock } from "lucide-react";
import { fetchCandidateAnswers, matchCandidateBank, saveCandidateAnswers } from "@/api";
import { toast } from "sonner";

const PRESET_TEST_QUESTIONS = [
  "Are you legally authorized to work in the United States?",
  "Will you now or in the future require visa sponsorship?",
  "What are your base salary expectations for this position?",
  "What is your earliest possible start date or notice period?",
  "Are you comfortable working in a hybrid or remote setup?",
];

export default function CandidateAnswerBank() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoadingAnswers, setIsLoadingAnswers] = useState(true);
  const [answersError, setAnswersError] = useState<string | null>(null);
  const [isSavingAnswers, setIsSavingAnswers] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetchCandidateAnswers()
      .then((data) => {
        if (active && data && typeof data === "object") {
          const values = data.answers && typeof data.answers === "object" ? data.answers : {};
          setAnswers(
            Object.fromEntries(
              Object.entries(values).map(([key, value]) => [key, value == null ? "" : String(value)])
            )
          );
        }
      })
      .catch((err: Error) => {
        if (!active) return;
        setAnswersError(err.message || "Could not load your candidate answers.");
        toast.error(err.message || "Could not load your candidate answers.");
      })
      .finally(() => {
        if (active) setIsLoadingAnswers(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Tester state
  const [testQuestion, setTestQuestion] = useState(PRESET_TEST_QUESTIONS[0]);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [isMatching, setIsMatching] = useState(false);

  const handleSaveAnswers = async () => {
    setIsSavingAnswers(true);
    setSaveError(null);
    try {
      await saveCandidateAnswers(answers);
      toast.success("Answers saved to your private answer bank. They still require application-specific confirmation before submission.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not save your candidate answers.";
      setSaveError(message);
      toast.error(message);
    } finally {
      setIsSavingAnswers(false);
    }
  };

  const handleTestMatch = async () => {
    if (!testQuestion.trim()) return;
    setIsMatching(true);
    try {
      const res = await matchCandidateBank(testQuestion);
      setMatchResult(res);
      toast.success(res.matched ? `Matched category: ${res.category}` : "No direct match, will use LLM fallback.");
    } catch (err: any) {
      toast.error(err.message || "Could not query candidate answer bank");
    } finally {
      setIsMatching(false);
    }
  };

  const exportAnswersJson = () => {
    const blob = new Blob([JSON.stringify(answers, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candidate_answer_bank_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Answer bank exported as JSON");
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (typeof parsed === "object" && parsed !== null) {
          setAnswers((prev) => ({ ...prev, ...parsed }));
          toast.success("Answers imported from JSON. Click Save to persist.");
        }
      } catch {
        toast.error("Invalid JSON file format");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AppShell>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-semibold px-3 py-1">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Deterministic Auto-Apply Safety
              </Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Candidate Answer QA Bank</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Store your explicit answers for standard ATS questions. Saved values are private profile data and still require application-specific confirmation before any submission.
            </p>
            {saveError && <div role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{saveError}</div>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportJson}
              accept="application/json"
              className="hidden"
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs">
              <Upload className="w-3.5 h-3.5 mr-1.5" /> Import JSON
            </Button>
            <Button variant="outline" size="sm" onClick={exportAnswersJson} className="text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export JSON
            </Button>
            <Button onClick={handleSaveAnswers} disabled={isLoadingAnswers || isSavingAnswers} size="sm" className="font-semibold shadow-md active:scale-[0.98]">
              {isSavingAnswers ? "Saving…" : "Save private answers"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Answers Form */}
          <div className="lg:col-span-2 space-y-6">
            {isLoadingAnswers && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">Loading your saved answers…</div>
            )}
            {answersError && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{answersError}</div>
            )}
            <Tabs defaultValue="legal" className="w-full" aria-disabled={isLoadingAnswers}>
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="legal">Work Auth & Legal</TabsTrigger>
                <TabsTrigger value="compensation">Salary & Notice</TabsTrigger>
                <TabsTrigger value="eeo">EEO & Demographics</TabsTrigger>
              </TabsList>

              {/* Work Auth */}
              <TabsContent value="legal">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Database className="w-5 h-5 text-primary" /> Work Authorization & Visa Status
                    </CardTitle>
                    <CardDescription>
                      Used for Greenhouse, Lever, and Workday citizenship/sponsorship checkboxes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="work_auth">US Work Authorization Status</Label>
                      <Input
                        id="work_auth"
                        placeholder="e.g. Authorized to work for any US employer"
                        value={answers.work_authorization ?? ""}
                        onChange={(e) => setAnswers({ ...answers, work_authorization: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sponsorship_ans">Visa Sponsorship Response</Label>
                      <Input
                        id="sponsorship_ans"
                        placeholder="e.g. No, I do not require visa sponsorship now or in the future"
                        value={answers.sponsorship_answer ?? ""}
                        onChange={(e) => setAnswers({ ...answers, sponsorship_answer: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Compensation */}
              <TabsContent value="compensation">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" /> Salary Expectations & Availability
                    </CardTitle>
                    <CardDescription>
                      Target compensation range and standard notice period for hiring managers.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sal_min">Minimum Base Salary ($)</Label>
                        <Input
                          id="sal_min"
                          type="number"
                          placeholder="e.g. 180000"
                          value={answers.target_salary_min ?? ""}
                          onChange={(e) => setAnswers({ ...answers, target_salary_min: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sal_max">Target Base Salary ($)</Label>
                        <Input
                          id="sal_max"
                          type="number"
                          placeholder="e.g. 230000"
                          value={answers.target_salary_max ?? ""}
                          onChange={(e) => setAnswers({ ...answers, target_salary_max: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sal_ans">Formatted Salary Response</Label>
                      <Input
                        id="sal_ans"
                        placeholder="e.g. $190,000 - $230,000 base DOE"
                        value={answers.salary_answer ?? ""}
                        onChange={(e) => setAnswers({ ...answers, salary_answer: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notice_ans">Notice Period / Earliest Start Date</Label>
                      <Input
                        id="notice_ans"
                        placeholder="e.g. 2 weeks notice upon signed offer"
                        value={answers.notice_period_answer ?? ""}
                        onChange={(e) => setAnswers({ ...answers, notice_period_answer: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* EEO */}
              <TabsContent value="eeo">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">EEO & Voluntary Self-Identification</CardTitle>
                    <CardDescription>
                      Pre-filled answers for US Equal Employment Opportunity demographic questions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender</Label>
                      <Input
                        id="gender"
                        placeholder="e.g. Male / Female / I decline to identify"
                        value={answers.gender ?? ""}
                        onChange={(e) => setAnswers({ ...answers, gender: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="race">Race / Ethnicity</Label>
                      <Input
                        id="race"
                        placeholder="e.g. Asian / White / I decline to identify"
                        value={answers.race_ethnicity ?? ""}
                        onChange={(e) => setAnswers({ ...answers, race_ethnicity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="veteran">Veteran Status</Label>
                      <Input
                        id="veteran"
                        placeholder="e.g. I am not a protected veteran / I decline to identify"
                        value={answers.veteran_status ?? ""}
                        onChange={(e) => setAnswers({ ...answers, veteran_status: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Tester Side Panel */}
          <div className="space-y-6">
            <Card className="border-primary/20 bg-primary/5 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="w-5 h-5 text-primary" /> Interactive QA Match Tester
                </CardTitle>
                <CardDescription>
                  Test how an ATS question label is parsed and answered by the Tayari Candidate Bank.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Presets */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono font-semibold text-muted-foreground">Preset Question Examples:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_TEST_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setTestQuestion(q);
                          setMatchResult(null);
                        }}
                        className="text-[10px] text-left p-1.5 rounded bg-background/80 border hover:border-primary/40 truncate max-w-full text-foreground/80"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label htmlFor="test_q">ATS Form Question</Label>
                  <Input
                    id="test_q"
                    placeholder="e.g. Will you require visa sponsorship?"
                    value={testQuestion}
                    onChange={(e) => setTestQuestion(e.target.value)}
                  />
                </div>
                <Button className="w-full font-semibold active:scale-[0.98]" onClick={handleTestMatch} disabled={isMatching}>
                  {isMatching ? "Testing Match..." : "Evaluate Answer Match"}
                </Button>

                {matchResult && (
                  <div className="p-4 rounded-lg bg-card border space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-muted-foreground">Match Status:</span>
                      {matchResult.matched ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Deterministic Match
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <AlertCircle className="w-3.5 h-3.5 mr-1" /> LLM Fallback Needed
                        </Badge>
                      )}
                    </div>
                    {matchResult.matched && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Category:</span>{" "}
                          <span className="font-mono text-primary font-bold">{matchResult.category}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Confidence:</span>{" "}
                          <span className="font-semibold">{(matchResult.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div className="pt-2 border-t mt-2">
                          <span className="text-muted-foreground block text-xs mb-1 font-mono">Pre-filled Response:</span>
                          <p className="font-medium bg-muted p-2 rounded text-xs">{matchResult.answer}</p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
