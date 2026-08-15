import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function States() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Switch id="auto-apply" />
        <Label htmlFor="auto-apply">Autopilot job applications</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Switch id="email-alerts" defaultChecked />
        <Label htmlFor="email-alerts">Email me new matching roles</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Switch id="disabled-off" disabled />
        <Label htmlFor="disabled-off" className="opacity-70">
          SMS alerts (upgrade to Pro)
        </Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Switch id="disabled-on" disabled defaultChecked />
        <Label htmlFor="disabled-on" className="opacity-70">
          ATS scan on save (always on)
        </Label>
      </div>
    </div>
  );
}

export function SettingsRow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: 360,
        padding: '12px 16px',
        border: '1px solid hsl(var(--border))',
        borderRadius: 8,
      }}
    >
      <div>
        <Label htmlFor="weekly-digest" style={{ fontSize: 14, fontWeight: 500, display: 'block', cursor: 'pointer' }}>
          Weekly ATS digest
        </Label>
        <p id="weekly-digest-desc" style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
          Summary of resume score changes, sent Mondays
        </p>
      </div>
      <Switch id="weekly-digest" aria-describedby="weekly-digest-desc" defaultChecked />
    </div>
  );
}
