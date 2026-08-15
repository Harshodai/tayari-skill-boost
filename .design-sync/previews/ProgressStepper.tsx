import { ProgressStepper, type Step } from '@/components/ui/progress-stepper';

const resumeSteps: Step[] = [
  { id: 'upload', label: 'Upload resume' },
  { id: 'analyze', label: 'AI analysis' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'export', label: 'Export' },
];

const applicationSteps: Step[] = [
  { id: 'match', label: 'Match job', description: 'Scan postings for ATS fit' },
  { id: 'tailor', label: 'Tailor resume', description: 'Rewrite bullets against the JD' },
  { id: 'apply', label: 'Submit application', description: 'Autopilot fills the portal' },
  { id: 'followup', label: 'Follow up', description: 'Track recruiter response' },
];

const noop = () => {};

export function Horizontal() {
  return (
    <div style={{ width: 560 }}>
      <ProgressStepper steps={resumeSteps} currentStep={2} onStepClick={noop} />
    </div>
  );
}

export function HorizontalWithError() {
  return (
    <div style={{ width: 560 }}>
      <ProgressStepper
        steps={[
          { id: 'upload', label: 'Upload resume' },
          { id: 'analyze', label: 'AI analysis', status: 'error' },
          { id: 'optimize', label: 'Optimize' },
          { id: 'export', label: 'Export' },
        ]}
        currentStep={1}
        onStepClick={noop}
      />
    </div>
  );
}

export function Vertical() {
  return (
    <div style={{ width: 340 }}>
      <ProgressStepper steps={applicationSteps} currentStep={1} orientation="vertical" onStepClick={noop} />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: 480 }}>
      <ProgressStepper steps={resumeSteps} currentStep={1} size="sm" />
      <ProgressStepper steps={resumeSteps} currentStep={1} size="md" />
      <ProgressStepper steps={resumeSteps} currentStep={1} size="lg" />
    </div>
  );
}
