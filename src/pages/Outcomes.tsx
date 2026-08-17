import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch, USE_SELF_HOSTED } from "@/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, BarChart3, ShieldCheck, TrendingUp, Receipt, CheckCheck, XCircle, AlertTriangle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BoomerangCard } from "@/components/outcomes/BoomerangCard";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ReceiptCard, SubmissionReceiptItem } from "@/components/receipts/ReceiptCard";
import { ReceiptStatus } from "@/components/receipts/ReceiptBadge";

type Stage = "saved" | "applied" | "interview" | "offer" | "rejected";

type OutcomeRecord = {
  company: string;
  title: string;
  url: string | null;
  stage: Stage;
  verifiedReceipt: boolean;
  hasReceipt: boolean;
};

const STAGE_RANK: Record<Stage, number> = {
  saved: 0,
  applied: 1,
  interview: 2,
  offer: 3,
  rejected: 1,
};

function pct(n: number, d: number) {
  if (!d) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

export default function Outcomes() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const [slice, setSlice] = useState<"company" | "title">("company");
  const [receiptFilter, setReceiptFilter] = useState<"all" | ReceiptStatus>("all");

  const jobsQuery = useQuery({
    queryKey: ["outcomes-saved-jobs", userId],
    enabled: !!userId,
    queryFn: async () => {
      try {
        const data = await apiFetch<any>("/v1/jobs/saved");
        return Array.isArray(data) ? data : (data?.jobs ?? []);
      } catch (err) {
        if (!USE_SELF_HOSTED) {
          const { data, error } = await supabase
            .from("saved_jobs")
            .select("id,title,company,url,stage,saved_at")
            .order("saved_at", { ascending: false });
          if (error) throw error;
          return data ?? [];
        }
        throw err;
      }
    },
  });

  const receiptsQuery = useQuery({
    queryKey: ["outcomes-receipts", userId],
    enabled: !!userId,
    queryFn: async () => {
      try {
        const res = await apiFetch<any>("/v1/jobs/receipts");
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.receipts)) return res.receipts;
      } catch {
        // Fallback to Supabase when not on self-hosted or endpoint not available
      }
      if (USE_SELF_HOSTED) return [];
      const { data, error } = await supabase
        .from("submission_receipts")
        .select("id,job_url,verified,confirmation_number,confirmation_text,submitted_at,outcome,ats_vendor,company,job_title,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Map raw receipts to typed SubmissionReceiptItems
  const receiptsList: SubmissionReceiptItem[] = useMemo(() => {
    return ((receiptsQuery.data ?? []) as any[]).map((r) => {
      let status: ReceiptStatus = "unverifiable";
      if (r.outcome === "failed" || (!r.verified && r.outcome?.includes("fail"))) {
        status = "failed";
      } else if (r.verified || r.outcome === "verified") {
        status = "verified";
      } else {
        status = "unverifiable";
      }

      return {
        id: String(r.id || r.job_url || Math.random()),
        company: r.company || "Target Company",
        title: r.job_title || "Application Submission",
        url: r.job_url || null,
        status,
        confirmationCode: r.confirmation_number || null,
        submittedAt: r.submitted_at || r.created_at || null,
        failureReason: status === "failed" ? r.confirmation_text || "Submission failed before completion" : null,
        atsVendor: r.ats_vendor || null,
      };
    });
  }, [receiptsQuery.data]);

  const filteredReceipts = useMemo(() => {
    if (receiptFilter === "all") return receiptsList;
    return receiptsList.filter((r) => r.status === receiptFilter);
  }, [receiptsList, receiptFilter]);

  const receiptStats = useMemo(() => {
    const verified = receiptsList.filter((r) => r.status === "verified").length;
    const failed = receiptsList.filter((r) => r.status === "failed").length;
    const unverifiable = receiptsList.filter((r) => r.status === "unverifiable").length;
    return { verified, failed, unverifiable, total: receiptsList.length };
  }, [receiptsList]);

  const records: OutcomeRecord[] = useMemo(() => {
    const byUrl = new Map<string, { verified: boolean }>();
    for (const r of (receiptsQuery.data ?? []) as any[]) {
      if (!r.job_url || byUrl.has(r.job_url)) continue;
      byUrl.set(r.job_url, { verified: !!r.verified });
    }
    return ((jobsQuery.data ?? []) as any[]).map((raw) => {
      const j = raw.job && typeof raw.job === "object" ? { ...raw.job, ...raw } : raw;
      const receipt = j.url ? byUrl.get(j.url) : undefined;
      return {
        company: (j.company || "Unknown").trim(),
        title: (j.title || "Unknown role").trim(),
        url: j.url ?? null,
        stage: (j.stage ?? raw.status ?? "saved") as Stage,
        verifiedReceipt: !!receipt?.verified,
        hasReceipt: !!receipt,
      };
    });
  }, [jobsQuery.data, receiptsQuery.data]);

  const funnel = useMemo(() => {
    const applied = records.filter((r) => STAGE_RANK[r.stage] >= 1 || r.verifiedReceipt);
    const verified = applied.filter((r) => r.verifiedReceipt);
    const interviews = records.filter((r) => r.stage === "interview" || r.stage === "offer");
    const offers = records.filter((r) => r.stage === "offer");
    return {
      saved: records.length,
      applied: applied.length,
      verified: verified.length,
      interviews: interviews.length,
      offers: offers.length,
    };
  }, [records]);

  const chartData = [
    { stage: "Saved", count: funnel.saved, fill: "hsl(var(--muted-foreground))" },
    { stage: "Applied", count: funnel.applied, fill: "hsl(var(--primary))" },
    { stage: "Interview", count: funnel.interviews, fill: "hsl(var(--chart-2, var(--primary)))" },
    { stage: "Offer", count: funnel.offers, fill: "hsl(var(--chart-3, var(--primary)))" },
  ];

  const breakdown = useMemo(() => {
    const map = new Map<string, { applied: number; interviews: number; offers: number; total: number }>();
    for (const r of records) {
      const key = slice === "company" ? r.company : r.title;
      const row = map.get(key) ?? { applied: 0, interviews: 0, offers: 0, total: 0 };
      row.total += 1;
      if (STAGE_RANK[r.stage] >= 1 || r.verifiedReceipt) row.applied += 1;
      if (r.stage === "interview" || r.stage === "offer") row.interviews += 1;
      if (r.stage === "offer") row.offers += 1;
      map.set(key, row);
    }
    return [...map.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.applied - a.applied || b.total - a.total)
      .slice(0, 25);
  }, [records, slice]);

  const isLoading = jobsQuery.isLoading || receiptsQuery.isLoading;
  const error = jobsQuery.error || receiptsQuery.error;

  const handleRetryReceipt = (item: SubmissionReceiptItem) => {
    if (item.url) {
      window.open(item.url, "_blank");
    } else {
      navigate("/jobs");
    }
  };

  return (
    <AppShell>
      <div className="container mx-auto max-w-5xl space-y-8 p-6">
        <div className="space-y-2 border-b pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Outcomes & Receipts</h1>
            <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Zero-Risk Receipt-Backed
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Your real funnel and verified submission audit receipts. 1 Credit is debited only on verified ATS confirmation.
          </p>
        </div>

        {error ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">
                {(error as Error).message || "Couldn't load your outcome data."}
              </p>
              <Button variant="outline" onClick={() => { jobsQuery.refetch(); receiptsQuery.refetch(); }}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Funnel Metrics Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Applied</CardDescription>
                  <CardTitle className="text-3xl">{funnel.applied}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {funnel.verified} with a verified receipt
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Interviews</CardDescription>
                  <CardTitle className="text-3xl">{funnel.interviews}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {pct(funnel.interviews, funnel.applied)} of applications
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Offers</CardDescription>
                  <CardTitle className="text-3xl">{funnel.offers}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {pct(funnel.offers, funnel.interviews)} of interviews
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Applied → offer</CardDescription>
                  <CardTitle className="text-3xl">{pct(funnel.offers, funnel.applied)}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  <TrendingUp className="mr-1 inline h-3 w-3" /> across {funnel.saved} tracked roles
                </CardContent>
              </Card>
            </div>

            {/* Submission Receipts Section */}
            <div data-testid="submission-receipts-section" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-primary" /> Submission Receipts & Audit Log
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Verifiable cryptographic & ATS confirmation tokens. Zero risk billing guarantee.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Button
                    size="sm"
                    variant={receiptFilter === "all" ? "default" : "outline"}
                    onClick={() => setReceiptFilter("all")}
                    className="h-7 text-xs"
                  >
                    All ({receiptStats.total})
                  </Button>
                  <Button
                    size="sm"
                    variant={receiptFilter === "verified" ? "default" : "outline"}
                    onClick={() => setReceiptFilter("verified")}
                    className="h-7 text-xs text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCheck className="w-3 h-3 mr-1" /> Verified ({receiptStats.verified})
                  </Button>
                  <Button
                    size="sm"
                    variant={receiptFilter === "failed" ? "default" : "outline"}
                    onClick={() => setReceiptFilter("failed")}
                    className="h-7 text-xs text-rose-600 dark:text-rose-400"
                  >
                    <XCircle className="w-3 h-3 mr-1" /> Failed ({receiptStats.failed})
                  </Button>
                  <Button
                    size="sm"
                    variant={receiptFilter === "unverifiable" ? "default" : "outline"}
                    onClick={() => setReceiptFilter("unverifiable")}
                    className="h-7 text-xs text-slate-600 dark:text-slate-400"
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" /> Unverifiable ({receiptStats.unverifiable})
                  </Button>
                </div>
              </div>

              {filteredReceipts.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground space-y-2">
                    <Receipt className="w-8 h-8 mx-auto text-muted-foreground/60" />
                    <p className="font-medium">No {receiptFilter !== "all" ? receiptFilter : ""} submission receipts found</p>
                    <p className="text-xs">
                      When applications are submitted, verifiable receipts with confirmation codes and credit audit trail will appear here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredReceipts.map((receipt) => (
                    <ReceiptCard
                      key={receipt.id}
                      receipt={receipt}
                      onRetry={handleRetryReceipt}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Funnel Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Funnel</CardTitle>
                <CardDescription>Where your applications actually stop.</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 16 }}>
                    <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis type="category" dataKey="stage" width={80} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        color: "hsl(var(--popover-foreground))",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {chartData.map((d) => (
                        <Cell key={d.stage} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Breakdown Table */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">Breakdown</CardTitle>
                  <CardDescription>Top 25 by application volume.</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={slice === "company" ? "default" : "outline"}
                    onClick={() => setSlice("company")}
                  >
                    Company
                  </Button>
                  <Button
                    size="sm"
                    variant={slice === "title" ? "default" : "outline"}
                    onClick={() => setSlice("title")}
                  >
                    Role
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{slice === "company" ? "Company" : "Role"}</TableHead>
                        <TableHead className="text-right">Applied</TableHead>
                        <TableHead className="text-right">Interviews</TableHead>
                        <TableHead className="text-right">Offers</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdown.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="max-w-[220px] truncate font-medium">{row.key}</TableCell>
                          <TableCell className="text-right">{row.applied}</TableCell>
                          <TableCell className="text-right">{row.interviews}</TableCell>
                          <TableCell className="text-right">{row.offers}</TableCell>
                          <TableCell className="text-right">{pct(row.interviews, row.applied)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <BoomerangCard userId={userId} offers={funnel.offers} />

            <p className="text-xs text-muted-foreground">
              "Applied" counts a role once its pipeline stage moved past Saved, or once a
              submission receipt exists for it. Verified means we captured confirmation evidence and debited 1 credit.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
