import { Send, Sparkles, Trash2 } from 'lucide-react';
import { AsyncButton } from '@/components/ui/async-button';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function SubmitApplication() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <AsyncButton onClick={() => delay(1200)} loadingText="Submitting…" successText="Applied!">
        <Send />
        Apply to Stripe
      </AsyncButton>
      <AsyncButton
        variant="outline"
        onClick={() => delay(1200)}
        loadingText="Generating…"
        successText="Ready!"
      >
        <Sparkles />
        Optimize resume
      </AsyncButton>
    </div>
  );
}

export function DestructiveWithErrorFeedback() {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <AsyncButton
        variant="destructive"
        onClick={async () => {
          await delay(900);
          throw new Error('Deletion blocked — application already in interview stage');
        }}
        loadingText="Deleting…"
        errorText="Couldn't delete"
      >
        <Trash2 />
        Delete application
      </AsyncButton>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <AsyncButton size="sm" onClick={() => delay(800)} loadingText="Saving…" successText="Saved">
        Save draft
      </AsyncButton>
      <AsyncButton size="default" onClick={() => delay(800)} loadingText="Saving…" successText="Saved">
        Save draft
      </AsyncButton>
      <AsyncButton size="lg" onClick={() => delay(800)} loadingText="Saving…" successText="Saved">
        Save draft
      </AsyncButton>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <AsyncButton disabled onClick={() => delay(500)}>
        Apply to Anthropic
      </AsyncButton>
      <AsyncButton variant="outline" disabled onClick={() => delay(500)}>
        Withdraw application
      </AsyncButton>
    </div>
  );
}
