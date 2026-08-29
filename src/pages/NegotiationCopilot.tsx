import { apiFetchResponse } from "@/api";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, Mail, Phone, Copy, Check, Sparkles, Calculator, UserCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

import { AppShell } from "@/components/layout";

export function NegotiationCopilot() {
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [baseOffer, setBaseOffer] = useState("");
  const [equityOffer, setEquityOffer] = useState("");
  const [signonOffer, setSignonOffer] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { toast } = useToast();

  const loadSampleBenchmark = () => {
    setRole("Staff Systems Engineer");
    setCompany("Cloudflare");
    setBaseOffer("210000");
    setEquityOffer("240000");
    setSignonOffer("30000");
    setLocation("Remote (US)");
    setError(null);
    setResult(null);
    toast({ title: "Sample Benchmark Loaded", description: "Offer terms populated for calculation." });
  };

  const parsedBase = Number(baseOffer) || 0;
  const parsedEquity = Number(equityOffer) || 0;
  const parsedSignon = Number(signonOffer) || 0;
  const calculatedFirstYearTC = parsedBase + (parsedEquity / 4) + parsedSignon;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedBaseOffer = Number(baseOffer);
    const parsedEquityOffer = equityOffer.trim() ? Number(equityOffer) : 0;
    const parsedSignonOffer = signonOffer.trim() ? Number(signonOffer) : 0;
    if (!role.trim() || !Number.isFinite(parsedBaseOffer) || parsedBaseOffer < 0 || !Number.isFinite(parsedEquityOffer) || parsedEquityOffer < 0 || !Number.isFinite(parsedSignonOffer) || parsedSignonOffer < 0) {
      setError("Enter a target role and non-negative numeric offer values before generating a draft strategy.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await apiFetchResponse("/v1/negotiation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          company,
          base_offer: parsedBaseOffer,
          equity_offer: parsedEquityOffer,
          signon_offer: parsedSignonOffer,
          location,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setResult(data);
      } else {
        const data = await resp.json().catch(() => null);
        setError(data?.detail || "Negotiation strategy could not be generated.");
      }
    } catch {
      setError("Negotiation strategy is unavailable. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: "Copied to Clipboard!" });
  };

  return (
    <AppShell>
      <div className="container max-w-5xl mx-auto py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 font-display">
              <DollarSign className="h-8 w-8 text-emerald-500" />
              Salary & Counter-Offer Negotiation Copilot
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Review a draft negotiation strategy using the offer details and available benchmark data. Outputs are not guaranteed compensation, legal, tax, or financial advice; verify consequential decisions with qualified professionals.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSampleBenchmark} className="text-xs shrink-0">
            <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Sample Benchmark
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Input Form */}
          <Card className="md:col-span-1 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" /> Offer Details
              </CardTitle>
              <CardDescription className="text-xs">Enter your initial offer terms to calculate target counter package.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerate} className="space-y-3.5 text-sm">
                <div>
                  <Label className="text-xs">Target Role *</Label>
                  <Input placeholder="e.g. Staff Software Engineer" value={role} onChange={(e) => setRole(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Company Name</Label>
                  <Input placeholder="e.g. Stripe, Cloudflare" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Base Salary ($) *</Label>
                    <Input placeholder="190000" value={baseOffer} onChange={(e) => setBaseOffer(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Equity Grant ($ / 4yr)</Label>
                    <Input placeholder="200000" value={equityOffer} onChange={(e) => setEquityOffer(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Sign-on Bonus ($)</Label>
                    <Input placeholder="25000" value={signonOffer} onChange={(e) => setSignonOffer(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Location</Label>
                    <Input placeholder="Remote / SF" value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1" />
                  </div>
                </div>

                {parsedBase > 0 && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                    <span className="text-[10px] uppercase font-mono font-semibold text-emerald-600 dark:text-emerald-400 block">Est. Year 1 Total Comp:</span>
                    <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300">
                      ${calculatedFirstYearTC.toLocaleString()}
                    </span>
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full font-semibold shadow-md active:scale-[0.98]">
                  <Sparkles className="h-4 w-4 mr-2" /> {loading ? "Calculating..." : "Generate Strategy"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Strategy Output */}
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Negotiation Strategy & Scripts</span>
                {result && (
                  <Badge variant="outline" className="font-mono text-[10px] text-emerald-500 border-emerald-500/20">
                    Benchmarked
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              {!result ? (
                <div className="py-12 text-center text-muted-foreground space-y-4">
                  {error ? (
                    <>
                      <Alert variant="destructive" role="alert" className="text-left">
                        <AlertTitle>Negotiation strategy unavailable</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                      <Button type="button" variant="outline" onClick={() => void handleGenerate({ preventDefault: () => undefined } as React.FormEvent)} disabled={loading}>Retry</Button>
                    </>
                  ) : (
                    <div>Enter your offer terms on the left to generate a candidate-reviewed counter-offer draft.</div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Comparison Card */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/60 p-4 rounded-xl border">
                      <div className="text-xs text-muted-foreground font-medium">Current First-Year Package</div>
                      <div className="text-2xl font-bold font-mono mt-1">${result.current_offer?.total_first_year?.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono">Base ${result.current_offer?.base?.toLocaleString()} + Equity ${result.current_offer?.equity?.toLocaleString()}</div>
                    </div>
                    <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                      <div className="text-xs text-emerald-500 font-semibold">Recommended Target Counter</div>
                      <div className="text-2xl font-bold font-mono text-emerald-500 mt-1">${result.recommended_counter?.total_first_year?.toLocaleString()}</div>
                      <div className="text-xs text-emerald-500/80 mt-1 font-mono">Base ${result.recommended_counter?.base?.toLocaleString()} + Equity ${result.recommended_counter?.equity?.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Counter Templates */}
                  {result.llm_available === false ? (
                    <Alert variant="destructive" role="alert" className="text-left">
                      <AlertTitle>Draft emails unavailable</AlertTitle>
                      <AlertDescription>
                        The compensation benchmark above is real, but no AI provider is configured to draft the
                        counter-offer emails and call script right now. Nothing was fabricated — try again once the
                        AI service is available.
                      </AlertDescription>
                    </Alert>
                  ) : (
                  <Tabs defaultValue="appreciation" className="w-full">
                    <TabsList className="w-full justify-start">
                      <TabsTrigger value="appreciation" className="text-xs">
                        Soft Counter Email
                      </TabsTrigger>
                      <TabsTrigger value="databacked" className="text-xs">
                        Data-Backed Counter
                      </TabsTrigger>
                      <TabsTrigger value="verbal" className="text-xs">
                        Verbal Call Script
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="appreciation" className="space-y-3 mt-4">
                      <div className="relative p-4 rounded-lg bg-muted/40 font-mono text-xs whitespace-pre-wrap border leading-relaxed">
                        {result.emails?.warm_appreciation}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(result.emails?.warm_appreciation, "warm")}
                          className="absolute top-2 right-2 h-7 px-2"
                        >
                          {copiedKey === "warm" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="databacked" className="space-y-3 mt-4">
                      <div className="relative p-4 rounded-lg bg-muted/40 font-mono text-xs whitespace-pre-wrap border leading-relaxed">
                        {result.emails?.data_backed}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(result.emails?.data_backed, "databacked")}
                          className="absolute top-2 right-2 h-7 px-2"
                        >
                          {copiedKey === "databacked" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="verbal" className="space-y-3 mt-4">
                      <div className="relative p-4 rounded-lg bg-muted/40 font-mono text-xs whitespace-pre-wrap border leading-relaxed">
                        {result.verbal_script}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(result.verbal_script, "verbal")}
                          className="absolute top-2 right-2 h-7 px-2"
                        >
                          {copiedKey === "verbal" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export default NegotiationCopilot;
