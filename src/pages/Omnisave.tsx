import { useCallback, useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { BackendUnavailableBanner } from "@/components/BackendUnavailableBanner";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FadeIn, SlideUp, StaggerContainer } from "@/components/ui/motion";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
} from "lucide-react";
import {
  deleteSavedArticle,
  fetchSavedArticles,
  importPublicArticle,
  KnowledgeHubQueryResponse,
  queryKnowledgeHub,
  SavedArticleItem,
} from "@/api/ai";

const sourceLabels: Record<SavedArticleItem["platform"], string> = {
  linkedin: "LinkedIn",
  medium: "Medium",
  substack: "Substack",
  custom_url: "Web",
};

const sourceClasses: Record<SavedArticleItem["platform"], string> = {
  linkedin: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  medium: "border-foreground/15 bg-foreground/5 text-foreground/80",
  substack: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  custom_url: "border-primary/30 bg-primary/10 text-primary",
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

export default function Omnisave() {
  const { unavailable: backendUnavailable, refetch: refetchHealth } = useBackendHealth();
  const [articles, setArticles] = useState<SavedArticleItem[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [qaInput, setQaInput] = useState("");
  const [qaResponse, setQaResponse] = useState<KnowledgeHubQueryResponse | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

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
  const sourcesCount = new Set(articles.map((article) => article.platform)).size;

  const handleIngestUrl = async () => {
    if (!urlInput.trim() || backendUnavailable) return;
    setIngesting(true);
    setError(null);
    try {
      await importPublicArticle(urlInput.trim());
      await loadArticles();
      setUrlInput("");
    } catch {
      await refetchHealth().catch(() => null);
      setError("This link could not be imported. Check that it is public and try again.");
    } finally {
      setIngesting(false);
    }
  };

  const handleDeleteSource = async (article: SavedArticleItem) => {
    if (backendUnavailable || deletingSourceId) return;
    if (!window.confirm(`Delete “${article.title}” from your saved library?`)) return;
    setDeletingSourceId(article.id);
    setError(null);
    try {
      await deleteSavedArticle(article.id);
      setArticles((current) => current.filter((item) => item.id !== article.id));
      setQaResponse(null);
    } catch {
      await refetchHealth().catch(() => null);
      setError("The saved item was not deleted. Nothing has been removed yet.");
    } finally {
      setDeletingSourceId(null);
    }
  };

  const handleAskRag = async () => {
    if (!qaInput.trim() || backendUnavailable) return;
    setAsking(true);
    setError(null);
    try {
      setQaResponse(await queryKnowledgeHub(qaInput.trim()));
    } catch {
      await refetchHealth().catch(() => null);
      setError("The answer could not be generated from your saved library.");
      setQaResponse(null);
    } finally {
      setAsking(false);
    }
  };

  return (
    <Layout>
      <div className="container space-y-8 py-8 md:py-10">
        {backendUnavailable && <BackendUnavailableBanner feature="OmniSaveAI" />}

        <FadeIn>
          <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-[0_24px_80px_-48px_hsl(var(--primary)/0.8)] md:p-8">
            <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-4">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary"><Sparkles className="mr-1.5 h-3.5 w-3.5" />OmniSaveAI knowledge workspace</Badge>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Save it once. Ask it anything later.</h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">OmniSaveAI turns your saved reading into a searchable, AI-tagged knowledge base. Every answer stays grounded in the posts you imported and links back to the evidence.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs sm:gap-3">
                <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-3"><div className="text-xl font-semibold">{articles.length}</div><div className="mt-1 text-muted-foreground">saved</div></div>
                <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-3"><div className="text-xl font-semibold">{readyCount}</div><div className="mt-1 text-muted-foreground">enriched</div></div>
                <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-3"><div className="text-xl font-semibold">{tagCount}</div><div className="mt-1 text-muted-foreground">tags</div></div>
              </div>
            </div>
          </section>
        </FadeIn>

        <SlideUp delay={0.05}>
          <Card className="border-border/70 bg-card/80">
            <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4 text-primary" />Add to your knowledge base</CardTitle><CardDescription>Paste a public LinkedIn, Medium, Substack, or article URL. OmniSaveAI extracts readable content, tags it, and indexes it for questions.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row"><Input value={urlInput} onChange={(event) => setUrlInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleIngestUrl(); }} placeholder="https://medium.com/..." aria-label="Public article URL to import" disabled={backendUnavailable} /><Button onClick={() => void handleIngestUrl()} disabled={ingesting || !urlInput.trim() || backendUnavailable}>{ingesting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enriching…</> : <><Sparkles className="mr-2 h-4 w-4" />Save & enrich</>}</Button></div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline" className="border-blue-500/30 text-blue-300">LinkedIn URL import</Badge><Badge variant="outline" className="border-foreground/15">Medium URL import</Badge><Badge variant="outline" className="border-orange-500/30 text-orange-300">Substack URL / RSS</Badge></div>
            </CardContent>
          </Card>
        </SlideUp>

        <Card className="border-amber-500/20 bg-amber-500/5"><CardContent className="flex items-start gap-3 p-4 text-sm leading-6 text-amber-100/90"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p><strong className="text-amber-200">Privacy boundary:</strong> public URL imports are supported now. Account-level saved-post sync is shown only when an authorized platform or user-provided export is available; OmniSaveAI never asks for platform passwords or private session cookies.</p></CardContent></Card>

        {error && <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-foreground" role="alert"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

        <SlideUp delay={0.1}>
          <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4 text-primary" />Ask your saved reading</CardTitle><CardDescription>Ask for themes, comparisons, frameworks, or next steps. Answers cite the exact saved excerpts used.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-col gap-2 sm:flex-row"><Input value={qaInput} onChange={(event) => setQaInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleAskRag(); }} placeholder="What do my saved posts say about building a strong engineering portfolio?" aria-label="Ask your saved reading" disabled={backendUnavailable} /><Button onClick={() => void handleAskRag()} disabled={asking || !qaInput.trim() || backendUnavailable}>{asking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching…</> : "Ask sources"}</Button></div>{qaResponse && <div className="space-y-4 rounded-xl border border-border/70 bg-background/70 p-4"><div className="flex items-center justify-between gap-3"><Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200"><CheckCircle2 className="mr-1 h-3 w-3" />Grounded answer</Badge><span className="text-xs text-muted-foreground">{qaResponse.retrieved_count || qaResponse.citations.length} sources inspected</span></div><p className="text-sm leading-7 text-foreground">{qaResponse.answer}</p>{qaResponse.citations.length > 0 && <div className="grid gap-3 border-t border-border/60 pt-4 md:grid-cols-2">{qaResponse.citations.map((citation) => <a key={`${citation.source_id || citation.url}-${citation.tag}`} href={citation.url} target="_blank" rel="noreferrer" className="group rounded-lg border border-border/60 bg-card p-3 transition hover:-translate-y-0.5 hover:border-primary/30"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold text-primary">{citation.tag}</div><div className="mt-1 text-sm font-medium">{citation.title}</div><div className="mt-1 text-xs text-muted-foreground">{citation.author}</div></div><ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-primary" /></div>{citation.excerpt && <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">“{citation.excerpt}”</p>}</a>)}</div>}</div>}</CardContent></Card>
        </SlideUp>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-semibold tracking-tight">Your saved library</h2><p className="mt-1 text-sm text-muted-foreground">{sourcesCount ? `${sourcesCount} source${sourcesCount === 1 ? "" : "s"} · ` : ""}Search across your posts, tags, phrases, and entities.</p></div><div className="relative w-full md:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search saved reading…" className="pl-9" aria-label="Search saved reading" /></div></div>

        <div className="flex flex-wrap gap-2">{categories.map((category) => <Button key={category} size="sm" variant={activeCategory === category ? "default" : "outline"} onClick={() => setActiveCategory(category)}>{category}</Button>)}</div>

        {filteredArticles.length === 0 ? <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center"><FileText className="h-8 w-8 text-muted-foreground" /><h3 className="font-semibold">{articles.length ? "No saved posts match this view" : "Your library is ready for its first save"}</h3><p className="max-w-md text-sm text-muted-foreground">{articles.length ? "Try another search or category." : "Paste a public article above and OmniSaveAI will create searchable NLP metadata for it."}</p></CardContent></Card> : <StaggerContainer className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" staggerDelay={0.06}>{filteredArticles.map((article) => <Card key={article.id} className="group flex h-full flex-col"><CardHeader className="space-y-3 pb-3"><div className="flex items-center justify-between gap-2"><Badge variant="outline" className={sourceClasses[article.platform]}>{sourceLabels[article.platform]}</Badge><NlpStatus article={article} /></div><CardTitle className="line-clamp-2 text-base leading-6">{article.title}</CardTitle><CardDescription className="line-clamp-1">{article.author}</CardDescription></CardHeader><CardContent className="flex flex-1 flex-col gap-4"><p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{article.nlp.summary || article.summary[0] || "This source is indexed and ready to explore."}</p><div className="flex flex-wrap gap-1.5">{article.tags.slice(0, 5).map((tag) => <Badge key={tag} variant="secondary" className="text-[11px]">{tag}</Badge>)}{article.keyphrases.slice(0, 2).map((phrase) => <Badge key={phrase} variant="outline" className="text-[11px] text-muted-foreground">{phrase}</Badge>)}</div>{article.entities.length > 0 && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Tags className="h-3.5 w-3.5 text-primary" />{article.entities.slice(0, 3).join(" · ")}</div>}<div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3"><span className="text-xs text-muted-foreground">{article.nlp.confidence > 0 ? `${Math.round(article.nlp.confidence * 100)}% NLP confidence` : "NLP pending"}</span><div className="flex items-center gap-1"><Button asChild variant="ghost" size="sm"><a href={article.url} target="_blank" rel="noreferrer">Read <ExternalLink className="ml-1 h-3.5 w-3.5" /></a></Button><Button type="button" variant="ghost" size="icon" onClick={() => void handleDeleteSource(article)} disabled={deletingSourceId === article.id} aria-label={`Delete ${article.title}`}>{deletingSourceId === article.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></div></div></CardContent></Card>)}</StaggerContainer>}

        <FadeIn delay={0.12}><div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-xs leading-5 text-muted-foreground"><BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p><strong className="text-foreground">How the NLP layer works:</strong> each saved item receives a category, topic tags, keyphrases, entities, a summary, confidence, and an enrichment status. You can inspect the source evidence through Ask your saved reading, and answers are rejected when they cannot cite your saved corpus.</p></div></FadeIn>
      </div>
    </Layout>
  );
}
