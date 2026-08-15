import { FullPageLoader } from '@/components/ui/loading-spinner';

// FullPageLoader renders `position: fixed; inset: 0`, which positions
// relative to the viewport unless an ancestor establishes a new containing
// block. Wrapping with `transform: translateZ(0)` gives it one so the
// overlay stays scoped to this preview cell instead of covering the page.

export function Default() {
  return (
    <div style={{ position: 'relative', height: 320, width: 480, transform: 'translateZ(0)', overflow: 'hidden', borderRadius: 12, border: '1px solid hsl(var(--border))' }}>
      <FullPageLoader />
    </div>
  );
}

export function CustomLabel() {
  return (
    <div style={{ position: 'relative', height: 320, width: 480, transform: 'translateZ(0)', overflow: 'hidden', borderRadius: 12, border: '1px solid hsl(var(--border))' }}>
      <FullPageLoader label="Preparing your interview prep session…" />
    </div>
  );
}
