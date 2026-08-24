import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ClipboardCheck, History, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const journeyCards = [
  {
    title: "Keep the role in context",
    description:
      "A serious application begins with more than a title. Keep the role requirements, your materials, and the next decision close together instead of rebuilding context each time.",
    icon: Sparkles,
    cta: "Explore role discovery",
    href: "/jobs",
  },
  {
    title: "Prepare from the real work",
    description:
      "Use the role and your experience as the starting point for a resume, a draft, or an interview answer—then make the final version your own.",
    icon: ClipboardCheck,
    cta: "Review a resume",
    href: "/resume",
  },
  {
    title: "Leave a learning trail",
    description:
      "Track where you are, what you used, and what happened next. A clear record turns every attempt into context for the one that follows.",
    icon: History,
    cta: "Open the tracker",
    href: "/interview",
  },
];

export function SocialProofSection() {
  return (
    <section className="border-t border-border/40 py-20 lg:py-28" aria-labelledby="evidence-title">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Candidate-owned context
          </p>
          <h2 id="evidence-title" className="mt-4 font-display text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Build progress you can explain.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-8 text-muted-foreground">
            Job Tayari does not promise an offer. It gives your search an understandable structure, so your time, preparation, and decisions remain connected from one opportunity to the next.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            Your personal activity belongs in your signed-in workspace. This public page stays focused on how the workflow helps rather than presenting unverified customer figures.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {journeyCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.title}
                className="group relative overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm transition duration-200 hover:-translate-y-1 hover:border-primary/40"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                <CardContent className="relative flex h-full flex-col pb-8 pt-8">
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">{card.title}</h3>
                  <p className="mb-6 mt-3 flex-1 leading-relaxed text-muted-foreground">{card.description}</p>
                  <Button variant="ghost" className="-ml-3 w-fit hover:bg-primary/10 hover:text-primary" asChild>
                    <Link to={card.href}>
                      {card.cta}
                      <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
