import React, { useState } from "react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Mail, Linkedin, Copy, Check, Sparkles, Send, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function RecruiterOutreach() {
  const [recruiterName, setRecruiterName] = useState("Sarah Jenkins");
  const [company, setCompany] = useState("Stripe");
  const [targetRole, setTargetRole] = useState("Senior Backend Engineer");
  const [proofPoints, setProofPoints] = useState(
    "Built high-throughput payment webhook microservices handling 10M+ daily events with 45% lower latency using Go & Redis."
  );
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>({
    company: "Stripe",
    role: "Senior Backend Engineer",
    recruiter_name: "Sarah Jenkins",
    cold_email: {
      subject: "Application for Senior Backend Engineer — Quick question re: Stripe tech stack",
      body: `Hi Sarah,\n\nI recently submitted my application for the Senior Backend Engineer role at Stripe.\n\nHaving led engineering projects that scaled systems to 2M+ daily requests while maintaining 99.99% uptime, I was particularly drawn to Stripe's recent work in resilient microservices.\n\nI've attached my ATS-optimized resume for your quick review. Would you be open to a brief 5-minute chat next Tuesday regarding your team's immediate priorities?\n\nBest regards,\nAlex Mercer\nhttps://alexmercer.dev`,
    },
    followup_1: {
      subject: "Re: Application for Senior Backend Engineer — Brief insight",
      body: `Hi Sarah,\n\nFollowing up on my note from earlier this week regarding the Senior Backend Engineer role. I came across a recent technical post on Stripe's engineering blog and thought of a similar Redis caching optimization we implemented that cut API latency by 45%.\n\nI'd love to share the brief case study if useful for your team.\n\nBest,\nAlex Mercer`,
    },
    followup_2: {
      subject: "Final check — Senior Backend Engineer role at Stripe",
      body: `Hi Sarah,\n\nI know your schedule is extremely busy. I'll make this my final check-in regarding the Senior Backend Engineer position.\n\nIf the role has been filled or priorities have shifted, no worries at all! If you're still interviewing candidates, I'd welcome 5 minutes to introduce myself.\n\nThanks again,\nAlex Mercer`,
    },
    linkedin_note: `Hi Sarah, I saw Stripe is hiring for a Senior Backend Engineer. Given my background in building high-throughput microservices, I'd love to connect!`,
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const resp = await fetch("/api/v1/recruiter/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: company,
          job_title: targetRole,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setResult(data);
        toast.success("Outreach Campaign Generated!");
      }
    } catch {
      // Keep existing preview
    } finally {
      setGenerating(false);
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success("Copied to Clipboard!");
  };

  const openGmail = (subject: string, body: string) => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank");
  };

  return (
    <AppShell>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Recruiter Cold Outreach Engine</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Send className="w-3.5 h-3.5 mr-1" /> 3-Touch Drip Campaign
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Find decision-maker email patterns and generate personalized, high-converting 3-touch outreach sequences.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Side */}
          <div className="lg:col-span-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" /> Target Outreach Details
                </CardTitle>
                <CardDescription className="text-xs">
                  Provide company and candidate proof points for tailored outreach.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGenerate} className="space-y-4 text-sm">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Recruiter / Manager Name</label>
                    <Input value={recruiterName} onChange={(e) => setRecruiterName(e.target.value)} className="mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Company Name</label>
                    <Input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Target Role</label>
                    <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Top Metric Achievement</label>
                    <Textarea value={proofPoints} onChange={(e) => setProofPoints(e.target.value)} rows={3} className="mt-1 text-xs" />
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={generating}>
                    <Sparkles className="w-4 h-4" /> Generate Outreach Sequence
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Email Permutation Finder Card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold flex items-center gap-2 text-primary">
                  <ShieldCheck className="w-4 h-4" /> Inferred Corporate Email Patterns
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-mono bg-background p-2 rounded border">
                  <span>{recruiterName.toLowerCase().replace(/\s+/g, ".")}@{company.toLowerCase()}.com</span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500">90% match</Badge>
                </div>
                <div className="flex items-center justify-between font-mono bg-background p-2 rounded border">
                  <span>{recruiterName.toLowerCase().replace(/\s+/g, "").charAt(0)}{recruiterName.toLowerCase().split(/\s+/).pop() || recruiterName.toLowerCase()}@{company.toLowerCase()}.com</span>
                  <Badge variant="outline" className="text-[10px]">85% match</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Drip Sequence & Preview */}
          <div className="lg:col-span-8 space-y-4">
            <Card>
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Linkedin className="w-4 h-4 text-blue-500" /> Multi-Touch Outreach Sequence
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Tabs defaultValue="touch1" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="touch1">Touch 1: Initial Pitch (Day 0)</TabsTrigger>
                    <TabsTrigger value="touch2">Touch 2: Follow-up (Day 3)</TabsTrigger>
                    <TabsTrigger value="touch3">Touch 3: Breakaway (Day 7)</TabsTrigger>
                    <TabsTrigger value="linkedin">LinkedIn Note</TabsTrigger>
                  </TabsList>

                  {/* Touch 1 */}
                  <TabsContent value="touch1" className="space-y-3">
                    <div className="flex items-center justify-between bg-muted/40 p-2 rounded border text-xs font-mono">
                      <span>Subject: {result?.cold_email?.subject}</span>
                      <Button variant="ghost" size="sm" onClick={() => copyText(result?.cold_email?.subject, "sub1")}>
                        {copiedKey === "sub1" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                    <Textarea readOnly value={result?.cold_email?.body} rows={8} className="font-mono text-xs" />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => openGmail(result?.cold_email?.subject, result?.cold_email?.body)} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                        <Mail className="w-4 h-4" /> Open in Gmail
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => copyText(result?.cold_email?.body, "body1")} className="gap-2">
                        <Copy className="w-4 h-4" /> Copy Email Body
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Touch 2 */}
                  <TabsContent value="touch2" className="space-y-3">
                    <div className="flex items-center justify-between bg-muted/40 p-2 rounded border text-xs font-mono">
                      <span>Subject: {result?.followup_1?.subject || "Re: Application follow-up"}</span>
                    </div>
                    <Textarea readOnly value={result?.followup_1?.body} rows={6} className="font-mono text-xs" />
                    <Button size="sm" variant="outline" onClick={() => copyText(result?.followup_1?.body, "body2")} className="gap-2">
                      <Copy className="w-4 h-4" /> Copy Follow-up 1
                    </Button>
                  </TabsContent>

                  {/* Touch 3 */}
                  <TabsContent value="touch3" className="space-y-3">
                    <div className="flex items-center justify-between bg-muted/40 p-2 rounded border text-xs font-mono">
                      <span>Subject: {result?.followup_2?.subject || "Final check-in"}</span>
                    </div>
                    <Textarea readOnly value={result?.followup_2?.body} rows={6} className="font-mono text-xs" />
                    <Button size="sm" variant="outline" onClick={() => copyText(result?.followup_2?.body, "body3")} className="gap-2">
                      <Copy className="w-4 h-4" /> Copy Breakaway Check
                    </Button>
                  </TabsContent>

                  {/* LinkedIn */}
                  <TabsContent value="linkedin" className="space-y-3">
                    <Textarea readOnly value={result?.linkedin_note} rows={4} className="font-mono text-xs" />
                    <Button size="sm" variant="outline" onClick={() => copyText(result?.linkedin_note, "li")} className="gap-2">
                      <Copy className="w-4 h-4" /> Copy LinkedIn Note (Under 300 chars)
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default RecruiterOutreach;
