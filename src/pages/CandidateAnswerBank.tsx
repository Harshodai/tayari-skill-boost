import React, { useState } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldCheck, Zap, Database, CheckCircle2, AlertCircle, Search } from "lucide-react";
import { matchCandidateBank } from "@/api";
import { toast } from "sonner";

export default function CandidateAnswerBank() {
  // Default Candidate Answers
  const [answers, setAnswers] = useState({
    work_authorization: "Authorized to work in the US without restriction",
    requires_sponsorship: false,
    sponsorship_answer: "No, I do not require sponsorship now or in the future.",
    target_salary_min: "140000",
    target_salary_max: "180000",
    salary_answer: "$150,000 - $180,000 (negotiable based on total compensation)",
    notice_period_answer: "2 weeks",
    years_experience: "5",
    gender: "Decline to Self-Identify",
    race_ethnicity: "Decline to Self-Identify",
    veteran_status: "I am not a protected veteran",
    disability_status: "No, I do not have a disability",
  });

  // Tester state
  const [testQuestion, setTestQuestion] = useState("Are you legally authorized to work in the United States?");
  const [matchResult, setMatchResult] = useState<any>(null);
  const [isMatching, setIsMatching] = useState(false);

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
              Store canonical answers for standard ATS portal questions. The auto-apply workflow can reuse these approved answers, but review every generated response before sending it.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Answers Form */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="legal" className="w-full">
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
                        value={answers.work_authorization}
                        onChange={(e) => setAnswers({ ...answers, work_authorization: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sponsorship_ans">Visa Sponsorship Response</Label>
                      <Input
                        id="sponsorship_ans"
                        value={answers.sponsorship_answer}
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
                          value={answers.target_salary_min}
                          onChange={(e) => setAnswers({ ...answers, target_salary_min: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sal_max">Target Base Salary ($)</Label>
                        <Input
                          id="sal_max"
                          type="number"
                          value={answers.target_salary_max}
                          onChange={(e) => setAnswers({ ...answers, target_salary_max: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sal_ans">Formatted Salary Response</Label>
                      <Input
                        id="sal_ans"
                        value={answers.salary_answer}
                        onChange={(e) => setAnswers({ ...answers, salary_answer: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notice_ans">Notice Period / Earliest Start Date</Label>
                      <Input
                        id="notice_ans"
                        value={answers.notice_period_answer}
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
                        value={answers.gender}
                        onChange={(e) => setAnswers({ ...answers, gender: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="race">Race / Ethnicity</Label>
                      <Input
                        id="race"
                        value={answers.race_ethnicity}
                        onChange={(e) => setAnswers({ ...answers, race_ethnicity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="veteran">Veteran Status</Label>
                      <Input
                        id="veteran"
                        value={answers.veteran_status}
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
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="w-5 h-5 text-primary" /> Interactive QA Match Tester
                </CardTitle>
                <CardDescription>
                  Test how an ATS question label is parsed and answered by the Tayari Candidate Bank.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test_q">ATS Form Question</Label>
                  <Input
                    id="test_q"
                    placeholder="e.g. Will you require visa sponsorship?"
                    value={testQuestion}
                    onChange={(e) => setTestQuestion(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleTestMatch} disabled={isMatching}>
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
                          <span className="text-muted-foreground block text-xs mb-1">Pre-filled Response:</span>
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
