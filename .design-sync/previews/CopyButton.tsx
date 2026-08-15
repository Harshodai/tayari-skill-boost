import * as React from 'react';
import { CopyButton } from '@/components/ui/async-button';

export function Default() {
  return <CopyButton text="https://jobtayari.com/applications/stripe-senior-frontend-eng" />;
}

export function CustomLabel() {
  return <CopyButton text="harsha.kolluru@email.com" label="Copy email" />;
}

export function InContext() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        width: 380,
        padding: 12,
        borderRadius: 10,
        border: '1px solid hsl(var(--border) / 0.5)',
        background: 'hsl(var(--muted) / 0.3)',
      }}
    >
      <code style={{ fontSize: 12, color: 'hsl(var(--foreground))' }}>
        REFERRAL-4F2A-9K1P
      </code>
      <CopyButton text="REFERRAL-4F2A-9K1P" label="Copy code" />
    </div>
  );
}

// Simulates the post-click "Copied!" confirmation state by rendering the
// same internal markup the component produces once `copied` flips true —
// CopyButton has no external prop to force this state, so we compose the
// identical class names/structure for a faithful static preview.
export function CopiedState() {
  return (
    <button
      type="button"
      aria-label="Copied!"
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border border-border/50 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
      Copied!
    </button>
  );
}
