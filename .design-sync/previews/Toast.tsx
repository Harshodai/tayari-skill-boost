import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from '@/components/ui/toast';

export function SuccessAndDestructive() {
  return (
    <ToastProvider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 380, position: 'relative' }}>
        <Toast open style={{ position: 'static', transform: 'none' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <ToastTitle>Application submitted</ToastTitle>
            <ToastDescription>
              Your application to Stripe — Senior Frontend Engineer was sent successfully.
            </ToastDescription>
          </div>
          <ToastClose />
        </Toast>
        <Toast open variant="destructive" style={{ position: 'static', transform: 'none' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <ToastTitle>Failed to save changes</ToastTitle>
            <ToastDescription>
              Couldn't update your resume — check your connection and try again.
            </ToastDescription>
          </div>
          <ToastClose />
        </Toast>
      </div>
      <ToastViewport style={{ position: 'static' }} />
    </ToastProvider>
  );
}

export function WithAction() {
  return (
    <ToastProvider>
      <div style={{ width: 380, position: 'relative' }}>
        <Toast open style={{ position: 'static', transform: 'none' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <ToastTitle>New job match found</ToastTitle>
            <ToastDescription>
              Anthropic just posted a Staff Product Designer role matching your profile.
            </ToastDescription>
          </div>
          <ToastAction altText="View job">View job</ToastAction>
          <ToastClose />
        </Toast>
      </div>
      <ToastViewport style={{ position: 'static' }} />
    </ToastProvider>
  );
}
