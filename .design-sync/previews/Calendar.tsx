import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';

// The sandboxed capture browser's real system clock doesn't match the app's
// "today" — react-day-picker defaults its displayed month to the real
// `new Date()` unless told otherwise, so without an explicit `defaultMonth`
// every story here showed the sandbox's actual current month instead of the
// dates the story is meant to demonstrate. Pin `defaultMonth` explicitly.

export function InterviewScheduler() {
  const [date, setDate] = React.useState<Date | undefined>(new Date(2026, 7, 20));
  return (
    <div style={{ width: 300, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <Calendar mode="single" selected={date} onSelect={setDate} defaultMonth={new Date(2026, 7, 1)} />
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
      <Calendar mode="range" selected={range as any} onSelect={setRange as any} defaultMonth={new Date(2026, 7, 1)} />
    </div>
  );
}

export function DisabledPastDates() {
  const [date, setDate] = React.useState<Date | undefined>(new Date(2026, 7, 15));
  return (
    <div style={{ width: 300, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        disabled={{ before: new Date(2026, 7, 15) }}
        defaultMonth={new Date(2026, 7, 1)}
      />
    </div>
  );
}
