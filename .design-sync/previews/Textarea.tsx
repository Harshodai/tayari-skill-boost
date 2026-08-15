import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function Basic() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 380 }}>
      <Label htmlFor="cover-letter">Cover letter opening</Label>
      <Textarea
        id="cover-letter"
        placeholder="Dear Hiring Manager, I'm excited to apply for the Senior Frontend Engineer role at Stripe…"
        rows={4}
      />
    </div>
  );
}

export function Filled() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 380 }}>
      <Label htmlFor="star-bullet">STAR bullet — Situation &amp; Task</Label>
      <Textarea
        id="star-bullet"
        defaultValue="Led the redesign of the checkout flow for a Series B fintech product after conversion dropped 12% following a platform migration."
        rows={4}
      />
    </div>
  );
}

export function ValidationStates() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 380 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label htmlFor="summary-good">Resume summary</Label>
        <Textarea
          id="summary-good"
          success
          rows={3}
          defaultValue="Staff engineer with 8 years building design systems used by 40+ product teams."
        />
        <p style={{ fontSize: 12, color: 'hsl(var(--success))' }}>Strong opening — quantified impact detected</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label htmlFor="summary-bad">Resume summary</Label>
        <Textarea id="summary-bad" error rows={3} defaultValue="Worked on stuff related to frontend things." />
        <p style={{ fontSize: 12, color: 'hsl(var(--destructive))' }}>
          Too vague — add metrics and specific technologies
        </p>
      </div>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 380 }}>
      <Label htmlFor="locked-notes">Recruiter notes (locked)</Label>
      <Textarea id="locked-notes" disabled rows={3} defaultValue="Candidate requested to pause outreach until Q3." />
    </div>
  );
}
