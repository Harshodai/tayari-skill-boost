import { AlertTriangle, CheckCircle2, Info, ShieldAlert, XCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export function Variants() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 420 }}>
      <Alert variant="default">
        <Info />
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>
          Your resume hasn't been re-scanned since you last edited it. Re-run the ATS check to
          get an up-to-date score.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <XCircle />
        <AlertTitle>Application failed to submit</AlertTitle>
        <AlertDescription>
          Stripe's careers portal rejected the upload — the PDF exceeded their 5MB limit. Try
          compressing it and resubmitting.
        </AlertDescription>
      </Alert>
      <Alert variant="success">
        <CheckCircle2 />
        <AlertTitle>Resume optimized</AlertTitle>
        <AlertDescription>
          Your ATS match score improved from 62% to 89% against the Anthropic Staff Engineer
          posting.
        </AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTriangle />
        <AlertTitle>Missing keywords detected</AlertTitle>
        <AlertDescription>
          This posting mentions "Kubernetes" and "gRPC" three times each — neither appears in
          your resume.
        </AlertDescription>
      </Alert>
      <Alert variant="info">
        <ShieldAlert />
        <AlertTitle>Manual submit required</AlertTitle>
        <AlertDescription>
          Autopilot filled the Figma application form but stopped at the CAPTCHA — finish
          submitting it yourself.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function TitleOnly() {
  return (
    <div style={{ width: 420 }}>
      <Alert variant="default">
        <Info />
        <AlertTitle>Autosave enabled — no description needed for this one.</AlertTitle>
      </Alert>
    </div>
  );
}

export function WithoutIcon() {
  return (
    <div style={{ width: 420 }}>
      <Alert variant="destructive">
        <AlertTitle>Payment method declined</AlertTitle>
        <AlertDescription>
          We couldn't renew your Job Tayari Pro subscription. Update your billing details to
          keep Autopilot running.
        </AlertDescription>
      </Alert>
    </div>
  );
}
