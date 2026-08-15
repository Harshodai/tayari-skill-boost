import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';

export function InterviewScheduler() {
  const [date, setDate] = React.useState<Date | undefined>(new Date(2026, 7, 20));
  return (
    <div style={{ width: 300, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <Calendar mode="single" selected={date} onSelect={setDate} />
    </div>
  );
}

export function ApplicationDeadlineRange() {
  const [range, setRange] = React.useState<{ from: Date; to?: Date } | undefined>({
    from: new Date(2026, 7, 10),
    to: new Date(2026, 7, 17),
  });
  return (
    <div style={{ width: 300, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <Calendar mode="range" selected={range as any} onSelect={setRange as any} />
    </div>
  );
}

export function DisabledPastDates() {
  const [date, setDate] = React.useState<Date | undefined>(new Date(2026, 7, 15));
  return (
    <div style={{ width: 300, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <Calendar mode="single" selected={date} onSelect={setDate} disabled={{ before: new Date(2026, 7, 15) }} />
    </div>
  );
}
