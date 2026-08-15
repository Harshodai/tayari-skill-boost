import { Bold, Italic, Underline } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';

export function PressedStates() {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Toggle aria-label="Remote only">Remote only</Toggle>
      <Toggle aria-label="Remote only" pressed>
        Remote only
      </Toggle>
      <Toggle aria-label="Toggle bold" pressed>
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle aria-label="Toggle italic">
        <Italic className="h-4 w-4" />
      </Toggle>
    </div>
  );
}

export function Variants() {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Toggle variant="default" pressed aria-label="Full-time">
        Full-time
      </Toggle>
      <Toggle variant="outline" aria-label="Contract">
        Contract
      </Toggle>
      <Toggle variant="outline" pressed aria-label="Underline">
        <Underline className="h-4 w-4" />
      </Toggle>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Toggle size="sm" pressed aria-label="Small">
        Sm
      </Toggle>
      <Toggle size="default" pressed aria-label="Default">
        Default
      </Toggle>
      <Toggle size="lg" pressed aria-label="Large">
        Lg
      </Toggle>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Toggle disabled aria-label="Sponsorship required">
        Sponsorship required
      </Toggle>
      <Toggle disabled pressed aria-label="Salary disclosed">
        Salary disclosed
      </Toggle>
    </div>
  );
}
