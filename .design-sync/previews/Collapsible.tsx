import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

export function ResumeBulletDetails() {
  return (
    <Collapsible defaultOpen style={{ width: 420 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Led migration to design tokens</span>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Toggle details">
            <ChevronsUpDown style={{ height: 16, width: 16 }} />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <p style={{ marginTop: 8, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
          Reduced component style drift 60% across 12 product surfaces at Stripe by
          rolling out a shared token pipeline — the STAR-scored version of this bullet.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FilterPanel() {
  return (
    <Collapsible style={{ width: 320 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>More filters</span>
          <Badge variant="secondary">2 active</Badge>
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm">
            Toggle
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <span>Remote only</span>
          <span>Salary: $150k+</span>
          <span>Posted in last 7 days</span>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
