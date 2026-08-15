import { LayoutGrid, List, Rows3 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export function SingleSelectView() {
  return (
    <ToggleGroup type="single" defaultValue="grid" aria-label="Job results layout">
      <ToggleGroupItem value="grid" aria-label="Grid view">
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List view">
        <List className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="compact" aria-label="Compact view">
        <Rows3 className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function MultiSelectFilters() {
  return (
    <ToggleGroup type="multiple" defaultValue={['remote', 'fulltime']} aria-label="Job filters">
      <ToggleGroupItem value="remote">Remote</ToggleGroupItem>
      <ToggleGroupItem value="fulltime">Full-time</ToggleGroupItem>
      <ToggleGroupItem value="contract">Contract</ToggleGroupItem>
      <ToggleGroupItem value="senior">Senior level</ToggleGroupItem>
    </ToggleGroup>
  );
}

export function OutlineVariantSizes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ToggleGroup type="single" variant="outline" size="sm" defaultValue="week" aria-label="Chart range">
        <ToggleGroupItem value="week">Week</ToggleGroupItem>
        <ToggleGroupItem value="month">Month</ToggleGroupItem>
        <ToggleGroupItem value="quarter">Quarter</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup type="single" variant="outline" size="lg" defaultValue="applied" aria-label="Application status">
        <ToggleGroupItem value="applied">Applied</ToggleGroupItem>
        <ToggleGroupItem value="interview">Interview</ToggleGroupItem>
        <ToggleGroupItem value="offer">Offer</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
