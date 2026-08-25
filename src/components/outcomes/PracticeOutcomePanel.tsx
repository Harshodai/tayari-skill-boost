import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { listPracticeOutcomes, recordPracticeOutcome, type PracticeOutcome } from "@/api";

export function PracticeOutcomePanel() {
  const [sessionId, setSessionId] = useState("");
  const [completionStatus, setCompletionStatus] = useState<PracticeOutcome["completion_status"]>("completed");
  const [confidence, setConfidence] = useState(70);
  const [interviewOutcome, setInterviewOutcome] = useState<PracticeOutcome["interview_outcome"]>("unknown");
  const [correctionNote, setCorrectionNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [outcomes, setOutcomes] = useState<PracticeOutcome[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listPracticeOutcomes(8).then((items) => {
      if (!cancelled) setOutcomes(items);
    }).catch(() => {
      // The page remains usable when outcome storage is unavailable.
    });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async () => {
    if (!sessionId.trim()) {
      toast.error("Add a practice session name before saving.");
      return;
    }
    if (!consent) {
      toast.error("Confirm consent before recording an outcome.");
      return;
    }
    setSaving(true);
    try {
      const outcome = await recordPracticeOutcome({
        practice_session_id: sessionId.trim(),
        completion_status: completionStatus,
        confidence,
        interview_outcome: interviewOutcome,
        correction_note: correctionNote.trim() || null,
        consent_acknowledged: true,
      });
      setOutcomes((items) => [outcome, ...items].slice(0, 8));
      setCorrectionNote("");
      toast.success("Practice outcome recorded with your consent.");
    } catch {
      toast.error("Could not save this practice outcome.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="practice-outcome-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-primary" /> Preparation outcomes</CardTitle>
        <CardDescription>Track practice progress and corrections only when you explicitly consent. Job Tayari never stores raw answers or transcripts here.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="practice-session">Practice session</Label>
            <Input id="practice-session" value={sessionId} onChange={(event) => setSessionId(event.target.value)} placeholder="e.g. data-platform-mock-1" maxLength={160} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="completion-status">Completion</Label>
            <select id="completion-status" value={completionStatus} onChange={(event) => setCompletionStatus(event.target.value as PracticeOutcome["completion_status"])} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="started">Started</option><option value="partial">Partial</option><option value="completed">Completed</option><option value="skipped">Skipped</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="practice-confidence">Confidence: {confidence}%</Label>
            <input id="practice-confidence" type="range" min={0} max={100} step={5} value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} className="w-full accent-primary" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="interview-outcome">Interview outcome</Label>
            <select id="interview-outcome" value={interviewOutcome} onChange={(event) => setInterviewOutcome(event.target.value as PracticeOutcome["interview_outcome"])} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="unknown">Unknown</option><option value="no_interview">No interview</option><option value="screen">Screen</option><option value="technical">Technical</option><option value="onsite">Onsite</option><option value="offer">Offer</option><option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="practice-correction">Correction or reflection (optional)</Label>
          <Textarea id="practice-correction" value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} placeholder="What should Job Tayari correct or remember about this practice result?" maxLength={1000} />
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <Checkbox id="practice-consent" checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} />
          <Label htmlFor="practice-consent" className="text-xs leading-5 text-muted-foreground">I consent to storing this bounded progress signal for my account. I understand it can be deleted later and does not include raw answers or transcripts.</Label>
        </div>
        <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>{saving ? "Saving…" : "Record outcome"}</Button>
        {outcomes.length > 0 && (
          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-xs font-semibold text-foreground">Recent practice signals</p>
            {outcomes.slice(0, 4).map((outcome) => <div key={outcome.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-xs"><span className="truncate">{outcome.practice_session_id} · {outcome.completion_status}</span><span className="ml-3 flex shrink-0 items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {outcome.confidence}%</span></div>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
