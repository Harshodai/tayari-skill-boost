import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Search, Sparkles, ExternalLink, Layers, MessageSquare, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { queryKnowledgeHub, fetchSavedArticles, syncSavedPosts, SavedArticleItem } from '@/api/ai';
import { BackendUnavailableBanner } from '@/components/BackendUnavailableBanner';
import { useBackendHealth } from '@/hooks/useBackendHealth';

export default function Omnisave() {
  const { unavailable: backendUnavailable, refetch: refetchHealth } = useBackendHealth();
  const [articles, setArticles] = useState<SavedArticleItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [qaInput, setQaInput] = useState<string>('');
  const [qaResponse, setQaResponse] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadArticles = async () => {
    setError(null);
    try {
      const res = await fetchSavedArticles();
      setArticles(res.sources ?? []);
    } catch (err) {
      // ponytail: re-probe the gateway so the banner + disabled states reflect
      // current health instead of a stale poll — a transient failure must not
      // leave the page permanently "unavailable".
      await refetchHealth().catch(() => null);
      setArticles([]);
      setError("Couldn't load your saved sources. Try again in a moment.");
    }
  };

  useEffect(() => {
    loadArticles();
  }, []);

  // Categories come from what has actually been ingested — no dead filter pills.
  const categories = [
    'All',
    ...Array.from(new Set(articles.map((a) => a.category).filter(Boolean))),
  ] as string[];

  const filteredArticles = articles.filter(art => {
    const matchesCat = activeCategory === 'All' || art.category === activeCategory;
    const matchesQuery = art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         art.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const [urlInput, setUrlInput] = useState<string>('');
  const [ingesting, setIngesting] = useState<boolean>(false);

  const handleIngestUrl = async () => {
    if (!urlInput.trim() || backendUnavailable) return;
    setIngesting(true);
    setError(null);
    try {
      let platform = 'custom_url';
      if (urlInput.includes('substack.')) platform = 'substack';
      else if (urlInput.includes('medium.')) platform = 'medium';
      else if (urlInput.includes('linkedin.')) platform = 'linkedin';

      const res = await syncSavedPosts([platform], urlInput.trim());
      if (res.sources && res.sources.length > 0) {
        setArticles(res.sources);
        setUrlInput('');
      } else {
        await loadArticles();
      }
    } catch (err) {
      await refetchHealth().catch(() => null);
      setError("Couldn't import this link. Check that it is a public article URL and try again.");
    } finally {
      setIngesting(false);
    }
  };

  const handleAskRAG = async () => {
    if (!qaInput.trim() || backendUnavailable) return;
    setLoading(true);
    setError(null);
    try {
      const res = await queryKnowledgeHub(qaInput);
      setQaResponse({
        answer: res.answer,
        citations: res.citations || [],
      });
    } catch (err) {
      await refetchHealth().catch(() => null);
      setError('Failed to query knowledge base. Please try again.');
      setQaResponse(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8 text-slate-100 font-sans">
        {/* Backend unavailable — the whole page is Go+Python gated */}
        {backendUnavailable && (
          <div className="mb-6">
            <BackendUnavailableBanner feature="knowledge hub" />
          </div>
        )}
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Layers className="w-8 h-8 text-purple-400" /> Omnisave Career Reading
            </h1>
            <p className="text-xs text-slate-400">Save public article links you choose, organize them with AI, and ask questions with linked source citations.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="border-orange-800 bg-orange-950 text-orange-300">Substack link import</Badge>
            <Badge className="border-emerald-800 bg-emerald-950 text-emerald-300">Medium link import</Badge>
            <Badge className="border-blue-800 bg-blue-950 text-blue-300">LinkedIn link import</Badge>
          </div>
        </div>

        <Card className="border-amber-800/70 bg-amber-950/30 p-4 text-xs leading-relaxed text-amber-100"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><p><strong>Import scope:</strong> Omnisave currently imports public article URLs that you paste. It does not connect to or enumerate your saved-post lists on Substack, Medium, or LinkedIn. LinkedIn saved items require an authorized integration or a user-provided export before that promise can be made.</p></div></Card>

        {/* Candidate-selected public article URL import */}
        <Card className="bg-slate-900/80 border-slate-800 p-4 flex flex-col sm:flex-row items-center gap-3">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste a public Substack, Medium, LinkedIn, or other article URL..."
            className="bg-slate-950 border-slate-800 text-xs font-mono flex-1"
            aria-label="Public article URL to import"
            disabled={backendUnavailable}
          />
          <Button
            onClick={handleIngestUrl}
            disabled={ingesting || !urlInput.trim() || backendUnavailable}
            className="bg-purple-600 hover:bg-purple-500 font-bold text-xs px-5 w-full sm:w-auto"
            aria-label={ingesting ? 'Importing article' : 'Import article'}
          >
            {ingesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                Ingest Article
              </>
            )}
          </Button>
        </Card>

        {error && (
          <div className="p-4 bg-red-950/80 border border-red-800 text-red-200 rounded-lg text-xs font-mono flex items-center gap-3 shadow-lg" role="alert">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Pills & Search */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map(cat => (
              <Button
                key={cat}
                size="sm"
                onClick={() => setActiveCategory(cat)}
                className={activeCategory === cat ? 'bg-purple-600 text-white font-semibold' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'}
              >
                {cat}
              </Button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <label htmlFor="omnisave-search" className="sr-only">
              Search saved sources
            </label>
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <Input
              id="omnisave-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved sources..."
              className="bg-slate-900 border-slate-800 pl-9 text-xs"
              aria-label="Search saved sources"
            />
          </div>
        </div>

        {/* Knowledge Card Grid */}
        {filteredArticles.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800 text-slate-300">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <BookOpen className="h-8 w-8 text-slate-500" />
              <div>
                <p className="font-medium text-slate-100">Nothing saved yet</p>
                <p className="text-xs text-slate-400">
                  Paste a public article URL above to begin. Account-level saved-post synchronization is not connected; LinkedIn saved items require an authorized integration or your official data export.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {filteredArticles.map(art => (
            <Card key={art.id} className="bg-slate-900 border-slate-800 text-slate-100 flex flex-col justify-between p-4 space-y-4 hover:border-purple-500/50 transition">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Badge className="bg-purple-950 text-purple-300 border-purple-800 text-[10px]">
                    {art.platform.toUpperCase()}
                  </Badge>
                  <span className="text-[10px] text-slate-500">{art.saved_at}</span>
                </div>
                <h3 className="font-bold text-sm leading-snug">{art.title}</h3>
                <p className="text-xs text-slate-400">By {art.author}</p>
                <div className="space-y-1 pt-2">
                  {art.summary.map((bullet, i) => (
                    <div key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                      <span className="text-purple-400">•</span> {bullet}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                <Badge className="bg-slate-950 text-slate-400 border-slate-800 text-[10px]">{art.category}</Badge>
                <a href={art.url} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1 font-semibold">
                  Read <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </Card>
          ))}
        </div>

        {/* Persistent Q&A Drawer with Inline Citations */}
        <Card className="bg-slate-900 border-purple-900/60 text-slate-100 p-6 space-y-4 shadow-xl shadow-purple-950/40">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold">Ask your saved career reading</h3>
          </div>

          <div className="flex gap-3">
            <Input
              value={qaInput}
              onChange={(e) => setQaInput(e.target.value)}
              placeholder="e.g. How do I structure STAR bullets for system design interviews?"
              className="bg-slate-950 border-slate-800 text-xs font-mono"
              disabled={backendUnavailable}
            />
            <Button
              onClick={handleAskRAG}
              disabled={loading || backendUnavailable}
              className="bg-purple-600 hover:bg-purple-500 font-bold px-6"
              aria-label={loading ? 'Searching saved reading, please wait' : 'Ask saved reading'}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  Querying...
                </>
              ) : (
                'Ask sources'
              )}
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 rounded text-xs font-mono" role="alert">
              {error}
            </div>
          )}

          {qaResponse && (
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-4 font-mono text-xs">
              <p className="text-slate-200 leading-relaxed">{qaResponse.answer}</p>
              
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">References & Inline Citations</div>
                <div className="flex flex-wrap gap-2">
                  {qaResponse.citations.map((c: any, i: number) => (
                    <a
                      key={i}
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-purple-950/60 border border-purple-800 text-purple-300 rounded text-[11px] hover:bg-purple-900 transition flex items-center gap-1.5"
                    >
                      <span className="font-bold">{c.tag}</span> {c.title} ({c.author}) <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
