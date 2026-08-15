import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export function ApplicationStatus() {
  return (
    <RadioGroup defaultValue="interview" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="applied" id="status-applied" />
        <Label htmlFor="status-applied">Applied</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="interview" id="status-interview" />
        <Label htmlFor="status-interview">Interviewing</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="offer" id="status-offer" />
        <Label htmlFor="status-offer">Offer received</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="rejected" id="status-rejected" />
        <Label htmlFor="status-rejected">Rejected</Label>
      </div>
    </RadioGroup>
  );
}

export function WorkAuthorization() {
  return (
    <RadioGroup defaultValue="citizen" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="citizen" id="auth-citizen" />
        <Label htmlFor="auth-citizen">U.S. Citizen / Permanent Resident</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="visa" id="auth-visa" />
        <Label htmlFor="auth-visa">Require visa sponsorship (H-1B)</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="disabled-option" id="auth-other" disabled />
        <Label htmlFor="auth-other" className="opacity-70">
          Other (not applicable to this posting)
        </Label>
      </div>
    </RadioGroup>
  );
}
