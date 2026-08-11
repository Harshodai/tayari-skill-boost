import { useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, FileText, ShieldCheck, Target } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500 selection:text-white">
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-600 p-2 font-bold text-white">T</div>
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
            Job Tayari
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          {features.pricing && <a href="#plans" className="text-slate-300 transition hover:text-white">How it works</a>}
          <Link to="/onboarding" className="text-slate-300 transition hover:text-white">Your plan</Link>
          <Link to="/auth"><Button size="sm" variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800">Sign in</Button></Link>
          <Link to="/auth"><Button size="sm" className="bg-indigo-600 font-semibold text-white hover:bg-indigo-500">Get started <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
        </div>
      </nav>

      <main>
        <section className="mx-auto max-w-6xl space-y-6 px-6 pb-16 pt-20 text-center">
          <Badge className="border-indigo-800 bg-indigo-950 px-4 py-1 text-xs uppercase tracking-widest text-indigo-300">
            A candidate-controlled career workspace
          </Badge>
          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Make every engineering application <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">more intentional.</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-400 md:text-xl">
            Tailor your resume to a real role, organize your job search, and review every application artifact before you act. Job Tayari helps you stay in control of your next move.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link to="/onboarding"><Button size="lg" className="bg-indigo-600 px-8 font-semibold text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-500">Build my job-change plan <ArrowRight className="ml-2 h-5 w-5" /></Button></Link>
            <Link to="/resume"><Button size="lg" variant="outline" className="border-slate-800 px-8 font-semibold text-slate-300 hover:bg-slate-900">Try the resume optimizer</Button></Link>
          </div>
          <button onClick={() => setShowCapabilityNote((value) => !value)} className="text-xs text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline" aria-expanded={showCapabilityNote}>
            What can Job Tayari do today?
          </button>
          {showCapabilityNote && (
            <p className="mx-auto max-w-2xl rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm leading-relaxed text-amber-100">
              Resume tailoring, career planning, job tracking, article URL import, and interview-email organization are available where connected. Application-browser automation is currently a clearly labelled preview; Job Tayari does not claim to submit an application until it has a verified external receipt.
            </p>
          )}
        </section>

        <section className="mx-auto max-w-6xl space-y-12 border-t border-slate-900 px-6 py-16">
          <div className="space-y-3 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Clear tools for a difficult job search</h2>
            <p className="mx-auto max-w-xl text-sm text-slate-400">Plain language, visible review steps, and no false promises about automation.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard icon={<FileText className="mb-2 h-8 w-8 text-indigo-400" />} title="Resume optimizer" description="Upload or paste a resume, add a pasted job description or a public job link, and review role-specific suggestions." />
            <FeatureCard icon={<Target className="mb-2 h-8 w-8 text-purple-400" />} title="Transition plan" description="Tell us whether you are changing jobs, moving domains, or both. You can edit that plan as your goals change." />
            <FeatureCard icon={<ShieldCheck className="mb-2 h-8 w-8 text-amber-400" />} title="Application review" description="Keep control of your resume and application answers. No sensitive question or final submission should happen without you." />
            <FeatureCard icon={<BookOpen className="mb-2 h-8 w-8 text-emerald-400" />} title="Career memory" description="Import article links you choose, organize them with AI, and ask questions with source links when citations are available." />
          </div>
        </section>

        <section id="plans" className="mx-auto max-w-6xl space-y-10 border-t border-slate-900 px-6 py-16">
          <div className="space-y-3 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Choose the workflow you need</h2>
            <p className="mx-auto max-w-xl text-sm text-slate-400">Capabilities—not exaggerated automation claims—should determine a plan. Commercial terms belong only after the related workflow is production-ready.</p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.name} className={`flex flex-col justify-between text-slate-100 ${plan.featured ? 'border-indigo-600 bg-slate-900 shadow-xl shadow-indigo-950/50' : 'border-slate-800 bg-slate-900'}`}>
                <CardHeader>
                  {plan.featured && <Badge className="mb-3 w-fit bg-indigo-600 text-white">Candidate-controlled beta</Badge>}
                  <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                  <CardDescription className="text-slate-400">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-300">
                  {plan.items.map((item) => <div key={item} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />{item}</div>)}
                </CardContent>
                <CardFooter>
                  <Link to={plan.name === 'Career Memory' ? '/omnisave' : '/auth'} className="w-full"><Button className={`w-full font-semibold ${plan.featured ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-800 hover:bg-slate-700'}`}>{plan.action}</Button></Link>
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
    <Card className="border-slate-800 bg-slate-900 text-slate-100 transition hover:border-indigo-500/50">
      <CardHeader><>{icon}</><CardTitle className="text-lg font-bold">{title}</CardTitle></CardHeader>
      <CardContent className="text-sm leading-relaxed text-slate-400">{description}</CardContent>
    </Card>
  );
}

export default LandingPage;
