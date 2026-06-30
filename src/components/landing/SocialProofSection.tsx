import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Rocket, Star, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { CountUp } from "@/components/ui/count-up";

import { useEffect, useState } from 'react';
import { dashboardStats } from '@/api';
import type { DashboardStats } from '@/api/types';

const trustLogos = [
  "Google", "Stripe", "Airbnb", "Notion", "Linear", "Vercel", "Shopify", "Atlassian",
];

const aspirationalCards = [
  {
    title: "Resume to offer in 21 days",
    description: "From ATS-optimized resume to signed offer — Tayari shortens every step of the loop.",
    icon: Rocket,
    cta: "See how it works",
    href: "/resume",
  },
  {
    title: "Interviews, decoded",
    description: "Behavioral, system design, coding — practice with an AI coach that's read your resume.",
    icon: Star,
    cta: "Practice now",
    href: "/interview/prep",
  },
  {
    title: "Apply with assistance",
    description: "Hermes finds, scores, and queues roles that actually match your trajectory — with your final approval.",
    icon: Sparkles,
    cta: "Launch Apply Assist",
    href: "/jobs/autopilot",
  },
];

export function SocialProofSection() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  useEffect(() => {
    if (!import.meta.env.VITE_API_URL) return;
    dashboardStats()
      .then(setStats)
      .catch(() => {
        // Backend unavailable on Lovable preview — fall back to static copy.
      });
  }, []);

  return (
    <section className="py-20 lg:py-28 border-t border-border/40">
      <div className="container mx-auto px-4">
        {/* Trust strip */}
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-8">
            Trusted by engineers hired at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-60 hover:opacity-90 transition-opacity">
            {trustLogos.map((logo) => (
              <span
                key={logo}
                className="font-display text-xl md:text-2xl font-semibold tracking-tight text-muted-foreground"
              >
                {logo}
              </span>
            ))}
          </div>
        </div>

        {/* Stat band */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/40 rounded-2xl overflow-hidden border border-border/40 mb-20">
          {[
            { value: stats?.resumes_count ?? 0, suffix: "+", label: "Resumes optimized" },
            { value: stats?.profile_completion_pct ?? 0, suffix: "%", label: "Interview success" },
            { value: stats?.applications_count ?? 0, suffix: "+", label: "Offers landed" },
            { value: stats?.interviews_count ?? 0, suffix: "", label: "Interviews", decimals: 0 },
          ].map((s) => (
            <div key={s.label} className="bg-card/60 backdrop-blur-sm p-8 text-center">
              <div className="font-display text-4xl font-bold text-gradient mb-2 flex justify-center items-baseline">
                <CountUp end={s.value} suffix={s.suffix} duration={2} decimals={s.decimals} />
              </div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
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
