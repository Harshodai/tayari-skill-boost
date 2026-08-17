import { useState, type ReactNode } from 'react';
import { ArrowRight, Download, BookOpen, CheckCircle2, FileText, ShieldCheck, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { features } from '@/config/features';

const plans = [
  {
    name: 'Prepare',
    description: 'For candidates who want a stronger, role-specific application.',
    items: ['Resume and job-description analysis', 'Career-transition profile', 'Candidate-reviewed recommendations'],
    action: 'Start preparing',
    featured: false,
  },
  {
    name: 'Application Assist',
    description: 'For candidates who want structured review before applying.',
    items: ['Job tracking and review queue', 'Approved-artifact workflow', 'Application-assistance preview'],
    action: 'Join the beta',
    featured: true,
  },
  {
    name: 'Career Memory',
    description: 'For candidates who want to reuse what they learn.',
    items: ['Article URL import', 'Automatic topic organization', 'Answers linked to imported sources'],
    action: 'Explore Omnisave',
    featured: false,
  },
] as const;

export const LandingPage = () => {
  const [showCapabilityNote, setShowCapabilityNote] = useState(false);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary selection:text-primary-foreground">
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary p-2 font-bold text-primary-foreground">T</div>
          <span className="font-display text-gradient text-xl font-bold tracking-tight">
            Job Tayari
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          {features.pricing && <a href="#plans" className="text-muted-foreground transition hover:text-foreground">How it works</a>}
          <Link to="/onboarding" className="text-muted-foreground transition hover:text-foreground">Your plan</Link>
          <Link to="/auth"><Button size="sm" variant="outline">Sign in</Button></Link>
          <Link to="/auth"><Button size="sm" className="font-semibold">Get started <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
        </div>
      </nav>

      <main>
        <section className="mx-auto max-w-6xl space-y-6 px-6 pb-16 pt-20 text-center">
          <Badge className="border-primary/20 bg-primary/10 px-4 py-1 text-xs uppercase tracking-widest text-primary">
            A candidate-controlled career workspace
          </Badge>
          <h1 className="font-display text-balance mx-auto max-w-4xl text-5xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl">
            Make every engineering application <span className="text-gradient">more intentional.</span>
          </h1>
          <p className="text-balance mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Tailor your resume to a real role, organize your job search, and review every application artifact before you act. Job Tayari helps you stay in control of your next move.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link to="/onboarding"><Button size="lg" className="px-8 font-semibold shadow-md active:scale-[0.98]">Build my job-change plan <ArrowRight className="ml-2 h-5 w-5" /></Button></Link>
            <Link to="/downloads"><Button size="lg" variant="outline" className="px-8 font-semibold active:scale-[0.98]">Download desktop app <Download className="ml-2 h-5 w-5" /></Button></Link>
            <Link to="/resume"><Button size="lg" variant="outline" className="px-8 font-semibold active:scale-[0.98]">Try the resume optimizer</Button></Link>
          </div>
          <button onClick={() => setShowCapabilityNote((value) => !value)} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" aria-expanded={showCapabilityNote}>
            What can Job Tayari do today?
          </button>
          {showCapabilityNote && (
            <p className="mx-auto max-w-2xl rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm leading-relaxed text-foreground text-balance">
              Resume tailoring, career planning, job tracking, article URL import, and interview-email organization are available where connected. Application-browser automation is currently a clearly labelled preview; Job Tayari does not claim to submit an application until it has a verified external receipt.
            </p>
          )}
        </section>

        <section className="mx-auto max-w-6xl space-y-12 border-t border-border px-6 py-16">
          <div className="space-y-3 text-center">
            <h2 className="font-display text-balance text-3xl font-bold tracking-tight text-foreground">Clear tools for a difficult job search</h2>
            <p className="text-balance mx-auto max-w-xl text-sm text-muted-foreground">Plain language, visible review steps, and no false promises about automation.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard icon={<FileText className="mb-2 h-8 w-8 text-primary" />} title="Resume optimizer" description="Upload or paste a resume, add a pasted job description or a public job link, and review role-specific suggestions." />
            <FeatureCard icon={<Target className="mb-2 h-8 w-8 text-primary" />} title="Transition plan" description="Tell us whether you are changing jobs, moving domains, or both. You can edit that plan as your goals change." />
            <FeatureCard icon={<ShieldCheck className="mb-2 h-8 w-8 text-primary" />} title="Application review" description="Keep control of your resume and application answers. No sensitive question or final submission should happen without you." />
            <FeatureCard icon={<BookOpen className="mb-2 h-8 w-8 text-primary" />} title="Career memory" description="Import article links you choose, organize them with AI, and ask questions with source links when citations are available." />
          </div>
        </section>

        <section id="plans" className="mx-auto max-w-6xl space-y-10 border-t border-border px-6 py-16">
          <div className="space-y-3 text-center">
            <h2 className="font-display text-balance text-3xl font-bold tracking-tight text-foreground">Choose the workflow you need</h2>
            <p className="text-balance mx-auto max-w-xl text-sm text-muted-foreground">Capabilities—not exaggerated automation claims—should determine a plan. Commercial terms belong only after the related workflow is production-ready.</p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.name} className={`flex flex-col text-foreground ${plan.featured ? 'border-primary bg-card shadow-lg ring-1 ring-primary/30' : 'border-border bg-card'}`}>
                <CardHeader>
                  {plan.featured && <Badge className="mb-3 w-fit bg-primary text-primary-foreground">Candidate-controlled beta</Badge>}
                  <CardTitle className="font-display text-xl font-bold">{plan.name}</CardTitle>
                  <CardDescription className="text-muted-foreground">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-foreground/80 flex-1">
                  {plan.items.map((item) => <div key={item} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{item}</div>)}
                </CardContent>
                <CardFooter className="mt-auto pt-4">
                  <Link to={plan.name === 'Career Memory' ? '/omnisave' : '/auth'} className="w-full">
                    <Button className="w-full font-semibold active:scale-[0.98]" variant={plan.featured ? "default" : "secondary"}>
                      {plan.action}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

function FeatureCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <Card className="border-border bg-card text-foreground transition hover:border-primary/50 flex flex-col">
      <CardHeader><>{icon}</><CardTitle className="font-display text-lg font-bold">{title}</CardTitle></CardHeader>
      <CardContent className="text-sm leading-relaxed text-muted-foreground flex-1">{description}</CardContent>
    </Card>
  );
}

export default LandingPage;
