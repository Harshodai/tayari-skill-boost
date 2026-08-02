import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle2, RefreshCw, ArrowRight, Target, Award } from "lucide-react";
import { AppShell } from "@/components/layout";
import { apiFetch } from "@/api";

const DEFAULT_FALLBACK_FUNNEL = {
  total_applied: 24,
  responses_received: 6,
  interviews_scheduled: 4,
  offers_received: 1,
  response_rate: 25.0,
  interview_rate: 66.7,
  offer_rate: 25.0,
  health_status: "EXCELLENT",
  recommendations: [
    "Outstanding response rate! Keep leveraging Typst ATS PDFs.",
    "Resumes tailored with 85%+ ATS scores significantly improve callback rates over generic submissions.",
    "Consider using the Salary Negotiation Copilot to maximize your recent offer package.",
  ],
};

export function ApplicationAnalytics() {
  const [loading, setLoading] = useState(false);
  const [isSampleData, setIsSampleData] = useState(true);
  const [funnel, setFunnel] = useState<any>(DEFAULT_FALLBACK_FUNNEL);

  const [outcomeMatrix, setOutcomeMatrix] = useState<any[]>([
    { tier: "90% - 100% ATS Match", applications: 12, responses: 4, interviews: 3, callback_rate: "33.3%", conversion_grade: "A+" },
    { tier: "80% - 89% ATS Match", applications: 8, responses: 2, interviews: 1, callback_rate: "25.0%", conversion_grade: "A" },
    { tier: "70% - 79% ATS Match", applications: 3, responses: 0, interviews: 0, callback_rate: "0.0%", conversion_grade: "B" },
    { tier: "Below 70% Match", applications: 1, responses: 0, interviews: 0, callback_rate: "0.0%", conversion_grade: "C" },
  ]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>("/v1/analytics/funnel", {
        method: "POST",
        body: JSON.stringify({ applications: [] }),
      });
      const isValid =
        data &&
        typeof data.total_applied === "number" &&
        typeof data.responses_received === "number" &&
        typeof data.interviews_scheduled === "number" &&
        typeof data.offers_received === "number" &&
        typeof data.response_rate === "number" &&
        typeof data.interview_rate === "number" &&
        typeof data.offer_rate === "number";

      if (isValid) {
        setFunnel(data);
        setIsSampleData(false);
      } else {
        setFunnel(DEFAULT_FALLBACK_FUNNEL);
        setIsSampleData(true);
      }
    } catch {
      setFunnel(DEFAULT_FALLBACK_FUNNEL);
      setIsSampleData(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <AppShell>
      <div className="container max-w-5xl mx-auto py-8 space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Application Conversion Analytics</h1>
              {isSampleData && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs py-1 px-2.5">
                  Sample Data
                </Badge>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={fetchAnalytics} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh Analytics
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Track recruiter response rates, interview conversion ratios, and closed-loop ATS match outcomes.
          </p>
        </div>

        {/* Top Funnel Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium">Total Applied</CardDescription>
              <CardTitle className="text-2xl font-bold">{funnel.total_applied}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <BarChart3 className="h-3 w-3 text-blue-500" /> Across all job portals
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium">Recruiter Responses</CardDescription>
              <CardTitle className="text-2xl font-bold text-blue-500">{funnel.responses_received}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-blue-600 font-medium">
                {funnel.response_rate}% Response Rate
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium font-medium">Interviews Scheduled</CardDescription>
              <CardTitle className="text-2xl font-bold text-purple-500">{funnel.interviews_scheduled}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-purple-600 font-medium">
                {funnel.interview_rate}% Conversion Rate
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium">Offers Received</CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-500">{funnel.offers_received}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-emerald-600 font-medium">
                {funnel.offer_rate}% Final Offer Rate
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Closed-Loop Outcome & Resume Tailoring Variant Matrix */}
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-xl flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-500" />
                Resume Tailoring Variant & Outcome Matrix
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                  Sample Data
                </Badge>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  Moat M2: Closed-Loop Data
                </Badge>
              </div>
            </CardTitle>
            <CardDescription>
              Correlation measuring recruiter response rates across different ATS match score ranges.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ATS Match Tier</TableHead>
                    <TableHead className="text-center">Applications</TableHead>
                    <TableHead className="text-center">Responses</TableHead>
                    <TableHead className="text-center">Interviews</TableHead>
                    <TableHead className="text-center">Callback Rate</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outcomeMatrix.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{row.tier}</TableCell>
                      <TableCell className="text-center font-mono">{row.applications}</TableCell>
                      <TableCell className="text-center font-mono text-blue-500 font-bold">{row.responses}</TableCell>
                      <TableCell className="text-center font-mono text-purple-500 font-bold">{row.interviews}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono text-emerald-600 bg-emerald-500/10">
                          {row.callback_rate}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={i === 0 ? "bg-emerald-600" : "bg-muted text-foreground"}>
                          {row.conversion_grade}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Visual Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Visual Funnel Pipeline</span>
              <Badge variant="outline" className="text-xs">
                Health Status: {funnel.health_status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
              <div className="p-4 rounded-lg bg-muted/60 border">
                <div className="text-xs text-muted-foreground">1. Sourced & Applied</div>
                <div className="text-xl font-bold mt-1">{funnel.total_applied}</div>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="text-xs text-blue-500 font-semibold">2. Recruiter Response</div>
                <div className="text-xl font-bold text-blue-500 mt-1">{funnel.responses_received}</div>
              </div>
              <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <div className="text-xs text-purple-500 font-semibold">3. Interview Rounds</div>
                <div className="text-xl font-bold text-purple-500 mt-1">{funnel.interviews_scheduled}</div>
              </div>
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-xs text-emerald-500 font-semibold">4. Offer Extended</div>
                <div className="text-xl font-bold text-emerald-500 mt-1">{funnel.offers_received}</div>
              </div>
            </div>

            {/* Diagnostic Recommendations */}
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-sm font-semibold">AI Diagnostic Recommendations</h4>
              <div className="space-y-2">
                {funnel.recommendations?.map((rec: string, idx: number) => (
                  <div key={idx} className="p-3 rounded bg-muted/40 border flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default ApplicationAnalytics;
