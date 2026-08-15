import { Download, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Variants() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <Button variant="default">Apply now</Button>
      <Button variant="glow">Optimize resume</Button>
      <Button variant="secondary">Save draft</Button>
      <Button variant="outline">View details</Button>
      <Button variant="ghost">Dismiss</Button>
      <Button variant="link">Learn more</Button>
      <Button variant="success">Mark hired</Button>
      <Button variant="info">Run ATS scan</Button>
      <Button variant="destructive">Delete application</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra large</Button>
      <Button size="icon" aria-label="Download">
        <Download />
      </Button>
    </div>
  );
}

export function WithIcons() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <Button>
        <Download />
        Export PDF
      </Button>
      <Button variant="outline">
        <Trash2 />
        Remove
      </Button>
      <Button disabled>
        <Loader2 className="animate-spin" />
        Submitting…
      </Button>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Button disabled>Apply now</Button>
      <Button variant="outline" disabled>
        View details
      </Button>
      <Button variant="destructive" disabled>
        Delete application
      </Button>
    </div>
  );
}
