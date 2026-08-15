import { ErrorEmptyState } from '@/components/ui/empty-state';

const noop = () => {};

export function Default() {
  return (
    <div style={{ width: 420, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <ErrorEmptyState onRetry={noop} />
    </div>
  );
}

export function CustomMessage() {
  return (
    <div style={{ width: 420, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <ErrorEmptyState
        message="Couldn't load your applications — the Go gateway returned a 503. Try again in a moment."
        onRetry={noop}
      />
    </div>
  );
}

export function NoRetryAction() {
  return (
    <div style={{ width: 420, border: '1px solid hsl(var(--border))', borderRadius: 12 }}>
      <ErrorEmptyState message="ATS scoring is temporarily unavailable while we update the model." />
    </div>
  );
}
