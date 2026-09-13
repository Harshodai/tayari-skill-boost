import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUp, BookOpen, LockKeyhole, Plus, Search, Share2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isBackendUnavailable } from "@/api/client";
import {
  createSharedInterviewExperience,
  listSharedInterviewExperiences,
  upvoteSharedInterviewExperience,
  type InterviewExperienceCategory,
  type InterviewExperienceVisibility,
} from "@/api/social";

export default function InterviewExperiences() {
  const queryClient = useQueryClient();
  const [company, setCompany] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    company: "",
    role: "",
    question: "",
    answer: "",
    category: "behavioral" as InterviewExperienceCategory,
    visibility: "connections" as InterviewExperienceVisibility,
  });
  const experiences = useQuery({
    queryKey: ["interview-experiences", company],
    queryFn: () => listSharedInterviewExperiences(company),
  });
  const create = useMutation({
    mutationFn: createSharedInterviewExperience,
    onSuccess: () => {
      toast.success("Experience shared with your selected audience.");
      setFormOpen(false);
      setForm({ company: "", role: "", question: "", answer: "", category: "behavioral", visibility: "connections" });
      queryClient.invalidateQueries({ queryKey: ["interview-experiences"] });
    },
    onError: (error) => toast.error(isBackendUnavailable(error) ? "The Job Tayari engine is unavailable. Your draft was not shared." : error instanceof Error ? error.message : "Could not share this experience."),
  });
  const upvote = useMutation({
    mutationFn: upvoteSharedInterviewExperience,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["interview-experiences"] }),
    onError: (error) => toast.error(isBackendUnavailable(error) ? "The Job Tayari engine is unavailable." : "Could not record your upvote."),
  });

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <AppShell>
      <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8 md:py-12">
        <div className="flex flex-col gap-5 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit"><Link to="/interview"><ArrowLeft className="mr-2 h-4 w-4" />Back to interview panel</Link></Button>
            <div><Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary"><Users className="mr-1.5 h-3.5 w-3.5" /> Community learning</Badge><h1 className="mt-2 text-3xl font-bold tracking-tight">Interview experiences</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Share anonymized questions and lessons from your journey, or learn from other candidates without exposing private recruiter or application data.</p></div>
          </div>
          <Button onClick={() => setFormOpen((open) => !open)}><Plus className="mr-2 h-4 w-4" />Share an experience</Button>
        </div>

        {formOpen && <Card className="border-primary/20 bg-primary/5"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Share2 className="h-5 w-5 text-primary" />Create a sanitized experience</CardTitle><CardDescription>Keep names, private links, exact confidential prompts, and raw email content out of anything you publish.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="experience-company">Company</Label><Input id="experience-company" value={form.company} onChange={(event) => update("company", event.target.value)} placeholder="e.g. Acme" /></div><div className="space-y-2"><Label htmlFor="experience-role">Role family</Label><Input id="experience-role" value={form.role} onChange={(event) => update("role", event.target.value)} placeholder="e.g. Frontend Engineer" /></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="experience-category">Interview type</Label><select id="experience-category" value={form.category} onChange={(event) => update("category", event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="behavioral">Behavioral</option><option value="technical">Technical</option><option value="system_design">System design</option><option value="culture">Culture</option><option value="hr">HR</option><option value="other">Other</option></select></div><div className="space-y-2"><Label htmlFor="experience-visibility">Audience</Label><select id="experience-visibility" value={form.visibility} onChange={(event) => update("visibility", event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="private">Private draft</option><option value="connections">Connections</option><option value="public">Public candidates</option></select></div></div><div className="space-y-2"><Label htmlFor="experience-question">Anonymized question</Label><Textarea id="experience-question" value={form.question} onChange={(event) => update("question", event.target.value)} placeholder="What was the question? Remove internal names or confidential details." rows={4} /></div><div className="space-y-2"><Label htmlFor="experience-answer">Your learning or answer</Label><Textarea id="experience-answer" value={form.answer} onChange={(event) => update("answer", event.target.value)} placeholder="What helped, what would you do differently, and what should another candidate prepare?" rows={5} /></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-4 w-4" /> Private by default. You choose the audience.</div><Button disabled={!form.question.trim() || create.isPending} onClick={() => create.mutate({ company: form.company, role: form.role, question_text: form.question, answer_text: form.answer, category: form.category, visibility: form.visibility })}>{create.isPending ? "Sharing..." : "Share experience"}</Button></div></CardContent></Card>}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <Card className="border-border/70"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={company} onChange={(event) => setCompany(event.target.value)} className="pl-9" placeholder="Filter by company" /></div><Badge variant="secondary">{experiences.data?.length ?? 0} visible experiences</Badge></CardContent></Card>
            {experiences.isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading shared experiences...</CardContent></Card>}
            {experiences.isError && <Card className="border-destructive/30"><CardContent className="p-6 text-sm text-destructive">{isBackendUnavailable(experiences.error) ? "The Job Tayari engine is unavailable. Reconnect it to load shared experiences." : "Could not load shared experiences."}</CardContent></Card>}
            {!experiences.isLoading && !experiences.isError && experiences.data?.length === 0 && <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center"><Sparkles className="h-8 w-8 text-primary" /><h2 className="text-lg font-semibold">Be the first to share a lesson</h2><p className="max-w-md text-sm text-muted-foreground">After a mock or real interview, turn your private reflection into a sanitized learning card for the candidate community.</p><Button onClick={() => setFormOpen(true)}>Create the first experience</Button></CardContent></Card>}
            {experiences.data?.map((item) => <Card key={item.id} className="border-border/70 transition-colors hover:border-primary/30"><CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{item.category.replace("_", " ")}</Badge>{item.visibility === "public" ? <Badge variant="outline">Public</Badge> : <Badge variant="outline"><Users className="mr-1 h-3 w-3" />Connections</Badge>}</div><CardTitle className="mt-3 text-lg">{item.company || "Undisclosed company"}</CardTitle><CardDescription>{item.role || "Interview experience"} · {new Date(item.created_at).toLocaleDateString()}</CardDescription></div><Button variant="outline" size="sm" onClick={() => upvote.mutate(item.id)} disabled={upvote.isPending}><ArrowUp className="mr-1.5 h-4 w-4" /> {item.upvotes}</Button></div></CardHeader><CardContent className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Question</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.question_text}</p></div>{item.answer_text && <div className="rounded-xl border border-primary/15 bg-primary/5 p-4"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><BookOpen className="h-3.5 w-3.5" /> Candidate takeaway</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{item.answer_text}</p></div>}</CardContent></Card>)}
          </div>
          <div className="space-y-4"><Card className="border-primary/20 bg-primary/5"><CardHeader><CardTitle className="text-base">Share safely</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p>Keep recruiter names, private URLs, email addresses, exact internal prompts, and confidential company details out of public writing.</p><p>Use the audience selector to keep a reflection private, share it with connections, or publish it for candidates.</p></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Connect your preparation</CardTitle></CardHeader><CardContent className="space-y-2"><Button asChild variant="outline" className="w-full justify-start"><Link to="/omnisave"><BookOpen className="mr-2 h-4 w-4" />Open OmniSaveAI</Link></Button><Button asChild variant="outline" className="w-full justify-start"><Link to="/interview/prep"><Sparkles className="mr-2 h-4 w-4" />Open AI prep</Link></Button></CardContent></Card></div>
        </div>
      </div>
    </AppShell>
  );
}
