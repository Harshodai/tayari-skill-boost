import { SlideUp } from '@/components/ui/motion';
import { Button } from '@/components/ui/button';

export function HeroCopy() {
  return (
    <SlideUp>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <h2 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Everything You Need to Succeed</h2>
        <p style={{ fontSize: 15, color: 'hsl(var(--muted-foreground))', marginTop: 10 }}>
          Our suite of automated AI agents and tools handles every step of your application funnel.
        </p>
      </div>
    </SlideUp>
  );
}

export function CtaRow() {
  return (
    <SlideUp delay={0.1}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Button>Optimize my resume</Button>
        <Button variant="outline">See how it works</Button>
      </div>
    </SlideUp>
  );
}

export function StaggeredDelayList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SlideUp delay={0}>
        <div style={{ fontSize: 14 }}>1. Upload your resume</div>
      </SlideUp>
      <SlideUp delay={0.08}>
        <div style={{ fontSize: 14 }}>2. Paste the job description</div>
      </SlideUp>
      <SlideUp delay={0.16}>
        <div style={{ fontSize: 14 }}>3. Get a tailored, ATS-ready rewrite</div>
      </SlideUp>
    </div>
  );
}
