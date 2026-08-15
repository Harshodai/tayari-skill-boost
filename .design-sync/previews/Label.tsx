import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

export function Basic() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 280 }}>
      <Label htmlFor="label-basic-title">Resume title</Label>
      <Input id="label-basic-title" defaultValue="Senior Frontend Engineer — Stripe" />
    </div>
  );
}

export function Required() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 280 }}>
      <Label htmlFor="label-required-company">
        Company name <span style={{ color: 'hsl(var(--destructive))' }}>*</span>
      </Label>
      <Input id="label-required-company" placeholder="e.g. Anthropic" />
    </div>
  );
}

export function PeerDisabled() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Checkbox id="label-peer-disabled" disabled className="peer" />
      <Label htmlFor="label-peer-disabled">Priority review (Pro plan only)</Label>
    </div>
  );
}
