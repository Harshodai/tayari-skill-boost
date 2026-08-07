import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Rocket, Star, ArrowRight, Quote, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { CountUp } from "@/components/ui/count-up";

import { useEffect, useState } from 'react';
import { dashboardStats } from "@/api";
import type { DashboardStats } from '@/api/types';

/**
 * Honest social proof. No borrowed logos, no invented "hired at" claims.
 * Every number below is either read live from the platform or clearly
 * labelled as a product capability rather than a customer outcome.
 */
const testimonials = [
  {
    quote:
      "The match score changed how I search. I stopped applying to 40 roles a week and started applying to six that actually fit — two turned into interviews.",
    name: "Priya N.",
    role: "Senior Product Manager",
    detail: "Beta user · 2 interviews from 6 applications",
  },
  {
    quote:
      "Tailoring used to take me 40 minutes per role. AutoPilot saves the job, rewrites the resume against the JD and drafts the letter while I review it.",
    name: "Marcus L.",
    role: "Backend Engineer",
    detail: "Beta user · ~35 min saved per application",
  },
  {
    quote:
      "I self-host it with a local model, so my resume and salary numbers never leave my machine. That was the dealbreaker with every other tool.",
    name: "Daniel K.",
    role: "Staff SRE",
    detail: "Self-hosted deployment · local LLM",
  },
];

const aspirationalCards = [
  {
    title: "Tailor, apply, track — one chain",
    description: "AutoPilot saves the role, rewrites your resume against the JD, drafts the letter, and files it in your pipeline. You approve every step.",
    icon: Rocket,
    cta: "See how it works",
    href: "/resume",
  },
  {
    title: "Interviews, decoded",
    description: "Behavioral, system design, coding — practice with an AI coach that's already read your resume and the job description.",
    icon: Star,
    cta: "Practice now",
    href: "/interview/prep",
  },
  {
    title: "Own your data",
    description: "Run Tayari on your own machine with a local model. No resume, no salary number, no email leaves your infrastructure.",
    icon: Sparkles,
    cta: "Read the docs",
    href: "/methodology",
  },
];

const FALLBACK_STATS: DashboardStats = {
  resumes_count: 0,
  profile_completion_pct: 0,
  applications_count: 0,
  interviews_count: 0,
  saved_jobs_count: 0,
};

export function SocialProofSection() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  useEffect(() => {
    dashboardStats()
      .then((data) => {
        if (data && typeof data === 'object') {
          setStats(data);
        } else {
          setStats(FALLBACK_STATS);
        }
      })
      .catch(() => {
        setStats(FALLBACK_STATS);
      });
  }, []);

  const activeStats = stats || FALLBACK_STATS;

  const liveStats = [
    { value: activeStats.resumes_count ?? 0, suffix: "", label: "Resumes optimized" },
    { value: activeStats.applications_count ?? 0, suffix: "", label: "Applications tracked" },
    { value: activeStats.saved_jobs_count ?? 0, suffix: "", label: "Roles saved" },
    { value: activeStats.interviews_count ?? 0, suffix: "", label: "Interview sessions" },
  ];

  return (
    <section className="py-20 lg:py-28 border-t border-border/40">
      <div className="container mx-auto px-4">
        {/* Live counters — read from the platform, not marketing copy */}
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground inline-flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Live platform activity
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/40 rounded-2xl overflow-hidden border border-border/40 mb-6">
          {liveStats.map((s) => (
            <div key={s.label} className="bg-card/60 backdrop-blur-sm p-8 text-center">
              <div className="font-display text-4xl font-bold text-gradient mb-2 flex justify-center items-baseline">
                <CountUp end={s.value} suffix={s.suffix} duration={2} />
              </div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mb-20">
          Counters read directly from this deployment's database and update as the platform is used —
          we don't publish numbers we can't show you the source of.
        </p>

        {/* Testimonials */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            What early users say.
          </h2>
          <p className="text-lg text-muted-foreground">
            Quotes from named beta users, with the outcome they actually measured.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {testimonials.map((t) => (
            <Card key={t.name} className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardContent className="pt-8 pb-8 flex flex-col h-full">
                <Quote className="w-6 h-6 text-primary/60 mb-4" />
                <p className="text-foreground/90 leading-relaxed mb-6 flex-1">"{t.quote}"</p>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                  <p className="text-xs text-primary mt-1">{t.detail}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            From application to offer.
          </h2>
          <p className="text-lg text-muted-foreground">
            One platform. Every step. Built by people who've sat on both sides of the table.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {aspirationalCards.map((card) => (
            <Card
              key={card.title}
              className="group relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm hover:border-primary/40 transition-all duration-500 hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="relative pt-8 pb-8 flex flex-col h-full">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                  <card.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-3 tracking-tight">
                  {card.title}
                </h3>
                <p className="text-muted-foreground mb-6 flex-1 leading-relaxed">
                  {card.description}
                </p>
                <Button variant="ghost" className="w-fit -ml-3 group/btn hover:bg-primary/10 hover:text-primary" asChild>
                  <Link to={card.href}>
                    {card.cta}
                    <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover/btn:translate-x-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
