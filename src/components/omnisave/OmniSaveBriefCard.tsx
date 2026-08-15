import { useState } from "react";
import { ArrowRight, BrainCircuit, Loader2, Target } from "lucide-react";
import { OmniSaveBrief } from "@/api/ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type OmniSaveBriefSuggestions = {
  role: string[];
  company: string[];
  skill: string[];
};

export function OmniSaveBriefCard({
  brief,
  onLoad,
  loading,
  suggestions = { role: [], company: [], skill: [] },
}: {
  brief: OmniSaveBrief | null;
  onLoad: (filters: { role: string; company: string; skill: string }) => Promise<void>;
  loading: boolean;
  suggestions?: OmniSaveBriefSuggestions;
}) {
  const [role, setRole] = useState(brief?.filters.role || "");
  const [company, setCompany] = useState(brief?.filters.company || "");
  const [skill, setSkill] = useState(brief?.filters.skill || "");
  const hasSuggestions = suggestions.role.length > 0 || suggestions.company.length > 0 || suggestions.skill.length > 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Interview Brief</CardTitle>
          <Badge variant="secondary">career-aware rediscovery</Badge>
        </div>
        <CardDescription>Turn your saved research into the next interview or application action.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Target role" aria-label="Interview brief target role" />
          <Input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company (optional)" aria-label="Interview brief company" />
          <Input value={skill} onChange={(event) => setSkill(event.target.value)} placeholder="Skill (optional)" aria-label="Interview brief skill" />
          <Button type="button" onClick={() => void onLoad({ role, company, skill })} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}Build brief
          </Button>
        </div>
        {hasSuggestions && <div className="rounded-xl border border-border/70 bg-background/40 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">From your applications</p><span className="text-[11px] text-muted-foreground">Click to prefill</span></div><div className="mt-3 space-y-2">{([['role', 'Roles', suggestions.role, setRole], ['company', 'Companies', suggestions.company, setCompany], ['skill', 'Skills', suggestions.skill, setSkill]] as const).map(([key, label, values, setter]) => values.length > 0 && <div key={key} className="flex flex-wrap items-center gap-2"><span className="w-20 text-[11px] font-medium text-muted-foreground">{label}</span>{values.slice(0, 6).map((value) => <button key={value} type="button" onClick={() => setter(value)} className="rounded-full border border-primary/25 bg-primary/[0.06] px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.12]">{value}</button>)}</div>)}</div></div>}
        {brief && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">{brief.headline}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{brief.summary}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {Object.entries(brief.stats).map(([key, value]) => <div key={key} className="rounded-lg border border-border/70 bg-background/50 p-3"><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-[11px] capitalize text-muted-foreground">{key.replace("_", " ")}</p></div>)}
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">What’s new since last brief</p><Badge variant="outline">{brief.new_since_last_brief?.length || 0} sources</Badge></div>{brief.new_since_last_brief?.length ? <div className="mt-3 space-y-2">{brief.new_since_last_brief.slice(0, 3).map((source, index) => <div key={String(source.id || index)} className="rounded-lg border border-border/60 bg-background/60 p-3"><p className="line-clamp-1 text-sm font-medium">{String(source.title || "New saved source")}</p><p className="mt-1 text-xs text-muted-foreground">Last seen {String(source.last_seen_at || source.created_at || "recently")}</p></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No newer sources have arrived since this brief was generated.</p>}</div>
            <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-xl border border-border/70 bg-background/50 p-4"><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Next actions</p><div className="mt-3 space-y-3">{brief.next_actions.map((action) => <div key={action} className="flex items-start gap-2 text-sm leading-6"><ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />{action}</div>)}</div></div>
              <div className="rounded-xl border border-border/70 bg-background/50 p-4"><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Evidence to rehearse</p>{brief.highlights.length > 0 ? <div className="mt-3 space-y-3">{brief.highlights.slice(0, 3).map((highlight, index) => <div key={String(highlight.id || index)} className="rounded-lg border border-border/60 p-3 text-sm leading-6"><p>“{String(highlight.text_excerpt || highlight.excerpt || "Saved evidence excerpt")}”</p>{highlight.note && <p className="mt-1 text-xs text-muted-foreground">{String(highlight.note)}</p>}</div>)}</div> : <p className="mt-3 text-sm leading-6 text-muted-foreground">No evidence cards are connected to this context yet. Open a source and capture an exact passage.</p>}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
