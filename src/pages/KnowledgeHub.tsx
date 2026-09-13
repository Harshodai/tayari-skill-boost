import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Sparkles, 
  Bookmark, 
  Search, 
  Filter, 
  Tag, 
  ArrowRight,
  Loader2,
  Calendar,
  Globe,
  Share2,
  BookMarked
} from "lucide-react";
import { listSaves, createSave, deleteSave, type SavedPost } from "@/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";

const CATEGORIES = [
  { value: "", label: "All Topics" },
  { value: "interview-questions", label: "Interview Questions" },
  { value: "career-advice", label: "Career Advice" },
  { value: "technical", label: "Technical Guides" },
  { value: "company-research", label: "Company Research" },
  { value: "networking", label: "Networking" },
  { value: "other", label: "Other Resources" }
];

const SOURCES = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "medium", label: "Medium" },
  { value: "substack", label: "Substack" },
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "X / Twitter" },
  { value: "other", label: "Other Webpage" }
];

export default function KnowledgeHub() {
  const [saves, setSaves] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({ url: "", note: "", source: "linkedin" });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listSaves(activeCategory);
      setSaves(data || []);
    } catch (error: any) {
      console.error("Failed to fetch saved posts", error);
      toast.error("Failed to load Knowledge Hub items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCategory]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.url || !form.url.startsWith("http")) {
      toast.error("Please enter a valid URL starting with http:// or https://");
      return;
    }
    setBusy(true);
    try {
      const result = await createSave(form);
      toast.success("Saved and AI-analyzed successfully!");
      setForm({ url: "", note: "", source: "linkedin" });
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to analyze and save post");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this item?");
    if (!confirmDelete) return;

    try {
      await deleteSave(id);
      toast.success("Item removed");
      setSaves(saves.filter(s => s.id !== id));
    } catch (error: any) {
      toast.error("Failed to delete item");
    }
  };

  const getSourceColor = (src: string) => {
    switch (src?.toLowerCase()) {
      case "linkedin": return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20";
      case "medium": return "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20";
      case "substack": return "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border-orange-500/20";
      case "twitter":
      case "x": return "bg-slate-500/10 text-slate-800 dark:text-slate-200 hover:bg-slate-500/20 border-slate-500/20";
      default: return "bg-accent/10 text-accent hover:bg-accent/20 border-accent/20";
    }
  };

  const filteredSaves = saves.filter(s => {
    const query = searchQuery.toLowerCase();
    return (
      s.title?.toLowerCase().includes(query) ||
      s.summary?.toLowerCase().includes(query) ||
      s.note?.toLowerCase().includes(query) ||
      s.url?.toLowerCase().includes(query) ||
      s.tags?.some(t => t.toLowerCase().includes(query))
    );
  });

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <BookMarked className="w-7 h-7" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75">
              Knowledge Hub
            </h1>
          </div>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Save and catalog recruiter posts, medium articles, substack threads, and interview questions. 
            Our AI auto-summarizes, categorizes, and extracts tags so you can build a personalized interview prep library.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Form Card */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-border/60 bg-card/50 backdrop-blur-md shadow-lg sticky top-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  Save a Resource
                </CardTitle>
                <CardDescription>
                  Enter a link and Tayari AI will analyze, categorize, and tag it instantly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resource URL</label>
                    <Input
                      type="url"
                      placeholder="https://linkedin.com/posts/..."
                      value={form.url}
                      onChange={(e) => setForm({ ...form, url: e.target.value })}
                      required
                      className="bg-background/80 focus-visible:ring-primary/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Note (Context)</label>
                    <Input
                      placeholder="e.g. Stripe SQL interview questions"
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      className="bg-background/80 focus-visible:ring-primary/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Origin Source</label>
                    <select
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background/80 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {SOURCES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <Button type="submit" className="w-full relative overflow-hidden group mt-2" disabled={busy}>
                    {busy ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        AI Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Add to Library
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: List & Filter */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search & Category Filter */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              {/* Category selector */}
              <div className="flex flex-wrap gap-1.5 max-w-full overflow-x-auto pb-1 scrollbar-none">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setActiveCategory(cat.value)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                      activeCategory === cat.value
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                        : "bg-muted/80 text-muted-foreground hover:bg-muted/100 hover:text-foreground"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search through saved titles, summaries, tags, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-card/40 border-border/60 focus-visible:ring-primary/20"
              />
            </div>

            {/* Saves Feed */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-muted-foreground text-sm font-medium">Retrieving saved articles...</p>
              </div>
            ) : filteredSaves.length === 0 ? (
              <Card className="border-dashed border-2 py-16 text-center bg-card/20 border-muted-foreground/20">
                <CardContent className="flex flex-col items-center justify-center gap-4">
                  <div className="p-4 rounded-full bg-muted/60 text-muted-foreground">
                    <Bookmark className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">No resources found</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {searchQuery
                        ? "No results matched your search. Try adjusting filters or typing another query."
                        : "Start adding job postings, guides, and tips from LinkedIn or other channels to build your hub."}
                    </p>
                  </div>
                  {!searchQuery && (
                    <Button onClick={() => setForm({ ...form, url: "https://linkedin.com" })} variant="outline" size="sm">
                      Get Started
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredSaves.map((save) => (
                  <Card 
                    key={save.id} 
                    className="group border-border/60 bg-card/30 hover:bg-card/60 backdrop-blur-sm transition-all duration-300 hover:shadow-md hover:border-primary/20 relative overflow-hidden"
                  >
                    {save.is_interview_related && (
                      <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
                        <div className="bg-gradient-to-r from-accent to-primary text-white text-[9px] font-bold uppercase tracking-wider py-1 text-center rotate-45 translate-x-7 translate-y-3 shadow-sm w-36 flex items-center justify-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> Prep
                        </div>
                      </div>
                    )}
                    <CardContent className="p-5 md:p-6 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5 min-w-0">
                          {/* Title */}
                          <a 
                            href={save.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-bold text-base md:text-lg hover:text-primary transition-colors flex items-center gap-2 group/title"
                          >
                            <span className="truncate">{save.title || save.url}</span>
                            <ExternalLink className="w-4 h-4 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity" />
                          </a>
                          
                          {/* Source & Category Badges */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="outline" className={getSourceColor(save.source)}>
                              {save.source}
                            </Badge>
                            <Badge variant="secondary" className="bg-primary/5 text-primary hover:bg-primary/10 border-primary/10">
                              {save.category ? save.category.replace(/-/g, " ") : "uncategorized"}
                            </Badge>
                            <ProvenanceBadge classification={save.provenance?.classification ?? "unknown"} />
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {save.created_at ? formatDistanceToNow(new Date(save.created_at)) + " ago" : "recently"}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(save.id)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Summary */}
                      {save.summary && (
                        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40 text-sm text-foreground/80 leading-relaxed">
                          <div className="font-semibold text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            AI Summary
                            <span className="sr-only">This summary is an AI-produced transformation of the saved source.</span>
                          </div>
                          {save.summary}
                        </div>
                      )}

                      {/* Personal Note */}
                      {save.note && (
                        <div className="text-xs text-muted-foreground/85 flex items-start gap-1.5 pl-1.5">
                          <Bookmark className="w-3.5 h-3.5 shrink-0 text-muted-foreground mt-0.5" />
                          <span><strong className="text-foreground/80">My Note:</strong> {save.note}</span>
                        </div>
                      )}

                      {/* Tags */}
                      {save.tags && save.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {save.tags.map((tag, idx) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className="text-[10px] uppercase font-bold py-0.5 px-2 bg-muted/40 text-muted-foreground border-border/40"
                            >
                              <Tag className="w-2.5 h-2.5 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
