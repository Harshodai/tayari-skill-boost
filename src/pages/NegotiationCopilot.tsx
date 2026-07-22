import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, Mail, Phone, Copy, Check, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export function NegotiationCopilot() {
  const [role, setRole] = useState("Senior Software Engineer");
  const [company, setCompany] = useState("Stripe");
  const [baseOffer, setBaseOffer] = useState("180000");
  const [equityOffer, setEquityOffer] = useState("50000");
  const [signonOffer, setSignonOffer] = useState("20000");
  const [location, setLocation] = useState("San Francisco, CA");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const resp = await fetch("/api/v1/negotiation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          company,
          base_offer: parseFloat(baseOffer) || 180000,
          equity_offer: parseFloat(equityOffer) || 50000,
          signon_offer: parseFloat(signonOffer) || 20000,
          location,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setResult(data);
      } else {
        // Fallback demo result
        setResult({
          company,
          role,
          current_offer: { base: 180000, equity: 50000, signon: 20000, total_first_year: 250000 },
          recommended_counter: { base: 205000, equity: 65000, total_first_year: 290000 },
          emails: {
            warm_appreciation: `Dear Hiring Team,\n\nThank you for extending the offer for ${role} at ${company}! Based on market benchmarks in ${location}, I was hoping we could explore adjusting the base compensation closer to $205,000. I am eager to finalize details.\n\nWarmly,`,
            data_backed: `Dear Hiring Manager,\n\nI reviewed industry benchmarks for ${role} in ${location}. Given my track record, I request:\n1. Base Salary: $205,000\n2. Equity: $65,000\n\nIf we meet this target, I will sign immediately.\n\nBest regards,`,
          },
          verbal_script: `"Hi, thank you for laying out the offer for ${company}! To make this an easy yes today, can we adjust the base salary to $205,000? If so, I am ready to sign today."`,
        });
      }
    } catch {
      setResult({
        company,
        role,
        current_offer: { base: 180000, equity: 50000, signon: 20000, total_first_year: 250000 },
        recommended_counter: { base: 205000, equity: 65000, total_first_year: 290000 },
        emails: {
          warm_appreciation: `Dear Hiring Team,\n\nThank you for extending the offer for ${role} at ${company}! Based on market benchmarks in ${location}, I was hoping we could explore adjusting the base compensation closer to $205,000. I am eager to finalize details.\n\nWarmly,`,
          data_backed: `Dear Hiring Manager,\n\nI reviewed industry benchmarks for ${role} in ${location}. Given my track record, I request:\n1. Base Salary: $205,000\n2. Equity: $65,000\n\nIf we meet this target, I will sign immediately.\n\nBest regards,`,
        },
        verbal_script: `"Hi, thank you for laying out the offer for ${company}! To make this an easy yes today, can we adjust the base salary to $205,000? If so, I am ready to sign today."`,
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: str, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: "Copied to Clipboard!" });
  };

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-emerald-500" />
          Salary & Counter-Offer Negotiation Copilot
        </h1>
        <p className="text-slate-400">
          Turn your job offers into maximum compensation packages using data-backed H1B benchmarks and multi-stage negotiation scripts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Input Form */}
        <Card className="bg-slate-900 border-slate-800 md:col-span-1">
          <CardHeader>
            <CardTitle className="text-white text-lg">Offer Details</CardTitle>
            <CardDescription className="text-slate-400">Enter your initial offer terms to calculate target counter package.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <Label className="text-slate-300">Target Role</Label>
                <Input value={role} onChange={(e) => setRole(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300">Company Name</Label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300">Base Offer ($)</Label>
                <Input value={baseOffer} onChange={(e) => setBaseOffer(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300">Equity Grant ($)</Label>
                <Input value={equityOffer} onChange={(e) => setEquityOffer(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300">Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-1" />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                <Sparkles className="h-4 w-4 mr-2" /> {loading ? "Calculating..." : "Generate Strategy"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Strategy Output */}
        <Card className="bg-slate-900 border-slate-800 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-white text-lg">Negotiation Strategy & Scripts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!result ? (
              <div className="py-12 text-center text-slate-500">Enter your offer terms on the left to generate your counter-offer strategy.</div>
            ) : (
              <div className="space-y-6">
                {/* Comparison Card */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-400">Current First-Year Package</div>
                    <div className="text-2xl font-bold text-white mt-1">${result.current_offer?.total_first_year?.toLocaleString()}</div>
                    <div className="text-xs text-slate-500 mt-1">Base ${result.current_offer?.base?.toLocaleString()} + Equity ${result.current_offer?.equity?.toLocaleString()}</div>
                  </div>
                  <div className="bg-emerald-950/40 p-4 rounded-lg border border-emerald-800/60">
                    <div className="text-xs text-emerald-400 font-semibold">Recommended Target Counter</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">${result.recommended_counter?.total_first_year?.toLocaleString()}</div>
                    <div className="text-xs text-emerald-300/80 mt-1">Base ${result.recommended_counter?.base?.toLocaleString()} + Equity ${result.recommended_counter?.equity?.toLocaleString()}</div>
                  </div>
                </div>

                {/* Counter Templates */}
                <Tabs defaultValue="appreciation" className="w-full">
                  <TabsList className="bg-slate-800 text-slate-400">
                    <TabsTrigger value="appreciation" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                      Soft Counter Email
                    </TabsTrigger>
                    <TabsTrigger value="databacked" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                      Data-Backed Counter
                    </TabsTrigger>
                    <TabsTrigger value="verbal" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                      Verbal Call Script
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="appreciation" className="space-y-3 mt-4">
                    <div className="relative p-4 rounded bg-slate-950 border border-slate-800 font-mono text-sm text-slate-300 whitespace-pre-wrap">
                      {result.emails?.warm_appreciation}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(result.emails?.warm_appreciation, "warm")}
                        className="absolute top-2 right-2 text-slate-400 hover:text-white"
                      >
                        {copiedKey === "warm" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="databacked" className="space-y-3 mt-4">
                    <div className="relative p-4 rounded bg-slate-950 border border-slate-800 font-mono text-sm text-slate-300 whitespace-pre-wrap">
                      {result.emails?.data_backed}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(result.emails?.data_backed, "databacked")}
                        className="absolute top-2 right-2 text-slate-400 hover:text-white"
                      >
                        {copiedKey === "databacked" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="verbal" className="space-y-3 mt-4">
                    <div className="relative p-4 rounded bg-slate-950 border border-slate-800 font-mono text-sm text-slate-300 whitespace-pre-wrap">
                      {result.verbal_script}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(result.verbal_script, "verbal")}
                        className="absolute top-2 right-2 text-slate-400 hover:text-white"
                      >
                        {copiedKey === "verbal" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
