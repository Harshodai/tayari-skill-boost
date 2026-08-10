import React, { useState } from 'react';
import { ShieldCheck, Zap, Bot, ArrowRight, CheckCircle2, Award, Sparkles, Cpu, Layers, BarChart3, Lock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { features } from '@/config/features';

export const LandingPage: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white font-bold">T</div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Job Tayari
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          {features.pricing && (
            <Link to="/pricing" className="text-slate-300 hover:text-white transition">Pricing</Link>
          )}
          <Link to="/onboarding" className="text-slate-300 hover:text-white transition">Onboarding</Link>
          <Link to="/auth">
            <Button size="sm" variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800">
              Sign In
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
              Get Started Free <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center space-y-6">
        <Badge className="bg-indigo-950 text-indigo-300 border-indigo-800 px-4 py-1 text-xs uppercase tracking-widest">
          Event-Driven Career Operations Platform
        </Badge>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-4xl mx-auto">
          Autonomous Career Intelligence & <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Tayari Computer Automation</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Scale your job hunt on autopilot. Tailor resumes, execute universal ATS applications, scan email invitations, and negotiate offers with human-in-the-loop precision.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <Link to="/onboarding">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 font-semibold shadow-lg shadow-indigo-900/40">
              Launch Onboarding <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link to="/omnisave">
            <Button size="lg" variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-900 px-8 font-semibold">
              Explore Omnisave AI
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-900 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold tracking-tight">Built for Enterprise Career Growth</h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm">
            Four agentic architectural pillars powering your job transition lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-slate-900 border-slate-800 text-slate-100 hover:border-indigo-500/50 transition">
            <CardHeader>
              <Cpu className="w-8 h-8 text-indigo-400 mb-2" />
              <CardTitle className="text-lg font-bold">Tayari Computer</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-400 leading-relaxed">
              Accessibility-snapshot browser sandbox executing form fills semantically with automatic PII redaction.
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-slate-100 hover:border-purple-400/50 transition">
            <CardHeader>
              <Layers className="w-8 h-8 text-purple-400 mb-2" />
              <CardTitle className="text-lg font-bold">Omnisave AI RAG</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-400 leading-relaxed">
              Hybrid vector search across Substack, Medium, and LinkedIn items with mandatory inline citations.
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-slate-100 hover:border-amber-400/50 transition">
            <CardHeader>
              <ShieldCheck className="w-8 h-8 text-amber-400 mb-2" />
              <CardTitle className="text-lg font-bold">HITL Guardrails</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-400 leading-relaxed">
              Durable Human-in-the-Loop review drawer for ATS keyword approvals before submitting applications.
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-slate-100 hover:border-emerald-400/50 transition">
            <CardHeader>
              <BarChart3 className="w-8 h-8 text-emerald-400 mb-2" />
              <CardTitle className="text-lg font-bold">Autopilot Graph</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-400 leading-relaxed">
              6-stage LangGraph execution pipeline with state checkpointers and real-time SSE progress streaming.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Interactive Pricing Tier Cards */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-900 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight">Flexible Pricing Plans</h2>
          <div className="flex justify-center items-center gap-3 text-sm">
            <span className={billingCycle === 'monthly' ? 'text-white font-bold' : 'text-slate-400'}>Monthly</span>
            <button
              onClick={() => setBillingCycle(b => b === 'monthly' ? 'annual' : 'monthly')}
              role="switch"
              aria-checked={billingCycle === 'annual'}
              aria-label="Toggle billing cycle between monthly and annual"
              className="w-12 h-6 bg-slate-800 rounded-full p-1 transition flex items-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <div className={`w-4 h-4 bg-indigo-500 rounded-full transition transform ${billingCycle === 'annual' ? 'translate-x-6' : ''}`} />
            </button>
            <span className={billingCycle === 'annual' ? 'text-white font-bold' : 'text-slate-400'}>
              Annual <Badge className="bg-emerald-950 text-emerald-300 ml-1">Save 20%</Badge>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Starter Plan */}
          <Card className="bg-slate-900 border-slate-800 text-slate-100 flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-xl font-bold">Starter</CardTitle>
              <CardDescription className="text-slate-400">Essential tools for active job seekers.</CardDescription>
              <div className="pt-4 text-3xl font-extrabold">
                {billingCycle === 'monthly' ? '$19' : '$15'}<span className="text-sm font-normal text-slate-400">/mo</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> 15 Resume Tailoring Runs/mo</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Basic Tayari Computer Form Fill</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Gmail Interview Classifier</div>
            </CardContent>
            <CardFooter>
              <Link to="/auth" className="w-full">
                <Button className="w-full bg-slate-800 hover:bg-slate-700 font-semibold">Choose Starter</Button>
              </Link>
            </CardFooter>
          </Card>

          {/* Professional Plan */}
          <Card className="bg-slate-900 border-indigo-600 text-slate-100 flex flex-col justify-between relative shadow-xl shadow-indigo-950/50">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] uppercase tracking-widest px-3 py-1 rounded-full font-bold">
              Most Popular
            </div>
            <CardHeader>
              <CardTitle className="text-xl font-bold">Pro Autopilot</CardTitle>
              <CardDescription className="text-slate-400">Full career operations automation swarm.</CardDescription>
              <div className="pt-4 text-3xl font-extrabold text-indigo-400">
                {billingCycle === 'monthly' ? '$49' : '$39'}<span className="text-sm font-normal text-slate-400">/mo</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Unlimited Resume Optimization</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Universal 25+ Portal Auto-Apply</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Omnisave AI Hybrid RAG Engine</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> HITL Action Approval Drawer</div>
            </CardContent>
            <CardFooter>
              <Link to="/auth" className="w-full">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold text-white">Start 14-Day Free Trial</Button>
              </Link>
            </CardFooter>
          </Card>

          {/* Executive Plan */}
          <Card className="bg-slate-900 border-slate-800 text-slate-100 flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-xl font-bold">Executive Suite</CardTitle>
              <CardDescription className="text-slate-400">Dedicated career advisory & copilot swarm.</CardDescription>
              <div className="pt-4 text-3xl font-extrabold">
                {billingCycle === 'monthly' ? '$99' : '$79'}<span className="text-sm font-normal text-slate-400">/mo</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Everything in Pro Autopilot</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> AI Compensation & Offer Negotiation</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Live STAR Interview Copilot</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Dedicated Account Manager</div>
            </CardContent>
            <CardFooter>
              <Link to="/auth" className="w-full">
                <Button className="w-full bg-slate-800 hover:bg-slate-700 font-semibold">Contact Executive Team</Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
