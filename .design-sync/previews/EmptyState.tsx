import { Inbox, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

const noop = () => {};

export function WithAction() {
  return (
    <div style={{ width: 420, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <EmptyState
        icon={<Inbox />}
        title="No saved applications yet"
        description="Applications you submit through Job Tayari will show up here so you can track their status."
        action={{ label: 'Browse jobs', onClick: noop }}
      />
    </div>
  );
}

export function WithBothActions() {
  return (
    <div style={{ width: 420, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <EmptyState
        icon={<Sparkles />}
        title="Resume not optimized yet"
        description="Run an ATS scan against a job description to see your match score and get tailored suggestions."
        action={{ label: 'Run ATS scan', onClick: noop }}
        secondaryAction={{ label: 'Upload a different resume', onClick: noop }}
      />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 360, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
        <EmptyState size="sm" icon={<Inbox />} title="Nothing here yet" description="Small variant for compact panels." />
      </div>
      <div style={{ width: 480, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
        <EmptyState size="lg" icon={<Inbox />} title="No applications tracked" description="Large variant for full-page empty states." action={{ label: 'Get started', onClick: noop }} />
      </div>
    </div>
  );
}
