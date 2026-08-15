import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function States() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Checkbox id="remote-only" />
        <Label htmlFor="remote-only">Remote only</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Checkbox id="visa-sponsor" defaultChecked />
        <Label htmlFor="visa-sponsor">Visa sponsorship available</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Checkbox id="disabled-unchecked" disabled />
        <Label htmlFor="disabled-unchecked" className="opacity-70">
          Under $120k (hidden by filter)
        </Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Checkbox id="disabled-checked" disabled defaultChecked />
        <Label htmlFor="disabled-checked" className="opacity-70">
          Full-time (locked)
        </Label>
      </div>
    </div>
  );
}

export function JobTypeFilterList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 260 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Job type</p>
      {[
        { id: 'jt-fulltime', label: 'Full-time', checked: true },
        { id: 'jt-contract', label: 'Contract', checked: true },
        { id: 'jt-intern', label: 'Internship', checked: false },
      ].map((opt) => (
        <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Checkbox id={opt.id} defaultChecked={opt.checked} />
          <Label htmlFor={opt.id}>{opt.label}</Label>
        </div>
      ))}
    </div>
  );
}
