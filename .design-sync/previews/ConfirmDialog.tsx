import * as React from 'react';
import { AlertTriangle, LogOut } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';

export function DestructiveDeleteApplication() {
  const [open, setOpen] = React.useState(true);
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Delete application
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete application to Stripe?"
        description="This removes the application record and its ATS score history. This action cannot be undone."
        variant="destructive"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        icon={<AlertTriangle className="h-6 w-6" />}
        onConfirm={async () => {}}
      />
    </div>
  );
}

export function DefaultSignOut() {
  const [open, setOpen] = React.useState(true);
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Sign out
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sign out of Job Tayari?"
        description="You'll need to sign back in to continue tracking your applications."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        icon={<LogOut className="h-6 w-6" />}
        onConfirm={async () => {}}
      />
    </div>
  );
}

export function LoadingState() {
  const [open, setOpen] = React.useState(true);
  return (
    <div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Withdraw application
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Withdraw application to Anthropic?"
        description="The recruiter will be notified immediately."
        variant="destructive"
        confirmLabel="Withdraw"
        isLoading
        onConfirm={async () => {}}
      />
    </div>
  );
}
