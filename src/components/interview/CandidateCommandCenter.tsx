import { Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  Code2,
  FileText,
  Mail,
  MessageSquareText,
  Network,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FadeIn, SlideUp } from "@/components/ui/motion";

type WorkflowItem = {
  label: string;
  detail: string;
  href: string;
  icon: typeof BriefcaseBusiness;
  tone: string;
};

type GmailSyncScope = {
  query?: string;
  after?: string;
  before?: string;
  max_results?: number;
};

interface CandidateCommandCenterProps {
  applicationCount: number;
  gmailEnabled: boolean;
  gmailConnected: boolean;
  onSyncGmail: (scope?: GmailSyncScope) => void;
  syncingGmail: boolean;
}

const workflowItems: WorkflowItem[] = [
  {
    label: "Apply to jobs",
    detail: "Find roles and move them through your pipeline.",
    href: "/jobs",
    icon: BriefcaseBusiness,
    tone: "text-primary",
  },
  {
    label: "Prepare for interviews",
    detail: "Generate role-specific questions and practice notes.",
    href: "/interview/prep",
    icon: MessageSquareText,
    tone: "text-violet-500",
  },
  {
    label: "Practice with a person",
    detail: "Use the voice coach for a structured mock session.",
    href: "/interview/voice-coach",
    icon: Users,
    tone: "text-emerald-500",
  },
  {
    label: "Clash of Code",
    detail: "Keep coding practice close to your interview plan.",
    href: "/interview/coding",
    icon: Code2,
    tone: "text-orange-500",
  },
  {
    label: "Ask OmniSaveAI",
    detail: "Turn saved reading into grounded preparation answers.",
    href: "/omnisave",
    icon: Sparkles,
    tone: "text-fuchsia-500",
  },
  {
    label: "Share an experience",
    detail: "Turn a reflection into a sanitized learning card.",
    href: "/interview/experiences",
    icon: Users,
    tone: "text-indigo-500",
  },
  {
    label: "Read company blogs",
    detail: "Build context from public company and career content.",
    href: "/blog",
    icon: BookOpen,
    tone: "text-sky-500",
  },
];

export function CandidateCommandCenter({
  applicationCount,
  gmailEnabled,
  gmailConnected,
  onSyncGmail,
  syncingGmail,
}: CandidateCommandCenterProps) {
  const [query, setQuery] = useState("");
  const [after, setAfter] = useState("");
  const [before, setBefore] = useState("");
  const emailLabel = !gmailEnabled
    ? "On demand"
    : gmailConnected
      ? "Connected"
      : "Ready";

  return (
    <div className="space-y-4">
      <FadeIn>
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-[0_24px_80px_-56px_hsl(var(--primary)/0.8)]">
          <CardContent className="relative p-5 md:p-6">
            <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-2xl space-y-3">
                <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
                  <Network className="mr-1.5 h-3.5 w-3.5" /> Candidate command center
                </Badge>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                    Everything for your next interview, in one place.
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    Move from opportunity to preparation to reflection without losing the context that makes each step useful.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link to="/interview/prep">
                    <Sparkles className="mr-2 h-4 w-4" /> Start AI prep
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/omnisave">
                    <BookOpen className="mr-2 h-4 w-4" /> Open knowledge
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <SlideUp delay={0.05}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Application pipeline" value={String(applicationCount)} detail="active records" icon={<BriefcaseBusiness className="h-5 w-5 text-primary" />} />
          <MetricCard label="Interview prep" value="AI + human" detail="choose your mode" icon={<Users className="h-5 w-5 text-emerald-500" />} />
          <MetricCard label="Coding practice" value="Clash of Code" detail="practice next" icon={<Trophy className="h-5 w-5 text-orange-500" />} />
          <MetricCard label="Email workflow" value={emailLabel} detail="review before board changes" icon={<Mail className="h-5 w-5 text-sky-500" />} />
        </div>
      </SlideUp>

      <SlideUp delay={0.1}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
          <Card className="border-border/70 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your preparation loop</CardTitle>
              <CardDescription>Choose the next step without leaving the interview panel.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {workflowItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button key={item.label} asChild variant="ghost" className="h-auto justify-between rounded-xl border border-border/60 bg-background/30 p-3 text-left hover:border-primary/30 hover:bg-primary/5">
                    <Link to={item.href}>
                      <span className="flex min-w-0 items-start gap-3">
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.tone}`} />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                          <span className="mt-1 block whitespace-normal text-xs font-normal leading-5 text-muted-foreground">{item.detail}</span>
                        </span>
                      </span>
                      <ArrowUpRight className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-primary" /> Today&apos;s handoff</CardTitle>
              <CardDescription>Keep context moving from one workflow to the next.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <HandoffItem icon={<FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />} title="Review your board" detail="Confirm the next action for each active application before starting new prep." />
              {gmailEnabled && <HandoffItem icon={<Mail className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />} title={gmailConnected ? "Sync job email" : "Connect job email"} detail="Email stays private until you approve a board update." action={gmailConnected ? (
                <div className="mt-2 space-y-2">
                  <details className="rounded-md border border-border/60 bg-background/40 p-2 text-xs">
                    <summary className="cursor-pointer font-medium text-foreground">Choose sync scope</summary>
                    <div className="mt-2 space-y-2">
                      <label className="block text-muted-foreground">Gmail search query
                        <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={240} placeholder="subject:(interview OR offer)" className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground" />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-muted-foreground">After
                          <input type="date" value={after} onChange={(event) => setAfter(event.target.value)} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground" />
                        </label>
                        <label className="text-muted-foreground">Before
                          <input type="date" value={before} onChange={(event) => setBefore(event.target.value)} className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground" />
                        </label>
                      </div>
                    </div>
                  </details>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => onSyncGmail({ query: query || undefined, after: after || undefined, before: before || undefined, max_results: 20 })} disabled={syncingGmail}>{syncingGmail ? "Syncing..." : "Sync now"}</Button>
                </div>
              ) : undefined} />}
              <HandoffItem icon={<Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-500" />} title="Turn reflection into leverage" detail="Keep private notes or publish a sanitized experience for other candidates." />
            </CardContent>
          </Card>
        </div>
      </SlideUp>
    </div>
  );
}

function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div>
        {icon}
      </CardContent>
    </Card>
  );
}

function HandoffItem({ icon, title, detail, action }: { icon: React.ReactNode; title: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/70 p-3">
      {icon}
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>{action}</div>
    </div>
  );
}
