import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/layout";
import { BackendUnavailableBanner } from "@/components/BackendUnavailableBanner";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FadeIn, SlideUp, StaggerContainer } from "@/components/ui/motion";
import {
  AlertCircle,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  MessageSquare,
  Network,
  Plus,
  Search,
  Sparkles,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import {
  CareerContextGraph,
  CareerContextType,
  ContextLink,
  createSourceHighlight,
  deleteSavedArticle,
  deleteSourceHighlight,
  fetchCareerContextGraph,
  fetchSavedArticles,
  importPublicArticle,
  KnowledgeHubQueryResponse,
  listSourceContext,
  listSourceHighlights,
  linkSourceContext,
  OmniSaveHighlightAction,
  queryKnowledgeHub,
  SavedArticleItem,
  SourceHighlight,
} from "@/api/ai";

const sourceLabels: Record<SavedArticleItem["platform"], string> = {
  linkedin: "LinkedIn",
  medium: "Medium",
  substack: "Substack",
  instagram: "Instagram",
  custom_url: "Web",
};
const sourceClasses: Record<SavedArticleItem["platform"], string> = {
  linkedin: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  medium: "border-foreground/15 bg-foreground/5 text-foreground/80",
  substack: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  instagram: "border-pink-500/30 bg-pink-500/10 text-pink-200",
  custom_url: "border-primary/30 bg-primary/10 text-primary",
};
const actionLabels: Record<OmniSaveHighlightAction, string> = {
  evidence: "Evidence",
  question: "Interview question",
  flashcard: "Flashcard",
  application: "Application note",
};
const contextLabels: Record<CareerContextType, string> = {
  role: "Target role",
  company: "Company",
  skill: "Skill",
  application: "Application",
  practice: "Practice",
  interview_stage: "Interview stage",
};

function NlpStatus({ article }: { article: SavedArticleItem }) {
  const ready = article.nlp.status === "ready" && !article.nlp.needs_review;
  return (
    <Badge variant="outline" className={ready ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}>
      {ready ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <BrainCircuit className="mr-1 h-3 w-3" />}
      {ready ? "AI enriched" : "Needs review"}
    </Badge>
  );
}

function EvidenceCard({ highlight, onDelete }: { highlight: SourceHighlight; onDelete: (highlight: SourceHighlight) => void }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/70 p-3 transition hover:-translate-y-0.5 hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <Badge variant="secondary" className="text-[11px]">{actionLabels[highlight.action_type]}</Badge>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(highlight)} aria-label="Delete evidence card">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <blockquote className="mt-3 border-l-2 border-primary/60 pl-3 text-sm leading-6 text-foreground/90">“{highlight.text_excerpt}”</blockquote>
      {highlight.note && <p className="mt-3 text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">Note:</span> {highlight.note}</p>}
      <p className="mt-3 text-[11px] text-muted-foreground">{highlight.created_at ? new Date(highlight.created_at).toLocaleDateString() : "Saved evidence"}</p>
    </div>
  );
}

function ContextPill({ link, onRemove }: { link: ContextLink; onRemove?: () => void }) {
  return (
    <Badge variant="outline" className="gap-1.5 border-primary/25 bg-primary/5 py-1 text-[11px]">
      <span className="text-primary">{contextLabels[link.context_type] || link.context_type}</span>
      <span>{link.context_label}</span>
      {onRemove && <button type="button" onClick={onRemove} className="ml-0.5 rounded-full p-0.5 hover:bg-muted" aria-label={`Remove ${link.context_label}`}><X className="h-3 w-3" /></button>}
    </Badge>
  );
}

function ContextGraphPanel({ graph, skill, role, onSkillChange, onRoleChange, onRefresh, loading }: {
  graph: CareerContextGraph | null;
  skill: string;
  role: string;
  onSkillChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  const sourceNodes = graph?.nodes.filter((node) => node.type === "source") || [];
  const contextNodes = graph?.nodes.filter((node) => node.type !== "source") || [];
  return (
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.04]">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Network className="h-4 w-4 text-primary" /> Career context graph</CardTitle>
            <CardDescription className="mt-1">Connect saved evidence to the roles, skills, and companies you are preparing for.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>{loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Network className="mr-2 h-3.5 w-3.5" />}Refresh graph</Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input value={role} onChange={(event) => onRoleChange(event.target.value)} placeholder="Filter by role, e.g. Backend Engineer" aria-label="Filter graph by role" />
          <Input value={skill} onChange={(event) => onSkillChange(event.target.value)} placeholder="Filter by skill, e.g. Python" aria-label="Filter graph by skill" />
          <Button type="button" onClick={onRefresh}>Explore</Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {!graph || sourceNodes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Network className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Your career graph is ready for its first link</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Open a source, connect it to a role or skill, and the graph will show where your evidence can be reused.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Saved sources</p>
              {sourceNodes.map((node) => <div key={node.id} className="rounded-lg border border-border/60 bg-background/60 p-3"><p className="line-clamp-2 text-sm font-medium">{node.label}</p><p className="mt-1 text-xs text-muted-foreground">{node.source?.highlight_count || 0} evidence card{node.source?.highlight_count === 1 ? "" : "s"}</p></div>)}
            </div>
            <div className="hidden items-center justify-center lg:flex"><Link2 className="h-5 w-5 text-primary/70" /></div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Career context</p>
              {contextNodes.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">No role or skill links match these filters yet.</p> : contextNodes.map((node) => <div key={node.id} className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3"><Badge variant="outline" className="text-[10px]">{contextLabels[node.type as CareerContextType] || node.type}</Badge><p className="mt-2 text-sm font-medium">{node.label}</p></div>)}
            </div>
          </div>
        )}
        {graph && <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground"><span>{graph.sources.length} source{graph.sources.length === 1 ? "" : "s"}</span><span>·</span><span>{graph.highlights.length} evidence card{graph.highlights.length === 1 ? "" : "s"}</span><span>·</span><span>{graph.context_links.length} context link{graph.context_links.length === 1 ? "" : "s"}</span></div>}
      </CardContent>
    </Card>
  );
}

export default function Omnisave() {
  const { unavailable: backendUnavailable, refetch: refetchHealth } = useBackendHealth();
  const [articles, setArticles] = useState<SavedArticleItem[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [qaInput, setQaInput] = useState("");
  const [queryMode, setQueryMode] = useState("grounded");
  const [qaResponse, setQaResponse] = useState<KnowledgeHubQueryResponse | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<SavedArticleItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [highlights, setHighlights] = useState<SourceHighlight[]>([]);
  const [contextLinks, setContextLinks] = useState<ContextLink[]>([]);
  const [selectedExcerpt, setSelectedExcerpt] = useState("");
  const [annotation, setAnnotation] = useState("");
  const [actionType, setActionType] = useState<OmniSaveHighlightAction>("evidence");
  const [contextType, setContextType] = useState<CareerContextType>("skill");
  const [contextLabel, setContextLabel] = useState("");
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [savingContext, setSavingContext] = useState(false);
  const [graph, setGraph] = useState<CareerContextGraph | null>(null);
  const [graphSkill, setGraphSkill] = useState("");
  const [graphRole, setGraphRole] = useState("");
  const [graphLoading, setGraphLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const loadArticles = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchSavedArticles();
      setArticles(result.sources || []);
    } catch {
      await refetchHealth().catch(() => null);
      setArticles([]);
      setError("Your saved library could not be loaded. Try again in a moment.");
    }
  }, [refetchHealth]);

  useEffect(() => { void loadArticles(); }, [loadArticles]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(articles.map((article) => article.category).filter(Boolean))).sort()], [articles]);
  const filteredArticles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return articles.filter((article) => {
      const matchesCategory = activeCategory === "All" || article.category === activeCategory;
      const haystack = [article.title, article.author, article.category, ...article.tags, ...article.keyphrases, ...article.entities].join(" ").toLowerCase();
      return matchesCategory && (!query || haystack.includes(query));
    });
  }, [activeCategory, articles, searchQuery]);
  const readyCount = articles.filter((article) => article.nlp.status === "ready" && !article.nlp.needs_review).length;
  const tagCount = new Set(articles.flatMap((article) => article.tags)).size;
  const highlightCount = articles.reduce((total, article) => total + (article.highlight_count || 0), 0);

  const openSourceDetail = async (article: SavedArticleItem) => {
    setSelectedArticle(article);
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedExcerpt("");
    try {
      const [loadedHighlights, loadedContext] = await Promise.all([listSourceHighlights(article.id), listSourceContext(article.id)]);
      setHighlights(loadedHighlights);
      setContextLinks(loadedContext);
    } catch {
      setHighlights([]);
      setContextLinks([]);
      setError("This source is available, but its evidence cards could not be loaded.");
    } finally {
      setDetailLoading(false);
    }
  };

  const captureSelection = () => {
    const selection = window.getSelection()?.toString().trim() || "";
    if (selection) setSelectedExcerpt(selection.slice(0, 5000));
  };

  const handleSaveHighlight = async () => {
    if (!selectedArticle || !selectedExcerpt.trim() || savingEvidence) return;
    setSavingEvidence(true);
    setError(null);
    try {
      const highlight = await createSourceHighlight(selectedArticle.id, { text_excerpt: selectedExcerpt, note: annotation, action_type: actionType });
      setHighlights((current) => [highlight, ...current]);
      setSelectedExcerpt("");
      setAnnotation("");
      setArticles((current) => current.map((article) => article.id === selectedArticle.id ? { ...article, highlight_count: (article.highlight_count || 0) + 1 } : article));
    } catch {
      setError("The evidence card could not be saved. Check that the AI engine and database are available.");
    } finally { setSavingEvidence(false); }
  };

  const handleDeleteHighlight = async (highlight: SourceHighlight) => {
    if (!selectedArticle) return;
    try {
      await deleteSourceHighlight(selectedArticle.id, highlight.id);
      setHighlights((current) => current.filter((item) => item.id !== highlight.id));
      setArticles((current) => current.map((article) => article.id === selectedArticle.id ? { ...article, highlight_count: Math.max(0, (article.highlight_count || 0) - 1) } : article));
    } catch { setError("The evidence card could not be deleted."); }
  };

  const handleLinkContext = async () => {
    if (!selectedArticle || !contextLabel.trim() || savingContext) return;
    setSavingContext(true);
    try {
      const link = await linkSourceContext(selectedArticle.id, { context_type: contextType, context_label: contextLabel.trim() });
      setContextLinks((current) => current.some((item) => item.id === link.id) ? current : [...current, link]);
      setContextLabel("");
      setArticles((current) => current.map((article) => article.id === selectedArticle.id ? { ...article, context_count: (article.context_count || 0) + 1 } : article));
    } catch { setError("The career context link could not be saved."); }
    finally { setSavingContext(false); }
  };

  const refreshGraph = async () => {
    setGraphLoading(true);
    try { setGraph(await fetchCareerContextGraph({ skill: graphSkill, role: graphRole })); }
    catch { setError("The career context graph could not be loaded yet."); }
    finally { setGraphLoading(false); }
  };

  const handleIngestUrl = async () => {
    if (!urlInput.trim() || backendUnavailable) return;
    setIngesting(true); setError(null);
    try { await importPublicArticle(urlInput.trim()); await loadArticles(); setUrlInput(""); }
    catch { await refetchHealth().catch(() => null); setError("This link could not be imported. Check that it is public and try again."); }
    finally { setIngesting(false); }
  };

  const handleDeleteSource = async (article: SavedArticleItem) => {
    if (backendUnavailable || deletingSourceId) return;
    if (!window.confirm(`Delete “${article.title}” from your saved library?`)) return;
    setDeletingSourceId(article.id);
    try { await deleteSavedArticle(article.id); setArticles((current) => current.filter((item) => item.id !== article.id)); if (selectedArticle?.id === article.id) setDetailOpen(false); }
    catch { setError("The source could not be deleted. Try again."); }
    finally { setDeletingSourceId(null); }
  };

  const handleAsk = async () => {
    if (!qaInput.trim() || backendUnavailable || asking) return;
    const modePrompt: Record<string, string> = {
      grounded: "Answer from my saved reading: ",
      compare: "Compare the relevant saved sources and cite differences: ",
      prepare: "Prepare me for the role or company using only my saved reading: ",
      explain: "Explain this simply using my saved reading: ",
      gaps: "Find evidence gaps in my saved reading related to: ",
      mock: "Turn my saved reading into a grounded mock interview prompt for: ",
    };
    setAsking(true); setError(null);
    try { setQaResponse(await queryKnowledgeHub(`${modePrompt[queryMode] || modePrompt.grounded}${qaInput.trim()}`)); }
    catch { setError("OmniSaveAI could not answer from your saved reading right now."); }
    finally { setAsking(false); }
  };

  return (
    <Layout>
      <div className="container space-y-8 py-10">
        <FadeIn>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl"><Badge variant="outline" className="mb-3 border-primary/30 bg-primary/5 text-primary"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> OmniSaveAI</Badge><h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Turn saved reading into career evidence.</h1><p className="mt-3 text-base leading-7 text-muted-foreground">Import public posts, enrich them with NLP, highlight what matters, and connect every insight to the roles and skills you are preparing for.</p></div>
            <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl border border-border/60 bg-card p-3"><div className="text-xl font-semibold">{articles.length}</div><div className="text-[11px] text-muted-foreground">sources</div></div><div className="rounded-xl border border-border/60 bg-card p-3"><div className="text-xl font-semibold">{highlightCount}</div><div className="text-[11px] text-muted-foreground">evidence cards</div></div><div className="rounded-xl border border-border/60 bg-card p-3"><div className="text-xl font-semibold">{readyCount}</div><div className="text-[11px] text-muted-foreground">AI enriched</div></div></div>
          </div>
        </FadeIn>
        {backendUnavailable && <BackendUnavailableBanner feature="knowledge hub" />}
        {error && <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
        <SlideUp delay={0.05}><Card className="border-primary/20 bg-gradient-to-r from-primary/[0.06] via-card to-card"><CardContent className="p-5"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" /><Input value={urlInput} onChange={(event) => setUrlInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleIngestUrl(); }} placeholder="Paste a public LinkedIn, Medium, Substack, Instagram, or web URL" className="pl-9" disabled={backendUnavailable || ingesting} aria-label="Public URL to save" /></div><Button type="button" onClick={() => void handleIngestUrl()} disabled={backendUnavailable || ingesting || !urlInput.trim()}>{ingesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Save and enrich</Button></div><p className="mt-3 text-xs text-muted-foreground">Only candidate-selected public URLs are imported. OmniSaveAI keeps the original link, creates NLP metadata, and lets you verify the exact evidence used in answers.</p></CardContent></Card></SlideUp>
        <ContextGraphPanel graph={graph} skill={graphSkill} role={graphRole} onSkillChange={setGraphSkill} onRoleChange={setGraphRole} onRefresh={() => void refreshGraph()} loading={graphLoading} />
        <SlideUp delay={0.08}><Card className="border-border/70"><CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4 text-primary" /> Ask your saved reading</CardTitle><CardDescription>Answers stay grounded in your indexed sources, with highlighted evidence preferred when available.</CardDescription></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-[180px_1fr_auto]"><select value={queryMode} onChange={(event) => setQueryMode(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="OmniSaveAI query mode"><option value="grounded">Grounded answer</option><option value="compare">Compare sources</option><option value="prepare">Prepare for role/company</option><option value="explain">Explain simply</option><option value="gaps">Find evidence gaps</option><option value="mock">Mock interview</option></select><Input value={qaInput} onChange={(event) => setQaInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleAsk(); }} placeholder="Ask about a skill, company, role, or saved idea…" disabled={backendUnavailable || asking} aria-label="Question about saved reading" /><Button type="button" onClick={() => void handleAsk()} disabled={backendUnavailable || asking || !qaInput.trim()}>{asking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}Ask</Button></div>{qaResponse && <div className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.04] p-4"><p className="whitespace-pre-wrap text-sm leading-7">{qaResponse.answer}</p>{qaResponse.citations.length > 0 && <div className="mt-4 grid gap-2 border-t border-border/60 pt-4 md:grid-cols-2">{qaResponse.citations.map((citation) => <a key={`${citation.source_id || citation.url}-${citation.tag}`} href={citation.url} target="_blank" rel="noreferrer" className="rounded-lg border border-border/60 bg-card p-3 transition hover:-translate-y-0.5 hover:border-primary/30"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold text-primary">{citation.tag}{citation.evidence_type === "highlight" && " · Evidence card"}</div><div className="mt-1 text-sm font-medium">{citation.title}</div><div className="mt-1 text-xs text-muted-foreground">{citation.author}</div></div><ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></div>{citation.excerpt && <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">“{citation.excerpt}”</p>}</a>)}</div>}</div>}</CardContent></Card></SlideUp>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-semibold tracking-tight">Your saved library</h2><p className="mt-1 text-sm text-muted-foreground">{articles.length ? `${articles.length} source${articles.length === 1 ? "" : "s"} · ` : ""}Search across posts, tags, evidence, and career context.</p></div><div className="relative w-full md:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search saved reading…" className="pl-9" aria-label="Search saved reading" /></div></div>
        <div className="flex flex-wrap gap-2">{categories.map((category) => <Button key={category} size="sm" variant={activeCategory === category ? "default" : "outline"} onClick={() => setActiveCategory(category)}>{category}</Button>)}</div>
        {filteredArticles.length === 0 ? <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center"><FileText className="h-8 w-8 text-muted-foreground" /><h3 className="font-semibold">{articles.length ? "No saved posts match this view" : "Your library is ready for its first save"}</h3><p className="max-w-md text-sm text-muted-foreground">{articles.length ? "Try another search or category." : "Paste a public article above and OmniSaveAI will create searchable NLP metadata for it."}</p></CardContent></Card> : <StaggerContainer className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" staggerDelay={0.06}>{filteredArticles.map((article) => <Card key={article.id} className="group flex h-full flex-col"><CardHeader className="space-y-3 pb-3"><div className="flex items-center justify-between gap-2"><Badge variant="outline" className={sourceClasses[article.platform]}>{sourceLabels[article.platform]}</Badge><NlpStatus article={article} /></div><CardTitle className="line-clamp-2 text-base leading-6">{article.title}</CardTitle><CardDescription className="line-clamp-1">{article.author}</CardDescription></CardHeader><CardContent className="flex flex-1 flex-col gap-4"><p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{article.nlp.summary || article.summary[0] || "This source is indexed and ready to explore."}</p><div className="flex flex-wrap gap-1.5">{article.tags.slice(0, 5).map((tag) => <Badge key={tag} variant="secondary" className="text-[11px]">{tag}</Badge>)}{article.keyphrases.slice(0, 2).map((phrase) => <Badge key={phrase} variant="outline" className="text-[11px] text-muted-foreground">{phrase}</Badge>)}</div>{article.entities.length > 0 && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Tags className="h-3.5 w-3.5 text-primary" />{article.entities.slice(0, 3).join(" · ")}</div>}<div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground"><Badge variant="outline" className="gap-1"><BookOpen className="h-3 w-3" />{article.highlight_count || 0} evidence</Badge><Badge variant="outline" className="gap-1"><Link2 className="h-3 w-3" />{article.context_count || 0} context</Badge></div><div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3"><span className="text-xs text-muted-foreground">{article.nlp.confidence > 0 ? `${Math.round(article.nlp.confidence * 100)}% NLP confidence` : "NLP pending"}</span><div className="flex items-center gap-1"><Button type="button" variant="outline" size="sm" onClick={() => void openSourceDetail(article)}>Open workspace</Button><Button asChild variant="ghost" size="icon"><a href={article.url} target="_blank" rel="noreferrer" aria-label={`Open ${article.title} in a new tab`}><ExternalLink className="h-4 w-4" /></a></Button><Button type="button" variant="ghost" size="icon" onClick={() => void handleDeleteSource(article)} disabled={deletingSourceId === article.id} aria-label={`Delete ${article.title}`}>{deletingSourceId === article.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></div></div></CardContent></Card>)}</StaggerContainer>}
        <FadeIn delay={0.12}><div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-xs leading-5 text-muted-foreground"><BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p><strong className="text-foreground">Evidence-first NLP:</strong> every saved item receives a category, topic tags, keyphrases, entities, summary, confidence, and enrichment status. Evidence cards make the exact passage inspectable, while the context graph connects it to your next role, company, or practice session.</p></div></FadeIn>
      </div>
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />{selectedArticle?.title || "Source workspace"}</DialogTitle><DialogDescription>{selectedArticle?.author || ""} · Read, capture evidence, and connect this source to your career context.</DialogDescription></DialogHeader>
          {detailLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : selectedArticle && <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4"><div ref={contentRef} className="max-h-[42vh] overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-5 text-sm leading-7 whitespace-pre-wrap select-text">{selectedArticle.content || selectedArticle.summary.join("\n\n") || "The source text is not available in the current response. Open the original source to read it."}</div><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Select a passage above, then capture it as reusable evidence.</p><Button type="button" variant="outline" size="sm" onClick={captureSelection}><Sparkles className="mr-2 h-3.5 w-3.5" />Capture selection</Button></div><Card className="border-primary/20"><CardHeader className="pb-3"><CardTitle className="text-sm">Create evidence card</CardTitle><CardDescription>Turn a precise excerpt into a question, flashcard, or application note.</CardDescription></CardHeader><CardContent className="space-y-3"><Textarea value={selectedExcerpt} onChange={(event) => setSelectedExcerpt(event.target.value)} placeholder="Paste or capture the exact passage…" rows={4} aria-label="Evidence excerpt" /><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Textarea value={annotation} onChange={(event) => setAnnotation(event.target.value)} placeholder="Why does this matter? (optional)" rows={2} aria-label="Evidence annotation" /><select value={actionType} onChange={(event) => setActionType(event.target.value as OmniSaveHighlightAction)} className="h-10 rounded-md border border-border bg-background px-3 text-sm" aria-label="Evidence action type"><option value="evidence">Evidence card</option><option value="question">Interview question</option><option value="flashcard">Flashcard</option><option value="application">Application note</option></select><Button type="button" onClick={() => void handleSaveHighlight()} disabled={savingEvidence || !selectedExcerpt.trim()}>{savingEvidence ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Save</Button></div></CardContent></Card></div>
            <div className="space-y-4"><Card><CardHeader className="pb-3"><CardTitle className="text-sm">Evidence cards <Badge variant="secondary" className="ml-1">{highlights.length}</Badge></CardTitle><CardDescription>Exact excerpts that OmniSaveAI can cite first.</CardDescription></CardHeader><CardContent className="space-y-3">{highlights.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">No evidence cards yet. Capture a passage to make this source reusable.</p> : highlights.map((highlight) => <EvidenceCard key={highlight.id} highlight={highlight} onDelete={(item) => void handleDeleteHighlight(item)} />)}</CardContent></Card><Card><CardHeader className="pb-3"><CardTitle className="text-sm">Career context</CardTitle><CardDescription>Link this source to the work you are actively preparing for.</CardDescription></CardHeader><CardContent className="space-y-3">{contextLinks.length > 0 && <div className="flex flex-wrap gap-2">{contextLinks.map((link) => <ContextPill key={link.id} link={link} />)}</div>}<div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]"><select value={contextType} onChange={(event) => setContextType(event.target.value as CareerContextType)} className="h-10 rounded-md border border-border bg-background px-3 text-sm" aria-label="Career context type">{Object.entries(contextLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Input value={contextLabel} onChange={(event) => setContextLabel(event.target.value)} placeholder="e.g. Staff Backend Engineer" aria-label="Career context label" /><Button type="button" onClick={() => void handleLinkContext()} disabled={savingContext || !contextLabel.trim()}>{savingContext ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}Link</Button></div></CardContent></Card></div>
          </div>}
          <DialogFooter><Button asChild variant="outline"><a href={selectedArticle?.url || "#"} target="_blank" rel="noreferrer">Open original <ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
