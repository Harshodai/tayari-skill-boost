import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Linkedin, Copy, Check, Sparkles, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export function RecruiterOutreach() {
  const [recruiterName, setRecruiterName] = useState("Sarah Jenkins");
  const [company, setCompany] = useState("Stripe");
  const [targetRole, setTargetRole] = useState("Senior Backend Engineer");
  const [proofPoints, setProofPoints] = useState(
    "Built high-throughput payment webhook microservices handling 10M+ daily events with 45% lower latency using Go & Redis."
  );
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const resp = await fetch("/api/v1/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recruiter_name: recruiterName,
          company,
          target_role: targetRole,
          candidate_proof_points: proofPoints,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setResult(data);
      } else {
        // Fallback demo
        setResult({
          company,
          role: targetRole,
          recruiter_name: recruiterName,
          cold_email: {
            subject: `Quick question re: ${targetRole} role at ${company}`,
            body: `Hi ${recruiterName},\n\nI noticed ${company} is expanding its engineering team for the ${targetRole} role and wanted to reach out directly.\n\nOver the past few years, I've specialized in building high-concurrency systems. Most recently: ${proofPoints}\n\nAre you open to a brief 5-minute chat next Tuesday morning to see if my background aligns with your team's current priorities?\n\nBest regards,`,
          },
          linkedin_note: `Hi ${recruiterName}, I saw ${company} is hiring for a ${targetRole}. Given my background in building high-throughput systems, I'd love to connect!`,
          followup_bump: `Hi ${recruiterName}, following up briefly on my note below. I'd still love to share how my experience could help ${company}. Are you free for a quick chat this week?`,
        });
      }
    } catch {
      setResult({
        company,
        role: targetRole,
        recruiter_name: recruiterName,
        cold_email: {
          subject: `Quick question re: ${targetRole} role at ${company}`,
          body: `Hi ${recruiterName},\n\nI noticed ${company} is expanding its engineering team for the ${targetRole} role and wanted to reach out directly.\n\nOver the past few years, I've specialized in building high-concurrency systems. Most recently: ${proofPoints}\n\nAre you open to a brief 5-minute chat next Tuesday morning to see if my background aligns with your team's current priorities?\n\nBest regards,`,
        },
        linkedin_note: `Hi ${recruiterName}, I saw ${company} is hiring for a ${targetRole}. Given my background in building high-throughput systems, I'd love to connect!`,
        followup_bump: `Hi ${recruiterName}, following up briefly on my note below. I'd still love to share how my experience could help ${company}. Are you free for a quick chat this week?`,
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: "Copied to Clipboard!" });
  };

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Send className="h-8 w-8 text-indigo-400" />
          Recruiter Cold Outreach Copilot
        </h1>
        <p className="text-slate-400">
          Generate non-spammy, high-converting cold emails and LinkedIn connection notes for hiring managers and recruiters.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="bg-slate-900 border-slate-800 md:col-span-1">
          <CardHeader>
            <CardTitle className="text-white text-lg">Target Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <Label className="text-slate-300">Recruiter / Manager Name</Label>
                <Input value={recruiterName} onChange={(e) => setRecruiterName(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300">Company Name</Label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300">Target Role</Label>
                <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-300">Top Candidate Proof Point</Label>
                <Textarea rows={3} value={proofPoints} onChange={(e) => setProofPoints(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-1" />
              </div>
              <Button type="submit" disabled={generating} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                <Sparkles className="h-4 w-4 mr-2" /> {generating ? "Drafting..." : "Generate Outreach"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Generated Templates */}
        <Card className="bg-slate-900 border-slate-800 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-white text-lg">Personalized Templates</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="py-16 text-center text-slate-500">Fill in contact details on the left to generate personalized messages.</div>
            ) : (
              <Tabs defaultValue="email" className="w-full">
                <TabsList className="bg-slate-800 text-slate-400">
                  <TabsTrigger value="email" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                    Cold Email
                  </TabsTrigger>
                  <TabsTrigger value="linkedin" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                    LinkedIn Note (&lt;300 chars)
                  </TabsTrigger>
                  <TabsTrigger value="followup" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                    5-Day Bump Email
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="space-y-3 mt-4">
                  <div className="p-3 bg-slate-800/80 rounded border border-slate-700 font-mono text-xs text-indigo-300">
                    Subject: {result.cold_email?.subject}
                  </div>
                  <div className="relative p-4 rounded bg-slate-950 border border-slate-800 font-mono text-sm text-slate-300 whitespace-pre-wrap">
                    {result.cold_email?.body}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyText(result.cold_email?.body, "email")}
                      className="absolute top-2 right-2 text-slate-400 hover:text-white"
                    >
                      {copiedKey === "email" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="linkedin" className="space-y-3 mt-4">
                  <div className="relative p-4 rounded bg-slate-950 border border-slate-800 font-mono text-sm text-slate-300 whitespace-pre-wrap">
                    {result.linkedin_note}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyText(result.linkedin_note, "linkedin")}
                      className="absolute top-2 right-2 text-slate-400 hover:text-white"
                    >
                      {copiedKey === "linkedin" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="followup" className="space-y-3 mt-4">
                  <div className="relative p-4 rounded bg-slate-950 border border-slate-800 font-mono text-sm text-slate-300 whitespace-pre-wrap">
                    {result.followup_bump}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyText(result.followup_bump, "followup")}
                      className="absolute top-2 right-2 text-slate-400 hover:text-white"
                    >
                      {copiedKey === "followup" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
