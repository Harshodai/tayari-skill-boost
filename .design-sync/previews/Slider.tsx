import * as React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

export function SalaryRange() {
  const [salary, setSalary] = React.useState([150]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Label htmlFor="salary-slider">Minimum salary</Label>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--primary))' }}>
          ${(salary[0] * 1000).toLocaleString()}
        </span>
      </div>
      <Slider id="salary-slider" value={salary} onValueChange={setSalary} min={60} max={300} step={5} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
        <span>$60k</span>
        <span>$300k</span>
      </div>
    </div>
  );
}

export function AtsMatchThreshold() {
  const [threshold, setThreshold] = React.useState([75]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Label htmlFor="ats-threshold">Only show jobs with ATS match above</Label>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--primary))' }}>{threshold[0]}%</span>
      </div>
      <Slider id="ats-threshold" value={threshold} onValueChange={setThreshold} min={0} max={100} step={1} />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Label htmlFor="commute-slider" className="opacity-70">
          Max commute distance (locked — remote only)
        </Label>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>0 mi</span>
      </div>
      <Slider id="commute-slider" defaultValue={[0]} min={0} max={50} step={5} disabled />
    </div>
  );
}
