import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Lock, Server, Cpu, CheckCircle2, RefreshCw, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout";
import { apiFetchResponse, fetchPrivacyLedger, clearPrivacyLedger } from "@/api";
import type { PrivacyLedgerEntry } from "@/api/types";

export function PrivacyReadiness() {
  const [loading, setLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerLogs, setLedgerLogs] = useState<PrivacyLedgerEntry[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const checkStatus = async () => {
    setLoading(true);
    setStatusError(null);
    try {
      const resp = await apiFetchResponse("/v1/privacy/check", { method: "POST" });
      if (!resp.ok) {
        throw new Error(`Live diagnostics unavailable (${resp.status}).`);
      }
      const data = await resp.json();
      setStatus(data);
    } catch (error) {
      setStatus(null);
      setStatusError(error instanceof Error ? error.message : "Live diagnostics unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchLedger = async () => {
    setLedgerLoading(true);
    setFetchError(null);
    try {
      const data = await fetchPrivacyLedger();
      setLedgerLogs(data.ledger || []);
    } catch {
      setFetchError("Unable to fetch live audit ledger.");
      setLedgerLogs([]);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleClearLedger = async () => {
    try {
      // ponytail: clear prior fetch error before wipe so a stale failure isn't
      // displayed after the ledger is successfully wiped.
      setFetchError(null);
      await clearPrivacyLedger();
      toast.success("Privacy Ledger Log Wiped");
      setLedgerLogs([]);
    } catch {
      toast.error("Failed to clear ledger");
    }
  };

  useEffect(() => {
    checkStatus();
    fetchLedger();
  }, []);

  return (
    <AppShell>
      <div className="container max-w-5xl mx-auto py-8 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-success" />
            Self-Hosted Privacy & AI Audit Ledger
          </h1>
          <p className="text-muted-foreground">
            Review live privacy diagnostics, model destinations, and PII sanitization ledger entries for this account.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Privacy Status</CardTitle>
              <CardDescription>Reported data-residency and provider diagnostics for this deployment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`p-4 rounded-lg border text-center space-y-2 ${statusError ? "bg-amber-500/10 border-amber-500/20" : "bg-muted/40 border-border"}`}>
                <Lock className={`h-8 w-8 mx-auto ${statusError ? "text-amber-500" : "text-muted-foreground"}`} />
                <div className="text-sm font-bold">Live privacy diagnostics</div>
                <Badge variant="outline" className="text-xs">
                  {statusError ? "Unavailable" : status?.privacy_mode || "Not checked"}
                </Badge>
                {statusError && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{statusError}</p>}
              </div>
              <Button onClick={checkStatus} disabled={loading} className="w-full font-semibold">
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh Diagnostics
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Local AI & Engine Diagnostics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded bg-muted/50 border">
                  <div className="text-xs text-muted-foreground">Local Ollama LLM</div>
                  <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
                    {status?.local_llm_active ? <CheckCircle2 className="h-4 w-4 text-success" /> : <RefreshCw className="h-4 w-4 text-muted-foreground" />}
                    {status ? (status.local_llm_active ? `Active${status.ollama_endpoint ? ` (${status.ollama_endpoint})` : ""}` : "Unavailable") : "Not checked"}
                  </div>
                </div>
                <div className="p-3.5 rounded bg-muted/50 border">
                  <div className="text-xs text-muted-foreground">Typst Rust PDF Compiler</div>
                  <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
                    {status?.typst_cli_installed ? <CheckCircle2 className="h-4 w-4 text-success" /> : <RefreshCw className="h-4 w-4 text-muted-foreground" />}
                    {status ? (status.typst_cli_installed ? "Ready" : "Unavailable") : "Not checked"}
                  </div>
                </div>
                <div className="p-3.5 rounded bg-muted/50 border">
                  <div className="text-xs text-muted-foreground">Playwright Chromium</div>
                  <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
                    {status?.local_playwright_installed ? <CheckCircle2 className="h-4 w-4 text-success" /> : <RefreshCw className="h-4 w-4 text-muted-foreground" />}
                    {status ? (status.local_playwright_installed ? "Installed & Isolated" : "Unavailable") : "Not checked"}
                  </div>
                </div>
                <div className="p-3.5 rounded bg-muted/50 border">
                  <div className="text-xs text-muted-foreground">External Analytics & Tracking</div>
                  <div className="text-sm font-bold text-success mt-1 flex items-center gap-1.5">
                                            {status?.external_tracking === "DISABLED" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <RefreshCw className="h-4 w-4 text-muted-foreground" />}
                        {status ? (status.external_tracking || "Not reported") : "Not checked"}

                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Privacy & Audit Ledger Section */}
        <Card className="border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                "What Left Your Machine" — Privacy Audit Ledger
              </CardTitle>
              <CardDescription className="mt-1">
                Account-scoped audit entries for outgoing requests, reported PII sanitization, and provider destinations. Missing fields remain explicitly unreported.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchLedger} disabled={ledgerLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${ledgerLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button variant="destructive" size="sm" onClick={handleClearLedger} disabled={ledgerLogs.length === 0}>
                <Trash2 className="h-4 w-4 mr-2" /> Wipe Log
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fetchError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {fetchError}
              </div>
            ) : ledgerLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                <ShieldCheck className="h-8 w-8 text-success mx-auto mb-2 opacity-80" />
                No outgoing request entries recorded for the current session.
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource Path</TableHead>
                      <TableHead>Model / Target</TableHead>
                      <TableHead>PII Redaction Audit</TableHead>
                      <TableHead>Residency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {log.resource}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {log.detail?.provider || "Provider not reported"}
                        </TableCell>
                        <TableCell>
                              {log.detail?.pii_redacted === undefined ? (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  Redaction status not reported
                                </Badge>
                              ) : log.detail.pii_redacted.length > 0 ? (
                                <div className="flex gap-1 flex-wrap">
                                  {log.detail.pii_redacted.map((item, i) => (
                                    <Badge key={i} variant="outline" className="bg-success/10 text-success text-[10px]">
                                      Scrubbed: {item}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  No redactions reported
                                </Badge>
                              )}
                        </TableCell>
                        <TableCell>
                          {log.detail?.is_local === true ? (
                            <Badge className="bg-success text-primary-foreground text-[11px]">Local Device</Badge>
                          ) : log.detail?.is_local === false ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-[11px]">Sanitized Remote API</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px]">Residency not reported</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default PrivacyReadiness;
