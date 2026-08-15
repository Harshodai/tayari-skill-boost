import { Search, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Basic() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 320 }}>
      <Label htmlFor="job-search">Search job title or company</Label>
      <Input id="job-search" placeholder="e.g. Senior Frontend Engineer" defaultValue="Staff Product Designer" />
    </div>
  );
}

export function WithIcon() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
      <div style={{ position: 'relative' }}>
        <Search aria-hidden="true" style={{ position: 'absolute', left: 10, top: 11, width: 16, height: 16, color: 'hsl(var(--muted-foreground))', pointerEvents: 'none' }} />
        <Input aria-label="Search open roles" placeholder="Search 2,400 open roles" style={{ paddingLeft: 32 }} />
      </div>
      <div style={{ position: 'relative' }}>
        <Mail aria-hidden="true" style={{ position: 'absolute', left: 10, top: 11, width: 16, height: 16, color: 'hsl(var(--muted-foreground))', pointerEvents: 'none' }} />
        <Input type="email" aria-label="Email address" placeholder="you@example.com" style={{ paddingLeft: 32 }} />
      </div>
    </div>
  );
}

export function ValidationStates() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 320 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label htmlFor="salary-min">Minimum salary</Label>
        <Input id="salary-min" success defaultValue="$140,000" />
        <p style={{ fontSize: 12, color: 'hsl(var(--success))' }}>Looks good — within market range</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Label htmlFor="linkedin-url">LinkedIn profile URL</Label>
        <Input id="linkedin-url" error defaultValue="linkedin/harsha" />
        <p style={{ fontSize: 12, color: 'hsl(var(--destructive))' }}>Enter a valid LinkedIn URL</p>
      </div>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 320 }}>
      <Label htmlFor="applicant-email">Account email</Label>
      <Input id="applicant-email" disabled defaultValue="harsha@jobtayari.com" />
    </div>
  );
}
