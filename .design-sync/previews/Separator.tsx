import { Separator } from '@/components/ui/separator';

export function Horizontal() {
  return (
    <div style={{ width: 360 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Resume Optimizer</div>
      <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
        Tailored for the Stripe Staff Engineer posting
      </div>
      <Separator style={{ margin: '12px 0' }} />
      <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Last edited 4 minutes ago</div>
    </div>
  );
}

export function Vertical() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 32, gap: 12 }}>
      <span style={{ fontSize: 13 }}>Applications</span>
      <Separator orientation="vertical" />
      <span style={{ fontSize: 13 }}>Interviews</span>
      <Separator orientation="vertical" />
      <span style={{ fontSize: 13 }}>Offers</span>
    </div>
  );
}

export function InSidebarNav() {
  return (
    <div style={{ width: 220, border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Job Tayari</div>
      <Separator style={{ margin: '10px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
        <span>Dashboard</span>
        <span>Job Search</span>
        <span>Applications</span>
      </div>
      <Separator style={{ margin: '10px 0' }} />
      <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Settings</div>
    </div>
  );
}
