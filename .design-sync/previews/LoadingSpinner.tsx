import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <LoadingSpinner size="xs" label="Loading" />
      <LoadingSpinner size="sm" label="Loading" />
      <LoadingSpinner size="md" label="Loading" />
      <LoadingSpinner size="lg" label="Loading" />
      <LoadingSpinner size="xl" label="Loading" />
    </div>
  );
}

export function Variants() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'hsl(var(--card))', padding: 16, borderRadius: 8 }}>
      <LoadingSpinner size="lg" variant="primary" label="Scanning resume" />
      <LoadingSpinner size="lg" variant="secondary" label="Loading applications" />
      <LoadingSpinner size="lg" variant="success" label="Verifying" />
      <LoadingSpinner size="lg" variant="destructive" label="Retrying" />
      <span style={{ background: 'hsl(var(--primary))', padding: 10, borderRadius: 8, display: 'inline-flex' }}>
        <LoadingSpinner size="lg" variant="white" label="Submitting" />
      </span>
    </div>
  );
}

export function InButtonContext() {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'hsl(var(--primary))',
        color: 'white',
        padding: '10px 16px',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      <LoadingSpinner size="sm" variant="white" label="Running ATS scan" />
      Running ATS scan…
    </div>
  );
}
