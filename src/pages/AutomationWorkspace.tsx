import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Bell, CheckCircle2, Clock3, Mail, MessageCircle, PauseCircle, Play, RefreshCw, ShieldCheck, Workflow, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { features } from "@/config/features";
import {
  createAutomation,
  createAutomationRun,
  decideAutomationApproval,
  listAutomations,
  getNotificationPreferences,
  listAutomationApprovals,
  notifyApproval,
  updateNotificationPreferences,
  type AutomationApproval,
  type AutomationDefinition,
  type AutomationRun,
  type NotificationPreferences,
} from "@/api/dashboard";

const emptyPreferences: NotificationPreferences = {
  email_enabled: false,
  email_address: "",
  whatsapp_enabled: false,
  phone_e164: "",
  whatsapp_opt_in: false,
  locale: "en",
  quiet_hours: {},
  fallback_order: ["in_app"],
};

const AutomationWorkspace = () => {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [approvals, setApprovals] = useState<AutomationApproval[]>([]);
  const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [selectedAutomationId, setSelectedAutomationId] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("manual");
  const [preferences, setPreferences] = useState<NotificationPreferences>(emptyPreferences);
  const [loading, setLoading] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [startingRun, setStartingRun] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadWorkspace = useCallback(async () => {
    if (!features.automationControl) return;
    setLoading(true);
    setError("");
    try {
      const [automationResponse, approvalResponse, preferenceResponse] = await Promise.all([
        listAutomations(),
        listAutomationApprovals(),
        getNotificationPreferences(),
      ]);
      setAutomations(automationResponse.automations);
      setSelectedAutomationId((current) => current || automationResponse.automations.find((automation) => automation.status === "active")?.id || automationResponse.automations[0]?.id || "");
      setApprovals(approvalResponse.approvals);
      setPreferences(preferenceResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load automation workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const createDraftAutomation = async () => {
    if (!name.trim() || !objective.trim()) {
      setError("A name and objective are required before creating an automation draft.");
      return;
    }
    setError("");
    setNotice("");
    try {
      await createAutomation({
        name: name.trim(),
        objective: objective.trim(),
        trigger_type: triggerEvent === "manual" ? "manual" : "task_event",
        trigger_config: triggerEvent === "manual" ? {} : { event_types: [triggerEvent] },
        tool_allowlist: [],
        approval_policy: { plan_required: true, action_approval_required: true },
      });
      setName("");
      setObjective("");
      await loadWorkspace();
      setNotice("Automation draft created. It remains inactive until its plan and launch policy are approved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create automation draft.");
    }
  };

  const startRun = async () => {
    if (!selectedAutomationId) {
      setError("Select an active automation before starting a run.");
      return;
    }
    setStartingRun(true);
    setError("");
    setNotice("");
    try {
      const result = await createAutomationRun(selectedAutomationId, `frontend-${crypto.randomUUID()}`);
      setRuns((current) => [result, ...current.filter((run) => run.id !== result.id)]);
      setNotice("Run queued. The durable worker will checkpoint it at the approval boundary; no external action was executed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start the automation run.");
    } finally {
      setStartingRun(false);
    }
  };

  const savePreferences = async () => {
    setSavingPreferences(true);
    setError("");
    setNotice("");
    try {
      await updateNotificationPreferences(preferences);
      setNotice("Notification preferences saved. Delivery still requires provider configuration and release evidence.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save notification preferences.");
    } finally {
      setSavingPreferences(false);
    }
  };

  const decide = async (approval: AutomationApproval, decision: "approve" | "deny") => {
    setError("");
    try {
      await decideAutomationApproval(approval.id, decision);
      await loadWorkspace();
      setNotice(`Approval ${decision === "approve" ? "approved" : "denied"}. The server revalidated expiry, ownership, tenant, and action state.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record approval decision.");
    }
  };

  const sendNotification = async (approval: AutomationApproval, channel: "email" | "whatsapp") => {
    setError("");
    try {
      const result = await notifyApproval(approval.id, channel);
      setNotice(`${channel === "email" ? "Email" : "WhatsApp"} provider accepted the request. This is not proof that the message was delivered or that the action executed.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notification delivery failed; the in-app approval remains authoritative.");
    }
  };

  if (!features.automationControl) {
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-3"><PauseCircle className="h-6 w-6 text-amber-600" /><CardTitle>Automation workspace is staged</CardTitle></div>
            <CardDescription>Durable automation and outbound approval notifications are disabled until provider, isolation, recovery, and human-approval evidence is complete.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>No automation was started and no external message was sent.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Job discovery", "Refresh watches, enrich matches, and surface review-ready opportunities."],
                ["Pipeline care", "Detect stale stages and prepare follow-up drafts without sending them."],
                ["Research enrichment", "Use allowlisted Firecrawl or Apify research with provenance."],
                ["Interview workspace", "Detect Calendar interviews and prepare candidate-controlled materials."],
                ["Outcome learning", "Attribute interview and offer outcomes to future recommendations."],
                ["Approval delivery", "Route review notifications while keeping in-app approval authoritative."],
              ].map(([title, description]) => (
                <div key={title} className="rounded-lg border border-amber-500/20 bg-background/70 p-3">
                  <p className="font-medium text-foreground">{title}</p>
                  <p className="mt-1 text-xs leading-5">{description}</p>
                </div>
              ))}
            </div>
            <p className="text-xs">Launch remains gated until provider configuration, tenant-isolation, recovery, and human-approval evidence are reviewed.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-primary" /><h1 className="text-3xl font-semibold tracking-tight">Automation workspace</h1><Badge variant="outline">Human approval required</Badge></div>
        <p className="max-w-3xl text-muted-foreground">Build durable, candidate-controlled workflows with explicit plans, risk-tiered actions, checkpoints, and truthful delivery receipts. External job submission and sensitive browser fields remain disabled.</p>
      </header>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Action could not be completed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert><CheckCircle2 className="h-4 w-4" /><AlertTitle>Recorded</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>Draft an automation</CardTitle><CardDescription>Drafts are inactive until the server-side policy and plan approval gates pass.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="automation-name">Name</Label><Input id="automation-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="A name for this workflow" /></div>
            <div className="space-y-2"><Label htmlFor="automation-objective">Objective</Label><Textarea id="automation-objective" value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Describe what the workflow should do and what it must never do." className="min-h-32" /></div>
            <div className="space-y-2"><Label htmlFor="automation-trigger">Trigger</Label><Select value={triggerEvent} onValueChange={setTriggerEvent}><SelectTrigger id="automation-trigger"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual review</SelectItem><SelectItem value="job_match.found">New job match</SelectItem><SelectItem value="application.outcome_recorded">Application outcome recorded</SelectItem><SelectItem value="calendar.interview_detected">Interview detected in Calendar</SelectItem><SelectItem value="pipeline.sweep_due">Pipeline sweep</SelectItem></SelectContent></Select></div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground"><Bell className="mr-2 inline h-4 w-4" />Event triggers enqueue durable work only. Every draft, sensitive, and external-write action still stops at the canonical in-app approval boundary.</div>
            <Button onClick={() => void createDraftAutomation()} disabled={loading || !name.trim() || !objective.trim()}>Create inactive draft</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Approval inbox</CardTitle><CardDescription>In-app decisions are authoritative. Email and WhatsApp are delivery channels, not separate approval stores.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading approvals…</p>}
            {!loading && approvals.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No pending approvals.</div>}
            {approvals.map((approval) => (
              <div key={approval.id} className="space-y-3 rounded-xl border border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{approval.summary}</p><p className="text-xs text-muted-foreground">{approval.action_type} · {approval.risk_tier}</p></div><Badge variant={approval.risk_tier === "external_write" ? "destructive" : "outline"}>{approval.status}</Badge></div>
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Expires {new Date(approval.expires_at).toLocaleString()}</p>
                <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void decide(approval, "approve")}><CheckCircle2 className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" onClick={() => void decide(approval, "deny")}><XCircle className="mr-1 h-4 w-4" />Deny</Button><Button size="sm" variant="ghost" onClick={() => void sendNotification(approval, "email")} disabled={!preferences.email_enabled}><Mail className="mr-1 h-4 w-4" />Email</Button><Button size="sm" variant="ghost" onClick={() => void sendNotification(approval, "whatsapp")} disabled={!preferences.whatsapp_enabled || !preferences.whatsapp_opt_in}><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</Button></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><div className="flex items-center gap-2"><Workflow className="h-5 w-5 text-primary" /><CardTitle>Automation catalog and runs</CardTitle></div><CardDescription>Choose a server-owned workflow and start a durable, tenant-scoped run. Draft and inactive workflows remain blocked by the server.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end"><div className="min-w-0 flex-1 space-y-2"><Label htmlFor="automation-select">Workflow</Label><Select value={selectedAutomationId} onValueChange={setSelectedAutomationId}><SelectTrigger id="automation-select"><SelectValue placeholder="Select an automation" /></SelectTrigger><SelectContent>{automations.map((automation) => <SelectItem key={automation.id} value={automation.id}>{automation.name} · {automation.status}</SelectItem>)}</SelectContent></Select></div><Button onClick={() => void startRun()} disabled={startingRun || !selectedAutomationId}><Play className="mr-2 h-4 w-4" />{startingRun ? "Queueing…" : "Start governed run"}</Button><Button variant="outline" onClick={() => void loadWorkspace()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
          {automations.length === 0 && <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No automation definitions are visible for this tenant yet. Create a draft above, then activate it through the server-side launch policy.</div>}
          {runs.length > 0 && <div className="space-y-2"><p className="text-sm font-medium">Runs started in this session</p>{runs.map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><span className="font-mono text-xs">{run.id}</span><Badge variant={run.status === "awaiting_action_approval" ? "destructive" : "outline"}>{run.status}</Badge><span className="text-xs text-muted-foreground">Updated {new Date(run.updated_at).toLocaleString()}</span></div>)}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Approval notification preferences</CardTitle><CardDescription>External delivery is opt-in and remains disabled until providers are configured and staging evidence passes.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border p-4"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /><p className="font-medium">Email</p></div><div className="flex items-center gap-2"><Checkbox id="email-enabled" checked={preferences.email_enabled} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, email_enabled: checked === true }))} /><Label htmlFor="email-enabled">Enable approval email</Label></div><Input value={preferences.email_address ?? ""} onChange={(event) => setPreferences((current) => ({ ...current, email_address: event.target.value }))} placeholder="Verified email address" /></div>
          <div className="space-y-3 rounded-xl border p-4"><div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /><p className="font-medium">WhatsApp</p></div><div className="flex items-center gap-2"><Checkbox id="whatsapp-enabled" checked={preferences.whatsapp_enabled} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, whatsapp_enabled: checked === true }))} /><Label htmlFor="whatsapp-enabled">Enable WhatsApp approval</Label></div><Input value={preferences.phone_e164 ?? ""} onChange={(event) => setPreferences((current) => ({ ...current, phone_e164: event.target.value }))} placeholder="Phone in E.164 format" /><div className="flex items-start gap-2"><Checkbox id="whatsapp-opt-in" checked={preferences.whatsapp_opt_in} onCheckedChange={(checked) => setPreferences((current) => ({ ...current, whatsapp_opt_in: checked === true }))} /><Label htmlFor="whatsapp-opt-in" className="text-sm leading-5">I explicitly opt in to JobTayari approval notifications on WhatsApp.</Label></div></div>
          <div className="md:col-span-2"><Button onClick={() => void savePreferences()} disabled={savingPreferences}>{savingPreferences ? "Saving…" : "Save notification preferences"}</Button></div>
        </CardContent>
      </Card>
    </main>
  );
};

export default AutomationWorkspace;
