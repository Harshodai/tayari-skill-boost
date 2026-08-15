import { JobsEmptyState } from '@/components/ui/empty-state';

const noop = () => {};

export function Default() {
  return (
    <div style={{ width: 420, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <JobsEmptyState onClear={noop} />
    </div>
  );
}

export function WithoutClearAction() {
  return (
    <div style={{ width: 420, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <JobsEmptyState />
    </div>
  );
}
