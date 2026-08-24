import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, Send, Plus, Trash2, Award, PieChart, CheckCircle2, AlertTriangle, Calendar, ChevronRight, Check, ToggleLeft, ToggleRight, Filter, X } from 'lucide-react';
import { AppShell } from '@/components/layout';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EvaluationReportPanel } from '../components/EvaluationReportPanel';
import { listCareerOpsPortals, createCareerOpsPortal, deleteCareerOpsPortal, updateCareerOpsPortal, scanCareerOpsPortals, getCareerOpsPatterns, listCareerOpsFollowups, actionCareerOpsFollowup, getCareerOpsStoryBank, saveCareerOpsStoryBank, deleteCareerOpsStoryBank, getCareerOpsStats } from '../api';

interface Portal {
  id?: number;
  name: string;
  careers_url: string;
  provider: string;
  enabled: boolean;
  keywords_override?: string[];
}

interface Followup {
  id: number;
  application_id: string;
  company: string;
  role: string;
  stage: string;
  age_days: number;
  followups_sent: number;
  urgency: string;
  reason: string;
  draft_subject: string;
  draft_body: string;
}

interface Story {
  requirement: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
}

interface Stats {
  total_portals: number;
  total_jobs_found: number;
  total_applications: number;
  active_scans: number;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

interface FilterState {
  minScore: string;
  keyword: string;
  lastNDays: string;
}

const FunnelStage = ({ label, pct, color }: { label: string; pct: number; color: string }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs">
      <span className="text-foreground/90 font-medium">{label}</span>
      <span className="text-muted-foreground tabular-nums">{pct}%</span>
    </div>
    <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  </div>
);

export const CareerOpsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scanner' | 'calibration' | 'followup' | 'storybank'>('scanner');

  const [portals, setPortals] = useState<Portal[]>([]);
  const [newPortalName, setNewPortalName] = useState('');
  const [newPortalUrl, setNewPortalUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any[]>([]);

  const [patterns, setPatterns] = useState<any>(null);

  const [followups, setFollowups] = useState<Followup[]>([]);
  const [sendingFollowupId, setSendingFollowupId] = useState<string | null>(null);
  const [followupNotes, setFollowupNotes] = useState('');
  const [followupContact, setFollowupContact] = useState('');

  const [stories, setStories] = useState<Story[]>([]);
  const [newStoryReq, setNewStoryReq] = useState('');
  const [newStoryS, setNewStoryS] = useState('');
  const [newStoryT, setNewStoryT] = useState('');
  const [newStoryA, setNewStoryA] = useState('');
  const [newStoryR, setNewStoryR] = useState('');
  const [newStoryRef, setNewStoryRef] = useState('');

  const [stats, setStats] = useState<Stats | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [evaluateAppId, setEvaluateAppId] = useState<string | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ minScore: '', keyword: '', lastNDays: '' });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({ minScore: '', keyword: '', lastNDays: '' });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchPortals();
    fetchPatterns();
    fetchFollowups();
    fetchStories();
    fetchStats();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!evaluateAppId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEvaluateAppId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [evaluateAppId]);

  const fetchStats = async () => {
    try {
      const data = await getCareerOpsStats();
      setStats(data as Stats);
    } catch {
      setPageError('Unable to load Career Ops statistics. Check the backend status and retry.');
    }
  };

  const fetchPortals = async () => {
    try {
      const data = await listCareerOpsPortals();
      setPortals(data.portals || []);
    } catch {
      setPageError('Unable to load configured scanner portals. Check the backend status and retry.');
    }
  };

  const fetchPatterns = async () => {
    try {
      const data = await getCareerOpsPatterns();
      setPatterns(data);
    } catch {
      setPageError('Unable to load Career Ops patterns. Check the backend status and retry.');
    }
  };

  const fetchFollowups = async () => {
    try {
      const data = await listCareerOpsFollowups();
      setFollowups(data.followups || []);
    } catch {
      setPageError('Unable to load follow-up items. Check the backend status and retry.');
    }
  };

  const fetchStories = async () => {
    try {
      const data = await getCareerOpsStoryBank();
      setStories(data.stories || []);
    } catch {
      setPageError('Unable to load the story bank. Check the backend status and retry.');
    }
  };

  const handleAddPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortalName || !newPortalUrl) return;
    try {
      await createCareerOpsPortal({ name: newPortalName, careers_url: newPortalUrl });
      setNewPortalName('');
      setNewPortalUrl('');
      fetchPortals();
      showToast('Portal added successfully', 'success');
    } catch {
      showToast('Failed to add portal', 'error');
    }
  };

  const handleDeletePortal = async (id: number) => {
    try {
      await deleteCareerOpsPortal(id);
      fetchPortals();
      showToast('Portal deleted', 'success');
    } catch {
      showToast('Failed to delete portal', 'error');
    }
  };

  const handleTogglePortal = async (p: Portal) => {
    if (!p.id) return;
    try {
      await updateCareerOpsPortal(p.id, { enabled: !p.enabled });
      fetchPortals();
    } catch {
      showToast('Failed to toggle portal', 'error');
    }
  };

  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      const data = await scanCareerOpsPortals();
      setScanResult(data.jobs || []);
      showToast('Scan completed', 'success');
    } catch {
      showToast('Scan failed', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleActionFollowup = async (appId: string) => {
    try {
      await actionCareerOpsFollowup(appId, { contact: followupContact, notes: followupNotes });
      setSendingFollowupId(null);
      setFollowupContact('');
      setFollowupNotes('');
      fetchFollowups();
      showToast('Follow-up recorded', 'success');
    } catch {
      showToast('Failed to record follow-up', 'error');
    }
  };

  const handleAddStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoryReq || !newStoryS || !newStoryT || !newStoryA || !newStoryR) return;
    const updated = [
      ...stories,
      {
        requirement: newStoryReq,
        situation: newStoryS,
        task: newStoryT,
        action: newStoryA,
        result: newStoryR,
        reflection: newStoryRef
      }
    ];
    try {
      await saveCareerOpsStoryBank(updated);
      setNewStoryReq('');
      setNewStoryS('');
      setNewStoryT('');
      setNewStoryA('');
      setNewStoryR('');
      setNewStoryRef('');
      fetchStories();
      showToast('Story saved', 'success');
    } catch {
      showToast('Failed to save story', 'error');
    }
  };

  const handleDeleteStory = async (idx: number) => {
    try {
      await deleteCareerOpsStoryBank(idx);
      fetchStories();
      showToast('Story deleted', 'success');
    } catch {
      showToast('Failed to delete story', 'error');
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'text-destructive bg-destructive/10 border-destructive/20';
      case 'overdue':
        return 'text-warning bg-warning/10 border-warning/20';
      case 'cold':
        return 'text-muted-foreground bg-muted border-border';
      default:
        return 'text-success bg-success/10 border-success/20';
    }
  };

  const applyFiltersToResults = () => {
    const f = appliedFilters;
    let results = [...scanResult];
    if (f.minScore) {
      const min = parseFloat(f.minScore);
      if (!isNaN(min)) results = results.filter((j: any) => (j.score || 0) >= min);
    }
    if (f.keyword) {
      const kw = f.keyword.toLowerCase();
      results = results.filter((j: any) =>
        (j.title || '').toLowerCase().includes(kw) ||
        (j.company || '').toLowerCase().includes(kw) ||
        (j.description || '').toLowerCase().includes(kw)
      );
    }
    if (f.lastNDays) {
      const n = parseInt(f.lastNDays, 10);
      if (!isNaN(n)) {
        const cutoff = Date.now() - n * 86400000;
        results = results.filter((j: any) => {
          if (!j.posted_date) return true;
          return new Date(j.posted_date).getTime() >= cutoff;
        });
      }
    }
    return results;
  };

  const filteredScanResult = applyFiltersToResults();

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6 animate-fade-in">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-[100] animate-slide-in">
            <div className={`px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-emerald-600/90 text-white border border-emerald-500/30'
                : 'bg-rose-600/90 text-white border border-rose-500/30'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {toast.message}
            </div>
          </div>
        )}

        {pageError && (
          <Alert variant="destructive" role="alert">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Career Ops data is unavailable</AlertTitle>
            <AlertDescription>{pageError} Existing local form state was not treated as persisted.</AlertDescription>
          </Alert>
        )}

        {/* Evaluate Drawer */}
        {evaluateAppId && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-xs"
              onClick={() => setEvaluateAppId(null)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Evaluation report"
              className="relative w-[500px] max-w-full h-full bg-card border-l border-border shadow-2xl overflow-y-auto"
            >
              <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between z-10">
                <span className="text-sm font-bold text-foreground">Evaluation Report</span>
                <Button variant="ghost" size="icon" onClick={() => setEvaluateAppId(null)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-4">
                <EvaluationReportPanel report={null as any} onClose={() => setEvaluateAppId(null)} />
              </div>
            </div>
          </div>
        )}

        {/* Page Header */}
        <PageHeader
          title="Career-Ops Command Center"
          description="Multi-agent job search orchestrator with zero-token portal scanners"
          breadcrumbs={[
            { label: "Dashboard", href: "/" },
            { label: "Career-Ops" },
          ]}
          actions={
            <Button
              onClick={handleTriggerScan}
              disabled={isScanning}
              variant="glow"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Scanning Portals...' : 'Scan Portals'}
            </Button>
          }
        />

        {/* Stats Bar */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-card border border-border space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Portals</span>
              <p className="text-2xl font-extrabold text-foreground tabular-nums">{stats.total_portals}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Jobs Found</span>
              <p className="text-2xl font-extrabold text-primary tabular-nums">{stats.total_jobs_found}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Applications</span>
              <p className="text-2xl font-extrabold text-emerald-500 tabular-nums">{stats.total_applications}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active Scans</span>
              <p className="text-2xl font-extrabold text-accent tabular-nums">{stats.active_scans}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border border-border gap-1.5 p-1 bg-muted/40 rounded-xl max-w-lg">
          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'scanner' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Portal Scanner
          </button>
          <button
            onClick={() => setActiveTab('calibration')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'calibration' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Calibration
          </button>
          <button
            onClick={() => setActiveTab('followup')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'followup' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Follow-up Cadence
          </button>
          <button
            onClick={() => setActiveTab('storybank')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'storybank' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Story Bank
          </button>
        </div>

        {/* Main View Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
            {/* Tab Content - Scanner */}
            {activeTab === 'scanner' && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-primary" /> Active Scanner Portals
                  </h2>

                  {portals.length === 0 ? (
                    <EmptyState
                      icon={<Terminal className="w-6 h-6" />}
                      title="No scanner portals configured"
                      description="Add a company careers URL below to start scanning for unlisted and newly open positions."
                      size="sm"
                    />
                  ) : (
                    <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-background/50">
                      {portals.map((p, idx) => (
                        <div key={idx} className="p-4 flex items-center justify-between hover:bg-muted/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleTogglePortal(p)} className="text-muted-foreground hover:text-primary transition-colors">
                              {p.enabled ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                            </button>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{p.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-md">{p.careers_url}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
                              {p.provider}
                            </Badge>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${p.enabled ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                              {p.enabled ? 'Active' : 'Disabled'}
                            </span>
                            <button onClick={() => p.id && handleDeletePortal(p.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddPortal} className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border pt-4">
                    <input
                      type="text"
                      value={newPortalName}
                      onChange={e => setNewPortalName(e.target.value)}
                      placeholder="Company Name (e.g. Anthropic)"
                      className="p-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                    <input
                      type="text"
                      value={newPortalUrl}
                      onChange={e => setNewPortalUrl(e.target.value)}
                      placeholder="Careers page URL"
                      className="p-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                    <Button type="submit" variant="default" className="flex items-center justify-center gap-1.5 h-auto py-3">
                      <Plus className="w-4 h-4" /> Add Portal
                    </Button>
                  </form>
                </div>

                {scanResult.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                    {/* Filter Panel */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                        Newly Discovered Positions (<span className="tabular-nums">{filteredScanResult.length}</span>)
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFilterOpen(!filterOpen)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Filter className="w-3.5 h-3.5 mr-1.5" /> Filters
                      </Button>
                    </div>

                    {filterOpen && (
                      <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Min Score</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={filters.minScore}
                              onChange={e => setFilters({ ...filters, minScore: e.target.value })}
                              placeholder="e.g. 4.0"
                              className="w-full p-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Keyword</label>
                            <input
                              type="text"
                              value={filters.keyword}
                              onChange={e => setFilters({ ...filters, keyword: e.target.value })}
                              placeholder="e.g. machine learning"
                              className="w-full p-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Last N Days</label>
                            <input
                              type="number"
                              min="1"
                              value={filters.lastNDays}
                              onChange={e => setFilters({ ...filters, lastNDays: e.target.value })}
                              placeholder="e.g. 30"
                              className="w-full p-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setFilters({ minScore: '', keyword: '', lastNDays: '' }); setAppliedFilters({ minScore: '', keyword: '', lastNDays: '' }); }}
                            className="text-xs"
                          >
                            Reset
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setAppliedFilters({ ...filters })}
                            className="text-xs font-semibold"
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {filteredScanResult.map((job, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-all flex justify-between items-start gap-4">
                          <div>
                            <h4 className="text-sm font-bold text-foreground">{job.title}</h4>
                            <div className="flex gap-2.5 items-center text-xs text-muted-foreground mt-1 font-medium">
                              <span className="text-foreground font-semibold">{job.company}</span>
                              <span>·</span>
                              <span>{job.location}</span>
                            </div>
                          </div>
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                          >
                            View JD <ChevronRight className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab Content - Calibration */}
            {activeTab === 'calibration' && patterns && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-xl bg-card border border-border space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Evaluated</span>
                    <p className="text-3xl font-extrabold text-foreground tabular-nums">{patterns.total_analyzed}</p>
                  </div>
                  <div className="p-5 rounded-xl bg-card border border-border space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Funnel Conversion</span>
                    <p className="text-3xl font-extrabold text-foreground tabular-nums">
                      {patterns.total_analyzed > 0 ? `${Math.round(((patterns.outcomes?.positive || 0) / patterns.total_analyzed) * 100)}%` : '0%'}
                    </p>
                  </div>
                  <div className="p-5 rounded-xl bg-card border border-border space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Positive Avg Score</span>
                    <p className="text-3xl font-extrabold text-emerald-500 tabular-nums">
                      {patterns.score_averages?.positive || 0.0}/5
                    </p>
                  </div>
                </div>

                {/* Funnel Chart */}
                <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <PieChart className="w-4.5 h-4.5 text-primary" /> Application Funnel
                  </h3>
                  <div className="space-y-3">
                    <FunnelStage label="Applications" pct={100} color="linear-gradient(90deg, #6366f1, #8b5cf6)" />
                    <FunnelStage label="Screened" pct={68} color="linear-gradient(90deg, #8b5cf6, #a855f7)" />
                    <FunnelStage label="Interview" pct={42} color="linear-gradient(90deg, #a855f7, #d946ef)" />
                    <FunnelStage label="Offer" pct={18} color="linear-gradient(90deg, #d946ef, #ec4899)" />
                    <FunnelStage label="Acceptance" pct={9} color="linear-gradient(90deg, #ec4899, #f43f5e)" />
                  </div>
                </div>

                {patterns.recommendations && patterns.recommendations.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                      <PieChart className="w-4.5 h-4.5 text-primary" /> Data-Driven Targeting Recommendations
                    </h3>
                    <div className="space-y-3">
                      {patterns.recommendations.map((rec: any, idx: number) => (
                        <div key={idx} className="p-4 rounded-xl border border-primary/15 bg-primary/5 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-foreground">{rec.action}</span>
                            <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20 uppercase tracking-wider">
                              {rec.impact} Impact
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{rec.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab Content - Follow-up */}
            {activeTab === 'followup' && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" /> Follow-up Cadence Tracker
                  </h2>

                  {followups.length === 0 ? (
                    <EmptyState
                      icon={<Calendar className="w-6 h-6" />}
                      title="No pending follow-ups"
                      description="All application follow-ups are up to date. Applications requiring cadenced communication will appear here."
                      size="sm"
                    />
                  ) : (
                    <div className="space-y-4">
                      {followups.map((f, idx) => (
                        <div key={idx} className="p-5 rounded-xl border border-border bg-card/60 space-y-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                              <h3 className="text-sm font-bold text-foreground">{f.role}</h3>
                              <p className="text-xs text-muted-foreground">
                                {f.company} · <span className="tabular-nums">{f.age_days}</span> days active
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getUrgencyColor(f.urgency)}`}>
                                {f.urgency}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEvaluateAppId(f.application_id)}
                                className="h-6 text-[10px] font-bold uppercase tracking-wider"
                              >
                                Evaluate
                              </Button>
                            </div>
                          </div>

                          {f.draft_body && (
                            <div className="space-y-2.5">
                              <div className="bg-muted/40 border border-border p-4 rounded-xl space-y-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">AI Voice DNA Follow-up Draft</span>
                                <pre className="text-xs text-foreground/90 font-mono whitespace-pre-wrap leading-relaxed">
                                  {f.draft_body}
                                </pre>
                              </div>

                              {sendingFollowupId === f.application_id ? (
                                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                                  <input
                                    type="text"
                                    placeholder="Recipient name / email"
                                    value={followupContact}
                                    onChange={e => setFollowupContact(e.target.value)}
                                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  />
                                  <textarea
                                    placeholder="Follow-up notes (e.g. Sent via email)"
                                    value={followupNotes}
                                    onChange={e => setFollowupNotes(e.target.value)}
                                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-20"
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <Button variant="ghost" size="sm" onClick={() => setSendingFollowupId(null)} className="text-xs">
                                      Cancel
                                    </Button>
                                    <Button size="sm" onClick={() => handleActionFollowup(f.application_id)} className="flex items-center gap-1 text-xs font-semibold">
                                      <Check className="w-3.5 h-3.5" /> Confirm Sent
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSendingFollowupId(f.application_id)}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary"
                                >
                                  <Send className="w-3.5 h-3.5" /> Record follow-up sent
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab Content - Story Bank */}
            {activeTab === 'storybank' && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary" /> STAR+Reflection Story Bank
                  </h2>

                  {stories.length === 0 ? (
                    <EmptyState
                      icon={<Award className="w-6 h-6" />}
                      title="No stories saved in story bank"
                      description="Build your library of impactful STAR+Reflection stories below to prepare for behavioral rounds."
                      size="sm"
                    />
                  ) : (
                    <div className="space-y-4">
                      {stories.map((st, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-border bg-card/60 space-y-3 relative">
                          <button
                            onClick={() => handleDeleteStory(idx)}
                            className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="border-b border-border pb-2">
                            <span className="text-xs font-bold text-foreground">Requirement: {st.requirement}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-2">
                              <p className="text-muted-foreground"><strong className="text-primary uppercase tracking-wider text-[10px]">Situation:</strong> {st.situation}</p>
                              <p className="text-muted-foreground"><strong className="text-primary uppercase tracking-wider text-[10px]">Task:</strong> {st.task}</p>
                              <p className="text-muted-foreground"><strong className="text-primary uppercase tracking-wider text-[10px]">Action:</strong> {st.action}</p>
                              <p className="text-muted-foreground"><strong className="text-primary uppercase tracking-wider text-[10px]">Result:</strong> {st.result}</p>
                            </div>
                            <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg space-y-1">
                              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">STAR Reflection</span>
                              <p className="text-foreground/90 leading-relaxed italic">"{st.reflection}"</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddStory} className="border-t border-border pt-5 space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add New STAR+R Story</h3>
                    <input
                      type="text"
                      value={newStoryReq}
                      onChange={e => setNewStoryReq(e.target.value)}
                      placeholder="JD Requirement / Topic (e.g. Scaling multi-node pipelines)"
                      className="w-full p-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <textarea
                        value={newStoryS}
                        onChange={e => setNewStoryS(e.target.value)}
                        placeholder="Situation (S)"
                        className="p-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-20"
                      />
                      <textarea
                        value={newStoryT}
                        onChange={e => setNewStoryT(e.target.value)}
                        placeholder="Task (T)"
                        className="p-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-20"
                      />
                      <textarea
                        value={newStoryA}
                        onChange={e => setNewStoryA(e.target.value)}
                        placeholder="Action (A)"
                        className="p-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-20"
                      />
                      <textarea
                        value={newStoryR}
                        onChange={e => setNewStoryR(e.target.value)}
                        placeholder="Result (R)"
                        className="p-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-20"
                      />
                    </div>
                    <textarea
                      value={newStoryRef}
                      onChange={e => setNewStoryRef(e.target.value)}
                      placeholder="Reflection (R - Lessons learned, key takeaways)"
                      className="w-full p-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-20"
                    />
                    <Button type="submit" variant="default" className="w-full h-auto py-3">
                      <Plus className="w-4 h-4 mr-1.5" /> Save Story
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Info Panels */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4.5 h-4.5 text-primary" /> Career-Ops Rules
              </h3>
              <div className="space-y-3.5 text-xs text-muted-foreground">
                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <p className="font-semibold text-foreground">1. Score Floor Guard</p>
                  <p className="text-muted-foreground mt-1">Applications scoring below 4.0/5.0 should be filtered out to preserve candidate energy.</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <p className="font-semibold text-foreground">2. Active Legitimacy Gating</p>
                  <p className="text-muted-foreground mt-1">Ghost jobs are identified by missing technical specifics or company layoff context.</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <p className="font-semibold text-foreground">3. Conversational Voice DNA</p>
                  <p className="text-muted-foreground mt-1">Follow-ups avoid "just checking in" clichés and are loaded with metric receipts.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default CareerOpsDashboard;
