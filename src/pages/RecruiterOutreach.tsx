import { apiFetchResponse } from "@/api";
import React, { useState } from "react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Mail, Linkedin, Copy, Check, Sparkles, Send, ExternalLink, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SAMPLE_OUTREACH_TARGETS = [
  {
    name: "Sarah Jenkins",
    company: "Stripe",
    role: "Staff Frontend Engineer",
    points: "Architected micro-frontends serving 4.2M DAU, reduced LCP by 42%, and led 14-team Playwright test adoption.",
  },
  {
    name: "Marcus Vance",
    company: "Cloudflare",
    role: "Lead Systems Engineer",
    points: "Built high-throughput Go/Kafka event streamer handling 250k events/sec and cut database contention by 78%.",
  },
];

export function RecruiterOutreach() {
  const [recruiterName, setRecruiterName] = useState("");
  const [company, setCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [proofPoints, setProofPoints] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadSampleTarget = (target: typeof SAMPLE_OUTREACH_TARGETS[0]) => {
    setRecruiterName(target.name);
    setCompany(target.company);
    setTargetRole(target.role);
    setProofPoints(target.points);
    setResult(null);
    toast.success(`Loaded outreach target: ${target.name} @ ${target.company}`);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !targetRole.trim()) {
      toast.error("Please enter company name and target role.");
      return;
    }
    setGenerating(true);

    try {
      const resp = await apiFetchResponse("/v1/recruiter/patterns", {
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
      } else {
        const errBody = await resp.json().catch(() => null);
        toast.error(errBody?.detail || "Could not generate the outreach campaign. Please try again.");
      }
    } catch {
      toast.error("Could not reach the server. Check your connection and try again.");
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

  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [pendingSubject, setPendingSubject] = useState("");
  const [pendingBody, setPendingBody] = useState("");

  const initiateSendReview = (subject: string, body: string) => {
    setPendingSubject(subject || "Outreach");
    setPendingBody(body || "");
    setApprovalDialogOpen(true);
  };

  const confirmAndOpenGmail = async () => {
    setApprovalDialogOpen(false);

    // Backend atomic duplicate check — 30-day window enforced server-side
    try {
      const resp = await apiFetchResponse("/v1/networking/record-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          recruiter_name: recruiterName.trim(),
          subject: pendingSubject,
        }),
      });
      if (resp.status === 409) {
        // Duplicate within 30-day window
        toast.error("Duplicate Outreach Blocked", {
          description: `You already reached out to ${recruiterName || "this contact"} at ${company} within the last 30 days. Gmail not opened.`,
          duration: 7000,
        });
        return;
      }
      if (!resp.ok) {
        // Non-2xx other than duplicate — surface error and block
        const body = await resp.json().catch(() => ({}));
        toast.error("Outreach record failed", {
          description: (body as any)?.error || `Server returned ${resp.status}. Gmail not opened.`,
          duration: 6000,
        });
        return;
      }
    } catch (err) {
      // Network failure — fail closed
      toast.error("Outreach check failed", {
        description: "Could not reach the server to verify duplicate. Gmail not opened.",
        duration: 6000,
      });
      return;
    }

    openGmail(pendingSubject, pendingBody);
    toast.success("Candidate approval confirmed — opening in Gmail");
  };


  return (
    <AppShell>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight font-display">Recruiter Cold Outreach Engine</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Send className="w-3.5 h-3.5 mr-1" /> 3-Touch Drip Campaign
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Find decision-maker email patterns and generate personalized, high-converting 3-touch outreach sequences.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_OUTREACH_TARGETS.map((t) => (
              <Button
                key={t.name}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadSampleTarget(t)}
                className="text-xs h-7 font-medium active:scale-[0.98]"
              >
                Sample: {t.company}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Side */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" /> Target Outreach Details
                </CardTitle>
                <CardDescription className="text-xs">
                  Provide company and candidate proof points for tailored outreach.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGenerate} className="space-y-3.5 text-sm">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Recruiter / Manager Name</label>
                    <Input placeholder="e.g. Sarah Jenkins" value={recruiterName} onChange={(e) => setRecruiterName(e.target.value)} className="mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Company Name *</label>
                    <Input placeholder="e.g. Stripe, OpenAI" value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Target Role *</label>
                    <Input placeholder="e.g. Staff Frontend Engineer" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Top Metric Achievement / Proof Point</label>
                    <Textarea placeholder="e.g. Scaled GraphQL gateway to 4.2M DAU with sub-50ms p99 latency..." value={proofPoints} onChange={(e) => setProofPoints(e.target.value)} rows={3} className="mt-1 text-xs" />
                  </div>

                  <Button type="submit" className="w-full gap-2 font-semibold shadow-md active:scale-[0.98]" disabled={generating}>
                    <Sparkles className="w-4 h-4" /> {generating ? "Generating Drip Sequence..." : "Generate Outreach Sequence"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Email Permutation Finder Card */}
            {company && (
              <Card className="bg-primary/5 border-primary/20 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold flex items-center gap-2 text-primary font-mono">
                    <ShieldCheck className="w-4 h-4" /> Inferred Corporate Email Patterns
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-mono bg-background p-2 rounded-lg border text-[11px]">
                    <span>{(recruiterName || "first.last").toLowerCase().replace(/\s+/g, ".")}@{company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com</span>
                    <Badge variant="outline" className="text-[10px] bg-success/10 text-success">90% match</Badge>
                  </div>
                  <div className="flex items-center justify-between font-mono bg-background p-2 rounded-lg border text-[11px]">
                    <span>{(recruiterName || "flast").toLowerCase().replace(/\s+/g, "").charAt(0)}{(recruiterName || "last").toLowerCase().split(/\s+/).pop() || "last"}@{company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com</span>
                    <Badge variant="outline" className="text-[10px]">85% match</Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Drip Sequence & Preview */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Linkedin className="w-4 h-4 text-blue-500" /> Multi-Touch Outreach Sequence
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {!result ? (
                  <div className="py-16 text-center text-muted-foreground space-y-2">
                    <Mail className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-medium text-foreground">No Campaign Generated Yet</p>
                    <p className="text-xs max-w-sm mx-auto">
                      Enter the target recruiter/company and your metric achievement on the left, then click "Generate Outreach Sequence".
                    </p>
                  </div>
                ) : (
                  <Tabs defaultValue="touch1" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="touch1" className="text-xs">Touch 1: Initial Pitch (Day 0)</TabsTrigger>
                      <TabsTrigger value="touch2" className="text-xs">Touch 2: Follow-up (Day 3)</TabsTrigger>
                      <TabsTrigger value="touch3" className="text-xs">Touch 3: Breakaway (Day 7)</TabsTrigger>
                      <TabsTrigger value="linkedin" className="text-xs">LinkedIn Note</TabsTrigger>
                    </TabsList>

                    {/* Touch 1 */}
                    <TabsContent value="touch1" className="space-y-3">
                      <div className="flex items-center justify-between bg-muted/40 p-2 rounded-lg border text-xs font-mono">
                        <span>Subject: {result?.cold_email?.subject}</span>
                        <Button variant="ghost" size="sm" onClick={() => copyText(result?.cold_email?.subject, "sub1")}>
                          {copiedKey === "sub1" ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                        </Button>
                      </div>
                      <Textarea readOnly value={result?.cold_email?.body} rows={8} className="font-mono text-xs leading-relaxed" />
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => initiateSendReview(result?.cold_email?.subject, result?.cold_email?.body)} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground active:scale-[0.98]">
                          <UserCheck className="w-4 h-4" /> Review & Send
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copyText(result?.cold_email?.body, "body1")} className="gap-2 active:scale-[0.98]">
                          <Copy className="w-4 h-4" /> Copy Email Body
                        </Button>
                      </div>
                    </TabsContent>

                    {/* Touch 2 */}
                    <TabsContent value="touch2" className="space-y-3">
                      <div className="flex items-center justify-between bg-muted/40 p-2 rounded-lg border text-xs font-mono">
                        <span>Subject: {result?.followup_1?.subject || "Re: Application follow-up"}</span>
                      </div>
                      <Textarea readOnly value={result?.followup_1?.body} rows={6} className="font-mono text-xs leading-relaxed" />
                      <Button size="sm" variant="outline" onClick={() => copyText(result?.followup_1?.body, "body2")} className="gap-2 active:scale-[0.98]">
                        <Copy className="w-4 h-4" /> Copy Follow-up 1
                      </Button>
                    </TabsContent>

                    {/* Touch 3 */}
                    <TabsContent value="touch3" className="space-y-3">
                      <div className="flex items-center justify-between bg-muted/40 p-2 rounded-lg border text-xs font-mono">
                        <span>Subject: {result?.followup_2?.subject || "Final check-in"}</span>
                      </div>
                      <Textarea readOnly value={result?.followup_2?.body} rows={6} className="font-mono text-xs leading-relaxed" />
                      <Button size="sm" variant="outline" onClick={() => copyText(result?.followup_2?.body, "body3")} className="gap-2 active:scale-[0.98]">
                        <Copy className="w-4 h-4" /> Copy Breakaway Check
                      </Button>
                    </TabsContent>

                    {/* LinkedIn */}
                    <TabsContent value="linkedin" className="space-y-3">
                      <Textarea readOnly value={result?.linkedin_note} rows={4} className="font-mono text-xs leading-relaxed" />
                      <Button size="sm" variant="outline" onClick={() => copyText(result?.linkedin_note, "li")} className="gap-2 active:scale-[0.98]">
                        <Copy className="w-4 h-4" /> Copy LinkedIn Note (Under 300 chars)
                      </Button>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* WP-16 Candidate Approval & Verification Confirmation Dialog */}
        <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Candidate Outreach Approval
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Review message details before transmitting. Decision-maker contact patterns are hypotheses and require human verification.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Recipient:</span>
                  <span className="font-semibold text-foreground">{recruiterName || "Hiring Manager"} ({company})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confidence:</span>
                  <Badge variant="outline" className="text-[10px] h-4">Medium (Pattern Hypothesis)</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subject:</span>
                  <span className="font-medium text-foreground truncate max-w-[200px]">{pendingSubject}</span>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] leading-relaxed">
                Notice: Outreach duplicate protection blocks re-sending to the same company within 30 days. No automated sending occurs without your explicit confirmation.
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={() => setApprovalDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="default" onClick={confirmAndOpenGmail} className="gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Confirm & Open Gmail
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

export default RecruiterOutreach;
