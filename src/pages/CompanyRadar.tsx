import { apiFetchResponse } from "@/api";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Radar, Search, Plus, Trash2, ExternalLink, RefreshCw, AlertCircle, CheckCircle2, ShieldAlert, Sparkles, Building2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface RadarMatch {
  title: string;
  company: string;
  location: string;
  url: string;
  ats_source: string;
}

interface RadarCompanyResult {
  company: string;
  count: number;
  error?: string;
  jobs: RadarMatch[];
}

const ROSTER_PRESETS = [
  { name: "Cloud & Infra", list: ["Cloudflare", "Datadog", "HashiCorp", "Vercel", "Fastly"] },
  { name: "AI Research", list: ["Anthropic", "OpenAI", "Cohere", "Scale AI", "Mistral"] },
  { name: "Fintech", list: ["Stripe", "Ramp", "Brex", "Plaid", "Mercury"] },
];

import { AppShell } from "@/components/layout";

export function CompanyRadar() {
  const [companies, setCompanies] = useState<string[]>(["Stripe", "OpenAI", "Anthropic", "Vercel", "Databricks"]);
  const [newCompany, setNewCompany] = useState("");
  const [keywords, setKeywords] = useState("engineer, developer, ai, full stack");
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<RadarCompanyResult[] | null>(null);
  const { toast } = useToast();

  const addCompany = () => {
    if (!newCompany.trim()) return;
    if (companies.includes(newCompany.trim())) return;
    setCompanies([...companies, newCompany.trim()]);
    setNewCompany("");
  };

  const removeCompany = (name: string) => {
    setCompanies(companies.filter((c) => c !== name));
  };

  const applyRosterPreset = (preset: typeof ROSTER_PRESETS[0]) => {
    setCompanies(preset.list);
    setResults(null);
    toast({ title: `Loaded ${preset.name} Roster`, description: `Monitoring ${preset.list.join(", ")}` });
  };

  const runRadarScan = async () => {
    if (companies.length === 0) return;
    setScanning(true);
    setResults(null);

    const kwList = keywords.split(",").map((k) => k.trim()).filter(Boolean);

    try {
      const resp = await apiFetchResponse("/v1/radar/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies,
          keywords: kwList,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setResults(data.results || []);
        toast({
          title: "Radar Scan Complete",
          description: `Scanned ${data.companies_scanned} company boards and found ${data.total_matches_found} matching roles.`,
        });
      } else {
        setResults(null);
        toast({
          title: "Scan failed",
          description: "The company radar scan could not complete. Try again in a moment.",
          variant: "destructive",
        });
      }
    } catch {
      setResults(null);
      toast({
        title: "Scan failed",
        description: "Could not reach the server to run the company radar scan.",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <AppShell>
      <div className="container max-w-5xl mx-auto py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 font-display">
              <Radar className="h-8 w-8 text-primary animate-pulse" />
              Company Radar (15-Minute Job Sentinel)
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Monitor your dream companies directly at their Greenhouse & Lever career APIs. Get alerted within 15 minutes of role posting to secure a 4X higher interview callback rate.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ROSTER_PRESETS.map((preset) => (
              <Button
                key={preset.name}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyRosterPreset(preset)}
                className="text-xs h-7 font-medium active:scale-[0.98]"
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Roster Config */}
          <Card className="md:col-span-1 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> Target Roster
              </CardTitle>
              <CardDescription className="text-xs">Companies monitored directly via ATS endpoints.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Stripe, Cloudflare"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCompany()}
                  className="text-sm"
                />
                <Button onClick={addCompany} size="icon" className="shrink-0 active:scale-[0.98]">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {companies.map((c) => (
                  <Badge key={c} variant="secondary" className="flex items-center gap-1 py-1 px-2 text-xs">
                    {c}
                    <Trash2 onClick={() => removeCompany(c)} className="h-3 w-3 hover:text-destructive cursor-pointer ml-1" />
                  </Badge>
                ))}
              </div>

              <div className="pt-2">
                <Label className="text-xs font-medium text-muted-foreground">Filter Keywords (comma separated)</Label>
                <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} className="text-xs mt-1" />
              </div>

              <Button onClick={runRadarScan} disabled={scanning} className="w-full font-semibold shadow-md active:scale-[0.98]">
                <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? "animate-spin" : ""}`} />
                {scanning ? "Scanning APIs..." : "Run Radar Scan Now"}
              </Button>
            </CardContent>
          </Card>

          {/* Scan Results */}
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Live Job Posting Sentinel Matches</span>
                <Badge variant="outline" className="text-xs font-mono text-emerald-500 border-emerald-500/20">
                  Direct API Ingestion
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {!results && !scanning && (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <Radar className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="font-medium text-foreground text-sm">No Active Scan</p>
                  <p className="text-xs max-w-xs mx-auto">
                    Click "Run Radar Scan Now" to fetch live job postings directly from company Greenhouse & Lever ATS endpoints.
                  </p>
                </div>
              )}

              {results && results.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  No matching open requisitions found on monitored company boards for the given keywords.
                </div>
              )}

              {results && results.map((res) => (
                <div key={res.company} className="space-y-3 p-3.5 rounded-xl border bg-muted/20">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      {res.company}
                    </h3>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {res.count} match{res.count !== 1 ? "es" : ""}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {res.jobs.map((job, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-background border hover:border-primary/40 transition-all flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-xs font-bold truncate">{job.title}</div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                            <span>{job.location}</span>
                            <span>•</span>
                            <span className="text-primary font-mono">{job.ats_source}</span>
                          </div>
                        </div>
                        <a href={job.url} target="_blank" rel="noreferrer" className="shrink-0">
                          <Button size="sm" variant="outline" className="text-xs h-7 active:scale-[0.98]">
                            Apply <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export default CompanyRadar;
